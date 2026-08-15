import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse, 
  generateAuthenticationOptions, 
  verifyAuthenticationResponse 
} from '@simplewebauthn/server';
import jwt from 'jsonwebtoken';
import { mainPool, myWaschenPool } from '../../db/pool.js';

// In-memory challenge store (mapped by userId or challenge key)
const challengeStore = new Map();

/**
 * Helper to extract RP ID & Origin from incoming request
 */
const getRPInfo = (req) => {
  const host = req.headers.host || 'localhost';
  const rpID = host.split(':')[0]; // e.g. 'localhost' or '192.168.1.10' or domain
  
  const originHeader = req.headers.origin || req.headers.referer;
  let origin = originHeader ? new URL(originHeader).origin : `http://${host}`;

  // Known valid origins for dev / mobile web testing
  const expectedOrigins = Array.from(new Set([
    origin,
    `http://${rpID}:9000`,
    `http://${rpID}:9001`,
    `http://localhost:9000`,
    `http://localhost:9001`,
    `http://127.0.0.1:9000`,
    `http://127.0.0.1:9001`
  ]));

  return { rpID, origin, expectedOrigins };
};

/**
 * Helper to verify JWT token from Authorization header or body
 */
const getUserFromReq = (req) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '') : req.body?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.SESSION_SECRET || 'waschensecret');
  } catch (e) {
    return null;
  }
};

/**
 * Helper to fetch full user info & outlets payload (identical to loginUser)
 */
const fetchUserLoginPayload = async (userId) => {
  const query = `
    SELECT 
      u.id AS user_id,
      u.name AS user_display_name,
      u.email AS user_email,
      u.username,
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
    WHERE u.id = ?
    LIMIT 1
  `;

  const [rows] = await mainPool.query(query, [userId]);
  if (rows.length === 0) return null;

  const user = rows[0];

  // Fetch assigned role & outlet from my_waschen
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

  // Fetch all outlets if company_id = 1
  let outlets = [];
  if (user.company_id === 1) {
    const [outletRows] = await mainPool.query(
      'SELECT id, name, full_name FROM mst_outlet ORDER BY name ASC'
    );
    outlets = outletRows;
  }

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

  return {
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
  };
};

/**
 * 1. Generate Registration Options for logged in user
 */
export const generateRegistrationOptionsHandler = async (req, res) => {
  try {
    const decoded = getUserFromReq(req);
    const userId = decoded?.userId || req.body?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak terautentikasi. Silakan login terlebih dahulu.'
      });
    }

    // Fetch user details from DB
    const [userRows] = await mainPool.query(
      'SELECT id, name, email, username FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    const user = userRows[0];
    const { rpID } = getRPInfo(req);

    // Fetch existing active credentials for user to prevent re-registration
    const [existingCreds] = await mainPool.query(
      'SELECT credential_id FROM mst_biometrics WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    const excludeCredentials = existingCreds.map(c => ({
      id: c.credential_id,
      type: 'public-key'
    }));

    const options = await generateRegistrationOptions({
      rpName: 'Waschen Mobile',
      rpID,
      userID: Buffer.from(String(user.id)),
      userName: user.username || user.email,
      userDisplayName: user.name || user.username || user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform' // Face ID / Touch ID / Windows Hello
      }
    });

    // Store challenge in memory with key `reg_${userId}`
    challengeStore.set(`reg_${userId}`, options.challenge);

    return res.status(200).json({
      success: true,
      options
    });

  } catch (error) {
    console.error('generateRegistrationOptionsHandler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat opsi registrasi biometrik.',
      error: error.message
    });
  }
};

/**
 * 2. Verify Registration Response & Save Credential to mst_biometrics
 */
export const verifyRegistrationHandler = async (req, res) => {
  try {
    const decoded = getUserFromReq(req);
    const userId = decoded?.userId || req.body?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak terautentikasi.'
      });
    }

    const expectedChallenge = challengeStore.get(`reg_${userId}`);
    if (!expectedChallenge) {
      return res.status(400).json({
        success: false,
        message: 'Sesi registrasi biometrik telah kadaluarsa. Silakan coba lagi.'
      });
    }

    const { response, deviceName } = req.body;
    const { rpID, expectedOrigins } = getRPInfo(req);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      requireUserVerification: false
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        success: false,
        message: 'Verifikasi registrasi biometrik gagal.'
      });
    }

    const { credential } = verification.registrationInfo;
    const credentialId = credential.id;
    const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64url');
    const counter = credential.counter || 0;
    const transports = (credential.transports || ['internal']).join(',');
    const device = deviceName || 'Face ID / Touch ID';

    // Get employee_id if exists
    const [empRows] = await mainPool.query(
      'SELECT employee_id FROM mst_employee e JOIN users u ON u.email = e.email WHERE u.id = ? LIMIT 1',
      [userId]
    );
    const employeeId = empRows.length > 0 ? empRows[0].employee_id : null;

    // Check if credential_id already exists in mst_biometrics
    const [existing] = await mainPool.query(
      'SELECT id FROM mst_biometrics WHERE credential_id = ? LIMIT 1',
      [credentialId]
    );

    if (existing.length > 0) {
      await mainPool.query(
        `UPDATE mst_biometrics 
         SET user_id = ?, employee_id = ?, public_key = ?, counter = ?, device_name = ?, transports = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
         WHERE credential_id = ?`,
        [userId, employeeId, publicKeyBase64, counter, device, transports, credentialId]
      );
    } else {
      await mainPool.query(
        `INSERT INTO mst_biometrics (user_id, employee_id, credential_id, public_key, counter, device_name, transports, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [userId, employeeId, credentialId, publicKeyBase64, counter, device, transports]
      );
    }

    // Clean up challenge
    challengeStore.delete(`reg_${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Face ID / Biometrik berhasil didaftarkan!'
    });

  } catch (error) {
    console.error('verifyRegistrationHandler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memverifikasi registrasi biometrik.',
      error: error.message
    });
  }
};

/**
 * 3. Generate Authentication Options for Login
 */
export const generateAuthenticationOptionsHandler = async (req, res) => {
  try {
    const { username } = req.body;
    const { rpID } = getRPInfo(req);

    let allowCredentials = [];
    let challengeKey = 'auth_global';

    if (username && username.trim()) {
      const [userRows] = await mainPool.query(
        'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
        [username.trim(), username.trim()]
      );

      if (userRows.length > 0) {
        const userId = userRows[0].id;
        challengeKey = `auth_${userId}`;

        const [creds] = await mainPool.query(
          'SELECT credential_id, transports FROM mst_biometrics WHERE user_id = ? AND is_active = 1',
          [userId]
        );

        allowCredentials = creds.map(c => ({
          id: c.credential_id,
          transports: c.transports ? c.transports.split(',') : ['internal']
        }));
      }
    } else {
      // Return all active credentials if no username specified
      const [allCreds] = await mainPool.query(
        'SELECT credential_id, transports FROM mst_biometrics WHERE is_active = 1'
      );
      allowCredentials = allCreds.map(c => ({
        id: c.credential_id,
        transports: c.transports ? c.transports.split(',') : ['internal']
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred'
    });

    // Store challenge in memory
    challengeStore.set(challengeKey, options.challenge);
    // Also store by options.challenge directly for fallback matching
    challengeStore.set(`challenge_${options.challenge}`, options.challenge);

    return res.status(200).json({
      success: true,
      options
    });

  } catch (error) {
    console.error('generateAuthenticationOptionsHandler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat opsi autentikasi biometrik.',
      error: error.message
    });
  }
};

/**
 * 4. Verify Authentication Response & Log User In
 */
export const verifyAuthenticationHandler = async (req, res) => {
  try {
    const { response } = req.body;

    if (!response || !response.id) {
      return res.status(400).json({
        success: false,
        message: 'Respon autentikasi biometrik tidak valid.'
      });
    }

    // Find credential in mst_biometrics
    const [credRows] = await mainPool.query(
      'SELECT id, user_id, credential_id, public_key, counter, transports FROM mst_biometrics WHERE credential_id = ? AND is_active = 1 LIMIT 1',
      [response.id]
    );

    if (credRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Biometrik / Face ID tidak dikenali atau belum terdaftar pada akun ini.'
      });
    }

    const biometric = credRows[0];
    const { rpID, expectedOrigins } = getRPInfo(req);

    // Retrieve expected challenge
    let expectedChallenge = challengeStore.get(`auth_${biometric.user_id}`) ||
                              challengeStore.get('auth_global') ||
                              challengeStore.get(`challenge_${response.clientDataJSON ? JSON.parse(Buffer.from(response.clientDataJSON, 'base64url').toString()).challenge : ''}`);

    if (!expectedChallenge) {
      // Fallback to clientDataJSON challenge decoding
      try {
        const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString());
        expectedChallenge = clientData.challenge;
      } catch (e) { }
    }

    if (!expectedChallenge) {
      return res.status(400).json({
        success: false,
        message: 'Sesi autentikasi biometrik telah kadaluarsa. Silakan coba lagi.'
      });
    }

    const publicKeyUint8 = Uint8Array.from(Buffer.from(biometric.public_key, 'base64url'));

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      authenticator: {
        credentialID: biometric.credential_id,
        credentialPublicKey: publicKeyUint8,
        counter: biometric.counter || 0,
        transports: biometric.transports ? biometric.transports.split(',') : ['internal']
      },
      requireUserVerification: false
    });

    if (!verification.verified) {
      return res.status(401).json({
        success: false,
        message: 'Verifikasi sidik jari / Face ID gagal.'
      });
    }

    // Update counter in mst_biometrics
    const newCounter = verification.authenticationInfo?.newCounter || biometric.counter + 1;
    await mainPool.query(
      'UPDATE mst_biometrics SET counter = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newCounter, biometric.id]
    );

    // Clean up challenges
    challengeStore.delete(`auth_${biometric.user_id}`);
    challengeStore.delete('auth_global');

    // Fetch full user payload & token
    const payload = await fetchUserLoginPayload(biometric.user_id);
    if (!payload) {
      return res.status(404).json({
        success: false,
        message: 'Data user biometrik tidak ditemukan.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login dengan Face ID / Biometrik Berhasil!',
      ...payload
    });

  } catch (error) {
    console.error('verifyAuthenticationHandler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat verifikasi biometrik.',
      error: error.message
    });
  }
};

/**
 * 5. Get Biometric Registration Status for current logged in user
 */
export const getBiometricStatusHandler = async (req, res) => {
  try {
    const decoded = getUserFromReq(req);
    const userId = decoded?.userId || req.query?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak terautentikasi.'
      });
    }

    const [rows] = await mainPool.query(
      'SELECT id, credential_id, device_name, created_at, updated_at FROM mst_biometrics WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    return res.status(200).json({
      success: true,
      isRegistered: rows.length > 0,
      count: rows.length,
      biometrics: rows
    });

  } catch (error) {
    console.error('getBiometricStatusHandler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil status biometrik.',
      error: error.message
    });
  }
};

/**
 * 6. Delete / Deactivate Biometric Registration for current user
 */
export const deleteBiometricHandler = async (req, res) => {
  try {
    const decoded = getUserFromReq(req);
    const userId = decoded?.userId || req.body?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak terautentikasi.'
      });
    }

    await mainPool.query(
      'UPDATE mst_biometrics SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Pendaftaran Face ID / Biometrik telah berhasil dihapus.'
    });

  } catch (error) {
    console.error('deleteBiometricHandler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus data biometrik.',
      error: error.message
    });
  }
};
