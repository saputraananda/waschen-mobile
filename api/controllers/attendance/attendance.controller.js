import { mainPool, myWaschenPool } from '../../db/pool.js';
import { ATTENDANCE_UPLOAD_PUBLIC_PATH, deleteAttendancePhotoFile, deleteGroomingPhotoFile } from '../../middleware/upload.js';
import { emitDataChange } from '../../socket/io.js';
import { getAttendanceWorkDate, getWibHoursMinutes } from '../../utils/wib.js';
import { requiresGrooming, deriveGroomingStatus } from '../../utils/groomingCleanliness.js';
import {
  getTimeMasterConfig,
  evaluateAttendanceStatus,
  evaluateGroomingStatus,
  timeToMinutes,
  formatHm,
  getWorkDateNow
} from '../../utils/timeMaster.js';

const MAX_DIST_M = 1000;

/** Catatan absen masuk wajib bila absen lewat jam ini (menit dari 00:00 WIB). */
const NOTE_REQUIRED_AFTER_MIN = 8 * 60; // 08:00
const NOTE_MAX_LEN = 255;

const NOTE_REQUIRED_AFTER_HM = `${String(Math.floor(NOTE_REQUIRED_AFTER_MIN / 60)).padStart(2, '0')}:${String(NOTE_REQUIRED_AFTER_MIN % 60).padStart(2, '0')}`;

/** Menit WIB dari nilai DATETIME MySQL (Date maupun string 'YYYY-MM-DD HH:mm:ss'). */
function wibMinutesOf(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const m = value.match(/(\d{1,2}):(\d{2})/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const { hours, minutes } = getWibHoursMinutes(d);
  return hours * 60 + minutes;
}

/**
 * Catatan masuk wajib bila JAM ABSEN TERCATAT >= 08:00 WIB.
 * Sengaja memakai check_in_time, bukan jam sekarang — karyawan mengisi catatan
 * setelah absen, jadi jam pengisian tidak boleh mengubah kewajiban.
 */
const isCheckInNoteRequired = (checkInTime) => {
  const min = wibMinutesOf(checkInTime);
  return min != null && min >= NOTE_REQUIRED_AFTER_MIN;
};

/**
 * Validasi + normalisasi catatan absen.
 * Masuk: wajib bila absen masuk lewat 08:00 WIB. Pulang: selalu opsional.
 * @returns {{ ok: true, value: string|null } | { ok: false, message: string }}
 */
function normalizeNote(raw, { punchType, checkInTime }) {
  const text = String(raw ?? '').trim().replace(/\s+/g, ' ');

  if (!text) {
    if (punchType === 'in' && isCheckInNoteRequired(checkInTime)) {
      return {
        ok: false,
        message: `Absen masuk setelah pukul ${NOTE_REQUIRED_AFTER_HM} WIB wajib disertai catatan.`
      };
    }
    return { ok: true, value: null };
  }

  if (text.length > NOTE_MAX_LEN) {
    return { ok: false, message: `Catatan maksimal ${NOTE_MAX_LEN} karakter.` };
  }
  return { ok: true, value: text };
}

/**
 * Gate absen pulang: Frontliner / Delivery Staff yang grooming-nya belum lengkap
 * wajib mengisi alasan dulu. Tanpa alasan, absen keluar ditolak.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
async function checkGroomingGateForCheckout(attendanceRow, role) {
  if (!requiresGrooming(role)) return { ok: true };

  const cfg = await getTimeMasterConfig();
  const gCfg = cfg.grooming;
  if (Number(gCfg.feature_enabled) !== 1) return { ok: true };

  const { hours, minutes } = getWibHoursMinutes();
  const gEval = evaluateGroomingStatus(gCfg, hours * 60 + minutes);
  // Sebelum jam kunci karyawan masih bisa melengkapi foto; jangan blokir dulu.
  if (!gEval.pastLock || Number(gCfg.require_reason_after_lock) !== 1) return { ok: true };

  let photoCount = 0;
  try {
    const [cnt] = await myWaschenPool.query(
      'SELECT COUNT(*) AS n FROM tr_attendance_grooming_photo WHERE attendance_id = ?',
      [attendanceRow.attendance_id]
    );
    photoCount = Number(cnt[0]?.n || 0);
  } catch (err) {
    // Tabel grooming belum ada → jangan kunci absen pulang.
    if (err.code === 'ER_NO_SUCH_TABLE') return { ok: true };
    throw err;
  }

  if (deriveGroomingStatus(photoCount, role) === 'lengkap') return { ok: true };

  const reason = String(attendanceRow.grooming_incomplete_reason || '').trim();
  if (reason) return { ok: true };

  return {
    ok: false,
    message: `Grooming belum lengkap dan terkunci sejak pukul ${formatHm(gCfg.lock_after_time)} WIB. Isi alasan grooming dulu sebelum absen pulang.`
  };
}

/** Jam absen dari mst_time_attendance (fallback hardcode di timeMaster) */
export const getTimeStatus = async () => {
  const { hours, minutes } = getWibHoursMinutes();
  const totalMin = hours * 60 + minutes;
  const cfg = await getTimeMasterConfig();
  const att = cfg.attendance;
  const evaluated = evaluateAttendanceStatus(att, totalMin);
  const workDate = await getWorkDateNow();

  return {
    isOpen: evaluated.isOpen,
    isLocked: evaluated.isLocked,
    lockReason: evaluated.lockReason,
    workDate,
    // Catatan diisi setelah absen; wajib/tidaknya dihitung dari jam absen tercatat,
    // jadi di sini cukup kirim ambang + batas panjang.
    note: {
      requiredAfter: formatHm(NOTE_REQUIRED_AFTER_HM),
      maxLength: NOTE_MAX_LEN
    },
    windows: {
      open: formatHm(att.open_time),
      close: formatHm(att.close_time),
      lockEnabled: Number(att.lock_enabled) === 1,
      lockStart: formatHm(att.lock_start_time),
      lockEnd: formatHm(att.lock_end_time),
      workDateCutoff: formatHm(att.work_date_cutoff_time)
    }
  };
};

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const buildPhotoUrl = (req, photoPath, photoName) => {
  if (!photoPath || !photoName) return null;
  const normalized = photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
  return `${req.protocol}://${req.get('host')}${normalized}/${encodeURIComponent(photoName)}`;
};

async function getOutletById(outletId) {
  const [rows] = await mainPool.query(
    'SELECT id, name, full_name, address, lat, lon FROM mst_outlet WHERE id = ? LIMIT 1',
    [outletId]
  );
  return rows[0] || null;
}

async function validateLocation(lat, lng, outletId) {
  if (lat == null || lng == null) {
    return { ok: false, message: 'Lokasi tidak tersedia. Aktifkan GPS dan izinkan akses lokasi.' };
  }

  const outlet = await getOutletById(outletId);
  if (!outlet) {
    return { ok: false, message: 'Outlet tidak ditemukan.' };
  }

  const oLat = parseFloat(outlet.lat);
  const oLng = parseFloat(outlet.lon);
  if (!Number.isFinite(oLat) || !Number.isFinite(oLng)) {
    return { ok: false, message: 'Koordinat outlet belum dikonfigurasi. Hubungi admin.' };
  }

  const dist = haversineMeters(parseFloat(lat), parseFloat(lng), oLat, oLng);
  if (dist > MAX_DIST_M) {
    return {
      ok: false,
      message: `Anda berada ${Math.round(dist)} meter dari ${outlet.full_name || outlet.name}. Maksimal ${MAX_DIST_M / 1000} km.`,
      distance: dist,
      outlet
    };
  }

  return { ok: true, distance: dist, outlet };
}

/**
 * GET /api/attendance/today
 */
export const getTodayAttendance = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const workDate = await getWorkDateNow();
    const timeStatus = await getTimeStatus();

    let rows;
    try {
      [rows] = await myWaschenPool.query(
        `SELECT attendance_id, outlet_id, work_date,
                check_in_time, check_in_lat, check_in_lng, check_in_photo_path, check_in_photo_name, check_in_note,
                check_out_time, check_out_lat, check_out_lng, check_out_photo_path, check_out_photo_name, check_out_note,
                grooming_status, grooming_incomplete_reason, grooming_locked_at
         FROM tr_attendance
         WHERE employee_id = ? AND work_date = ?
         LIMIT 1`,
        [employeeId, workDate]
      );
    } catch (colErr) {
      if (colErr.code !== 'ER_BAD_FIELD_ERROR') throw colErr;
      [rows] = await myWaschenPool.query(
        `SELECT attendance_id, outlet_id, work_date,
                check_in_time, check_in_lat, check_in_lng, check_in_photo_path, check_in_photo_name,
                check_out_time, check_out_lat, check_out_lng, check_out_photo_path, check_out_photo_name
         FROM tr_attendance
         WHERE employee_id = ? AND work_date = ?
         LIMIT 1`,
        [employeeId, workDate]
      );
    }

    let record = null;
    if (rows.length > 0) {
      record = rows[0];
      record.check_in_photo_url = buildPhotoUrl(req, record.check_in_photo_path, record.check_in_photo_name);
      record.check_out_photo_url = buildPhotoUrl(req, record.check_out_photo_path, record.check_out_photo_name);
    }

    let assignedOutlet = null;
    if (req.user.assignedOutletId) {
      assignedOutlet = await getOutletById(req.user.assignedOutletId);
    }

    return res.status(200).json({
      success: true,
      message: 'Data absensi hari ini',
      data: {
        record,
        workDate,
        timeStatus,
        assignedOutletId: req.user.assignedOutletId,
        assignedOutlet,
        maxDistanceM: MAX_DIST_M
      }
    });
  } catch (error) {
    console.error('getTodayAttendance error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Tabel tr_attendance belum tersedia di database myWaschen. Jalankan DDL di agent/tr_attendance.sql terlebih dahulu.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal mengambil data absensi', error: error.message });
  }
};

/**
 * GET /api/attendance/outlets
 */
export const getOutlets = async (req, res) => {
  try {
    const [rows] = await mainPool.query(
      'SELECT id, name, full_name, address, lat, lon FROM mst_outlet ORDER BY name ASC'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('getOutlets error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar outlet', error: error.message });
  }
};

/**
 * POST /api/attendance/check-location
 * Body: { lat, lng, outlet_id }
 */
export const checkLocation = async (req, res) => {
  try {
    const { lat, lng, outlet_id } = req.body;
    const outletId = outlet_id || req.user.assignedOutletId;

    if (!outletId) {
      return res.status(400).json({ success: false, message: 'Outlet belum ditetapkan untuk akun Anda.' });
    }

    const result = await validateLocation(lat, lng, outletId);
    return res.status(200).json({
      success: true,
      data: {
        inZone: result.ok,
        distance: result.distance != null ? Math.round(result.distance) : null,
        maxDistanceM: MAX_DIST_M,
        outlet: result.outlet || null,
        message: result.ok ? 'Anda berada dalam zona outlet.' : result.message
      }
    });
  } catch (error) {
    console.error('checkLocation error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memeriksa lokasi', error: error.message });
  }
};

/**
 * POST /api/attendance/punch-selfie (multipart)
 * Fields: punch_type (in|out), lat, lng, outlet_id, selfie(file)
 */
export const punchSelfie = async (req, res) => {
  const uploadedName = req.file?.filename || null;
  const cleanupUpload = async () => {
    if (uploadedName) await deleteAttendancePhotoFile(uploadedName);
  };

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Foto selfie wajib diambil dari kamera.' });
    }

    const userId = req.user.user_id;
    const employeeId = req.user.employee_id;
    const { punch_type, lat, lng, outlet_id } = req.body;

    if (!['in', 'out'].includes(punch_type)) {
      await cleanupUpload();
      return res.status(400).json({ success: false, message: 'Parameter punch_type tidak valid' });
    }

    const timeStatus = await getTimeStatus();
    if (!timeStatus.isOpen) {
      await cleanupUpload();
      return res.status(400).json({ success: false, message: timeStatus.lockReason });
    }

    const outletId = outlet_id || req.user.assignedOutletId;
    if (!outletId) {
      await cleanupUpload();
      return res.status(400).json({ success: false, message: 'Outlet absensi belum dipilih.' });
    }

    const locCheck = await validateLocation(lat, lng, outletId);
    if (!locCheck.ok) {
      await cleanupUpload();
      return res.status(400).json({ success: false, message: locCheck.message });
    }

    const workDate = await getWorkDateNow();
    const photo_path = ATTENDANCE_UPLOAD_PUBLIC_PATH;
    const photo_name = req.file.filename;

    let employeeRole = null;
    try {
      const [roleRows] = await myWaschenPool.query(
        'SELECT role FROM mst_role WHERE employee_id = ? LIMIT 1',
        [employeeId]
      );
      employeeRole = roleRows[0]?.role || null;
    } catch (_) { /* optional */ }
    const groomingStatus = requiresGrooming(employeeRole) ? 'kosong' : 'tidak_wajib';

    const [rows] = await myWaschenPool.query(
      'SELECT * FROM tr_attendance WHERE employee_id = ? AND work_date = ? LIMIT 1',
      [employeeId, workDate]
    );

    if (punch_type === 'in') {
      if (rows.length > 0 && rows[0].check_in_time) {
        await cleanupUpload();
        return res.status(400).json({ success: false, message: 'Anda sudah absen masuk hari ini.' });
      }

      if (rows.length === 0) {
        try {
          await myWaschenPool.query(
            `INSERT INTO tr_attendance
             (user_id, employee_id, outlet_id, work_date, check_in_time, check_in_lat, check_in_lng,
              check_in_photo_path, check_in_photo_name, grooming_status)
             VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
            [userId, employeeId, outletId, workDate, lat, lng, photo_path, photo_name, groomingStatus]
          );
        } catch (insErr) {
          if (insErr.code !== 'ER_BAD_FIELD_ERROR') throw insErr;
          await myWaschenPool.query(
            `INSERT INTO tr_attendance
             (user_id, employee_id, outlet_id, work_date, check_in_time, check_in_lat, check_in_lng, check_in_photo_path, check_in_photo_name)
             VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
            [userId, employeeId, outletId, workDate, lat, lng, photo_path, photo_name]
          );
        }
      } else {
        const oldInPhoto = rows[0].check_in_photo_name;
        try {
          await myWaschenPool.query(
            `UPDATE tr_attendance
             SET user_id=?, outlet_id=?, check_in_time=NOW(), check_in_lat=?, check_in_lng=?,
                 check_in_photo_path=?, check_in_photo_name=?, check_in_note=NULL,
                 grooming_status=COALESCE(NULLIF(grooming_status,''), ?)
             WHERE employee_id=? AND work_date=?`,
            [userId, outletId, lat, lng, photo_path, photo_name, groomingStatus, employeeId, workDate]
          );
        } catch (updErr) {
          if (updErr.code !== 'ER_BAD_FIELD_ERROR') throw updErr;
          await myWaschenPool.query(
            `UPDATE tr_attendance
             SET user_id=?, outlet_id=?, check_in_time=NOW(), check_in_lat=?, check_in_lng=?, check_in_photo_path=?, check_in_photo_name=?
             WHERE employee_id=? AND work_date=?`,
            [userId, outletId, lat, lng, photo_path, photo_name, employeeId, workDate]
          );
        }
        if (oldInPhoto && oldInPhoto !== photo_name) {
          await deleteAttendancePhotoFile(oldInPhoto);
        }
      }

      emitDataChange({
        domain: 'attendance',
        outletId,
        employeeId,
        action: 'check_in'
      });
      emitDataChange({ domain: 'history', employeeId, action: 'check_in' });
      return res.status(200).json({ success: true, message: 'Absen masuk berhasil dicatat.' });
    }

    if (rows.length === 0 || !rows[0].check_in_time) {
      await cleanupUpload();
      return res.status(400).json({ success: false, message: 'Anda belum absen masuk hari ini.' });
    }
    if (rows[0].check_out_time) {
      await cleanupUpload();
      return res.status(400).json({ success: false, message: 'Anda sudah absen keluar hari ini.' });
    }

    const groomingGate = await checkGroomingGateForCheckout(rows[0], employeeRole);
    if (!groomingGate.ok) {
      await cleanupUpload();
      return res.status(422).json({ success: false, message: groomingGate.message, code: 'GROOMING_REASON_REQUIRED' });
    }

    const oldOutPhoto = rows[0].check_out_photo_name;
    try {
      await myWaschenPool.query(
        `UPDATE tr_attendance
         SET check_out_time=NOW(), check_out_lat=?, check_out_lng=?,
             check_out_photo_path=?, check_out_photo_name=?, check_out_note=NULL, outlet_id=?
         WHERE employee_id=? AND work_date=?`,
        [lat, lng, photo_path, photo_name, outletId, employeeId, workDate]
      );
    } catch (updErr) {
      if (updErr.code !== 'ER_BAD_FIELD_ERROR') throw updErr;
      await myWaschenPool.query(
        `UPDATE tr_attendance
         SET check_out_time=NOW(), check_out_lat=?, check_out_lng=?, check_out_photo_path=?, check_out_photo_name=?, outlet_id=?
         WHERE employee_id=? AND work_date=?`,
        [lat, lng, photo_path, photo_name, outletId, employeeId, workDate]
      );
    }
    if (oldOutPhoto && oldOutPhoto !== photo_name) {
      await deleteAttendancePhotoFile(oldOutPhoto);
    }

    emitDataChange({
      domain: 'attendance',
      outletId,
      employeeId,
      action: 'check_out'
    });
    emitDataChange({ domain: 'history', employeeId, action: 'check_out' });
    return res.status(200).json({ success: true, message: 'Absen keluar berhasil dicatat.' });
  } catch (error) {
    console.error('punchSelfie error:', error);
    await cleanupUpload();
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Tabel tr_attendance belum tersedia di database myWaschen. Jalankan DDL di agent/tr_attendance.sql terlebih dahulu.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal menyimpan absensi', error: error.message });
  }
};

/**
 * POST /api/attendance/note
 * Body: { punch_type: 'in'|'out', note }
 * Catatan diisi SETELAH absen tersimpan. Wajib untuk absen masuk >= 08:00 WIB.
 */
export const savePunchNote = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const { punch_type, note } = req.body;

    if (!['in', 'out'].includes(punch_type)) {
      return res.status(400).json({ success: false, message: 'Parameter punch_type tidak valid' });
    }

    const workDate = await getWorkDateNow();
    const [rows] = await myWaschenPool.query(
      'SELECT check_in_time, check_out_time FROM tr_attendance WHERE employee_id = ? AND work_date = ? LIMIT 1',
      [employeeId, workDate]
    );
    const rec = rows[0];
    const punchTime = punch_type === 'in' ? rec?.check_in_time : rec?.check_out_time;
    if (!punchTime) {
      return res.status(400).json({
        success: false,
        message: punch_type === 'in' ? 'Anda belum absen masuk hari ini.' : 'Anda belum absen pulang hari ini.'
      });
    }

    const check = normalizeNote(note, { punchType: punch_type, checkInTime: rec.check_in_time });
    if (!check.ok) {
      return res.status(422).json({ success: false, message: check.message });
    }

    const column = punch_type === 'in' ? 'check_in_note' : 'check_out_note';
    await myWaschenPool.query(
      `UPDATE tr_attendance SET ${column}=? WHERE employee_id=? AND work_date=?`,
      [check.value, employeeId, workDate]
    );

    emitDataChange({ domain: 'attendance', employeeId, action: `note_${punch_type}` });
    return res.status(200).json({ success: true, message: 'Catatan tersimpan.', data: { note: check.value } });
  } catch (error) {
    console.error('savePunchNote error:', error);
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({
        success: false,
        message: 'Kolom catatan belum ada. Jalankan DDL di agent/tr_attendance_note.sql terlebih dahulu.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal menyimpan catatan', error: error.message });
  }
};

/**
 * POST /api/attendance/delete-punch
 * Body: { punch_type: 'in'|'out' }
 * Hapus foto di server dan reset data absen agar bisa absen ulang.
 */
export const deletePunch = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const { punch_type } = req.body;

    if (!['in', 'out'].includes(punch_type)) {
      return res.status(400).json({ success: false, message: 'Parameter punch_type tidak valid' });
    }

    const workDate = await getWorkDateNow();
    let photoName = null;

    if (punch_type === 'in') {
      const [existing] = await myWaschenPool.query(
        `SELECT check_in_time, check_in_photo_name, check_out_time
         FROM tr_attendance
         WHERE employee_id = ? AND work_date = ?
         LIMIT 1`,
        [employeeId, workDate]
      );

      if (existing.length === 0 || !existing[0].check_in_time) {
        return res.status(400).json({ success: false, message: 'Data absen masuk tidak ditemukan.' });
      }

      if (existing[0].check_out_time) {
        return res.status(400).json({
          success: false,
          message: 'Tidak dapat menghapus absen masuk karena absen pulang sudah tercatat.'
        });
      }

      photoName = existing[0].check_in_photo_name;

      // Hapus foto grooming milik absensi ini sebelum reset check-in
      try {
        const [gPhotos] = await myWaschenPool.query(
          `SELECT photo_name FROM tr_attendance_grooming_photo
           WHERE employee_id = ? AND work_date = ?`,
          [employeeId, workDate]
        );
        for (const gp of gPhotos) {
          await deleteGroomingPhotoFile(gp.photo_name);
        }
        await myWaschenPool.query(
          `DELETE FROM tr_attendance_grooming_photo WHERE employee_id = ? AND work_date = ?`,
          [employeeId, workDate]
        );
      } catch (_) { /* tabel mungkin belum ada */ }

      try {
        await myWaschenPool.query(
          `UPDATE tr_attendance
           SET check_in_time=NULL, check_in_lat=NULL, check_in_lng=NULL,
               check_in_photo_path=NULL, check_in_photo_name=NULL, check_in_note=NULL
           WHERE employee_id=? AND work_date=?`,
          [employeeId, workDate]
        );
      } catch (updErr) {
        if (updErr.code !== 'ER_BAD_FIELD_ERROR') throw updErr;
        await myWaschenPool.query(
          `UPDATE tr_attendance
           SET check_in_time=NULL, check_in_lat=NULL, check_in_lng=NULL,
               check_in_photo_path=NULL, check_in_photo_name=NULL
           WHERE employee_id=? AND work_date=?`,
          [employeeId, workDate]
        );
      }

      await myWaschenPool.query(
        `DELETE FROM tr_attendance
         WHERE employee_id=? AND work_date=?
           AND check_in_time IS NULL AND check_out_time IS NULL`,
        [employeeId, workDate]
      );
    } else {
      const [existing] = await myWaschenPool.query(
        `SELECT check_out_photo_name, check_out_time
         FROM tr_attendance
         WHERE employee_id = ? AND work_date = ?
         LIMIT 1`,
        [employeeId, workDate]
      );

      if (existing.length === 0 || !existing[0].check_out_time) {
        return res.status(400).json({ success: false, message: 'Data absen pulang tidak ditemukan.' });
      }

      photoName = existing[0].check_out_photo_name;

      try {
        await myWaschenPool.query(
          `UPDATE tr_attendance
           SET check_out_time=NULL, check_out_lat=NULL, check_out_lng=NULL,
               check_out_photo_path=NULL, check_out_photo_name=NULL, check_out_note=NULL
           WHERE employee_id=? AND work_date=?`,
          [employeeId, workDate]
        );
      } catch (updErr) {
        if (updErr.code !== 'ER_BAD_FIELD_ERROR') throw updErr;
        await myWaschenPool.query(
          `UPDATE tr_attendance
           SET check_out_time=NULL, check_out_lat=NULL, check_out_lng=NULL,
               check_out_photo_path=NULL, check_out_photo_name=NULL
           WHERE employee_id=? AND work_date=?`,
          [employeeId, workDate]
        );
      }
    }

    if (photoName) {
      await deleteAttendancePhotoFile(photoName);
    }

    return res.status(200).json({
      success: true,
      message: 'Absensi berhasil dihapus. Silakan absen ulang.'
    });
  } catch (error) {
    console.error('deletePunch error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus absensi', error: error.message });
  }
};
