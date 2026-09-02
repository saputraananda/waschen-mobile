import { mainPool, myWaschenPool } from '../../db/pool.js';
import { KASBON_UPLOAD_PUBLIC_PATH, deleteKasbonProofFile } from '../../middleware/upload.js';

const KASBON_TYPES = ['kasbon', 'pinjaman'];

const buildProofUrl = (req, row) => {
  if (!row?.proof_path) return null;
  const normalized = row.proof_path.startsWith('/') ? row.proof_path : `/${row.proof_path}`;
  return `${req.protocol}://${req.get('host')}${normalized}`;
};

const mapRow = (req, row) => ({
  ...row,
  proof_url: buildProofUrl(req, row)
});

/**
 * GET /api/kasbon/list?startDate=&endDate=
 * Riwayat pengajuan kasbon/pinjaman milik karyawan yang login, lengkap dengan agregat pembayaran.
 */
export const getKasbonList = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const { startDate, endDate } = req.query;

    let sql = `
      SELECT
        k.id, k.employee_id, k.employee_name, k.type,
        k.submission_date, k.amount_requested, k.amount_approved,
        k.purpose, k.notes, k.proof_path, k.status,
        k.process_note, k.process_by_name, k.process_at,
        k.approved_note, k.approved_by_name, k.approved_at,
        k.rejection_note, k.created_at, k.updated_at,
        COALESCE((SELECT SUM(p.amount) FROM tr_kasbon_payment p WHERE p.kasbon_id = k.id), 0) AS total_paid,
        (SELECT COUNT(*) FROM tr_kasbon_payment p WHERE p.kasbon_id = k.id) AS payment_count
      FROM tr_kasbon k
      WHERE k.employee_id = ?
    `;
    const params = [employeeId];

    if (startDate) { sql += ' AND k.submission_date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND k.submission_date <= ?'; params.push(endDate); }

    sql += ' ORDER BY k.created_at DESC';

    const [rows] = await myWaschenPool.query(sql, params);
    return res.status(200).json({ success: true, message: 'OK', data: rows.map((r) => mapRow(req, r)) });
  } catch (error) {
    console.error('getKasbonList error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Tabel tr_kasbon belum tersedia di database myWaschen. Jalankan DDL di agent/tr_kasbon.sql terlebih dahulu.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat kasbon', error: error.message });
  }
};

/**
 * GET /api/kasbon/:id
 * Detail satu pengajuan + riwayat pembayaran (untuk pinjaman).
 */
export const getKasbonById = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const { id } = req.params;

    const [rows] = await myWaschenPool.query(
      'SELECT * FROM tr_kasbon WHERE id = ? AND employee_id = ? LIMIT 1',
      [id, employeeId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }

    const submission = mapRow(req, rows[0]);

    const [payments] = await myWaschenPool.query(
      `SELECT id, payment_date, amount, payment_method, notes, recorded_by_name, created_at
       FROM tr_kasbon_payment
       WHERE kasbon_id = ?
       ORDER BY payment_date ASC, created_at ASC`,
      [id]
    );
    submission.payments = payments;

    return res.status(200).json({ success: true, message: 'OK', data: submission });
  } catch (error) {
    console.error('getKasbonById error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail pengajuan', error: error.message });
  }
};

/**
 * POST /api/kasbon (multipart)
 * Fields: type, submission_date, purpose, amount_requested, notes, proof_doc(file, opsional)
 */
export const submitKasbon = async (req, res) => {
  const uploadedFileName = req.file ? req.file.filename : null;
  const cleanupFile = async () => {
    if (uploadedFileName) await deleteKasbonProofFile(uploadedFileName);
  };

  try {
    const employeeId = req.user.employee_id;
    const { type, submission_date, purpose, amount_requested, notes } = req.body;

    if (!KASBON_TYPES.includes(type)) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Jenis pengajuan tidak valid' });
    }
    if (!submission_date) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Tanggal pengajuan wajib diisi' });
    }
    if (!purpose?.trim()) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Keperluan/tujuan wajib diisi' });
    }
    const amount = parseFloat(amount_requested);
    if (!amount || amount <= 0) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Jumlah pengajuan harus lebih dari 0' });
    }

    const [empRows] = await mainPool.query(
      'SELECT full_name FROM mst_employee WHERE employee_id = ? LIMIT 1',
      [employeeId]
    );
    const employeeName = empRows[0]?.full_name || req.user.email || 'Unknown';

    const proofPath = req.file ? `${KASBON_UPLOAD_PUBLIC_PATH}/${req.file.filename}` : null;

    const [result] = await myWaschenPool.query(
      `INSERT INTO tr_kasbon
         (employee_id, employee_name, type, submission_date, amount_requested, purpose, notes, proof_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pengajuan')`,
      [employeeId, employeeName, type, submission_date, amount, purpose.trim(), notes?.trim() || null, proofPath]
    );

    const [inserted] = await myWaschenPool.query('SELECT * FROM tr_kasbon WHERE id = ?', [result.insertId]);

    return res.status(201).json({ success: true, message: 'Pengajuan berhasil dikirim', data: mapRow(req, inserted[0]) });
  } catch (error) {
    await cleanupFile();
    console.error('submitKasbon error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Tabel tr_kasbon belum tersedia di database myWaschen. Jalankan DDL di agent/tr_kasbon.sql terlebih dahulu.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal mengirim pengajuan', error: error.message });
  }
};

/**
 * PUT /api/kasbon/:id (multipart)
 * Hanya bisa diedit jika status masih 'pengajuan'.
 */
export const updateKasbon = async (req, res) => {
  const uploadedFileName = req.file ? req.file.filename : null;
  const cleanupFile = async () => {
    if (uploadedFileName) await deleteKasbonProofFile(uploadedFileName);
  };

  try {
    const employeeId = req.user.employee_id;
    const { id } = req.params;

    const [existingRows] = await myWaschenPool.query(
      'SELECT id, status, proof_path FROM tr_kasbon WHERE id = ? AND employee_id = ? LIMIT 1',
      [id, employeeId]
    );
    if (existingRows.length === 0) {
      await cleanupFile();
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }
    if (existingRows[0].status !== 'pengajuan') {
      await cleanupFile();
      return res.status(403).json({ success: false, message: 'Pengajuan tidak dapat diubah karena sudah diproses' });
    }

    const { type, submission_date, purpose, amount_requested, notes, remove_proof } = req.body;

    if (!KASBON_TYPES.includes(type)) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Jenis pengajuan tidak valid' });
    }
    if (!submission_date) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Tanggal pengajuan wajib diisi' });
    }
    if (!purpose?.trim()) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Keperluan/tujuan wajib diisi' });
    }
    const amount = parseFloat(amount_requested);
    if (!amount || amount <= 0) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Jumlah pengajuan harus lebih dari 0' });
    }

    let proofPath = existingRows[0].proof_path;

    if (req.file) {
      if (proofPath) await deleteKasbonProofFile(proofPath.split('/').pop());
      proofPath = `${KASBON_UPLOAD_PUBLIC_PATH}/${req.file.filename}`;
    } else if (remove_proof === '1' && proofPath) {
      await deleteKasbonProofFile(proofPath.split('/').pop());
      proofPath = null;
    }

    await myWaschenPool.query(
      `UPDATE tr_kasbon
       SET type = ?, submission_date = ?, amount_requested = ?, purpose = ?, notes = ?, proof_path = ?
       WHERE id = ?`,
      [type, submission_date, amount, purpose.trim(), notes?.trim() || null, proofPath, id]
    );

    const [updatedRows] = await myWaschenPool.query('SELECT * FROM tr_kasbon WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Pengajuan berhasil diperbarui', data: mapRow(req, updatedRows[0]) });
  } catch (error) {
    await cleanupFile();
    console.error('updateKasbon error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengupdate pengajuan', error: error.message });
  }
};

/**
 * DELETE /api/kasbon/:id
 * Hanya bisa dihapus jika status masih 'pengajuan'.
 */
export const deleteKasbon = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const { id } = req.params;

    const [existingRows] = await myWaschenPool.query(
      'SELECT id, status, proof_path FROM tr_kasbon WHERE id = ? AND employee_id = ? LIMIT 1',
      [id, employeeId]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }
    if (existingRows[0].status !== 'pengajuan') {
      return res.status(403).json({ success: false, message: 'Pengajuan tidak dapat dihapus karena sudah diproses' });
    }

    if (existingRows[0].proof_path) {
      await deleteKasbonProofFile(existingRows[0].proof_path.split('/').pop());
    }

    await myWaschenPool.query('DELETE FROM tr_kasbon WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Pengajuan berhasil dihapus' });
  } catch (error) {
    console.error('deleteKasbon error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus pengajuan', error: error.message });
  }
};
