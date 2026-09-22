import { mainPool, myWaschenPool } from '../../db/pool.js';
import jwt from 'jsonwebtoken';
import { emitDataChange } from '../../socket/io.js';
import { toAssetUrl as toPublicUrl } from '../../utils/assetUrl.js';

/** docKey → prefix kolom di mst_employee (pola `<prefix>_name` + `<prefix>_path`) */
const DOC_KEYS = ['profile', 'ktp', 'kk', 'npwp', 'bpjs', 'bpjs_tk', 'ijazah', 'sertifikat', 'rekomkerja'];

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
    let assignedCodePin = null;

    try {
      const [roleRows] = await myWaschenPool.query(
        'SELECT role, is_leader, outlet_id, employee_name, code_pin FROM mst_role WHERE employee_id = ? LIMIT 1',
        [employeeRow.employee_id]
      );
      if (roleRows.length > 0) {
        assignedRole = roleRows[0].role;
        isLeader = roleRows[0].is_leader || 0;
        assignedOutletId = roleRows[0].outlet_id;
        assignedCodePin =
          roleRows[0].code_pin != null && String(roleRows[0].code_pin).trim() !== ''
            ? String(roleRows[0].code_pin).trim()
            : null;
        if (roleRows[0].employee_name && !employeeRow.full_name) {
          employeeRow.full_name = roleRows[0].employee_name;
        }

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

    // URL publik tiap dokumen: <docKey>_url dipakai langsung oleh frontend
    const docUrls = {};
    for (const key of DOC_KEYS) {
      docUrls[`${key}_url`] = toPublicUrl(employeeRow[`${key}_path`]);
    }

    // Combine detailed profile response
    const profileData = {
      ...employeeRow,
      ...docUrls,
      fullName: employeeRow.full_name,
      employeeCode: employeeRow.employee_code,
      position: employeeRow.position_name || 'Staff',
      department: employeeRow.department_name || 'Waschen Laundry',
      profile_url: toPublicUrl(employeeRow.profile_path || employeeRow.avatar),
      role: assignedRole || 'Frontliner',
      assignedRole: assignedRole || null,
      is_leader: isLeader,
      isLeader: isLeader,
      outlet_id: assignedOutletId,
      assignedOutletName: assignedOutletName || 'Waschen Head Office',
      code_pin: assignedCodePin,
      has_pin: Boolean(assignedCodePin)
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

    // Sync nama ke myWaschen.mst_role.employee_name (hindari ketergantungan mainPool untuk display name)
    if (data.full_name) {
      try {
        await myWaschenPool.query(
          `UPDATE mst_role SET employee_name = ? WHERE employee_id = ?`,
          [String(data.full_name).trim() || null, empId]
        );
      } catch (e) {
        console.warn('sync mst_role.employee_name warning:', e.message);
      }
    }

    // Update PIN kasir/POS di mst_role.code_pin (4 digit, unik)
    if (data.code_pin !== undefined) {
      const rawPin = data.code_pin;
      let cleanPin = null;
      if (rawPin !== null && rawPin !== '' && rawPin !== 'null') {
        const digits = String(rawPin).replace(/\D/g, '');
        if (!digits) {
          return res.status(422).json({
            success: false,
            message: 'PIN harus berupa angka.'
          });
        }
        if (digits.length !== 4) {
          return res.status(422).json({
            success: false,
            message: 'PIN harus 4 digit.'
          });
        }
        cleanPin = digits;

        const [dup] = await myWaschenPool.query(
          `SELECT employee_id FROM mst_role
           WHERE TRIM(CAST(code_pin AS CHAR)) = ?
             AND employee_id != ?
           LIMIT 1`,
          [cleanPin, empId]
        );
        if (dup.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Pin telah digunakan, harap ganti'
          });
        }
      }

      const [roleExist] = await myWaschenPool.query(
        'SELECT employee_id FROM mst_role WHERE employee_id = ? LIMIT 1',
        [empId]
      );
      if (roleExist.length === 0) {
        return res.status(422).json({
          success: false,
          message: 'Posisi outlet belum ditetapkan. Hubungi admin untuk set posisi dulu.'
        });
      }
      await myWaschenPool.query(
        'UPDATE mst_role SET code_pin = ? WHERE employee_id = ?',
        [cleanPin, empId]
      );
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

    emitDataChange({ domain: 'profile', employeeId: empId, action: 'update' });
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
 * File diteruskan ke Alsa (POST /service/employee-assets/:docType). Alsa yang
 * menulis file ke storage/assets/{avatars,documents} sekaligus mengisi
 * mst_employee.<docKey>_path & _name — satu sumber, tidak ada duplikasi file.
 */
export const uploadDoc = async (req, res) => {
  const docKey = String(req.params.docKey || '').toLowerCase();

  if (!DOC_KEYS.includes(docKey)) {
    return res.status(400).json({ success: false, message: 'Jenis dokumen tidak dikenal.' });
  }
  if (!req.file?.buffer) {
    return res.status(400).json({ success: false, message: 'File tidak ditemukan.' });
  }

  const empId = getRequestUserId(req)?.employee_id || null;
  if (!empId) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid. Silakan login ulang.' });
  }

  const endpoint = String(process.env.ALSA_SERVICE_URL || '').replace(/\/+$/, '');
  const token = process.env.SERVICE_UPLOAD_TOKEN || '';
  if (!endpoint || !token) {
    console.error('uploadDoc: ALSA_SERVICE_URL / SERVICE_UPLOAD_TOKEN belum diset');
    return res.status(503).json({ success: false, message: 'Layanan unggah belum dikonfigurasi.' });
  }

  try {
    const form = new FormData();
    form.append('employee_id', String(empId));
    form.append(
      'file',
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname
    );

    const upstream = await fetch(`${endpoint}/service/employee-assets/${docKey}`, {
      method: 'POST',
      headers: { 'x-service-token': token },
      body: form,
      signal: AbortSignal.timeout(30000)
    });

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      // Pesan upstream aman ditampilkan (validasi format/ukuran), bukan detail internal
      return res.status(upstream.status === 401 ? 502 : upstream.status).json({
        success: false,
        message: payload.message || 'Gagal menyimpan dokumen.'
      });
    }

    emitDataChange({ domain: 'profile', employeeId: empId, action: 'upload' });
    return res.status(200).json({
      success: true,
      message: 'Dokumen berhasil diunggah',
      data: { docKey, url: toPublicUrl(payload[`${docKey}_path`]) }
    });
  } catch (error) {
    console.error('uploadDoc error:', error);
    return res.status(502).json({ success: false, message: 'Gagal menghubungi server dokumen.' });
  }
};
