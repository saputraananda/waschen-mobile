import { myWaschenPool } from '../../db/pool.js';
import { LEAVE_UPLOAD_PUBLIC_PATH, deleteLeaveDocFile } from '../../middleware/upload.js';

const LEAVE_TYPES = ['izin', 'sakit', 'cuti'];
const DURATION_TYPES = ['full_day', 'half_day_morning', 'half_day_afternoon'];

const getTodayDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const buildDoctorNoteUrl = (req, row) => {
  if (!row?.doctor_note_path || !row?.doctor_note_name) return null;
  const normalized = row.doctor_note_path.startsWith('/') ? row.doctor_note_path : `/${row.doctor_note_path}`;
  return `${req.protocol}://${req.get('host')}${normalized}/${encodeURIComponent(row.doctor_note_name)}`;
};

const mapRow = (req, row) => ({
  ...row,
  doctor_note_url: buildDoctorNoteUrl(req, row)
});

/**
 * GET /api/leave/today
 * Data izin aktif (pengajuan/disetujui) hari ini — untuk lock halaman absen.
 */
export const getTodayLeave = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const today = getTodayDate();

    const [rows] = await myWaschenPool.query(
      `SELECT leave_id, leave_type, duration_type, start_date, end_date, reason, status,
              doctor_note_path, doctor_note_name
       FROM tr_leave
       WHERE employee_id = ?
         AND start_date <= ? AND end_date >= ?
         AND status IN ('pengajuan', 'disetujui')
       ORDER BY created_at DESC
       LIMIT 1`,
      [employeeId, today, today]
    );

    return res.status(200).json({
      success: true,
      message: 'OK',
      data: rows[0] ? mapRow(req, rows[0]) : null
    });
  } catch (error) {
    console.error('getTodayLeave error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Tabel tr_leave belum tersedia di database myWaschen. Jalankan DDL di agent/tr_leave.sql terlebih dahulu.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal mengambil data izin', error: error.message });
  }
};

/**
 * GET /api/leave/years
 */
export const getLeaveYears = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const [rows] = await myWaschenPool.query(
      `SELECT DISTINCT YEAR(start_date) AS yr FROM tr_leave WHERE employee_id = ? ORDER BY yr DESC`,
      [employeeId]
    );
    const currentYear = new Date().getFullYear();
    const years = rows.map((r) => Number(r.yr));
    if (!years.includes(currentYear)) years.unshift(currentYear);
    return res.status(200).json({ success: true, message: 'OK', data: years });
  } catch (error) {
    console.error('getLeaveYears error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data tahun', error: error.message });
  }
};

/**
 * GET /api/leave/stats?month=&year=
 * Periode payroll: tanggal 26 bulan sebelumnya s.d 25 bulan berjalan.
 */
export const getLeaveStats = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const month = parseInt(req.query.month || '0', 10);
    const year = parseInt(req.query.year || '0', 10);

    let whereClause = 'WHERE employee_id = ?';
    const params = [employeeId];

    if (month >= 1 && month <= 12 && year >= 2000) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const periodStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
      const periodEnd = `${year}-${String(month).padStart(2, '0')}-25`;
      whereClause += ' AND start_date <= ? AND end_date >= ?';
      params.push(periodEnd, periodStart);
    }

    const [rows] = await myWaschenPool.query(
      `SELECT leave_type, COUNT(*) AS cnt FROM tr_leave ${whereClause} GROUP BY leave_type`,
      params
    );

    const stats = { izin: 0, sakit: 0, cuti: 0 };
    rows.forEach((r) => { stats[r.leave_type] = Number(r.cnt); });
    return res.status(200).json({ success: true, message: 'OK', data: stats });
  } catch (error) {
    console.error('getLeaveStats error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil statistik izin', error: error.message });
  }
};

/**
 * GET /api/leave/list?page=&limit=&month=&year=
 */
export const getLeaveList = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
    const offset = (page - 1) * limit;

    const month = parseInt(req.query.month || '0', 10);
    const year = parseInt(req.query.year || '0', 10);
    let periodWhere = '';
    const periodParams = [];
    if (month >= 1 && month <= 12 && year >= 2000) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const periodStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
      const periodEnd = `${year}-${String(month).padStart(2, '0')}-25`;
      periodWhere = ' AND start_date <= ? AND end_date >= ?';
      periodParams.push(periodEnd, periodStart);
    }

    const [[{ total }]] = await myWaschenPool.query(
      `SELECT COUNT(*) AS total FROM tr_leave WHERE employee_id = ?${periodWhere}`,
      [employeeId, ...periodParams]
    );

    const [rows] = await myWaschenPool.query(
      `SELECT leave_id, leave_type, duration_type, start_date, end_date, reason,
              status, rejection_note, doctor_note_path, doctor_note_name, created_at, updated_at
       FROM tr_leave
       WHERE employee_id = ?${periodWhere}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [employeeId, ...periodParams, limit, offset]
    );

    return res.status(200).json({
      success: true,
      message: 'OK',
      data: { total, page, limit, items: rows.map((r) => mapRow(req, r)) }
    });
  } catch (error) {
    console.error('getLeaveList error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Tabel tr_leave belum tersedia di database myWaschen. Jalankan DDL di agent/tr_leave.sql terlebih dahulu.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat izin', error: error.message });
  }
};

/**
 * POST /api/leave (multipart)
 * Fields: leave_type, duration_type, start_date, end_date, reason, doctor_note(file, wajib jika sakit)
 */
export const submitLeave = async (req, res) => {
  const uploadedFileName = req.file ? req.file.filename : null;
  const cleanupFile = async () => {
    if (uploadedFileName) await deleteLeaveDocFile(uploadedFileName);
  };

  try {
    const employeeId = req.user.employee_id;
    const { leave_type, duration_type = 'full_day', start_date, end_date, reason } = req.body;

    if (!LEAVE_TYPES.includes(leave_type)) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'leave_type tidak valid' });
    }
    if (!DURATION_TYPES.includes(duration_type)) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'duration_type tidak valid' });
    }
    if (!start_date || !end_date) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'start_date dan end_date wajib diisi' });
    }
    if (start_date > end_date) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'end_date tidak boleh sebelum start_date' });
    }
    if (!reason || reason.trim().length < 5) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Keterangan wajib diisi minimal 5 karakter' });
    }
    if (leave_type === 'sakit' && !req.file) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Foto surat dokter wajib dilampirkan untuk izin sakit' });
    }
    if (duration_type !== 'full_day' && start_date !== end_date) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Izin setengah hari hanya berlaku untuk 1 hari' });
    }

    const [overlap] = await myWaschenPool.query(
      `SELECT leave_id FROM tr_leave
       WHERE employee_id = ? AND status IN ('pengajuan', 'disetujui')
         AND start_date <= ? AND end_date >= ?`,
      [employeeId, end_date, start_date]
    );
    if (overlap.length > 0) {
      await cleanupFile();
      return res.status(409).json({ success: false, message: 'Anda sudah memiliki pengajuan izin aktif pada rentang tanggal tersebut' });
    }

    const doctorNotePath = req.file ? LEAVE_UPLOAD_PUBLIC_PATH : null;
    const doctorNoteName = req.file ? req.file.filename : null;

    const [result] = await myWaschenPool.query(
      `INSERT INTO tr_leave
         (employee_id, leave_type, duration_type, start_date, end_date, reason, doctor_note_path, doctor_note_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pengajuan')`,
      [employeeId, leave_type, duration_type, start_date, end_date, reason.trim(), doctorNotePath, doctorNoteName]
    );

    const [inserted] = await myWaschenPool.query('SELECT * FROM tr_leave WHERE leave_id = ?', [result.insertId]);

    return res.status(201).json({ success: true, message: 'Pengajuan izin berhasil dikirim', data: mapRow(req, inserted[0]) });
  } catch (error) {
    await cleanupFile();
    console.error('submitLeave error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Tabel tr_leave belum tersedia di database myWaschen. Jalankan DDL di agent/tr_leave.sql terlebih dahulu.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal mengirim pengajuan izin', error: error.message });
  }
};

/**
 * PUT /api/leave/:id (multipart)
 * Hanya bisa diedit jika status masih 'pengajuan'.
 */
export const updateLeave = async (req, res) => {
  const uploadedFileName = req.file ? req.file.filename : null;
  const cleanupFile = async () => {
    if (uploadedFileName) await deleteLeaveDocFile(uploadedFileName);
  };

  try {
    const employeeId = req.user.employee_id;
    const { id } = req.params;
    const { leave_type, duration_type, start_date, end_date, reason } = req.body;

    const [existingRows] = await myWaschenPool.query(
      'SELECT * FROM tr_leave WHERE leave_id = ? AND employee_id = ?',
      [id, employeeId]
    );
    const existing = existingRows[0];
    if (!existing) {
      await cleanupFile();
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }
    if (existing.status !== 'pengajuan') {
      await cleanupFile();
      return res.status(403).json({ success: false, message: 'Pengajuan yang sudah diproses tidak dapat diubah' });
    }

    const newLeaveType = leave_type || existing.leave_type;
    const newDurationType = duration_type || existing.duration_type;
    const newStartDate = start_date || existing.start_date;
    const newEndDate = end_date || existing.end_date;
    const newReason = reason ? reason.trim() : existing.reason;

    if (!LEAVE_TYPES.includes(newLeaveType)) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'leave_type tidak valid' });
    }
    if (!DURATION_TYPES.includes(newDurationType)) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'duration_type tidak valid' });
    }
    if (newStartDate > newEndDate) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'end_date tidak boleh sebelum start_date' });
    }
    if (!newReason || newReason.length < 5) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Keterangan wajib diisi minimal 5 karakter' });
    }
    if (newDurationType !== 'full_day' && newStartDate !== newEndDate) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Izin setengah hari hanya berlaku untuk 1 hari' });
    }
    if (newLeaveType === 'sakit' && !req.file && !existing.doctor_note_name) {
      await cleanupFile();
      return res.status(422).json({ success: false, message: 'Foto surat dokter wajib dilampirkan untuk izin sakit' });
    }

    const [overlap] = await myWaschenPool.query(
      `SELECT leave_id FROM tr_leave
       WHERE employee_id = ? AND leave_id <> ?
         AND status IN ('pengajuan', 'disetujui')
         AND start_date <= ? AND end_date >= ?`,
      [employeeId, id, newEndDate, newStartDate]
    );
    if (overlap.length > 0) {
      await cleanupFile();
      return res.status(409).json({ success: false, message: 'Terdapat pengajuan izin aktif lain pada rentang tanggal tersebut' });
    }

    let newDoctorNotePath = existing.doctor_note_path;
    let newDoctorNoteName = existing.doctor_note_name;
    if (req.file) {
      if (existing.doctor_note_name) {
        await deleteLeaveDocFile(existing.doctor_note_name);
      }
      newDoctorNotePath = LEAVE_UPLOAD_PUBLIC_PATH;
      newDoctorNoteName = req.file.filename;
    } else if (newLeaveType !== 'sakit') {
      if (existing.doctor_note_name) {
        await deleteLeaveDocFile(existing.doctor_note_name);
      }
      newDoctorNotePath = null;
      newDoctorNoteName = null;
    }

    await myWaschenPool.query(
      `UPDATE tr_leave
       SET leave_type=?, duration_type=?, start_date=?, end_date=?, reason=?,
           doctor_note_path=?, doctor_note_name=?
       WHERE leave_id=?`,
      [newLeaveType, newDurationType, newStartDate, newEndDate, newReason, newDoctorNotePath, newDoctorNoteName, id]
    );

    const [updatedRows] = await myWaschenPool.query('SELECT * FROM tr_leave WHERE leave_id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Pengajuan berhasil diperbarui', data: mapRow(req, updatedRows[0]) });
  } catch (error) {
    await cleanupFile();
    console.error('updateLeave error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengajuan izin', error: error.message });
  }
};

/**
 * DELETE /api/leave/:id
 * Hanya bisa dibatalkan jika status masih 'pengajuan'.
 */
export const cancelLeave = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const { id } = req.params;

    const [existingRows] = await myWaschenPool.query(
      'SELECT * FROM tr_leave WHERE leave_id = ? AND employee_id = ?',
      [id, employeeId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }
    if (existing.status !== 'pengajuan') {
      return res.status(403).json({ success: false, message: 'Hanya pengajuan dengan status "pengajuan" yang dapat dibatalkan' });
    }

    if (existing.doctor_note_name) {
      await deleteLeaveDocFile(existing.doctor_note_name);
    }

    await myWaschenPool.query('DELETE FROM tr_leave WHERE leave_id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Pengajuan berhasil dibatalkan' });
  } catch (error) {
    console.error('cancelLeave error:', error);
    return res.status(500).json({ success: false, message: 'Gagal membatalkan pengajuan izin', error: error.message });
  }
};
