import { mainPool, myWaschenPool } from '../../db/pool.js';
import { ATTENDANCE_UPLOAD_PUBLIC_PATH, deleteAttendancePhotoFile } from '../../middleware/upload.js';
import { emitDataChange } from '../../socket/io.js';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_DIST_M = 1000;

const getWibNow = () => new Date(Date.now() + WIB_OFFSET_MS);

/** Work-date: 00:00–03:59 WIB masih dihitung hari sebelumnya */
const getWorkDate = () => {
  const wib = getWibNow();
  const totalMin = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  if (totalMin < 240) {
    return new Date(wib.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  return wib.toISOString().slice(0, 10);
};

/** Jam absen terkunci 01:00–03:59 WIB; buka 05:00–23:59 & 00:00–00:59 */
export const getTimeStatus = () => {
  const wib = getWibNow();
  const totalMin = wib.getUTCHours() * 60 + wib.getUTCMinutes();

  const isLocked = totalMin >= 60 && totalMin < 240;
  const isOpen = (totalMin >= 300 && totalMin <= 1439) || (totalMin >= 0 && totalMin < 60);

  let lockReason = null;
  if (isLocked) {
    lockReason = 'Absensi terkunci pukul 01:00–03:59 WIB. Silakan coba lagi setelah jam 05:00.';
  } else if (!isOpen) {
    lockReason = 'Absensi hanya dapat dilakukan pukul 05:00–24:00 WIB.';
  }

  return { isOpen: isOpen && !isLocked, isLocked, lockReason, workDate: getWorkDate() };
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
    const workDate = getWorkDate();
    const timeStatus = getTimeStatus();

    const [rows] = await myWaschenPool.query(
      `SELECT attendance_id, outlet_id, work_date,
              check_in_time, check_in_lat, check_in_lng, check_in_photo_path, check_in_photo_name,
              check_out_time, check_out_lat, check_out_lng, check_out_photo_path, check_out_photo_name
       FROM tr_attendance
       WHERE employee_id = ? AND work_date = ?
       LIMIT 1`,
      [employeeId, workDate]
    );

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
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Foto selfie wajib diambil dari kamera.' });
    }

    const userId = req.user.user_id;
    const employeeId = req.user.employee_id;
    const { punch_type, lat, lng, outlet_id } = req.body;

    if (!['in', 'out'].includes(punch_type)) {
      return res.status(400).json({ success: false, message: 'Parameter punch_type tidak valid' });
    }

    const timeStatus = getTimeStatus();
    if (!timeStatus.isOpen) {
      return res.status(400).json({ success: false, message: timeStatus.lockReason });
    }

    const outletId = outlet_id || req.user.assignedOutletId;
    if (!outletId) {
      return res.status(400).json({ success: false, message: 'Outlet absensi belum dipilih.' });
    }

    const locCheck = await validateLocation(lat, lng, outletId);
    if (!locCheck.ok) {
      return res.status(400).json({ success: false, message: locCheck.message });
    }

    const workDate = getWorkDate();
    const photo_path = ATTENDANCE_UPLOAD_PUBLIC_PATH;
    const photo_name = req.file.filename;

    const [rows] = await myWaschenPool.query(
      'SELECT * FROM tr_attendance WHERE employee_id = ? AND work_date = ? LIMIT 1',
      [employeeId, workDate]
    );

    if (punch_type === 'in') {
      if (rows.length > 0 && rows[0].check_in_time) {
        return res.status(400).json({ success: false, message: 'Anda sudah absen masuk hari ini.' });
      }

      if (rows.length === 0) {
        await myWaschenPool.query(
          `INSERT INTO tr_attendance
           (user_id, employee_id, outlet_id, work_date, check_in_time, check_in_lat, check_in_lng, check_in_photo_path, check_in_photo_name)
           VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
          [userId, employeeId, outletId, workDate, lat, lng, photo_path, photo_name]
        );
      } else {
        await myWaschenPool.query(
          `UPDATE tr_attendance
           SET user_id=?, outlet_id=?, check_in_time=NOW(), check_in_lat=?, check_in_lng=?, check_in_photo_path=?, check_in_photo_name=?
           WHERE employee_id=? AND work_date=?`,
          [userId, outletId, lat, lng, photo_path, photo_name, employeeId, workDate]
        );
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
      return res.status(400).json({ success: false, message: 'Anda belum absen masuk hari ini.' });
    }
    if (rows[0].check_out_time) {
      return res.status(400).json({ success: false, message: 'Anda sudah absen keluar hari ini.' });
    }

    await myWaschenPool.query(
      `UPDATE tr_attendance
       SET check_out_time=NOW(), check_out_lat=?, check_out_lng=?, check_out_photo_path=?, check_out_photo_name=?, outlet_id=?
       WHERE employee_id=? AND work_date=?`,
      [lat, lng, photo_path, photo_name, outletId, employeeId, workDate]
    );

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

    const workDate = getWorkDate();
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

      await myWaschenPool.query(
        `UPDATE tr_attendance
         SET check_in_time=NULL, check_in_lat=NULL, check_in_lng=NULL,
             check_in_photo_path=NULL, check_in_photo_name=NULL
         WHERE employee_id=? AND work_date=?`,
        [employeeId, workDate]
      );

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

      await myWaschenPool.query(
        `UPDATE tr_attendance
         SET check_out_time=NULL, check_out_lat=NULL, check_out_lng=NULL,
             check_out_photo_path=NULL, check_out_photo_name=NULL
         WHERE employee_id=? AND work_date=?`,
        [employeeId, workDate]
      );
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
