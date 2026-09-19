import { mainPool, myWaschenPool } from '../../db/pool.js';
import {
  GROOMING_UPLOAD_PUBLIC_PATH,
  CLEANLINESS_UPLOAD_PUBLIC_PATH,
  deleteGroomingPhotoFile,
  deleteCleanlinessPhotoFile
} from '../../middleware/upload.js';
import { emitDataChange } from '../../socket/io.js';
import { getWibHoursMinutes } from '../../utils/wib.js';
import {
  GROOMING_STEPS,
  GROOMING_STEP_CODES,
  requiresGrooming,
  requiresCleanliness,
  cleanlinessAreaLabel,
  deriveGroomingStatus
} from '../../utils/groomingCleanliness.js';
import {
  getTimeMasterConfig,
  evaluateGroomingStatus,
  getWorkDateNow,
  formatHm
} from '../../utils/timeMaster.js';

const buildPhotoUrl = (req, photoPath, photoName) => {
  if (!photoPath || !photoName) return null;
  const normalized = photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
  return `${req.protocol}://${req.get('host')}${normalized}/${encodeURIComponent(photoName)}`;
};

async function getGroomingEval() {
  const { hours, minutes } = getWibHoursMinutes();
  const totalMin = hours * 60 + minutes;
  const cfg = await getTimeMasterConfig();
  return { cfg: cfg.grooming, eval: evaluateGroomingStatus(cfg.grooming, totalMin) };
}

async function getEmployeeRole(employeeId) {
  const [rows] = await myWaschenPool.query(
    'SELECT role, outlet_id, employee_name FROM mst_role WHERE employee_id = ? LIMIT 1',
    [employeeId]
  );
  return rows[0] || null;
}

async function getEmployeeDisplayName(employeeId, fallbackName = null) {
  if (fallbackName) return fallbackName;
  try {
    const [rows] = await mainPool.query(
      'SELECT full_name FROM mst_employee WHERE employee_id = ? LIMIT 1',
      [employeeId]
    );
    return rows[0]?.full_name || null;
  } catch (_) {
    return null;
  }
}

async function syncGroomingStatus(attendanceId, role, photoCount, reason = undefined) {
  const status = deriveGroomingStatus(photoCount, role);
  const { eval: gEval } = await getGroomingEval();
  const locked = gEval.pastLock && requiresGrooming(role) && status !== 'lengkap';
  const params = [status];
  let sql = 'UPDATE tr_attendance SET grooming_status = ?';
  if (locked) {
    sql += ', grooming_locked_at = COALESCE(grooming_locked_at, NOW())';
  }
  if (reason !== undefined) {
    sql += ', grooming_incomplete_reason = ?';
    params.push(reason);
  }
  sql += ' WHERE attendance_id = ?';
  params.push(attendanceId);
  await myWaschenPool.query(sql, params);
  return status;
}

async function loadGroomingBundle(req, attendance, role) {
  const { cfg, eval: gEval } = await getGroomingEval();
  const featureOn = Number(cfg.feature_enabled) === 1;
  const needGrooming = featureOn && requiresGrooming(role);
  const windowsMeta = {
    featureEnabled: featureOn,
    window1: `${formatHm(cfg.window1_start)}–${formatHm(cfg.window1_end)}`,
    window2: Number(cfg.window2_enabled) ? `${formatHm(cfg.window2_start)}–${formatHm(cfg.window2_end)}` : null,
    lockAfter: formatHm(cfg.lock_after_time),
    lockEnabled: Number(cfg.lock_enabled) === 1
  };

  if (!attendance?.attendance_id || !needGrooming) {
    return {
      required: needGrooming,
      status: attendance?.grooming_status || (needGrooming ? 'kosong' : 'tidak_wajib'),
      incompleteReason: attendance?.grooming_incomplete_reason || null,
      lockedAt: attendance?.grooming_locked_at || null,
      featureEnabled: featureOn,
      windowOpen: gEval.windowOpen,
      pastLock: gEval.pastLock,
      steps: GROOMING_STEPS.map((s) => ({ ...s, photo: null })),
      doneCount: 0,
      totalSteps: GROOMING_STEPS.length,
      windows: windowsMeta
    };
  }

  const [photos] = await myWaschenPool.query(
    `SELECT grooming_photo_id, step_code, photo_path, photo_name, taken_at, taken_by_name, lat, lng
     FROM tr_attendance_grooming_photo
     WHERE attendance_id = ?
     ORDER BY grooming_photo_id ASC`,
    [attendance.attendance_id]
  );

  const byStep = new Map(photos.map((p) => [p.step_code, p]));
  const steps = GROOMING_STEPS.map((s) => {
    const p = byStep.get(s.code);
    return {
      ...s,
      photo: p
        ? {
            id: p.grooming_photo_id,
            url: buildPhotoUrl(req, p.photo_path, p.photo_name),
            taken_at: p.taken_at,
            taken_by_name: p.taken_by_name,
            lat: p.lat,
            lng: p.lng
          }
        : null
    };
  });

  const doneCount = steps.filter((s) => s.photo).length;
  const status = await syncGroomingStatus(attendance.attendance_id, role, doneCount);

  return {
    required: true,
    status,
    incompleteReason: attendance.grooming_incomplete_reason || null,
    lockedAt: attendance.grooming_locked_at || null,
    featureEnabled: featureOn,
    windowOpen: gEval.windowOpen,
    pastLock: gEval.pastLock,
    canUpload: gEval.windowOpen && Boolean(attendance.check_in_time),
    needsReason: gEval.needsReasonGate && status !== 'lengkap' && !attendance.grooming_incomplete_reason,
    steps,
    doneCount,
    totalSteps: GROOMING_STEPS.length,
    windows: windowsMeta
  };
}

async function loadCleanlinessBundle(req, outletId, role, workDate) {
  const need = requiresCleanliness(role);
  if (!need || !outletId) {
    return {
      required: false,
      areaLabel: cleanlinessAreaLabel(role),
      photoCount: 0,
      unlocked: true,
      photos: []
    };
  }

  const [photos] = await myWaschenPool.query(
    `SELECT cleanliness_photo_id, uploaded_by_employee_id, uploaded_by_name,
            photo_path, photo_name, taken_at, lat, lng, attendance_id
     FROM tr_attendance_cleanliness_photo
     WHERE outlet_id = ? AND role_code = ? AND work_date = ?
     ORDER BY taken_at DESC, cleanliness_photo_id DESC`,
    [outletId, role, workDate]
  );

  return {
    required: true,
    areaLabel: cleanlinessAreaLabel(role),
    roleCode: role,
    photoCount: photos.length,
    unlocked: photos.length >= 1,
    photos: photos.map((p) => ({
      id: p.cleanliness_photo_id,
      url: buildPhotoUrl(req, p.photo_path, p.photo_name),
      taken_at: p.taken_at,
      uploaded_by_employee_id: p.uploaded_by_employee_id,
      uploaded_by_name: p.uploaded_by_name,
      is_mine: Number(p.uploaded_by_employee_id) === Number(req.user?.employee_id),
      lat: p.lat,
      lng: p.lng,
      attendance_id: p.attendance_id
    }))
  };
}

/**
 * GET /api/attendance/grooming-cleanliness
 */
export const getGroomingCleanliness = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const workDate = await getWorkDateNow();
    const roleRow = await getEmployeeRole(employeeId);
    const role = roleRow?.role || null;
    const outletId = req.user.assignedOutletId || roleRow?.outlet_id || null;

    const [rows] = await myWaschenPool.query(
      `SELECT attendance_id, outlet_id, work_date, check_in_time, check_out_time,
              grooming_status, grooming_incomplete_reason, grooming_locked_at
       FROM tr_attendance
       WHERE employee_id = ? AND work_date = ?
       LIMIT 1`,
      [employeeId, workDate]
    );
    const attendance = rows[0] || null;
    const effectiveOutletId = attendance?.outlet_id || outletId;

    const grooming = await loadGroomingBundle(req, attendance, role);
    const cleanliness = await loadCleanlinessBundle(req, effectiveOutletId, role, workDate);

    return res.json({
      success: true,
      data: {
        workDate,
        role,
        outletId: effectiveOutletId,
        hasCheckIn: Boolean(attendance?.check_in_time),
        attendanceId: attendance?.attendance_id || null,
        grooming,
        cleanliness,
        progressGate: {
          required: requiresCleanliness(role),
          unlocked: !requiresCleanliness(role) || cleanliness.unlocked,
          photoCount: cleanliness.photoCount,
          message: requiresCleanliness(role) && !cleanliness.unlocked
            ? `Upload foto kebersihan (${cleanliness.areaLabel}) dulu sebelum Update Progress.`
            : null
        }
      }
    });
  } catch (error) {
    console.error('getGroomingCleanliness error:', error);
    if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Schema grooming/kebersihan belum tersedia. Jalankan DDL agent/tr_attendance_grooming_cleanliness.sql.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal memuat grooming/kebersihan', error: error.message });
  }
};

/**
 * GET /api/attendance/progress-gate
 */
export const getProgressGate = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const workDate = await getWorkDateNow();
    const roleRow = await getEmployeeRole(employeeId);
    const role = roleRow?.role || null;
    const outletId = req.user.assignedOutletId || roleRow?.outlet_id || null;

    if (!requiresCleanliness(role)) {
      return res.json({
        success: true,
        data: { required: false, unlocked: true, photoCount: 0, role, outletId, workDate, message: null }
      });
    }

    if (!outletId) {
      return res.json({
        success: true,
        data: {
          required: true,
          unlocked: false,
          photoCount: 0,
          role,
          outletId: null,
          workDate,
          message: 'Outlet belum ditetapkan. Absensi & foto kebersihan diperlukan.'
        }
      });
    }

    const [cnt] = await myWaschenPool.query(
      `SELECT COUNT(*) AS n FROM tr_attendance_cleanliness_photo
       WHERE outlet_id = ? AND role_code = ? AND work_date = ?`,
      [outletId, role, workDate]
    );
    const photoCount = Number(cnt[0]?.n || 0);
    const unlocked = photoCount >= 1;

    return res.json({
      success: true,
      data: {
        required: true,
        unlocked,
        photoCount,
        role,
        outletId,
        workDate,
        areaLabel: cleanlinessAreaLabel(role),
        message: unlocked
          ? null
          : `Upload foto kebersihan (${cleanlinessAreaLabel(role)}) dulu sebelum Update Progress.`
      }
    });
  } catch (error) {
    console.error('getProgressGate error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        data: { required: false, unlocked: true, photoCount: 0, message: null, schemaMissing: true }
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal cek progress gate', error: error.message });
  }
};

/**
 * POST /api/attendance/grooming-photo
 * Fields: step_code, lat, lng, selfie(file)
 */
export const uploadGroomingStep = async (req, res) => {
  const uploadedName = req.file?.filename || null;
  const cleanup = async () => {
    if (uploadedName) await deleteGroomingPhotoFile(uploadedName);
  };

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Foto grooming wajib diambil dari kamera.' });
    }

    const employeeId = req.user.employee_id;
    const stepCode = String(req.body?.step_code || '').trim();
    const lat = req.body?.lat != null ? Number(req.body.lat) : null;
    const lng = req.body?.lng != null ? Number(req.body.lng) : null;

    if (!GROOMING_STEP_CODES.includes(stepCode)) {
      await cleanup();
      return res.status(400).json({ success: false, message: 'step_code tidak valid.' });
    }

    const roleRow = await getEmployeeRole(employeeId);
    const role = roleRow?.role || null;
    if (!requiresGrooming(role)) {
      await cleanup();
      return res.status(403).json({ success: false, message: 'Posisi Anda tidak wajib grooming.' });
    }

    const { cfg, eval: gEval } = await getGroomingEval();
    if (Number(cfg.feature_enabled) !== 1) {
      await cleanup();
      return res.status(400).json({ success: false, message: 'Fitur grooming sedang nonaktif.' });
    }
    if (!gEval.windowOpen) {
      await cleanup();
      const msg = gEval.pastLock
        ? `Grooming terkunci setelah pukul ${formatHm(cfg.lock_after_time)} WIB. Isi alasan jika belum lengkap.`
        : 'Upload grooming di luar jendela jam yang ditetapkan.';
      return res.status(400).json({ success: false, message: msg });
    }

    const workDate = await getWorkDateNow();
    const [rows] = await myWaschenPool.query(
      `SELECT * FROM tr_attendance WHERE employee_id = ? AND work_date = ? LIMIT 1`,
      [employeeId, workDate]
    );
    if (!rows.length || !rows[0].check_in_time) {
      await cleanup();
      return res.status(400).json({ success: false, message: 'Absen masuk dulu sebelum foto grooming.' });
    }

    const att = rows[0];
    const displayName =
      (await getEmployeeDisplayName(employeeId, roleRow?.employee_name)) ||
      roleRow?.employee_name ||
      `Karyawan #${employeeId}`;

    const [existing] = await myWaschenPool.query(
      `SELECT grooming_photo_id, photo_name FROM tr_attendance_grooming_photo
       WHERE attendance_id = ? AND step_code = ? LIMIT 1`,
      [att.attendance_id, stepCode]
    );

    if (existing.length) {
      await myWaschenPool.query(
        `UPDATE tr_attendance_grooming_photo
         SET photo_path=?, photo_name=?, taken_at=NOW(), taken_by_employee_id=?, taken_by_name=?, lat=?, lng=?
         WHERE grooming_photo_id=?`,
        [
          GROOMING_UPLOAD_PUBLIC_PATH,
          req.file.filename,
          employeeId,
          displayName,
          Number.isFinite(lat) ? lat : null,
          Number.isFinite(lng) ? lng : null,
          existing[0].grooming_photo_id
        ]
      );
      if (existing[0].photo_name && existing[0].photo_name !== req.file.filename) {
        await deleteGroomingPhotoFile(existing[0].photo_name);
      }
    } else {
      await myWaschenPool.query(
        `INSERT INTO tr_attendance_grooming_photo
         (attendance_id, employee_id, outlet_id, work_date, step_code,
          photo_path, photo_name, taken_at, taken_by_employee_id, taken_by_name, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
        [
          att.attendance_id,
          employeeId,
          att.outlet_id,
          workDate,
          stepCode,
          GROOMING_UPLOAD_PUBLIC_PATH,
          req.file.filename,
          employeeId,
          displayName,
          Number.isFinite(lat) ? lat : null,
          Number.isFinite(lng) ? lng : null
        ]
      );
    }

    const [cntRows] = await myWaschenPool.query(
      `SELECT COUNT(*) AS n FROM tr_attendance_grooming_photo WHERE attendance_id = ?`,
      [att.attendance_id]
    );
    const status = await syncGroomingStatus(att.attendance_id, role, cntRows[0].n);

    emitDataChange({
      domain: 'attendance',
      outletId: att.outlet_id,
      employeeId,
      action: 'grooming_photo'
    });

    return res.json({
      success: true,
      message: 'Foto grooming tersimpan.',
      data: { step_code: stepCode, status, doneCount: Number(cntRows[0].n) }
    });
  } catch (error) {
    console.error('uploadGroomingStep error:', error);
    await cleanup();
    return res.status(500).json({ success: false, message: 'Gagal menyimpan foto grooming', error: error.message });
  }
};

/**
 * DELETE /api/attendance/grooming-photo
 * Body: { step_code } atau { grooming_photo_id }
 * Hapus baris DB + file di server.
 */
export const deleteGroomingPhoto = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const stepCode = String(req.body?.step_code || '').trim();
    const photoId = req.body?.grooming_photo_id != null ? Number(req.body.grooming_photo_id) : null;

    const roleRow = await getEmployeeRole(employeeId);
    const role = roleRow?.role || null;
    if (!requiresGrooming(role)) {
      return res.status(403).json({ success: false, message: 'Posisi Anda tidak wajib grooming.' });
    }

    const { cfg, eval: gEval } = await getGroomingEval();
    if (Number(cfg.feature_enabled) !== 1) {
      return res.status(400).json({ success: false, message: 'Fitur grooming sedang nonaktif.' });
    }
    if (!gEval.windowOpen) {
      return res.status(400).json({
        success: false,
        message: gEval.pastLock
          ? `Grooming terkunci setelah pukul ${formatHm(cfg.lock_after_time)} WIB.`
          : 'Tidak bisa hapus di luar jendela jam grooming.'
      });
    }

    const workDate = await getWorkDateNow();
    const [rows] = await myWaschenPool.query(
      `SELECT attendance_id, outlet_id FROM tr_attendance WHERE employee_id = ? AND work_date = ? LIMIT 1`,
      [employeeId, workDate]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });
    }
    const att = rows[0];

    let photos;
    if (photoId) {
      [photos] = await myWaschenPool.query(
        `SELECT grooming_photo_id, photo_name, step_code
         FROM tr_attendance_grooming_photo
         WHERE grooming_photo_id = ? AND attendance_id = ? LIMIT 1`,
        [photoId, att.attendance_id]
      );
    } else if (GROOMING_STEP_CODES.includes(stepCode)) {
      [photos] = await myWaschenPool.query(
        `SELECT grooming_photo_id, photo_name, step_code
         FROM tr_attendance_grooming_photo
         WHERE attendance_id = ? AND step_code = ? LIMIT 1`,
        [att.attendance_id, stepCode]
      );
    } else {
      return res.status(400).json({ success: false, message: 'step_code / grooming_photo_id tidak valid.' });
    }

    if (!photos.length) {
      return res.status(404).json({ success: false, message: 'Foto grooming tidak ditemukan.' });
    }

    const photo = photos[0];
    await myWaschenPool.query(
      `DELETE FROM tr_attendance_grooming_photo WHERE grooming_photo_id = ?`,
      [photo.grooming_photo_id]
    );
    await deleteGroomingPhotoFile(photo.photo_name);

    const [cntRows] = await myWaschenPool.query(
      `SELECT COUNT(*) AS n FROM tr_attendance_grooming_photo WHERE attendance_id = ?`,
      [att.attendance_id]
    );
    const status = await syncGroomingStatus(att.attendance_id, role, cntRows[0].n);

    emitDataChange({
      domain: 'attendance',
      outletId: att.outlet_id,
      employeeId,
      action: 'grooming_photo_delete'
    });

    return res.json({
      success: true,
      message: 'Foto grooming dihapus dari server.',
      data: { step_code: photo.step_code, status, doneCount: Number(cntRows[0].n) }
    });
  } catch (error) {
    console.error('deleteGroomingPhoto error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus foto grooming', error: error.message });
  }
};

/**
 * POST /api/attendance/grooming-reason
 * Body: { reason }
 */
export const submitGroomingReason = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) {
      return res.status(400).json({ success: false, message: 'Alasan minimal 5 karakter.' });
    }
    if (reason.length > 1000) {
      return res.status(400).json({ success: false, message: 'Alasan terlalu panjang.' });
    }

    const roleRow = await getEmployeeRole(employeeId);
    if (!requiresGrooming(roleRow?.role)) {
      return res.status(403).json({ success: false, message: 'Posisi Anda tidak wajib grooming.' });
    }
    const { cfg, eval: gEval } = await getGroomingEval();
    if (!gEval.needsReasonGate && !gEval.pastLock) {
      return res.status(400).json({
        success: false,
        message: `Alasan hanya diisi setelah pukul ${formatHm(cfg.lock_after_time)} WIB jika grooming belum lengkap.`
      });
    }
    if (!gEval.featureEnabled || !Number(cfg.require_reason_after_lock)) {
      return res.status(400).json({
        success: false,
        message: 'Fitur alasan grooming sedang tidak aktif.'
      });
    }

    const workDate = await getWorkDateNow();
    const [rows] = await myWaschenPool.query(
      `SELECT attendance_id FROM tr_attendance WHERE employee_id = ? AND work_date = ? LIMIT 1`,
      [employeeId, workDate]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Data absensi hari ini tidak ditemukan.' });
    }

    const [cntRows] = await myWaschenPool.query(
      `SELECT COUNT(*) AS n FROM tr_attendance_grooming_photo WHERE attendance_id = ?`,
      [rows[0].attendance_id]
    );
    const status = deriveGroomingStatus(cntRows[0].n, roleRow.role);
    if (status === 'lengkap') {
      return res.status(400).json({ success: false, message: 'Grooming sudah lengkap, alasan tidak diperlukan.' });
    }

    await myWaschenPool.query(
      `UPDATE tr_attendance
       SET grooming_incomplete_reason = ?, grooming_status = ?, grooming_locked_at = COALESCE(grooming_locked_at, NOW())
       WHERE attendance_id = ?`,
      [reason, status, rows[0].attendance_id]
    );

    emitDataChange({
      domain: 'attendance',
      employeeId,
      action: 'grooming_reason'
    });

    return res.json({ success: true, message: 'Alasan grooming tersimpan.', data: { status } });
  } catch (error) {
    console.error('submitGroomingReason error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan alasan', error: error.message });
  }
};

/**
 * POST /api/attendance/cleanliness-photos
 * Fields: lat, lng, photos(file[])
 */
export const uploadCleanliness = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const cleanup = async () => {
    for (const f of files) {
      if (f?.filename) await deleteCleanlinessPhotoFile(f.filename);
    }
  };

  try {
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'Minimal 1 foto kebersihan.' });
    }

    const employeeId = req.user.employee_id;
    const lat = req.body?.lat != null ? Number(req.body.lat) : null;
    const lng = req.body?.lng != null ? Number(req.body.lng) : null;
    const roleRow = await getEmployeeRole(employeeId);
    const role = roleRow?.role || null;

    if (!requiresCleanliness(role)) {
      await cleanup();
      return res.status(403).json({ success: false, message: 'Posisi Anda tidak wajib foto kebersihan.' });
    }

    const workDate = await getWorkDateNow();
    const [rows] = await myWaschenPool.query(
      `SELECT * FROM tr_attendance WHERE employee_id = ? AND work_date = ? LIMIT 1`,
      [employeeId, workDate]
    );
    if (!rows.length || !rows[0].check_in_time) {
      await cleanup();
      return res.status(400).json({ success: false, message: 'Absen masuk dulu sebelum foto kebersihan.' });
    }

    const att = rows[0];
    const outletId = att.outlet_id || req.user.assignedOutletId || roleRow?.outlet_id;
    if (!outletId) {
      await cleanup();
      return res.status(400).json({ success: false, message: 'Outlet tidak ditemukan.' });
    }

    const displayName =
      (await getEmployeeDisplayName(employeeId, roleRow?.employee_name)) ||
      roleRow?.employee_name ||
      `Karyawan #${employeeId}`;

    for (const file of files) {
      await myWaschenPool.query(
        `INSERT INTO tr_attendance_cleanliness_photo
         (attendance_id, outlet_id, work_date, role_code,
          uploaded_by_employee_id, uploaded_by_name,
          photo_path, photo_name, taken_at, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
        [
          att.attendance_id,
          outletId,
          workDate,
          role,
          employeeId,
          displayName,
          CLEANLINESS_UPLOAD_PUBLIC_PATH,
          file.filename,
          Number.isFinite(lat) ? lat : null,
          Number.isFinite(lng) ? lng : null
        ]
      );
    }

    emitDataChange({
      domain: 'attendance',
      outletId,
      employeeId,
      action: 'cleanliness_photo'
    });

    return res.json({
      success: true,
      message: `${files.length} foto kebersihan tersimpan.`,
      data: { uploaded: files.length, areaLabel: cleanlinessAreaLabel(role) }
    });
  } catch (error) {
    console.error('uploadCleanliness error:', error);
    await cleanup();
    return res.status(500).json({ success: false, message: 'Gagal menyimpan foto kebersihan', error: error.message });
  }
};

/**
 * DELETE /api/attendance/cleanliness-photos
 * Body: { cleanliness_photo_id }
 * Hapus baris DB + file. Hanya foto milik sendiri.
 */
export const deleteCleanlinessPhoto = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const photoId = Number(req.body?.cleanliness_photo_id);
    if (!photoId) {
      return res.status(400).json({ success: false, message: 'cleanliness_photo_id wajib.' });
    }

    const [photos] = await myWaschenPool.query(
      `SELECT cleanliness_photo_id, photo_name, uploaded_by_employee_id, outlet_id, role_code, work_date
       FROM tr_attendance_cleanliness_photo
       WHERE cleanliness_photo_id = ?
       LIMIT 1`,
      [photoId]
    );
    if (!photos.length) {
      return res.status(404).json({ success: false, message: 'Foto kebersihan tidak ditemukan.' });
    }

    const photo = photos[0];
    if (Number(photo.uploaded_by_employee_id) !== Number(employeeId)) {
      return res.status(403).json({
        success: false,
        message: 'Hanya bisa menghapus foto kebersihan yang Anda unggah sendiri.'
      });
    }

    await myWaschenPool.query(
      `DELETE FROM tr_attendance_cleanliness_photo WHERE cleanliness_photo_id = ?`,
      [photo.cleanliness_photo_id]
    );
    await deleteCleanlinessPhotoFile(photo.photo_name);

    emitDataChange({
      domain: 'attendance',
      outletId: photo.outlet_id,
      employeeId,
      action: 'cleanliness_photo_delete'
    });

    return res.json({
      success: true,
      message: 'Foto kebersihan dihapus dari server.'
    });
  } catch (error) {
    console.error('deleteCleanlinessPhoto error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus foto kebersihan', error: error.message });
  }
};
