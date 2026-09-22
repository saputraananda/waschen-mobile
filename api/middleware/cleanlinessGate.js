import { myWaschenPool } from '../db/pool.js';
import { getWorkDateNow } from '../utils/timeMaster.js';
import { requiresCleanliness, cleanlinessAreaLabel } from '../utils/groomingCleanliness.js';

/**
 * Blok Update Progress / QC jika role wajib kebersihan dan belum ada foto
 * bersama untuk outlet + role + hari ini.
 */
export async function requireCleanlinessForProgress(req, res, next) {
  try {
    const employeeId = req.user?.employee_id;
    if (!employeeId) return next();

    const [roleRows] = await myWaschenPool.query(
      'SELECT role, outlet_id FROM mst_role WHERE employee_id = ? LIMIT 1',
      [employeeId]
    );
    const role = roleRows[0]?.role || null;
    if (!requiresCleanliness(role)) return next();

    const workDate = await getWorkDateNow();

    // Foto kebersihan tersimpan memakai tr_attendance.outlet_id (bisa outlet
    // pengganti). Samakan sumber outlet dengan getProgressGate.
    const [attRows] = await myWaschenPool.query(
      'SELECT outlet_id FROM tr_attendance WHERE employee_id = ? AND work_date = ? LIMIT 1',
      [employeeId, workDate]
    );
    const outletId = attRows[0]?.outlet_id || req.user.assignedOutletId || roleRows[0]?.outlet_id || null;
    if (!outletId) {
      return res.status(403).json({
        success: false,
        message: 'Outlet belum ditetapkan. Absensi & foto kebersihan diperlukan sebelum Update Progress.'
      });
    }

    const [cnt] = await myWaschenPool.query(
      `SELECT COUNT(*) AS n FROM tr_attendance_cleanliness_photo
       WHERE outlet_id = ? AND role_code = ? AND work_date = ?`,
      [outletId, role, workDate]
    );

    if (Number(cnt[0]?.n || 0) < 1) {
      return res.status(403).json({
        success: false,
        message: `Upload foto kebersihan (${cleanlinessAreaLabel(role)}) dulu di Absensi sebelum Update Progress.`
      });
    }

    return next();
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return next();
    console.error('requireCleanlinessForProgress:', err);
    return res.status(500).json({ success: false, message: 'Gagal memverifikasi syarat kebersihan' });
  }
}
