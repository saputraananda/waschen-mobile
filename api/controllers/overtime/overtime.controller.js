import { myWaschenPool } from '../../db/pool.js';
import { emitDataChange } from '../../socket/io.js';

/**
 * =============================================================================
 * BUSINESS RULES — LEMBUR (tr_overtime) — MEMORY / DO NOT DRIFT
 * =============================================================================
 * Alur sesi (seperti absen), BUKAN pengajuan di muka:
 * 1. Karyawan Start Lembur → status 'berlangsung', start_at=NOW().
 *    Hanya 1 sesi berlangsung per karyawan.
 * 2. Selama 'berlangsung', semua QC/kerja di-tag overtime_id +
 *    work_time_flag='overtime_pending'.
 * 3. Karyawan Close Lembur → end_at=NOW(), status 'pengajuan'
 *    (muncul di Persetujuan leader + Alsa).
 * 4. Leader/Alsa ACC → 'disetujui' (pending→overtime KPI).
 *    Tolak → 'ditolak' (→outside_hours = sukarela).
 * 5. Setelah close: boleh edit jam/alasan (seperti dulu). Edit setelah ACC
 *    → status kembali 'pengajuan' (ACC ulang). Hapus/batal → 'dibatalkan'.
 * 6. Lupa close & ganti hari: sesi tetap 'berlangsung' → AlertOvertime merah
 *    + lock menu (kecuali Lembur/Riwayat/Profil) sampai close.
 * =============================================================================
 */

const CLOSED_ACTIVE = ['pengajuan', 'disetujui'];

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
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = String(Math.min(23, Number(m[1]))).padStart(2, '0');
  const mm = String(Math.min(59, Number(m[2]))).padStart(2, '0');
  const ss = String(Math.min(59, Number(m[3] || 0))).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const pad2 = (n) => String(n).padStart(2, '0');

const formatSqlDateTime = (d = new Date()) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())} ${pad2(x.getHours())}:${pad2(x.getMinutes())}:${pad2(x.getSeconds())}`;
};

const parseSqlDateTime = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).replace('T', ' ').slice(0, 19);
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
};

const isSameCalendarDay = (a, b = new Date()) => {
  const da = a instanceof Date ? a : parseSqlDateTime(a);
  const db = b instanceof Date ? b : parseSqlDateTime(b);
  if (!da || !db) return true;
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
};

const mapRow = (row) => {
  if (!row) return null;
  const startAt = row.start_at || null;
  const endAt = row.end_at || null;
  const startParsed = parseSqlDateTime(startAt);
  const pastMidnight = row.status === 'berlangsung' && startParsed
    ? !isSameCalendarDay(startParsed, new Date())
    : false;
  return {
    ...row,
    overtime_date: toDateOnly(row.overtime_date),
    start_time: row.start_time ? String(row.start_time).slice(0, 8) : null,
    end_time: row.end_time ? String(row.end_time).slice(0, 8) : null,
    start_at: startAt ? formatSqlDateTime(parseSqlDateTime(startAt) || startAt) : null,
    end_at: endAt ? formatSqlDateTime(parseSqlDateTime(endAt) || endAt) : null,
    is_active: row.status === 'berlangsung',
    past_midnight: pastMidnight
  };
};

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

const getOpenSession = async (employeeId, connOrPool = myWaschenPool) => {
  const [rows] = await connOrPool.query(
    `SELECT * FROM tr_overtime
     WHERE employee_id = ? AND status = 'berlangsung' AND end_at IS NULL
     ORDER BY id DESC LIMIT 1`,
    [employeeId]
  );
  return rows[0] || null;
};

/** Overlap sesi tertutup (pengajuan/disetujui) via DATETIME. */
const hasDateTimeOverlap = async (employeeId, startAt, endAt, excludeId = null) => {
  let sql = `
    SELECT id FROM tr_overtime
    WHERE employee_id = ?
      AND status IN (?, ?)
      AND start_at IS NOT NULL AND end_at IS NOT NULL
      AND start_at < ? AND end_at > ?
  `;
  const p = [employeeId, ...CLOSED_ACTIVE, endAt, startAt];
  if (excludeId) {
    sql += ' AND id <> ?';
    p.push(excludeId);
  }
  const [rows] = await myWaschenPool.query(sql, p);
  return rows.length > 0;
};

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
    const { start_at, end_at } = window;
    await db.query(
      `UPDATE tr_item_progress
       SET work_time_flag = 'overtime_pending'
       WHERE overtime_id = ?
         AND completed_at >= ?
         AND completed_at <= ?`,
      [overtimeId, start_at, end_at]
    );
    await db.query(
      `UPDATE tr_item_progress
       SET overtime_id = NULL, work_time_flag = 'normal'
       WHERE overtime_id = ?
         AND (completed_at < ? OR completed_at > ?)`,
      [overtimeId, start_at, end_at]
    );
  }
};

/**
 * Dipakai produksi QC: sesi berlangsung ATAU jendela closed yang cover now.
 */
export const findCoveringOvertime = async (employeeId, atDateTime = new Date()) => {
  const at = atDateTime instanceof Date ? atDateTime : new Date(atDateTime);
  const atSql = formatSqlDateTime(at);

  const open = await getOpenSession(employeeId);
  if (open) {
    return { overtime_id: open.id, work_time_flag: 'overtime_pending' };
  }

  const [rows] = await myWaschenPool.query(
    `SELECT id, status FROM tr_overtime
     WHERE employee_id = ?
       AND status IN ('pengajuan', 'disetujui')
       AND start_at IS NOT NULL AND end_at IS NOT NULL
       AND ? BETWEEN start_at AND end_at
     ORDER BY FIELD(status, 'disetujui', 'pengajuan'), id DESC
     LIMIT 1`,
    [employeeId, atSql]
  );
  if (!rows[0]) return null;
  return {
    overtime_id: rows[0].id,
    work_time_flag: rows[0].status === 'disetujui' ? 'overtime' : 'overtime_pending'
  };
};

export const getMeMeta = async (req, res) => {
  try {
    const role = await resolveRoleMeta(req.user.employee_id);
    const active = await getOpenSession(req.user.employee_id);
    return res.json({
      success: true,
      data: {
        is_leader: Number(role?.is_leader) === 1,
        outlet_id: role?.outlet_id ?? req.user.assignedOutletId ?? null,
        employee_name: role?.employee_name || null,
        role: role?.role || null,
        active_overtime: mapRow(active)
      }
    });
  } catch (error) {
    console.error('getMeMeta overtime:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** GET /api/overtime/active */
export const getActiveOvertime = async (req, res) => {
  try {
    const active = await getOpenSession(req.user.employee_id);
    return res.json({
      success: true,
      data: mapRow(active),
      locked: Boolean(active && mapRow(active)?.past_midnight)
    });
  } catch (error) {
    console.error('getActiveOvertime:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/overtime/start — mulai sesi lembur */
export const startOvertime = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const existing = await getOpenSession(employeeId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Anda masih memiliki sesi lembur yang berlangsung. Close dulu sebelum start baru.',
        data: mapRow(existing)
      });
    }

    const role = await resolveRoleMeta(employeeId);
    const outletId = role?.outlet_id || req.user.assignedOutletId;
    if (!outletId) {
      return res.status(422).json({ success: false, message: 'Outlet karyawan tidak ditemukan di mst_role' });
    }

    const now = new Date();
    const startAt = formatSqlDateTime(now);
    const overtimeDate = toDateOnly(now);
    const startTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const reason = String(req.body.reason || '').trim() || 'Sesi lembur';

    const [result] = await myWaschenPool.query(
      `INSERT INTO tr_overtime
         (employee_id, employee_name, outlet_id, overtime_date, start_time, end_time,
          start_at, end_at, reason, status)
       VALUES (?, ?, ?, ?, ?, '23:59:59', ?, NULL, ?, 'berlangsung')`,
      [employeeId, role?.employee_name || null, outletId, overtimeDate, startTime, startAt, reason]
    );

    const [rows] = await myWaschenPool.query('SELECT * FROM tr_overtime WHERE id = ?', [result.insertId]);
    emitDataChange({ domain: 'overtime', outletId, employeeId, action: 'start' });
    return res.status(201).json({
      success: true,
      message: 'Sesi lembur dimulai. Semua kerjaan akan tercatat sebagai lembur sampai Anda close.',
      data: mapRow(rows[0])
    });
  } catch (error) {
    console.error('startOvertime:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/overtime/end — tutup sesi → pengajuan */
export const endOvertime = async (req, res) => {
  const conn = await myWaschenPool.getConnection();
  try {
    const employeeId = req.user.employee_id;
    const active = await getOpenSession(employeeId, conn);
    if (!active) {
      return res.status(404).json({ success: false, message: 'Tidak ada sesi lembur yang berlangsung' });
    }

    const now = new Date();
    const endAt = formatSqlDateTime(now);
    const endTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const reasonRaw = String(req.body.reason || active.reason || '').trim();
    const reason = reasonRaw.length >= 5 ? reasonRaw : (active.reason || 'Sesi lembur');

    const startParsed = parseSqlDateTime(active.start_at);
    if (startParsed && now.getTime() <= startParsed.getTime()) {
      return res.status(422).json({ success: false, message: 'Jam selesai harus setelah jam mulai' });
    }

    await conn.beginTransaction();
    await conn.query(
      `UPDATE tr_overtime SET
         end_at = ?, end_time = ?, reason = ?, status = 'pengajuan', updated_at = NOW()
       WHERE id = ? AND status = 'berlangsung'`,
      [endAt, endTime, reason, active.id]
    );
    await conn.commit();

    const [rows] = await myWaschenPool.query('SELECT * FROM tr_overtime WHERE id = ?', [active.id]);
    emitDataChange({
      domain: 'overtime',
      outletId: active.outlet_id,
      employeeId,
      action: 'end'
    });
    return res.json({
      success: true,
      message: 'Sesi lembur ditutup. Status menjadi Pengajuan — menunggu ACC leader. Anda bisa edit jam/alasan jika perlu.',
      data: mapRow(rows[0])
    });
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error('endOvertime:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

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

    if (scope === 'pengajuan') {
      cond.push(`status IN ('berlangsung','pengajuan','disetujui')`);
    } else if (scope === 'riwayat') {
      if (status && ['berlangsung', 'pengajuan', 'disetujui', 'ditolak', 'dibatalkan'].includes(status)) {
        cond.push('status = ?');
        params.push(status);
      }
    } else if (status && ['berlangsung', 'pengajuan', 'disetujui', 'ditolak', 'dibatalkan'].includes(status)) {
      cond.push('status = ?');
      params.push(status);
    }

    const [rows] = await myWaschenPool.query(
      `SELECT * FROM tr_overtime WHERE ${cond.join(' AND ')}
       ORDER BY FIELD(status,'berlangsung','pengajuan','disetujui','ditolak','dibatalkan'),
                overtime_date DESC, start_at DESC, id DESC
       LIMIT 500`,
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
       ORDER BY FIELD(status,'pengajuan','disetujui','ditolak'), overtime_date DESC, start_at DESC
       LIMIT 500`,
      params
    );

    return res.json({ success: true, data: rows.map(mapRow) });
  } catch (error) {
    console.error('getApprovals overtime:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** Legacy create — redirect behavior: start session if no times, else reject */
export const createOvertime = async (req, res) => {
  // Backward-compatible: prefer start session
  return startOvertime(req, res);
};

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
      return res.status(404).json({ success: false, message: 'Data lembur tidak ditemukan' });
    }
    if (existing.status === 'berlangsung') {
      return res.status(403).json({
        success: false,
        message: 'Sesi masih berlangsung. Close lembur dulu, baru bisa edit jam.'
      });
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
    if (reason.length < 5) {
      return res.status(422).json({ success: false, message: 'Alasan lembur wajib diisi minimal 5 karakter' });
    }

    // Build DATETIME window (handle overnight if end < start)
    const startAt = `${overtime_date} ${start_time}`;
    let endDate = overtime_date;
    const [sh, sm, ss] = start_time.split(':').map(Number);
    const [eh, em, es] = end_time.split(':').map(Number);
    const startN = sh * 3600 + sm * 60 + (ss || 0);
    const endN = eh * 3600 + em * 60 + (es || 0);
    if (endN <= startN) {
      const d = new Date(`${overtime_date}T00:00:00`);
      d.setDate(d.getDate() + 1);
      endDate = toDateOnly(d);
    }
    const endAt = `${endDate} ${end_time}`;

    if (await hasDateTimeOverlap(employeeId, startAt, endAt, id)) {
      return res.status(409).json({
        success: false,
        message: 'Rentang jam overlap dengan pengajuan lembur aktif lain.'
      });
    }

    const wasApproved = existing.status === 'disetujui';
    const nextStatus = wasApproved || existing.status === 'pengajuan' ? 'pengajuan' : existing.status;
    const resetToPengajuan = wasApproved;

    await conn.beginTransaction();
    await conn.query(
      `UPDATE tr_overtime SET
         overtime_date = ?, start_time = ?, end_time = ?,
         start_at = ?, end_at = ?, reason = ?,
         status = ?, approval_note = NULL, rejection_note = NULL,
         reviewed_by = NULL, reviewed_by_name = NULL, reviewed_at = NULL,
         updated_at = NOW()
       WHERE id = ?`,
      [overtime_date, start_time, end_time, startAt, endAt, reason, nextStatus, id]
    );

    if (resetToPengajuan || existing.status === 'pengajuan') {
      await reconcileProgressFlags(conn, id, 'resync_window', { start_at: startAt, end_at: endAt });
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
        ? 'Perubahan disimpan. Status kembali ke Pengajuan — leader harus menyetujui ulang.'
        : 'Data lembur diperbarui',
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
    if (existing.status === 'berlangsung') {
      await conn.query(
        `UPDATE tr_overtime SET
           status = 'dibatalkan', end_at = NOW(),
           end_time = TIME(NOW()), updated_at = NOW()
         WHERE id = ?`,
        [id]
      );
    } else {
      await conn.query(
        `UPDATE tr_overtime SET status = 'dibatalkan', updated_at = NOW() WHERE id = ?`,
        [id]
      );
    }
    await reconcileProgressFlags(conn, id, 'reject_or_cancel');
    await conn.commit();

    emitDataChange({
      domain: 'overtime',
      outletId: existing.outlet_id,
      employeeId,
      action: 'cancel'
    });
    return res.json({ success: true, message: 'Lembur dibatalkan' });
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error('cancelOvertime:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

export const approveOvertime = async (req, res) => {
  const conn = await myWaschenPool.getConnection();
  try {
    const reviewerId = req.user.employee_id;
    const id = Number(req.params.id);
    const approval_note = String(req.body.approval_note || req.body.note || '').trim() || null;

    const [rows] = await conn.query('SELECT * FROM tr_overtime WHERE id = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    if (row.status === 'berlangsung') {
      return res.status(403).json({ success: false, message: 'Sesi masih berlangsung — karyawan harus close dulu' });
    }
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
    if (row.status === 'berlangsung') {
      return res.status(403).json({ success: false, message: 'Sesi masih berlangsung — karyawan harus close dulu' });
    }
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
    await reconcileProgressFlags(conn, id, 'reject_or_cancel');
    await conn.commit();

    emitDataChange({
      domain: 'overtime',
      outletId: row.outlet_id,
      employeeId: row.employee_id,
      action: 'reject'
    });
    return res.json({ success: true, message: 'Lembur ditolak (dianggap sukarela)' });
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error('rejectOvertime:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};
