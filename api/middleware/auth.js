import jwt from 'jsonwebtoken';
import { mainPool, myWaschenPool } from '../db/pool.js';

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

    // Prefer assignedOutletId embedded in the token (set at login) to avoid
    // hitting mst_role on every single authenticated request. Fallback to a
    // DB lookup only for older tokens issued before this field existed.
    let assignedOutletId = decoded.assignedOutletId ?? null;
    if (assignedOutletId == null) {
      try {
        const roleQuery = myWaschenPool.query(
          'SELECT outlet_id FROM mst_role WHERE employee_id = ? LIMIT 1',
          [employeeId]
        );
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('role_lookup_timeout')), 3000)
        );
        const [roleRows] = await Promise.race([roleQuery, timeout]);
        if (roleRows[0]?.outlet_id) {
          assignedOutletId = roleRows[0].outlet_id;
        }
      } catch (_) { /* mst_role optional / timeout */ }
    }

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
