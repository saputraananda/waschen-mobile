import { myWaschenPool } from '../../db/pool.js';

const pad2 = (n) => String(n).padStart(2, '0');

const toDateKey = (d) => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d).slice(0, 10);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};

const leaveLabel = (type) => {
  if (type === 'sakit') return 'Sakit';
  if (type === 'cuti') return 'Cuti';
  return 'Izin';
};

const dayOffLabel = (status) => (status === 'pengajuan' ? 'Pengajuan Libur' : 'Jadwal Libur');

/** Expand date range inclusive → array of YYYY-MM-DD */
const expandDateRange = (start, end) => {
  const out = [];
  const s = new Date(`${toDateKey(start)}T12:00:00`);
  const e = new Date(`${toDateKey(end)}T12:00:00`);
  for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
    out.push(toDateKey(cur));
  }
  return out;
};

const monthBounds = (year, month) => {
  const y = Number(year);
  const m = Number(month);
  const start = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${pad2(m)}-${pad2(lastDay)}`;
  return { start, end, year: y, month: m };
};

const buildPhotoUrl = (req, photoPath, photoName) => {
  if (!photoPath || !photoName) return null;
  const normalized = photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
  return `${req.protocol}://${req.get('host')}${normalized}/${encodeURIComponent(photoName)}`;
};

const formatTime = (dt) => {
  if (!dt) return null;
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
};

async function getDayOffPolicy() {
  const [rows] = await myWaschenPool.query(
    `SELECT max_days_per_month, min_notice_days, allow_past_date_request
     FROM mst_day_off_policy WHERE is_active = 1
     ORDER BY policy_id ASC LIMIT 1`
  );
  return rows[0] || { max_days_per_month: 4, min_notice_days: 1, allow_past_date_request: 0 };
}

async function countDayOffInMonth(employeeId, year, month, statuses = ['pengajuan', 'disetujui']) {
  const [rows] = await myWaschenPool.query(
    `SELECT COUNT(*) AS cnt FROM tr_employee_day_off
     WHERE employee_id = ? AND schedule_year = ? AND schedule_month = ?
       AND status IN (${statuses.map(() => '?').join(',')})`,
    [employeeId, year, month, ...statuses]
  );
  return Number(rows[0]?.cnt) || 0;
}

/**
 * GET /api/history/calendar?year=&month=
 * Gabung tr_attendance + tr_leave + tr_employee_day_off untuk kalender bulan.
 */
export const getCalendar = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const now = new Date();
    const year = parseInt(req.query.year || now.getFullYear(), 10);
    const month = parseInt(req.query.month || now.getMonth() + 1, 10);

    if (month < 1 || month > 12 || year < 2000) {
      return res.status(422).json({ success: false, message: 'Bulan/tahun tidak valid' });
    }

    const { start, end } = monthBounds(year, month);

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
        `SELECT day_off_id, off_date, requested_date, reason, status, source, reviewed_at
         FROM tr_employee_day_off
         WHERE employee_id = ? AND schedule_year = ? AND schedule_month = ?
           AND status IN ('pengajuan', 'disetujui')`,
        [employeeId, year, month]
      )
    ]);

    const days = {};
    const stats = { hadir: 0, izin: 0, sakit: 0, cuti: 0, libur: 0, pengajuan_libur: 0, tidak_masuk: 0 };

    attendanceRows[0].forEach((row) => {
      const key = toDateKey(row.work_date);
      if (!key) return;
      if (!row.check_in_time) return;
      days[key] = {
        date: key,
        kind: 'hadir',
        label: 'Hadir',
        check_in: formatTime(row.check_in_time),
        check_out: formatTime(row.check_out_time),
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
      const key = toDateKey(row.off_date);
      if (!key || key < start || key > end) return;
      if (days[key]?.kind === 'hadir' || days[key]?.kind === 'leave') return;

      const isPending = row.status === 'pengajuan';
      days[key] = {
        date: key,
        kind: isPending ? 'libur_pengajuan' : 'libur',
        label: dayOffLabel(row.status),
        reason: row.reason,
        day_off_id: row.day_off_id,
        day_off_status: row.status,
        requested_date: toDateKey(row.requested_date),
        source: row.source
      };
      if (isPending) stats.pengajuan_libur += 1;
      else stats.libur += 1;
    });

    // Hari lampau tanpa absensi / izin / libur → tidak masuk (alpha / lupa absen)
    const today = toDateKey(new Date());
    const lastDayNum = new Date(year, month, 0).getDate();
    for (let d = 1; d <= lastDayNum; d++) {
      const key = `${year}-${pad2(month)}-${pad2(d)}`;
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
      data: { year, month, days, stats, policy: await getDayOffPolicy() }
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
    const now = new Date();
    const year = parseInt(req.query.year || now.getFullYear(), 10);
    const month = parseInt(req.query.month || now.getMonth() + 1, 10);
    const status = req.query.status || 'disetujui';

    let statusClause = "status IN ('disetujui', 'pengajuan')";
    const params = [employeeId, year, month];

    if (status === 'disetujui') {
      statusClause = "status = 'disetujui'";
    } else if (status === 'pengajuan') {
      statusClause = "status = 'pengajuan'";
    }

    const [rows] = await myWaschenPool.query(
      `SELECT day_off_id, off_date, requested_date, reason, status, source, reviewed_at, created_at
       FROM tr_employee_day_off
       WHERE employee_id = ? AND schedule_year = ? AND schedule_month = ?
         AND ${statusClause}
       ORDER BY off_date ASC`,
      params
    );

    return res.status(200).json({ success: true, message: 'OK', data: rows });
  } catch (error) {
    console.error('getDayOffs error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat jadwal libur', error: error.message });
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
    const offDate = toDateKey(offDateRaw);
    const reasonTrim = String(reason || '').trim();

    if (!offDate || !reasonTrim) {
      return res.status(422).json({ success: false, message: 'Tanggal dan alasan libur wajib diisi' });
    }

    const d = new Date(`${offDate}T12:00:00`);
    const scheduleYear = d.getFullYear();
    const scheduleMonth = d.getMonth() + 1;

    const policy = await getDayOffPolicy();
    const today = toDateKey(new Date());
    if (offDate < today && !policy.allow_past_date_request) {
      return res.status(422).json({ success: false, message: 'Tidak dapat mengajukan libur untuk tanggal lampau' });
    }

    const diffDays = Math.floor((d - new Date(`${today}T12:00:00`)) / 86400000);
    if (diffDays >= 0 && diffDays < Number(policy.min_notice_days || 0)) {
      return res.status(422).json({
        success: false,
        message: `Pengajuan libur minimal H-${policy.min_notice_days} dari tanggal libur`
      });
    }

    const used = await countDayOffInMonth(employeeId, scheduleYear, scheduleMonth);
    if (used >= Number(policy.max_days_per_month || 4)) {
      return res.status(422).json({
        success: false,
        message: `Kuota libur bulan ini sudah penuh (maks ${policy.max_days_per_month} hari)`
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

    return res.status(201).json({
      success: true,
      message: 'Pengajuan libur berhasil dikirim. Menunggu persetujuan admin.',
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
    return res.status(200).json({ success: true, message: 'Pengajuan libur dibatalkan' });
  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) { /* ignore */ } }
    console.error('cancelDayOff error:', error);
    return res.status(500).json({ success: false, message: 'Gagal membatalkan pengajuan', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};
