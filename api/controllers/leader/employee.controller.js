import { mainPool, myWaschenPool } from '../../db/pool.js';
import { toWibDateKey, getWibHoursMinutes, todayWibISO, addWibDays } from '../../utils/wib.js';
import { cutoffRangeFor, isIsoDate, eachDateISO } from '../../utils/cutoff.js';
import { getTimeMasterConfig, requiresShift, findShift, timeToMinutes, formatHm, DEFAULT_SHIFT_CODE } from '../../utils/timeMaster.js';
import { toAssetUrl } from '../../utils/assetUrl.js';

// Menu Leader > Karyawan: kedisiplinan & perizinan karyawan di outlet leader.
// Sengaja TANPA gaji, kasbon, pinjaman, limit. Aturan telat / pulang cepat sama dengan
// Payroll ALSA (Frontliner ikut shift; role lain batas 08:00).

const WASCHEN_COMPANY_ID = 5;
const MAX_RANGE_DAYS = 93;
const DEFAULT_LATE_AFTER_MIN = 8 * 60;
const OFF_WAITING = ['pengajuan', 'disetujui_leader', 'ditolak_leader'];
const num = (v) => Number(v) || 0;

const minutesOfDay = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const { hours, minutes } = getWibHoursMinutes(d);
  return hours * 60 + minutes;
};

const hhmm = (v) => {
  const m = minutesOfDay(v);
  return m == null ? null : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

function resolvePeriod(query) {
  const def = cutoffRangeFor();
  const startDate = isIsoDate(query.startDate) ? query.startDate : def.startDate;
  const endDate = isIsoDate(query.endDate) ? query.endDate : def.endDate;
  if (startDate > endDate) return { error: 'Tanggal mulai melebihi tanggal akhir.' };
  if (eachDateISO(startDate, endDate).length > MAX_RANGE_DAYS) {
    return { error: `Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari.` };
  }
  return { startDate, endDate };
}

/** Telat & pulang cepat satu absensi. Frontliner ikut shift (kosong = Pagi). */
function evaluateRecord(rec, role, shifts) {
  const inMin = minutesOfDay(rec.check_in_time);
  const outMin = minutesOfDay(rec.check_out_time);
  const shift = requiresShift(role)
    ? findShift(shifts, rec.shift_code || DEFAULT_SHIFT_CODE) || findShift(shifts, DEFAULT_SHIFT_CODE)
    : null;
  const lateAfter = timeToMinutes(shift?.open_time) ?? DEFAULT_LATE_AFTER_MIN;
  const earlyBefore = shift ? timeToMinutes(shift.close_time) : null;
  const hasBoth = rec.check_in_time && rec.check_out_time && new Date(rec.check_out_time) > new Date(rec.check_in_time);
  return {
    shift_name: shift?.name || null,
    shift_assumed: Boolean(shift && !rec.shift_code),
    late_min: inMin != null && inMin > lateAfter ? inMin - lateAfter : 0,
    // Pulang lewat tengah malam (jam < batas masuk) bukan pulang cepat.
    early_min: earlyBefore != null && outMin != null && outMin < earlyBefore && outMin >= lateAfter ? earlyBefore - outMin : 0,
    work_min: hasBoth ? Math.round((new Date(rec.check_out_time) - new Date(rec.check_in_time)) / 60000) : null,
  };
}

function overtimeMinutes(r) {
  if (r.start_at && r.end_at && new Date(r.end_at) > new Date(r.start_at)) {
    return Math.round((new Date(r.end_at) - new Date(r.start_at)) / 60000);
  }
  if (r.status === 'berlangsung') return 0;
  const toMin = (t) => {
    const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const s = toMin(r.start_time);
  const e = toMin(r.end_time);
  if (s == null || e == null) return 0;
  return e >= s ? e - s : e + 1440 - s;
}

/** Karyawan di outlet leader (mst_role.outlet_id), datanya dari mst_employee. */
async function loadOutletEmployees(outletId, startDate, endDate, { onlyId = null } = {}) {
  const [roles] = await myWaschenPool.query(
    `SELECT employee_id, employee_name, role, is_leader FROM mst_role WHERE outlet_id = ?${onlyId ? ' AND employee_id = ?' : ''}`,
    onlyId ? [outletId, onlyId] : [outletId]
  );
  if (!roles.length) return [];
  const [emps] = await mainPool.query(
    `SELECT employee_id, employee_code, full_name, profile_path, exit_date, join_date
     FROM mst_employee
     WHERE employee_id IN (?) AND company_id = ? AND is_deleted = 0
       AND (exit_date IS NULL OR exit_date >= ?)
       AND (join_date IS NULL OR join_date <= ?)`,
    [roles.map((r) => Number(r.employee_id)), WASCHEN_COMPANY_ID, startDate, endDate]
  );
  const roleById = new Map(roles.map((r) => [Number(r.employee_id), r]));
  return emps.map((e) => {
    const r = roleById.get(Number(e.employee_id));
    return {
      employee_id: Number(e.employee_id),
      employee_code: e.employee_code || null,
      employee_name: e.full_name || r?.employee_name || `#${e.employee_id}`,
      profile_url: toAssetUrl(e.profile_path),
      role: r?.role || null,
      is_leader: Number(r?.is_leader) === 1,
      join_date: toWibDateKey(e.join_date),
      exit_date: toWibDateKey(e.exit_date),
    };
  }).sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'id'));
}

async function loadActivity(ids, startDate, endDate) {
  const [[attendance], [dayOffs], [overtime], [leaves]] = await Promise.all([
    myWaschenPool.query(
      `SELECT attendance_id, employee_id, work_date, shift_code, check_in_time, check_out_time, check_in_note, check_out_note
       FROM tr_attendance
       WHERE employee_id IN (?) AND work_date BETWEEN ? AND ?
       ORDER BY work_date ASC, check_in_time ASC`,
      [ids, startDate, endDate]
    ),
    myWaschenPool.query(
      `SELECT day_off_id, employee_id, off_date, status, reason
       FROM tr_employee_day_off
       WHERE off_date BETWEEN ? AND ? AND employee_id IN (?)
       ORDER BY off_date ASC`,
      [startDate, endDate, ids]
    ),
    myWaschenPool.query(
      `SELECT id, employee_id, overtime_date, start_at, end_at, start_time, end_time, reason, status
       FROM tr_overtime
       WHERE employee_id IN (?) AND overtime_date BETWEEN ? AND ?
       ORDER BY overtime_date ASC`,
      [ids, startDate, endDate]
    ),
    myWaschenPool.query(
      `SELECT leave_id, employee_id, leave_type, duration_type, start_date, end_date, reason, status
       FROM tr_leave
       WHERE employee_id IN (?) AND end_date >= ? AND start_date <= ?
       ORDER BY start_date ASC`,
      [ids, startDate, endDate]
    ),
  ]);
  const group = (rows) => {
    const map = new Map();
    rows.forEach((r) => {
      const k = Number(r.employee_id);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return map;
  };
  return { attendance: group(attendance), dayOffs: group(dayOffs), overtime: group(overtime), leaves: group(leaves) };
}

const EMPTY_CTX = { attendance: new Map(), dayOffs: new Map(), overtime: new Map(), leaves: new Map() };

function buildEmployee(emp, ctx, startDate, endDate, shifts, withDetail) {
  const id = emp.employee_id;
  const yesterday = addWibDays(todayWibISO(), -1);

  // Satu tanggal bisa >1 record: check-in pertama menentukan telat, check-out terakhir pulang cepat.
  const byDate = new Map();
  let workMinutes = 0;
  let belumOut = 0;
  const workedDates = new Set();
  const noOutDates = new Set();
  (ctx.attendance.get(id) || []).forEach((r) => {
    if (!r.check_in_time) return;
    const date = toWibDateKey(r.work_date);
    const rec = { ...r, date, ...evaluateRecord(r, emp.role, shifts) };
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(rec);
    if (rec.work_min != null) { workMinutes += rec.work_min; workedDates.add(date); } else if (!r.check_out_time) { belumOut += 1; noOutDates.add(date); }
  });
  const hadirDates = new Set(byDate.keys());

  const offsAll = ctx.dayOffs.get(id) || [];
  const offApproved = offsAll.filter((d) => d.status === 'disetujui');
  const offPending = offsAll.filter((d) => OFF_WAITING.includes(d.status));
  const offDates = new Set(offApproved.map((d) => toWibDateKey(d.off_date)));

  const ot = (ctx.overtime.get(id) || []).map((r) => ({ ...r, minutes: overtimeMinutes(r) }));
  const otApproved = ot.filter((r) => r.status === 'disetujui');

  // Perizinan: hari yang jatuh di periode (setengah hari = 0,5)
  const leaveDays = { izin: 0, sakit: 0, cuti: 0 };
  const leaveByDate = new Map();
  const leaves = (ctx.leaves.get(id) || []).map((l) => {
    const ls = toWibDateKey(l.start_date);
    const le = toWibDateKey(l.end_date);
    const dates = eachDateISO(ls < startDate ? startDate : ls, le > endDate ? endDate : le);
    const perDay = l.duration_type === 'full_day' ? 1 : 0.5;
    if (l.status === 'disetujui') {
      leaveDays[l.leave_type] = (leaveDays[l.leave_type] || 0) + dates.length * perDay;
      dates.forEach((d) => leaveByDate.set(d, { type: l.leave_type, half: perDay < 1, duration: l.duration_type }));
    }
    return { ...l, start_date: ls, end_date: le, days_in_period: dates.length * perDay };
  });

  // Telat & pulang cepat; dikecualikan bila izin ½ hari pagi / siang disetujui.
  const late = { count: 0, minutes: 0, max: 0, excused: 0 };
  const early = { count: 0, minutes: 0, excused: 0 };
  const lateByDate = new Map();
  const earlyByDate = new Map();
  hadirDates.forEach((d) => {
    const recs = byDate.get(d);
    const l = num(recs[0].late_min);
    if (l > 0) {
      if (leaveByDate.get(d)?.duration === 'half_day_morning') late.excused += 1;
      else { late.count += 1; late.minutes += l; late.max = Math.max(late.max, l); lateByDate.set(d, l); }
    }
    const withOut = recs.filter((r) => r.check_out_time);
    const e = num(withOut[withOut.length - 1]?.early_min);
    if (e > 0) {
      if (leaveByDate.get(d)?.duration === 'half_day_afternoon') early.excused += 1;
      else { early.count += 1; early.minutes += e; earlyByDate.set(d, e); }
    }
  });

  // Tanpa keterangan: sejak tanggal masuk s/d kemarin (atau tanggal keluar)
  const scopeFrom = emp.join_date && emp.join_date > startDate ? emp.join_date : startDate;
  const scopeTo = [endDate, yesterday, emp.exit_date].filter(Boolean).sort()[0];
  const noInfoDates = scopeFrom <= scopeTo
    ? eachDateISO(scopeFrom, scopeTo).filter((d) => !hadirDates.has(d) && !offDates.has(d) && !leaveByDate.has(d))
    : [];

  const noInfoSet = new Set(noInfoDates);
  const summary = {
    employee_id: id,
    employee_code: emp.employee_code,
    employee_name: emp.employee_name,
    role: emp.role,
    is_leader: emp.is_leader,
    join_date: emp.join_date,
    exit_date: emp.exit_date,
    hadir: hadirDates.size,
    off: offApproved.length,
    off_pending: offPending.length,
    work_minutes: workMinutes,
    avg_work_minutes: workedDates.size ? Math.round(workMinutes / workedDates.size) : 0,
    belum_out: belumOut,
    late,
    early,
    overtime: {
      approved_count: otApproved.length,
      approved_minutes: otApproved.reduce((s, r) => s + r.minutes, 0),
      pending_count: ot.filter((r) => r.status === 'pengajuan' || r.status === 'berlangsung').length,
    },
    leave: {
      ...leaveDays,
      total_days: leaveDays.izin + leaveDays.sakit + leaveDays.cuti,
      pending: leaves.filter((l) => l.status === 'pengajuan').length,
      rejected: leaves.filter((l) => l.status === 'ditolak').length,
    },
    no_info_days: noInfoDates.length,
    tidak_hadir: noInfoDates.length,
    // Strip status harian utk kartu (maks 31 hari terakhir periode): h=hadir, o=libur, l=izin/sakit/cuti, x=tanpa ket., B=belum out, .=belum berjalan
    strip: eachDateISO(startDate, scopeTo).slice(-31)
      .map((d) => (hadirDates.has(d) ? (noOutDates.has(d) ? 'B' : 'h')
        : leaveByDate.has(d) ? 'l' : offDates.has(d) ? 'o'
        : noInfoSet.has(d) ? 'x' : '.'))
      .join(''),
  };
  if (!withDetail) return summary;

  const days =eachDateISO(startDate, endDate).map((d) => {
    const recs = byDate.get(d) || [];
    const first = recs[0] || null;
    const lastOut = [...recs].reverse().find((r) => r.check_out_time) || null;
    const leave = leaveByDate.get(d) || null;
    let status;
    if (recs.length) status = 'hadir';
    else if (leave) status = leave.type;
    else if (offDates.has(d)) status = 'off';
    else if (noInfoSet.has(d)) status = 'tanpa_keterangan';
    else if (emp.join_date && d < emp.join_date) status = 'belum_bergabung';
    else if (emp.exit_date && d > emp.exit_date) status = 'sudah_keluar';
    else status = 'belum_berjalan';
    return {
      date: d,
      status,
      half_day_leave: leave?.half && recs.length ? leave.type : null,
      off_but_present: recs.length > 0 && offDates.has(d),
      check_in: hhmm(first?.check_in_time),
      check_out: hhmm(lastOut?.check_out_time),
      work_minutes: recs.reduce((s, r) => s + num(r.work_min), 0),
      belum_out: recs.some((r) => !r.check_out_time),
      late_minutes: lateByDate.get(d) || 0,
      late_excused: Boolean(first && leave?.duration === 'half_day_morning' && num(first.late_min) > 0),
      early_minutes: earlyByDate.get(d) || 0,
      shift_name: first?.shift_name || null,
      shift_assumed: Boolean(first?.shift_assumed),
      note: [first?.check_in_note, lastOut?.check_out_note].filter(Boolean).join(' · ') || null,
    };
  });

  return {
    ...summary,
    days,
    leave_list: leaves.map((l) => ({
      id: l.leave_id, type: l.leave_type, duration_type: l.duration_type,
      start_date: l.start_date, end_date: l.end_date, days_in_period: l.days_in_period,
      reason: l.reason || null, status: l.status,
    })),
    off_list: offsAll.map((d) => ({ id: d.day_off_id, date: toWibDateKey(d.off_date), status: d.status, reason: d.reason || null })),
    overtime_list: ot.map((r) => ({
      id: r.id, date: toWibDateKey(r.overtime_date),
      start: r.start_at ? hhmm(r.start_at) : String(r.start_time || '').slice(0, 5) || null,
      end: r.end_at ? hhmm(r.end_at) : (r.status === 'berlangsung' ? null : String(r.end_time || '').slice(0, 5) || null),
      minutes: r.minutes, reason: r.reason || null, status: r.status,
    })),
  };
}

// Periode cutoff (26–25) yang punya absensi di outlet. Dasar pilihan bulan/tahun di UI.
// Query ini memindai seluruh riwayat absensi outlet dan hasilnya jarang berubah -> cache per outlet.
const PERIODS_TTL_MS = 5 * 60_000;
const periodsCache = new Map(); // outletId -> { at, data }
async function loadAvailablePeriods(outletId) {
  const hit = periodsCache.get(outletId);
  if (hit && Date.now() - hit.at < PERIODS_TTL_MS) return hit.data;
  const [rows] = await myWaschenPool.query(
    `SELECT YEAR(DATE_ADD(work_date, INTERVAL IF(DAY(work_date) >= 26, 1, 0) MONTH)) AS y,
            MONTH(DATE_ADD(work_date, INTERVAL IF(DAY(work_date) >= 26, 1, 0) MONTH)) AS m
     FROM tr_attendance WHERE outlet_id = ?
     GROUP BY y, m
     ORDER BY y, m`,
    [outletId]
  );
  const data = rows.map((r) => ({ year: Number(r.y), month: Number(r.m) }));
  periodsCache.set(outletId, { at: Date.now(), data });
  return data;
}

const getShifts = async () => (await getTimeMasterConfig()).shifts || [];

/** GET /api/leader/employees?startDate&endDate */
export const listEmployees = async (req, res) => {
  try {
    const period = resolvePeriod(req.query);
    if (period.error) return res.status(400).json({ success: false, message: period.error });
    const { startDate, endDate } = period;

    // Ketiganya saling bebas -> paralel (dulu berurutan).
    const [employees, shifts, availablePeriods] = await Promise.all([
      loadOutletEmployees(req.leader.outletId, startDate, endDate),
      getShifts(),
      loadAvailablePeriods(req.leader.outletId),
    ]);
    const ctx = employees.length ? await loadActivity(employees.map((e) => e.employee_id), startDate, endDate) : EMPTY_CTX;
    const data = employees.map((e) => buildEmployee(e, ctx, startDate, endDate, shifts, false));
    return res.json({
      success: true,
      data,
      meta: {
        startDate,
        endDate,
        outletId: req.leader.outletId,
        availablePeriods,
        roles: [...new Set(data.map((d) => d.role).filter(Boolean))].sort(),
        shifts: shifts.map((s) => ({ name: s.name, open: formatHm(s.open_time), close: formatHm(s.close_time) })),
      },
    });
  } catch (err) {
    console.error('leader listEmployees error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data karyawan.' });
  }
};

/** GET /api/leader/employees/:id — hanya karyawan di outlet leader */
export const getEmployeeDetail = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID karyawan tidak valid.' });
    const period = resolvePeriod(req.query);
    if (period.error) return res.status(400).json({ success: false, message: period.error });
    const { startDate, endDate } = period;

    const [emp] = await loadOutletEmployees(req.leader.outletId, startDate, endDate, { onlyId: id });
    if (!emp) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan di outlet Anda.' });

    const ctx = await loadActivity([id], startDate, endDate);
    return res.json({ success: true, data: buildEmployee(emp, ctx, startDate, endDate, await getShifts(), true), meta: { startDate, endDate } });
  } catch (err) {
    console.error('leader getEmployeeDetail error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat detail karyawan.' });
  }
};