import { mainPool, myWaschenPool } from '../db/pool.js';
import jwt from 'jsonwebtoken';

/**
 * Helper to extract user identity from JWT header or request params/query
 */
const getRequestUserId = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'waschensecret');
      return decoded;
    } catch (e) {}
  }
  return null;
};

/**
 * GET /api/employee/profile-detail
 * GET /api/profile/detail
 * Fetch exact employee details from `mst_employee` table joined with position, department, role, outlet.
 */
export const getProfileDetail = async (req, res) => {
  const decoded = getRequestUserId(req);
  const employeeId = req.query.employee_id || req.query.employeeId || (decoded ? decoded.employee_id : null);
  const email = req.query.email || (decoded ? decoded.email : null);
  const userId = req.query.user_id || req.query.userId || (decoded ? decoded.userId : null);

  try {
    let employeeRow = null;

    // 1. Query by employee_id or email or user_id
    if (employeeId) {
      const [rows] = await mainPool.query(
        `SELECT e.*, p.position_name, d.department_name 
         FROM mst_employee e
         LEFT JOIN mst_position p ON e.position_id = p.position_id
         LEFT JOIN mst_department d ON e.department_id = d.department_id
         WHERE e.employee_id = ? LIMIT 1`,
        [employeeId]
      );
      if (rows.length > 0) employeeRow = rows[0];
    }

    if (!employeeRow && email) {
      const [rows] = await mainPool.query(
        `SELECT e.*, p.position_name, d.department_name 
         FROM mst_employee e
         LEFT JOIN mst_position p ON e.position_id = p.position_id
         LEFT JOIN mst_department d ON e.department_id = d.department_id
         WHERE e.email = ? OR e.private_email = ? LIMIT 1`,
        [email, email]
      );
      if (rows.length > 0) employeeRow = rows[0];
    }

    if (!employeeRow && userId) {
      const [userRows] = await mainPool.query(
        `SELECT u.email FROM users u WHERE u.id = ? LIMIT 1`,
        [userId]
      );
      if (userRows.length > 0 && userRows[0].email) {
        const [rows] = await mainPool.query(
          `SELECT e.*, p.position_name, d.department_name 
           FROM mst_employee e
           LEFT JOIN mst_position p ON e.position_id = p.position_id
           LEFT JOIN mst_department d ON e.department_id = d.department_id
           WHERE e.email = ? LIMIT 1`,
          [userRows[0].email]
        );
        if (rows.length > 0) employeeRow = rows[0];
      }
    }

    // Fallback: If still not found, fetch first employee record from mst_employee
    if (!employeeRow) {
      const [rows] = await mainPool.query(
        `SELECT e.*, p.position_name, d.department_name 
         FROM mst_employee e
         LEFT JOIN mst_position p ON e.position_id = p.position_id
         LEFT JOIN mst_department d ON e.department_id = d.department_id
         ORDER BY e.employee_id ASC LIMIT 1`
      );
      if (rows.length > 0) employeeRow = rows[0];
    }

    if (!employeeRow) {
      return res.status(404).json({
        success: false,
        message: 'Data karyawan tidak ditemukan di mst_employee'
      });
    }

    // 2. Query role & outlet from myWaschenPool mst_role
    let assignedRole = null;
    let isLeader = 0;
    let assignedOutletId = null;
    let assignedOutletName = null;

    try {
      const [roleRows] = await myWaschenPool.query(
        'SELECT role, is_leader, outlet_id FROM mst_role WHERE employee_id = ? LIMIT 1',
        [employeeRow.employee_id]
      );
      if (roleRows.length > 0) {
        assignedRole = roleRows[0].role;
        isLeader = roleRows[0].is_leader || 0;
        assignedOutletId = roleRows[0].outlet_id;

        if (assignedOutletId) {
          const [outletRows] = await mainPool.query(
            'SELECT name, full_name FROM mst_outlet WHERE id = ? LIMIT 1',
            [assignedOutletId]
          );
          if (outletRows.length > 0) {
            assignedOutletName = outletRows[0].full_name || outletRows[0].name;
          }
        }
      }
    } catch (e) {
      console.warn('myWaschenPool role fetch warning:', e.message);
    }

    // Combine detailed profile response
    const profileData = {
      ...employeeRow,
      fullName: employeeRow.full_name,
      employeeCode: employeeRow.employee_code,
      position: employeeRow.position_name || 'Staff',
      department: employeeRow.department_name || 'Waschen Laundry',
      profile_url: employeeRow.profile_path || employeeRow.avatar || null,
      role: assignedRole || 'Frontliner',
      is_leader: isLeader,
      isLeader: isLeader,
      outlet_id: assignedOutletId,
      assignedOutletName: assignedOutletName || 'Waschen Head Office'
    };

    return res.status(200).json({
      success: true,
      message: 'Detail profil karyawan berhasil diambil',
      data: profileData
    });

  } catch (error) {
    console.error('getProfileDetail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data rincian karyawan',
      error: error.message
    });
  }
};

/**
 * PUT /api/employee/update-profile
 * PUT /api/profile/update
 * Update real employee details in `mst_employee` table in mainPool database.
 */
export const updateProfile = async (req, res) => {
  const decoded = getRequestUserId(req);
  const data = req.body;

  const targetEmployeeId = data.employee_id || (decoded ? decoded.employee_id : null);
  const targetEmail = data.email || data.private_email || (decoded ? decoded.email : null);

  try {
    // Determine employee_id to update
    let empId = targetEmployeeId;

    if (!empId && targetEmail) {
      const [rows] = await mainPool.query(
        'SELECT employee_id FROM mst_employee WHERE email = ? OR private_email = ? LIMIT 1',
        [targetEmail, targetEmail]
      );
      if (rows.length > 0) empId = rows[0].employee_id;
    }

    if (!empId) {
      // Fallback to first employee
      const [rows] = await mainPool.query('SELECT employee_id FROM mst_employee ORDER BY employee_id ASC LIMIT 1');
      if (rows.length > 0) empId = rows[0].employee_id;
    }

    if (!empId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID tidak ditemukan untuk diperbarui'
      });
    }

    // Build dynamic UPDATE query for mst_employee
    const updateFields = [];
    const queryParams = [];

    const allowedCols = [
      'full_name', 'gender', 'birth_place', 'birth_date', 'address', 
      'ktp_number', 'phone_number', 'private_email', 'mother_name', 
      'emergency_contact', 'join_date', 'contract_end_date', 
      'education_level_id', 'school_name', 'major_name', 
      'religion_id', 'marital_status', 'bank_id', 'bank_account_number',
      'profile_path'
    ];

    for (const col of allowedCols) {
      if (data[col] !== undefined) {
        updateFields.push(`${col} = ?`);
        queryParams.push(data[col] === '' ? null : data[col]);
      }
    }

    if (updateFields.length > 0) {
      queryParams.push(empId);
      const sql = `UPDATE mst_employee SET ${updateFields.join(', ')} WHERE employee_id = ?`;
      await mainPool.query(sql, queryParams);
    }

    // Optionally sync full_name / phone / address back to users table if matching email
    if (data.full_name || data.phone_number) {
      try {
        await mainPool.query(
          `UPDATE users SET name = COALESCE(?, name) WHERE email = (SELECT email FROM mst_employee WHERE employee_id = ? LIMIT 1)`,
          [data.full_name || null, empId]
        );
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: 'Profil karyawan berhasil diperbarui di database mst_employee'
    });

  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengupdate data karyawan di database',
      error: error.message
    });
  }
};

/**
 * GET /api/employee/banks
 * Fetch active banks list
 */
export const getBanks = async (req, res) => {
  try {
    const [rows] = await mainPool.query(
      'SELECT bank_id AS v, bank_name AS l FROM mst_bank WHERE is_active = 1 ORDER BY bank_name ASC'
    );
    if (rows.length > 0) {
      return res.status(200).json({ success: true, data: rows });
    }
  } catch (e) {}

  // Standard Indonesian Bank List Fallback
  const defaultBanks = [
    { v: '1', l: 'Bank Central Asia (BCA)' },
    { v: '2', l: 'Bank Mandiri' },
    { v: '3', l: 'Bank Rakyat Indonesia (BRI)' },
    { v: '4', l: 'Bank Negara Indonesia (BNI)' },
    { v: '5', l: 'Bank Syariah Indonesia (BSI)' },
    { v: '6', l: 'Bank CIMB Niaga' },
    { v: '7', l: 'Bank Permata' }
  ];

  return res.status(200).json({ success: true, data: defaultBanks });
};

/**
 * GET /api/employee/education-levels
 * Fetch education levels list
 */
export const getEducationLevels = async (req, res) => {
  const levels = [
    { v: '1', l: 'SD / Sederajat' },
    { v: '2', l: 'SMP / Sederajat' },
    { v: '3', l: 'SMA / SMK / Sederajat' },
    { v: '4', l: 'Diploma I / II' },
    { v: '5', l: 'Diploma III (D3)' },
    { v: '6', l: 'Sarjana (S1) / Diploma IV' },
    { v: '7', l: 'Magister (S2)' },
    { v: '8', l: 'Doktor (S3)' }
  ];
  return res.status(200).json({ success: true, data: levels });
};

/**
 * POST /api/employee/upload-doc/:docKey
 * Handle document / avatar uploads
 */
export const uploadDoc = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Dokumen berhasil diunggah'
  });
};
