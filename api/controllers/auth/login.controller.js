import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mainPool, myWaschenPool } from '../../db/pool.js';

export const loginUser = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username/Email dan Password wajib diisi'
    });
  }

  try {
    // Query users & join employee details
    const query = `
      SELECT 
        u.id AS user_id,
        u.name AS user_display_name,
        u.email AS user_email,
        u.username,
        u.password_hash,
        u.role AS user_role,
        u.avatar,
        e.employee_id,
        e.company_id,
        e.employee_code,
        e.full_name,
        e.phone_number,
        e.address,
        e.join_date,
        e.profile_path,
        p.position_name,
        d.department_name
      FROM users u
      LEFT JOIN mst_employee e ON u.email = e.email
      LEFT JOIN mst_position p ON e.position_id = p.position_id
      LEFT JOIN mst_department d ON e.department_id = d.department_id
      WHERE u.username = ? OR u.email = ?
      LIMIT 1
    `;

    const [rows] = await mainPool.query(query, [username, username]);

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Kredensial tidak valid (User tidak ditemukan)'
      });
    }

    const user = rows[0];

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Kredensial tidak valid (Password salah)'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.user_id, 
        username: user.username, 
        email: user.user_email, 
        role: user.user_role 
      },
      process.env.SESSION_SECRET || 'waschensecret',
      { expiresIn: '24h' }
    );

    // Fetch assigned role and outlet from my_waschen
    let assignedRole = null;
    let isLeader = 0;
    let assignedOutletId = null;
    let assignedOutletName = null;

    if (user.employee_id) {
      const [roleRows] = await myWaschenPool.query(
        'SELECT role, is_leader, outlet_id FROM mst_role WHERE employee_id = ? LIMIT 1',
        [user.employee_id]
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
    }

    // Fetch all outlets for company_id = 1
    let outlets = [];
    if (user.company_id === 1) {
      const [outletRows] = await mainPool.query(
        'SELECT id, name, full_name FROM mst_outlet ORDER BY name ASC'
      );
      outlets = outletRows;
    }

    // Return success response with user and employee info
    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.user_email,
        phone: user.phone_number,
        address: user.address,
        role: user.user_role,
        avatar: user.avatar,
        employee_id: user.employee_id,
        employeeId: user.employee_id,
        employee_code: user.employee_code,
        employeeCode: user.employee_code,
        company_id: user.company_id,
        companyId: user.company_id,
        is_leader: isLeader,
        isLeader: isLeader,
        join_date: user.join_date,
        joinDate: user.join_date,
        fullName: user.full_name || user.user_display_name,
        position: user.position_name || 'Staff',
        department: user.department_name || 'Waschen Laundry',
        profilePath: user.profile_path || user.avatar,
        assignedRole,
        assignedOutletId,
        assignedOutletName
      },
      outlets
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat login',
      error: error.message
    });
  }
};

/**
 * Fetch detailed employee profile directly from mainPool mst_employee
 */
export const getUserProfile = async (req, res) => {
  const { email, employeeId, userId } = req.query;

  try {
    const query = `
      SELECT 
        e.employee_id,
        e.employee_code,
        e.company_id,
        e.full_name,
        e.phone_number,
        e.address,
        e.join_date,
        e.profile_path,
        p.position_name,
        d.department_name
      FROM mst_employee e
      LEFT JOIN mst_position p ON e.position_id = p.position_id
      LEFT JOIN mst_department d ON e.department_id = d.department_id
      WHERE e.employee_id = ? OR e.email = ?
      LIMIT 1
    `;

    const [rows] = await mainPool.query(query, [employeeId || 0, email || '']);

    if (rows.length > 0) {
      return res.status(200).json({
        success: true,
        data: rows[0]
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Data karyawan tidak ditemukan'
    });
  } catch (error) {
    console.error('getUserProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data karyawan',
      error: error.message
    });
  }
};