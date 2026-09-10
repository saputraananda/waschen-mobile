import { myWaschenPool } from '../../db/pool.js';

/**
 * =============================================================================
 * BUSINESS RULES — LEMBUR (tr_overtime) — MEMORY / DO NOT DRIFT
 * =============================================================================
 * 1. Karyawan mengisi: tanggal, jam mulai, jam selesai, alasan.
 * 2. Multi-slot diperbolehkan (beberapa pengajuan di hari yang sama), asalkan
 *    rentang jam tidak overlap dengan slot aktif (pengajuan/disetujui).
 * 3. Status awal = 'pengajuan'. Muncul di tab Persetujuan leader cabang
 *    (mst_role.is_leader=1, outlet_id sama) dan di Alsa HRIS.
 * 4. Leader/Alsa ACC → 'disetujui' (+ approval_note opsional).
 *    Tolak → 'ditolak' (+ rejection_note wajib).
 * 5. Edit setelah disetujui: BOLEH edit semua field, TAPI status kembali ke
 *    'pengajuan' dan frontend WAJIB tampilkan notif agar karyawan sadar
 *    perlu ACC ulang. Hapus/batal juga boleh meski sudah ACC → 'dibatalkan'.
 * 6. FLAG KPI di tr_item_progress (saat QC di jendela jam):
 *    - status lembur 'disetujui'  → work_time_flag = 'overtime'
 *    - status lembur 'pengajuan' → work_time_flag = 'overtime_pending'
 *    - di luar start_time–end_time (tanpa slot yang cover) → TIDAK ada flag
 *      lembur (tetap 'normal'). Contoh: slot 19:00–20:00, kerja jam 20:15
 *      tanpa perpanjang/ACC tambahan → tidak terhitung lembur.
 * 7. Perpanjang jam (mis. sedang di 19:30, ingin sampai 21:00): harus edit
 *    slot / ajukan slot baru → butuh ACC leader lagi. Tanpa itu, item setelah
 *    end_time tidak dapat flag lembur.
 * 8. ACC terlambat (besok baru ACC): progress yang sudah ditandai
 *    overtime_pending dipromosikan jadi 'overtime'. Jika ditolak/dibatalkan:
 *    jadi 'outside_hours' (kerja di luar jam, sukarela, bukan KPI lembur).
 * =============================================================================
 */
import { emitDataChange } from '../../socket/io.js';

const ACTIVE_STATUSES = ['pengajuan', 'disetujui'];

const toDateOnly = (v) => {
  if (!v) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const toTimeOnly = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  // accept HH:MM or HH:MM:SS
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = String(Math.min(23, Number(m[1]))).padStart(2, '0');
  const mm = String(Math.min(59, Number(m[2]))).padStart(2, '0');
  const ss = String(Math.min(59, Number(m[3] || 0))).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const timeToSec = (t) => {
  const p = String(t).split(':').map(Number);
  return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
};

const mapRow = (row) => ({
  ...row,
  overtime_date: toDateOnly(row.overtime_date),
  start_time: row.start_time ? String(row.start_time).slice(0, 8) : null,
  end_time: row.end_time ? String(row.end_time).slice(0, 8) : null
});

const resolveRoleMeta = async (employeeId) => {
  const [rows] = await myWaschenPool.query(
    `SELECT role, is_leader, outlet_id, employee_name
     FROM mst_role WHERE employee_id = ? LIMIT 1`,
    [employeeId]
  );
  return rows[0] || null;
};

const assertLeaderOfOutlet = async (employeeId, outletId) => {
  const role = await resolveRoleMeta(employeeId);
  if (!role || Number(role.is_leader) !== 1) {
    const err = new Error('Hanya leader yang dapat menyetujui/menolak lembur');
    err.status = 403;
    throw err;
  }
  if (Number(role.outlet_id) !== Number(outletId)) {
    const err = new Error('Leader hanya dapat mereview pengajuan di outlet sendiri');
    err.status = 403;
    throw err;
  }
  return role;
};

/** Cek overlap jam di hari yang sama untuk slot aktif. */
const hasTimeOverlap = async (employeeId, overtimeDate, startTime, endTime, excludeId = null) => {
  const params = [employeeId, overtimeDate, ...ACTIVE_STATUSES];
  let sql = `
    SELECT id, start_time, end_time FROM tr_overtime
    WHERE employee_id = ? AND overtime_date = ?
      AND status IN (?, ?)
  `;
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  const [rows] = await myWaschenPool.query(sql, params);
  const s = timeToSec(startTime);
  const e = timeToSec(endTime);
  return rows.some((r) => {
    const rs = timeToSec(String(r.start_time).slice(0, 8));
    const re = timeToSec(String(r.end_time).slice(0, 8));
    return s < re && e > rs;
  });
};

/**
 * Reconcile flag progress terkait satu overtime_id.
 * mode: 'approve' | 'reject_or_cancel' | 'reset_pending' | 'resync_window'
 */
const reconcileProgressFlags = async (connOrPool, overtimeId, mode, window = null) => {
  const db = connOrPool;
  if (mode === 'approve') {
    await db.query(
      `UPDATE tr_item_progress
       SET work_time_flag = 'overtime'
       WHERE overtime_id = ? AND work_time_flag IN ('overtime_pending','overtime')`,
      [overtimeId]
    );
    return;
  }
  if (mode === 'reject_or_cancel') {
    await db.query(
      `UPDATE tr_item_progress
       SET work_time_flag = 'outside_hours'
       WHERE overtime_id = ? AND work_time_flag IN ('overtime_pending','overtime')`,
      [overtimeId]
    );
    return;
  }
  if (mode === 'reset_pending') {
    await db.query(
      `UPDATE tr_item_progress
       SET work_time_flag = 'overtime_pending'
       WHERE overtime_id = ? AND work_time_flag IN ('overtime','overtime_pending')`,
      [overtimeId]
    );
    return;
  }
  if (mode === 'resync_window' && window) {
    const { overtime_date, start_time, end_time } = window;
    // Di dalam jendela baru → pending (menunggu ACC ulang)
    await db.query(
      `UPDATE tr_item_progress
       SET work_time_flag = 'overtime_pending'
       WHERE overtime_id = ?
         AND DATE(completed_at) = ?
         AND TIME(completed_at) >= ?
         AND TIME(completed_at) <= ?`,
      [overtimeId, overtime_date, start_time, end_time]
    );
    // Di luar jendela baru → lepas flag lembur (bukan KPI)
    await db.query(
      `UPDATE tr_item_progress
       SET overtime_id = NULL, work_time_flag = 'normal'
       WHERE overtime_id = ?
         AND (
           DATE(completed_at) <> ?
           OR TIME(completed_at) < ?
           OR TIME(completed_at) > ?
         )`,
      [overtimeId, overtime_date, start_time, end_time]
    );
  }
};

/**
 * Dipakai produksi QC: cari slot lembur yang cover timestamp sekarang.
 * MEMORY: hanya item di dalam [start_time, end_time] yang dapat flag.
 */
export const findCoveringOvertime = async (employeeId, atDateTime = new Date()) => {
  const d = atDateTime instanceof Date ? atDateTime : new Date(atDateTime);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

  const [rows] = await myWaschenPool.query(
    `SELECT id, status FROM tr_overtime
     WHERE employee_id = ?
       AND overtime_date = ?
       AND status IN ('pengajuan', 'disetujui')
       AND ? BETWEEN start_time AND end_time
     ORDER BY FIELD(status, 'disetujui', 'pengajuan'), id DESC
     LIMIT 1`,
    [employeeId, dateStr, timeStr]
  );
  if (!rows[0]) return null;
  return {
    overtime_id: rows[0].id,
    work_time_flag: rows[0].status === 'disetujui' ? 'overtime' : 'overtime_pending'
  };
};

/**
 * GET /api/overtime/me-meta — is_leader + outlet untuk UI tabs
 */
export const getMeMeta = async (req, res) => {
  try {
    const role = await resolveRoleMeta(req.user.employee_id);
    return res.json({
      success: true,
      data: {
        is_leader: Number(role?.is_leader) === 1,
        outlet_id: role?.outlet_id ?? req.user.assignedOutletId ?? null,
        employee_name: role?.employee_name || null,
        role: role?.role || null
      }
    });
  } catch (error) {
    console.error('getMeMeta overtime:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/overtime/list?month=&year=&status=&scope=mine|history
 */
export const getMyList = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const month = parseInt(req.query.month || '0', 10);
    const year = parseInt(req.query.year || '0', 10);
    const status = String(req.query.status || '').trim().toLowerCase();
    const scope = String(req.query.scope || 'mine').toLowerCase();

    const cond = ['employee_id = ?'];
    const params = [employeeId];

    if (month >= 1 && month <= 12 && year >= 2000) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const periodStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
      const periodEnd = `${year}-${String(month).padStart(2, '0')}-25`;
      cond.push('overtime_date >= ? AND overtime_date <= ?');
      params.push(periodStart, periodEnd);
    }

    // Tab Pengajuan: aktif (pengajuan + disetujui belum lewat / semua aktif)
    // Tab Riwayat: semua status final + yang sudah selesai review
    if (scope === 'pengajuan') {
      cond.push(`status IN ('pengajuan','disetujui')`);
    } else if (scope === 'riwayat') {
      // riwayat = semua milik sendiri
      if (status && ['pengajuan', 'disetujui', 'ditolak', 'dibatalkan'].includes(status)) {
        cond.push('status = ?');
        params.push(status);
      }
    } else if (status && ['pengajuan', 'disetujui', 'ditolak', 'dibatalkan'].includes(status)) {
      cond.push('status = ?');
      params.push(status);
    }

    const [rows] = await myWaschenPool.query(
      `SELECT * FROM tr_overtime WHERE ${cond.join(' AND ')} ORDER BY overtime_date DESC, start_time DESC, id DESC LIMIT 500`,
      params
    );

    return res.json({ success: true, data: rows.map(mapRow) });
  } catch (error) {
    console.error('getMyList overtime:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Tabel tr_overtime belum tersedia. Jalankan migrasi lembur terlebih dahulu.'
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/overtime/approvals?filter=pengajuan|disetujui|ditolak
 * Leader only — pengajuan karyawan outlet yang sama.
 */
export const getApprovals = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const role = await resolveRoleMeta(employeeId);
    if (!role || Number(role.is_leader) !== 1) {
      return res.status(403).json({ success: false, message: 'Hanya leader yang dapat melihat tab Persetujuan' });
    }

    const filter = String(req.query.filter || 'pengajuan').toLowerCase();
    const allowed = ['pengajuan', 'disetujui', 'ditolak', 'semua'];
    const statusFilter = allowed.includes(filter) ? filter : 'pengajuan';

    const cond = ['outlet_id = ?', 'employee_id <> ?'];
    const params = [role.outlet_id, employeeId];

    if (statusFilter !== 'semua') {
      cond.push('status = ?');
      params.push(statusFilter);
    } else {
      cond.push(`status IN ('pengajuan','disetujui','ditolak')`);
    }

    const month = parseInt(req.query.month || '0', 10);
    const year = parseInt(req.query.year || '0', 10);
    if (month >= 1 && month <= 12 && year >= 2000) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const periodStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
      const periodEnd = `${year}-${String(month).padStart(2, '0')}-25`;
      cond.push('overtime_date >= ? AND overtime_date <= ?');
      params.push(periodStart, periodEnd);
    }

    const [rows] = await myWaschenPool.query(
      `SELECT * FROM tr_overtime WHERE ${cond.join(' AND ')}
       ORDER BY FIELD(status,'pengajuan','disetujui','ditolak'), overtime_date DESC, start_time DESC
       LIMIT 500`,
      params
    );

    return res.json({ success: true, data: rows.map(mapRow) });
  } catch (error) {
    console.error('getApprovals overtime:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/overtime
 * body: overtime_date, start_time, end_time, reason
 */
export const createOvertime = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const overtime_date = toDateOnly(req.body.overtime_date);
    const start_time = toTimeOnly(req.body.start_time);
    const end_time = toTimeOnly(req.body.end_time);
    const reason = String(req.body.reason || '').trim();

    if (!overtime_date || !start_time || !end_time) {
      return res.status(422).json({ success: false, message: 'Tanggal, jam mulai, dan jam selesai wajib diisi' });
    }
    if (timeToSec(start_time) >= timeToSec(end_time)) {
      return res.status(422).json({ success: false, message: 'Jam selesai harus setelah jam mulai' });
    }
    if (reason.length < 5) {
      return res.status(422).json({ success: false, message: 'Alasan lembur wajib diisi minimal 5 karakter' });
    }

    const role = await resolveRoleMeta(employeeId);
    const outletId = role?.outlet_id || req.user.assignedOutletId;
    if (!outletId) {
      return res.status(422).json({ success: false, message: 'Outlet karyawan tidak ditemukan di mst_role' });
    }

    if (await hasTimeOverlap(employeeId, overtime_date, start_time, end_time)) {
      return res.status(409).json({
        success: false,
        message: 'Rentang jam overlap dengan pengajuan lembur aktif lain. Perpanjang slot yang ada atau pilih jam berbeda.'
      });
    }

    const [result] = await myWaschenPool.query(
      `INSERT INTO tr_overtime
         (employee_id, employee_name, outlet_id, overtime_date, start_time, end_time, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pengajuan')`,
      [employeeId, role?.employee_name || null, outletId, overtime_date, start_time, end_time, reason]
    );

    const [rows] = await myWaschenPool.query('SELECT * FROM tr_overtime WHERE id = ?', [result.insertId]);
    emitDataChange({
      domain: 'overtime',
      outletId,
      employeeId,
      action: 'create'
    });
    return res.status(201).json({
      success: true,
      message: 'Pengajuan lembur dikirim. Menunggu persetujuan leader.',
      data: mapRow(rows[0])
    });
  } catch (error) {
    console.error('createOvertime:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/overtime/:id
 * MEMORY: jika sebelumnya 'disetujui', edit apapun → status kembali 'pengajuan'
 * (butuh ACC ulang). Response menyertakan reset_to_pengajuan=true untuk notif UI.
 */
export const updateOvertime = async (req, res) => {
  const conn = await myWaschenPool.getConnection();
  try {
    const employeeId = req.user.employee_id;
    const id = Number(req.params.id);

    const [existingRows] = await conn.query(
      'SELECT * FROM tr_overtime WHERE id = ? AND employee_id = ? LIMIT 1',
      [id, employeeId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pengajuan lembur tidak ditemukan' });
    }
    if (existing.status === 'ditolak' || existing.status === 'dibatalkan') {
      return res.status(403).json({ success: false, message: 'Pengajuan yang ditolak/dibatalkan tidak dapat diedit' });
    }

    const overtime_date = toDateOnly(req.body.overtime_date ?? existing.overtime_date);
    const start_time = toTimeOnly(req.body.start_time ?? String(existing.start_time).slice(0, 8));
    const end_time = toTimeOnly(req.body.end_time ?? String(existing.end_time).slice(0, 8));
    const reason = String(req.body.reason ?? existing.reason).trim();

    if (!overtime_date || !start_time || !end_time) {
      return res.status(422).json({ success: false, message: 'Tanggal dan jam wajib diisi' });
    }
    if (timeToSec(start_time) >= timeToSec(end_time)) {
      return res.status(422).json({ success: false, message: 'Jam selesai harus setelah jam mulai' });
    }
    if (reason.length < 5) {
      return res.status(422).json({ success: false, message: 'Alasan lembur wajib diisi minimal 5 karakter' });
    }

    if (await hasTimeOverlap(employeeId, overtime_date, start_time, end_time, id)) {
      return res.status(409).json({
        success: false,
        message: 'Rentang jam overlap dengan pengajuan lembur aktif lain.'
      });
    }

    const wasApproved = existing.status === 'disetujui';
    // MEMORY: edit setelah ACC → kembali pengajuan (perpanjang jam juga ikut rule ini)
    const nextStatus = wasApproved || existing.status === 'pengajuan' ? 'pengajuan' : existing.status;
    const resetToPengajuan = wasApproved;

    await conn.beginTransaction();

    await conn.query(
      `UPDATE tr_overtime SET
         overtime_date = ?, start_time = ?, end_time = ?, reason = ?,
         status = ?, approval_note = NULL, rejection_note = NULL,
         reviewed_by = NULL, reviewed_by_name = NULL, reviewed_at = NULL,
         updated_at = NOW()
       WHERE id = ?`,
      [overtime_date, start_time, end_time, reason, nextStatus, id]
    );

    if (resetToPengajuan || existing.status === 'pengajuan') {
      await reconcileProgressFlags(conn, id, 'resync_window', {
        overtime_date,
        start_time,
        end_time
      });
    }

    await conn.commit();

    const [rows] = await myWaschenPool.query('SELECT * FROM tr_overtime WHERE id = ?', [id]);
    emitDataChange({
      domain: 'overtime',
      outletId: rows[0]?.outlet_id,
      employeeId,
      action: resetToPengajuan ? 'reset_pengajuan' : 'update'
    });
    return res.json({
      success: true,
      reset_to_pengajuan: resetToPengajuan,
      message: resetToPengajuan
        ? 'Perubahan disimpan. Status kembali ke Pengajuan — leader harus menyetujui ulang (termasuk jika Anda memperpanjang jam).'
        : 'Pengajuan lembur diperbarui',
      data: mapRow(rows[0])
    });
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error('updateOvertime:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

/**
 * DELETE /api/overtime/:id — batalkan (boleh meski sudah disetujui)
 */
export const cancelOvertime = async (req, res) => {
  const conn = await myWaschenPool.getConnection();
  try {
    const employeeId = req.user.employee_id;
    const id = Number(req.params.id);

    const [existingRows] = await conn.query(
      'SELECT * FROM tr_overtime WHERE id = ? AND employee_id = ? LIMIT 1',
      [id, employeeId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }
    if (existing.status === 'ditolak' || existing.status === 'dibatalkan') {
      return res.status(403).json({ success: false, message: 'Pengajuan sudah tidak aktif' });
    }

    await conn.beginTransaction();
    await conn.query(
      `UPDATE tr_overtime SET status = 'dibatalkan', updated_at = NOW() WHERE id = ?`,
      [id]
    );
    // MEMORY: progress yang sudah di-flag → outside_hours (bukan KPI lembur)
    await reconcileProgressFlags(conn, id, 'reject_or_cancel');
    await conn.commit();

    emitDataChange({
      domain: 'overtime',
      outletId: existing.outlet_id,
      employeeId,
      action: 'cancel'
    });
    return res.json({ success: true, message: 'Pengajuan lembur dibatalkan' });
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error('cancelOvertime:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

/**
 * PATCH /api/overtime/:id/approve
 * body: approval_note? (opsional)
 */
export const approveOvertime = async (req, res) => {
  const conn = await myWaschenPool.getConnection();
  try {
    const reviewerId = req.user.employee_id;
    const id = Number(req.params.id);
    const approval_note = String(req.body.approval_note || req.body.note || '').trim() || null;

    const [rows] = await conn.query('SELECT * FROM tr_overtime WHERE id = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    if (row.status !== 'pengajuan') {
      return res.status(403).json({ success: false, message: 'Hanya status pengajuan yang dapat disetujui' });
    }
    if (Number(row.employee_id) === Number(reviewerId)) {
      return res.status(403).json({ success: false, message: 'Tidak dapat menyetujui pengajuan sendiri' });
    }

    const reviewer = await assertLeaderOfOutlet(reviewerId, row.outlet_id);

    await conn.beginTransaction();
    await conn.query(
      `UPDATE tr_overtime SET
         status = 'disetujui',
         approval_note = ?,
         rejection_note = NULL,
         reviewed_by = ?,
         reviewed_by_name = ?,
         reviewed_at = NOW(),
         updated_at = NOW()
       WHERE id = ?`,
      [approval_note, reviewerId, reviewer.employee_name || null, id]
    );
    // MEMORY: ACC (termasuk terlambat) → promote pending → overtime (KPI)
    await reconcileProgressFlags(conn, id, 'approve');
    await conn.commit();

    emitDataChange({
      domain: 'overtime',
      outletId: row.outlet_id,
      employeeId: row.employee_id,
      action: 'approve'
    });
    return res.json({ success: true, message: 'Lembur disetujui' });
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error('approveOvertime:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

/**
 * PATCH /api/overtime/:id/reject
 * body: rejection_note (wajib)
 */
export const rejectOvertime = async (req, res) => {
  const conn = await myWaschenPool.getConnection();
  try {
    const reviewerId = req.user.employee_id;
    const id = Number(req.params.id);
    const rejection_note = String(req.body.rejection_note || req.body.note || '').trim();

    if (rejection_note.length < 3) {
      return res.status(422).json({ success: false, message: 'Alasan penolakan wajib diisi' });
    }

    const [rows] = await conn.query('SELECT * FROM tr_overtime WHERE id = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    if (row.status !== 'pengajuan') {
      return res.status(403).json({ success: false, message: 'Hanya status pengajuan yang dapat ditolak' });
    }
    if (Number(row.employee_id) === Number(reviewerId)) {
      return res.status(403).json({ success: false, message: 'Tidak dapat menolak pengajuan sendiri' });
    }

    const reviewer = await assertLeaderOfOutlet(reviewerId, row.outlet_id);

    await conn.beginTransaction();
    await conn.query(
      `UPDATE tr_overtime SET
         status = 'ditolak',
         rejection_note = ?,
         approval_note = NULL,
         reviewed_by = ?,
         reviewed_by_name = ?,
         reviewed_at = NOW(),
         updated_at = NOW()
       WHERE id = ?`,
      [rejection_note, reviewerId, reviewer.employee_name || null, id]
    );
    // MEMORY: ditolak → outside_hours (bukan KPI lembur)
    await reconcileProgressFlags(conn, id, 'reject_or_cancel');
    await conn.commit();

    emitDataChange({
      domain: 'overtime',
      outletId: row.outlet_id,
      employeeId: row.employee_id,
      action: 'reject'
    });
    return res.json({ success: true, message: 'Lembur ditolak' });
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error('rejectOvertime:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};
