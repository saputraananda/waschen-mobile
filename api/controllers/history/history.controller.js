import { mainPool, myWaschenPool } from '../../db/pool.js';
import { emitDataChange } from '../../socket/io.js';
import { toWibDateKey, formatWibTime } from '../../utils/wib.js';
import { cutoffFor, currentCutoff } from '../../utils/kasbonLimit.js';

const leaveLabel = (type) => {
  if (type === 'sakit') return 'Sakit';
  if (type === 'cuti') return 'Cuti';
  return 'Izin';
};

const QUOTA_STATUSES = ['pengajuan', 'disetujui_leader', 'disetujui'];
const VISIBLE_STATUSES = ['pengajuan', 'disetujui_leader', 'ditolak_leader', 'disetujui'];

async function employeeNameMap(ids) {
  const unique = [...new Set(ids.map(Number).filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;
  const [rows] = await mainPool.query(
    `SELECT employee_id, full_name FROM mst_employee WHERE employee_id IN (${unique.map(() => '?').join(',')})`,
    unique
  );
  rows.forEach((row) => map.set(Number(row.employee_id), row.full_name || null));
  return map;
}

const dayOffLabel = (status) => {
  if (status === 'pengajuan') return 'Menunggu leader';
  if (status === 'disetujui_leader') return 'Disetujui leader';
  if (status === 'ditolak_leader') return 'Ditolak leader';
  if (status === 'disetujui') return 'Jadwal Libur';
  return 'Jadwal Libur';
};

/** Pengajuan hanya di tanggal rules (default 20). Periode tetap 26 s/d 25. */
export function requestPeriodOnDay(todayKey, openDay = 20) {
  const day = Number(openDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const [y, m, d] = String(todayKey || '').split('-').map(Number);
  if (d !== day || !y || !m) return null;
  const pad = (n) => String(n).padStart(2, '0');
  let startY = y;
  let startM = m;
  if (day >= 26) {
    startM += 1;
    if (startM > 12) { startM = 1; startY += 1; }
  }
  const start = `${startY}-${pad(startM)}-26`;
  let endM = startM + 1;
  let endY = startY;
  if (endM > 12) { endM = 1; endY += 1; }
  return { start, end: `${endY}-${pad(endM)}-25`, openDay: day };
}

/** Expand date range inclusive → array of YYYY-MM-DD */
const expandDateRange = (start, end) => {
  const out = [];
  const startKey = toWibDateKey(start);
  const endKey = toWibDateKey(end);
  if (!startKey || !endKey) return out;
  const s = new Date(`${startKey}T12:00:00+07:00`);
  const e = new Date(`${endKey}T12:00:00+07:00`);
  for (let cur = new Date(s); cur <= e; cur.setUTCDate(cur.getUTCDate() + 1)) {
    out.push(toWibDateKey(cur));
  }
  return out;
};

const periodOfDate = (dateKey) => {
  const y = Number(String(dateKey).slice(0, 4));
  const m = Number(String(dateKey).slice(5, 7));
  const d = Number(String(dateKey).slice(8, 10));
  if (d >= 26) {
    return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
  }
  return { year: y, month: m };
};

const buildPhotoUrl = (req, photoPath, photoName) => {
  if (!photoPath || !photoName) return null;
  const normalized = photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
  return `${req.protocol}://${req.get('host')}${normalized}/${encodeURIComponent(photoName)}`;
};

async function getDayOffPolicy() {
  const [rows] = await myWaschenPool.query(
    `SELECT max_days_per_month, min_notice_days, allow_past_date_request, request_open_day
     FROM mst_day_off_policy WHERE is_active = 1
     ORDER BY policy_id ASC LIMIT 1`
  );
  const row = rows[0] || { max_days_per_month: 4, min_notice_days: 1, allow_past_date_request: 0, request_open_day: 20 };
  const openDay = Number(row.request_open_day);
  return { ...row, request_open_day: openDay >= 1 && openDay <= 31 ? openDay : 20 };
}

async function countDayOffInRange(employeeId, start, end, statuses = QUOTA_STATUSES) {
  const [rows] = await myWaschenPool.query(
    `SELECT COUNT(*) AS cnt FROM tr_employee_day_off
     WHERE employee_id = ? AND off_date BETWEEN ? AND ?
       AND status IN (${statuses.map(() => '?').join(',')})`,
    [employeeId, start, end, ...statuses]
  );
  return Number(rows[0]?.cnt) || 0;
}

/**
 * GET /api/history/calendar?year=&month=
 * year/month = label periode cutoff (26 bulan sebelumnya s/d 25 bulan itu).
 */
export const getCalendar = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const cur = currentCutoff();
    const year = parseInt(req.query.year || cur.year, 10);
    const month = parseInt(req.query.month || cur.month, 10);

    if (month < 1 || month > 12 || year < 2000) {
      return res.status(422).json({ success: false, message: 'Bulan/tahun tidak valid' });
    }

    const { start, end } = cutoffFor(year, month);

    const [attendanceRows, leaveRows, dayOffRows] = await Promise.all([
      myWaschenPool.query(
        `SELECT work_date, check_in_time, check_out_time,
                check_in_photo_path, check_in_photo_name,
                check_out_photo_path, check_out_photo_name, outlet_id
         FROM tr_attendance
         WHERE employee_id = ? AND work_date BETWEEN ? AND ?`,
        [employeeId, start, end]
      ),
      myWaschenPool.query(
        `SELECT leave_id, leave_type, duration_type, start_date, end_date, reason, status
         FROM tr_leave
         WHERE employee_id = ?
           AND start_date <= ? AND end_date >= ?
           AND status IN ('pengajuan', 'disetujui')`,
        [employeeId, end, start]
      ),
      myWaschenPool.query(
        `SELECT day_off_id, off_date, requested_date, reason, status, source, reviewed_at, backup_employee_id
         FROM tr_employee_day_off
         WHERE employee_id = ? AND off_date BETWEEN ? AND ?
           AND status IN ('pengajuan', 'disetujui_leader', 'ditolak_leader', 'disetujui')`,
        [employeeId, start, end]
      )
    ]);
    const backupNames = await employeeNameMap(dayOffRows[0].map((row) => row.backup_employee_id));

    const days = {};
    const stats = { hadir: 0, izin: 0, sakit: 0, cuti: 0, libur: 0, pengajuan_libur: 0, tidak_masuk: 0 };

    attendanceRows[0].forEach((row) => {
      const key = toWibDateKey(row.work_date);
      if (!key) return;
      if (!row.check_in_time) return;
      days[key] = {
        date: key,
        kind: 'hadir',
        label: 'Hadir',
        check_in: formatWibTime(row.check_in_time),
        check_out: formatWibTime(row.check_out_time),
        check_in_photo_url: buildPhotoUrl(req, row.check_in_photo_path, row.check_in_photo_name),
        check_out_photo_url: buildPhotoUrl(req, row.check_out_photo_path, row.check_out_photo_name),
        outlet_id: row.outlet_id
      };
      stats.hadir += 1;
    });

    leaveRows[0].forEach((row) => {
      expandDateRange(row.start_date, row.end_date).forEach((key) => {
        if (key < start || key > end) return;
        if (days[key]?.kind === 'hadir') return;
        const label = leaveLabel(row.leave_type);
        days[key] = {
          date: key,
          kind: 'leave',
          leave_type: row.leave_type,
          label,
          reason: row.reason,
          leave_status: row.status,
          leave_id: row.leave_id,
          duration_type: row.duration_type
        };
        if (row.leave_type === 'sakit') stats.sakit += 1;
        else if (row.leave_type === 'cuti') stats.cuti += 1;
        else stats.izin += 1;
      });
    });

    dayOffRows[0].forEach((row) => {
      const key = toWibDateKey(row.off_date);
      if (!key || key < start || key > end) return;
      if (days[key]?.kind === 'hadir' || days[key]?.kind === 'leave') return;

      const isFinal = row.status === 'disetujui';
      days[key] = {
        date: key,
        kind: isFinal ? 'libur' : 'libur_pengajuan',
        label: dayOffLabel(row.status),
        reason: row.reason,
        day_off_id: row.day_off_id,
        day_off_status: row.status,
        requested_date: toWibDateKey(row.requested_date),
        source: row.source,
        backup_name: isFinal ? (backupNames.get(Number(row.backup_employee_id)) || null) : null
      };
      if (isFinal) stats.libur += 1;
      else if (QUOTA_STATUSES.includes(row.status)) stats.pengajuan_libur += 1;
    });

    // Hari lampau tanpa absensi / izin / libur → tidak masuk (alpha / lupa absen)
    const today = toWibDateKey(new Date());
    for (const key of expandDateRange(start, end)) {
      if (key >= today) continue;
      if (days[key]) continue;
      days[key] = {
        date: key,
        kind: 'tidak_masuk',
        label: 'Tidak Masuk',
        reason: 'Tidak ada record absensi (lupa absen / alpha)'
      };
      stats.tidak_masuk += 1;
    }

    return res.status(200).json({
      success: true,
      message: 'OK',
      data: { year, month, dateFrom: start, dateTo: end, days, stats, policy: await getDayOffPolicy() }
    });
  } catch (error) {
    console.error('getCalendar error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Tabel riwayat belum lengkap. Jalankan agent/tr_employee_day_off.sql di database myWaschen.'
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal memuat kalender absensi', error: error.message });
  }
};

/**
 * GET /api/history/day-offs?year=&month=&status=
 */
export const getDayOffs = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const cur = currentCutoff();
    const year = parseInt(req.query.year || cur.year, 10);
    const month = parseInt(req.query.month || cur.month, 10);
    const status = req.query.status || 'disetujui';

    const { start, end } = cutoffFor(year, month);
    let statusClause = `status IN (${VISIBLE_STATUSES.map(() => '?').join(',')})`;
    const params = [employeeId, start, end, ...VISIBLE_STATUSES];

    if (status === 'disetujui') {
      statusClause = "status = 'disetujui'";
      params.length = 3;
    } else if (status === 'pengajuan') {
      statusClause = "status = 'pengajuan'";
      params.length = 3;
    }

    const [rows] = await myWaschenPool.query(
      `SELECT day_off_id, off_date, requested_date, reason, status, source, reviewed_at, created_at, backup_employee_id
       FROM tr_employee_day_off
       WHERE employee_id = ? AND off_date BETWEEN ? AND ?
         AND ${statusClause}
       ORDER BY off_date ASC`,
      params
    );
    const backupNames = await employeeNameMap(rows.map((row) => row.backup_employee_id));
    const data = rows.map((row) => ({
      ...row,
      backup_name: row.status === 'disetujui' ? (backupNames.get(Number(row.backup_employee_id)) || null) : null
    }));

    return res.status(200).json({ success: true, message: 'OK', data });
  } catch (error) {
    console.error('getDayOffs error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat jadwal libur', error: error.message });
  }
};

/**
 * GET /api/history/day-offs/outlet?date=YYYY-MM-DD
 * Outlet sendiri di atas, outlet lain dikelompokkan di bawah.
 */
export const getOutletDayOffs = async (req, res) => {
  try {
    const date = toWibDateKey(req.query.date);
    const myOutletId = Number(req.user.assignedOutletId) || 0;
    if (!date) {
      return res.status(422).json({ success: false, message: 'Tanggal tidak valid' });
    }

    const [rows] = await myWaschenPool.query(
      `SELECT d.employee_id, d.status,
              (SELECT r.outlet_id FROM mst_role r WHERE r.employee_id = d.employee_id ORDER BY r.is_leader DESC, r.outlet_id ASC LIMIT 1) AS outlet_id,
              (SELECT r.employee_name FROM mst_role r WHERE r.employee_id = d.employee_id ORDER BY r.is_leader DESC, r.outlet_id ASC LIMIT 1) AS employee_name
       FROM tr_employee_day_off d
       WHERE d.off_date = ? AND d.status IN ('pengajuan', 'disetujui_leader', 'ditolak_leader', 'disetujui')
       ORDER BY employee_name ASC`,
      [date]
    );

    const outletIds = [...new Set(rows.map((r) => Number(r.outlet_id)).filter(Boolean))];
    const nameById = new Map();
    if (outletIds.length) {
      const [outlets] = await mainPool.query(
        `SELECT id, name, full_name FROM mst_outlet WHERE id IN (${outletIds.map(() => '?').join(',')})`,
        outletIds
      );
      outlets.forEach((o) => nameById.set(Number(o.id), o.name || o.full_name || `Outlet ${o.id}`));
    }

    const peopleOf = (list) => list.map((row) => ({
      employee_id: row.employee_id,
      name: row.employee_name || `Karyawan ${row.employee_id}`,
      status: row.status,
      status_label: dayOffLabel(row.status)
    }));

    const ownRows = rows.filter((r) => Number(r.outlet_id) === myOutletId && myOutletId);
    const otherIds = [...new Set(rows.map((r) => Number(r.outlet_id)).filter((id) => id && id !== myOutletId))];
    const others = otherIds.map((id) => ({
      outlet_id: id,
      outlet_name: nameById.get(id) || `Outlet ${id}`,
      people: peopleOf(rows.filter((r) => Number(r.outlet_id) === id))
    }));
    const noOutlet = rows.filter((r) => !Number(r.outlet_id));
    if (noOutlet.length) {
      others.push({ outlet_id: 0, outlet_name: 'Tanpa outlet', people: peopleOf(noOutlet) });
    }
    others.sort((a, b) => String(a.outlet_name).localeCompare(String(b.outlet_name), 'id'));

    return res.status(200).json({
      success: true,
      data: {
        own: {
          outlet_id: myOutletId || null,
          outlet_name: nameById.get(myOutletId) || null,
          people: peopleOf(ownRows)
        },
        others
      }
    });
  } catch (error) {
    console.error('getOutletDayOffs error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat libur cabang' });
  }
};

/**
 * POST /api/history/day-off
 * Body: { off_date, reason }
 */
export const requestDayOff = async (req, res) => {
  let conn;
  try {
    const employeeId = req.user.employee_id;
    const { off_date: offDateRaw, reason } = req.body;
    const offDate = toWibDateKey(offDateRaw);
    const reasonTrim = String(reason || '').trim();

    if (!offDate || !reasonTrim) {
      return res.status(422).json({ success: false, message: 'Tanggal dan alasan libur wajib diisi' });
    }

    const d = new Date(`${offDate}T12:00:00+07:00`);
    const scheduleYear = d.getUTCFullYear();
    const scheduleMonth = d.getUTCMonth() + 1;

    const policy = await getDayOffPolicy();
    const today = toWibDateKey(new Date());
    const openDay = Number(policy.request_open_day) || 20;
    const window = requestPeriodOnDay(today, openDay);
    if (!window) {
      return res.status(422).json({ success: false, message: `Pengajuan libur hanya bisa pada tanggal ${openDay}.` });
    }
    if (offDate < window.start || offDate > window.end) {
      return res.status(422).json({
        success: false,
        message: `Pilih tanggal libur antara ${window.start} dan ${window.end}.`
      });
    }

    const period = periodOfDate(offDate);
    const quotaRange = cutoffFor(period.year, period.month);
    const used = await countDayOffInRange(employeeId, quotaRange.start, quotaRange.end);
    if (used >= Number(policy.max_days_per_month || 4)) {
      return res.status(422).json({
        success: false,
        message: `Kuota libur periode ini sudah penuh (maks ${policy.max_days_per_month} hari)`
      });
    }

    const [att] = await myWaschenPool.query(
      'SELECT attendance_id FROM tr_attendance WHERE employee_id = ? AND work_date = ? LIMIT 1',
      [employeeId, offDate]
    );
    if (att.length > 0) {
      return res.status(409).json({ success: false, message: 'Tanggal ini sudah ada record absensi masuk' });
    }

    const [leave] = await myWaschenPool.query(
      `SELECT leave_id FROM tr_leave
       WHERE employee_id = ? AND start_date <= ? AND end_date >= ?
         AND status IN ('pengajuan', 'disetujui') LIMIT 1`,
      [employeeId, offDate, offDate]
    );
    if (leave.length > 0) {
      return res.status(409).json({ success: false, message: 'Tanggal ini sudah ada pengajuan izin/sakit/cuti' });
    }

    conn = await myWaschenPool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO tr_employee_day_off
       (employee_id, off_date, schedule_year, schedule_month, reason, status, source)
       VALUES (?, ?, ?, ?, ?, 'pengajuan', 'employee')`,
      [employeeId, offDate, scheduleYear, scheduleMonth, reasonTrim]
    );

    await conn.query(
      `INSERT INTO tr_day_off_change_log
       (day_off_id, employee_id, action, old_off_date, new_off_date, note, changed_by)
       VALUES (?, ?, 'request', NULL, ?, ?, ?)`,
      [result.insertId, employeeId, offDate, reasonTrim, employeeId]
    );

    await conn.commit();

    const [inserted] = await myWaschenPool.query(
      'SELECT * FROM tr_employee_day_off WHERE day_off_id = ?',
      [result.insertId]
    );

    emitDataChange({ domain: 'history', employeeId, action: 'day_off_request' });
    return res.status(201).json({
      success: true,
      message: 'Pengajuan libur berhasil dikirim. Menunggu persetujuan leader.',
      data: inserted[0]
    });
  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) { /* ignore */ } }
    console.error('requestDayOff error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Tanggal libur ini sudah pernah diajukan' });
    }
    return res.status(500).json({ success: false, message: 'Gagal mengajukan libur', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * DELETE /api/history/day-off/:id
 */
export const cancelDayOff = async (req, res) => {
  let conn;
  try {
    const employeeId = req.user.employee_id;
    const id = Number(req.params.id);

    const [rows] = await myWaschenPool.query(
      'SELECT * FROM tr_employee_day_off WHERE day_off_id = ? AND employee_id = ?',
      [id, employeeId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan libur tidak ditemukan' });
    }
    const row = rows[0];
    if (row.status !== 'pengajuan') {
      return res.status(409).json({ success: false, message: 'Hanya pengajuan yang masih pending yang bisa dibatalkan' });
    }

    conn = await myWaschenPool.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE tr_employee_day_off SET status = 'dibatalkan' WHERE day_off_id = ?`,
      [id]
    );
    await conn.query(
      `INSERT INTO tr_day_off_change_log
       (day_off_id, employee_id, action, old_off_date, new_off_date, note, changed_by)
       VALUES (?, ?, 'cancel', ?, NULL, 'Dibatalkan karyawan', ?)`,
      [id, employeeId, row.off_date, employeeId]
    );

    await conn.commit();
    emitDataChange({ domain: 'history', employeeId, action: 'day_off_cancel' });
    return res.status(200).json({ success: true, message: 'Pengajuan libur dibatalkan' });
  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) { /* ignore */ } }
    console.error('cancelDayOff error:', error);
    return res.status(500).json({ success: false, message: 'Gagal membatalkan pengajuan', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

export const listLeaderDayOffs = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const [roleRows] = await myWaschenPool.query(
      'SELECT is_leader, outlet_id FROM mst_role WHERE employee_id = ? AND is_leader = 1 LIMIT 1',
      [employeeId]
    );
    const role = roleRows[0];
    if (!role || Number(role.is_leader) !== 1 || !role.outlet_id) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [rows] = await myWaschenPool.query(
      `SELECT d.day_off_id, d.employee_id, d.off_date, d.reason, MIN(r.employee_name) AS employee_name
       FROM tr_employee_day_off d
       INNER JOIN mst_role r ON r.employee_id = d.employee_id AND r.outlet_id = ?
       WHERE d.status = 'pengajuan' AND d.employee_id <> ?
       GROUP BY d.day_off_id, d.employee_id, d.off_date, d.reason
       ORDER BY d.off_date ASC`,
      [role.outlet_id, employeeId]
    );
    return res.status(200).json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        off_date: toWibDateKey(row.off_date),
        employee_name: row.employee_name || `Karyawan ${row.employee_id}`
      }))
    });
  } catch (error) {
    console.error('listLeaderDayOffs error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat pengajuan libur' });
  }
};

async function reviewAsLeader(req, res, decision) {
  let conn;
  try {
    const actorId = req.user.employee_id;
    const id = Number(req.params.id);
    const note = String(req.body?.note || '').trim();
    const [roleRows] = await myWaschenPool.query(
      'SELECT is_leader, outlet_id FROM mst_role WHERE employee_id = ? AND is_leader = 1 LIMIT 1',
      [actorId]
    );
    const role = roleRows[0];
    if (!role || Number(role.is_leader) !== 1) {
      return res.status(403).json({ success: false, message: 'Hanya leader cabang yang dapat memutuskan pengajuan ini.' });
    }

    const [rows] = await myWaschenPool.query(
      'SELECT * FROM tr_employee_day_off WHERE day_off_id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    const row = rows[0];
    if (Number(row.employee_id) === Number(actorId)) {
      return res.status(403).json({ success: false, message: 'Tidak dapat memutuskan pengajuan sendiri.' });
    }
    if (row.status !== 'pengajuan') {
      return res.status(409).json({ success: false, message: 'Pengajuan ini sudah diputuskan leader.' });
    }

    const [owner] = await myWaschenPool.query(
      'SELECT outlet_id FROM mst_role WHERE employee_id = ? AND outlet_id = ? LIMIT 1',
      [row.employee_id, role.outlet_id]
    );
    if (!owner.length) {
      return res.status(403).json({ success: false, message: 'Leader hanya dapat memutuskan pengajuan di outlet sendiri.' });
    }

    const nextStatus = decision === 'approve' ? 'disetujui_leader' : 'ditolak_leader';
    const action = decision === 'approve' ? 'leader_approve' : 'leader_reject';
    conn = await myWaschenPool.getConnection();
    await conn.beginTransaction();
    await conn.query(
      `UPDATE tr_employee_day_off
       SET status = ?, leader_employee_id = ?, leader_note = ?, leader_reviewed_at = NOW()
       WHERE day_off_id = ? AND status = 'pengajuan'`,
      [nextStatus, actorId, note || null, id]
    );
    await conn.query(
      `INSERT INTO tr_day_off_change_log
       (day_off_id, employee_id, action, old_off_date, new_off_date, note, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, row.employee_id, action, row.off_date, row.off_date, note || dayOffLabel(nextStatus), actorId]
    );
    await conn.commit();
    emitDataChange({ domain: 'history', employeeId: row.employee_id, action });
    return res.json({
      success: true,
      message: decision === 'approve' ? 'Pengajuan disetujui leader.' : 'Pengajuan ditolak leader.'
    });
  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) { /* ignore */ } }
    console.error('reviewAsLeader error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan keputusan leader' });
  } finally {
    if (conn) conn.release();
  }
}

/**
 * GET /api/history/day-off/backups?year=&month=
 * Jadwal di mana user ini ditunjuk sebagai backup (hanya libur yang sudah disetujui HRD).
 */
export const getMyBackups = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const cur = currentCutoff();
    const year = parseInt(req.query.year || cur.year, 10);
    const month = parseInt(req.query.month || cur.month, 10);
    const { start, end } = cutoffFor(year, month);

    const [rows] = await myWaschenPool.query(
      `SELECT d.day_off_id, d.off_date, d.employee_id, d.reason,
              (SELECT r.role FROM mst_role r WHERE r.employee_id = d.employee_id ORDER BY r.is_leader DESC, r.outlet_id ASC LIMIT 1) AS role_name,
              (SELECT r.outlet_id FROM mst_role r WHERE r.employee_id = d.employee_id ORDER BY r.is_leader DESC, r.outlet_id ASC LIMIT 1) AS outlet_id
       FROM tr_employee_day_off d
       WHERE d.backup_employee_id = ? AND d.status = 'disetujui' AND d.off_date BETWEEN ? AND ?
       ORDER BY d.off_date ASC`,
      [employeeId, start, end]
    );

    const names = await employeeNameMap(rows.map((row) => row.employee_id));
    const outletIds = [...new Set(rows.map((row) => Number(row.outlet_id)).filter(Boolean))];
    const outletName = new Map();
    if (outletIds.length) {
      const [outlets] = await mainPool.query(
        `SELECT id, name, full_name FROM mst_outlet WHERE id IN (${outletIds.map(() => '?').join(',')})`,
        outletIds
      );
      outlets.forEach((outlet) => outletName.set(Number(outlet.id), outlet.name || outlet.full_name || null));
    }

    const data = rows.map((row) => ({
      day_off_id: row.day_off_id,
      off_date: toWibDateKey(row.off_date),
      employee_id: row.employee_id,
      employee_name: names.get(Number(row.employee_id)) || null,
      outlet_name: outletName.get(Number(row.outlet_id)) || null,
      role_name: row.role_name || null,
      reason: row.reason || null
    }));

    return res.json({ success: true, message: 'OK', data });
  } catch (error) {
    console.error('getMyBackups error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat jadwal backup' });
  }
};

export const leaderApproveDayOff = (req, res) => reviewAsLeader(req, res, 'approve');
export const leaderRejectDayOff = (req, res) => reviewAsLeader(req, res, 'reject');
