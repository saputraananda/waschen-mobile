import jwt from 'jsonwebtoken';
import { mainPool, myWaschenPool } from '../db/pool.js';

// Penugasan cabang (mst_role.outlet_id) dibaca terkini, bukan dari token. Token berlaku 365 hari,
// jadi kalau penugasan berubah setelah login, nilai di token basi sampai karyawan login ulang.
// Cache singkat per karyawan agar tidak query mst_role di setiap request.
const OUTLET_CACHE_TTL_MS = 60 * 1000;
const outletCache = new Map(); // employeeId -> { outletId, at }

async function lookupAssignedOutletId(employeeId) {
  const hit = outletCache.get(employeeId);
  if (hit && Date.now() - hit.at < OUTLET_CACHE_TTL_MS) return hit.outletId;
  try {
    const roleQuery = myWaschenPool.query(
      'SELECT outlet_id FROM mst_role WHERE employee_id = ? LIMIT 1',
      [employeeId]
    );
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('role_lookup_timeout')), 3000)
    );
    const [roleRows] = await Promise.race([roleQuery, timeout]);
    const outletId = roleRows[0]?.outlet_id || null;
    outletCache.set(employeeId, { outletId, at: Date.now() });
    return outletId;
  } catch (_) {
    return hit?.outletId ?? null; // mst_role opsional / timeout: pakai nilai terakhir bila ada
  }
}

/**
 * JWT auth middleware — resolves user_id & employee_id from token + DB.
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized — token tidak ditemukan' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'waschensecret');

    let userId = decoded.userId || decoded.user_id || null;
    let employeeId = decoded.employee_id || decoded.employeeId || null;

    if (!employeeId && userId) {
      const [rows] = await mainPool.query(
        `SELECT u.id AS user_id, e.employee_id
         FROM users u
         LEFT JOIN mst_employee e ON u.email = e.email
         WHERE u.id = ?
         LIMIT 1`,
        [userId]
      );
      if (rows[0]) {
        userId = rows[0].user_id;
        employeeId = rows[0].employee_id;
      }
    }

    if (!employeeId) {
      return res.status(403).json({
        success: false,
        message: 'Data karyawan tidak ditemukan untuk akun ini'
      });
    }

    // Sumber kebenaran = mst_role terkini. Nilai di token (saat login) hanya cadangan
    // bila karyawan tidak punya baris mst_role atau lookup gagal.
    const freshOutletId = await lookupAssignedOutletId(employeeId);
    const assignedOutletId = freshOutletId ?? decoded.assignedOutletId ?? null;

    req.user = {
      user_id: userId,
      userId,
      employee_id: employeeId,
      employeeId,
      email: decoded.email,
      assignedOutletId,
    };

    next();
  } catch (_) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kedaluwarsa' });
  }
};
