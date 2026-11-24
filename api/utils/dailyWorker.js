import { myWaschenPool } from '../db/pool.js';

/**
 * Daily Worker = pekerja lepas. Bisa bekerja sebagai role apa saja (QC semua tahap, delivery,
 * buat nota di POS), tetapi tanpa gaji tetap, jatah libur, izin, maupun kasbon.
 * Tidak wajib foto grooming/kebersihan; jam absen normal (bukan shift Frontliner).
 */
export const DAILY_WORKER_ROLE = 'Daily Worker';

export async function isDailyWorker(employeeId) {
  const id = Number(employeeId) || 0;
  if (!id) return false;
  const [rows] = await myWaschenPool.query('SELECT role FROM mst_role WHERE employee_id = ? LIMIT 1', [id]);
  return rows[0]?.role === DAILY_WORKER_ROLE;
}

/** Balas 403 bila Daily Worker; kembalikan true bila sudah dibalas. */
export async function rejectDailyWorker(req, res, feature) {
  if (!(await isDailyWorker(req.user?.employee_id))) return false;
  res.status(403).json({ success: false, message: `Daily Worker tidak memakai fitur ${feature}` });
  return true;
}
