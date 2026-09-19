import { myWaschenPool } from '../db/pool.js';
import { getAttendanceWorkDate } from './wib.js';

const CACHE_TTL_MS = 30_000;
let cache = { at: 0, data: null };

const DEFAULTS = {
  attendance: {
    open_time: '05:00:00',
    close_time: '23:59:59',
    after_midnight_open: 1,
    lock_enabled: 1,
    lock_start_time: '01:00:00',
    lock_end_time: '04:00:00',
    work_date_cutoff_time: '04:00:00',
    is_active: 1
  },
  grooming: {
    feature_enabled: 1,
    window1_start: '05:00:00',
    window1_end: '09:00:00',
    window2_enabled: 1,
    window2_start: '10:00:00',
    window2_end: '11:30:00',
    lock_enabled: 1,
    lock_after_time: '11:30:00',
    require_reason_after_lock: 1,
    is_active: 1
  },
  shifts: [
    { shift_number: 1, code: 'pagi', name: 'Shift Pagi', open_time: '08:00:00', close_time: '17:00:00', remind_open: 1, remind_close: 1, enforce_open: 0, enforce_close: 0, is_active: 1 },
    { shift_number: 2, code: 'siang', name: 'Shift Siang', open_time: '10:30:00', close_time: '20:00:00', remind_open: 1, remind_close: 1, enforce_open: 0, enforce_close: 0, is_active: 1 }
  ]
};

function timeToMinutes(t) {
  if (!t) return null;
  const s = String(t);
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function normalizeTime(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return `${String(m[1]).padStart(2, '0')}:${m[2]}:${m[3] || '00'}`;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const h = String(v.getHours()).padStart(2, '0');
    const mi = String(v.getMinutes()).padStart(2, '0');
    const s = String(v.getSeconds()).padStart(2, '0');
    return `${h}:${mi}:${s}`;
  }
  return null;
}

export function formatHm(t) {
  const n = normalizeTime(t);
  return n ? n.slice(0, 5) : '--:--';
}

export async function getTimeMasterConfig({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.data && now - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const [[att]] = await myWaschenPool.query(
      `SELECT * FROM mst_time_attendance WHERE is_active = 1 ORDER BY id ASC LIMIT 1`
    );
    const [[groom]] = await myWaschenPool.query(
      `SELECT * FROM mst_time_grooming WHERE is_active = 1 ORDER BY id ASC LIMIT 1`
    );
    const [shifts] = await myWaschenPool.query(
      `SELECT * FROM mst_time_shift WHERE is_active = 1 ORDER BY sort_order ASC, shift_number ASC`
    );

    const data = {
      attendance: {
        ...DEFAULTS.attendance,
        ...(att || {}),
        open_time: normalizeTime(att?.open_time) || DEFAULTS.attendance.open_time,
        close_time: normalizeTime(att?.close_time) || DEFAULTS.attendance.close_time,
        lock_start_time: normalizeTime(att?.lock_start_time) || DEFAULTS.attendance.lock_start_time,
        lock_end_time: normalizeTime(att?.lock_end_time) || DEFAULTS.attendance.lock_end_time,
        work_date_cutoff_time: normalizeTime(att?.work_date_cutoff_time) || DEFAULTS.attendance.work_date_cutoff_time,
        after_midnight_open: att ? (Number(att.after_midnight_open) ? 1 : 0) : 1,
        lock_enabled: att ? (Number(att.lock_enabled) ? 1 : 0) : 1
      },
      grooming: {
        ...DEFAULTS.grooming,
        ...(groom || {}),
        window1_start: normalizeTime(groom?.window1_start) || DEFAULTS.grooming.window1_start,
        window1_end: normalizeTime(groom?.window1_end) || DEFAULTS.grooming.window1_end,
        window2_start: normalizeTime(groom?.window2_start) || DEFAULTS.grooming.window2_start,
        window2_end: normalizeTime(groom?.window2_end) || DEFAULTS.grooming.window2_end,
        lock_after_time: normalizeTime(groom?.lock_after_time) || DEFAULTS.grooming.lock_after_time,
        feature_enabled: groom ? (Number(groom.feature_enabled) ? 1 : 0) : 1,
        window2_enabled: groom ? (Number(groom.window2_enabled) ? 1 : 0) : 1,
        lock_enabled: groom ? (Number(groom.lock_enabled) ? 1 : 0) : 1,
        require_reason_after_lock: groom ? (Number(groom.require_reason_after_lock) ? 1 : 0) : 1
      },
      shifts: (shifts?.length ? shifts : DEFAULTS.shifts).map((s) => ({
        ...s,
        open_time: normalizeTime(s.open_time),
        close_time: normalizeTime(s.close_time),
        shift_number: Number(s.shift_number),
        remind_open: Number(s.remind_open) ? 1 : 0,
        remind_close: Number(s.remind_close) ? 1 : 0,
        enforce_open: Number(s.enforce_open) ? 1 : 0,
        enforce_close: Number(s.enforce_close) ? 1 : 0
      }))
    };

    cache = { at: now, data };
    return data;
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') {
      console.warn('[timeMaster] fallback defaults:', err.message);
    }
    cache = { at: now, data: DEFAULTS };
    return DEFAULTS;
  }
}

export function evaluateAttendanceStatus(attendanceCfg, totalMin) {
  const open = timeToMinutes(attendanceCfg.open_time) ?? 5 * 60;
  const close = timeToMinutes(attendanceCfg.close_time) ?? 23 * 60 + 59;
  const lockOn = Number(attendanceCfg.lock_enabled) === 1;
  const lockStart = timeToMinutes(attendanceCfg.lock_start_time) ?? 60;
  const lockEnd = timeToMinutes(attendanceCfg.lock_end_time) ?? 4 * 60;
  const afterMidnight = Number(attendanceCfg.after_midnight_open) === 1;

  let isLocked = false;
  if (lockOn) {
    if (lockStart <= lockEnd) {
      isLocked = totalMin >= lockStart && totalMin < lockEnd;
    } else {
      // wrap midnight
      isLocked = totalMin >= lockStart || totalMin < lockEnd;
    }
  }

  const inDayWindow = totalMin >= open && totalMin <= close;
  const inAfterMidnight = afterMidnight && totalMin >= 0 && totalMin < (lockOn ? lockStart : open);
  const isOpen = !isLocked && (inDayWindow || inAfterMidnight);

  let lockReason = null;
  if (isLocked) {
    lockReason = `Absensi terkunci pukul ${formatHm(attendanceCfg.lock_start_time)}–${formatHm(attendanceCfg.lock_end_time)} WIB.`;
  } else if (!isOpen) {
    lockReason = `Absensi hanya dapat dilakukan pukul ${formatHm(attendanceCfg.open_time)}–${formatHm(attendanceCfg.close_time)} WIB` +
      (afterMidnight ? ` (dan setelah tengah malam sampai kunci).` : `.`);
  }

  return { isOpen, isLocked, lockReason, open, close, lockStart, lockEnd };
}

export function evaluateGroomingStatus(groomingCfg, totalMin) {
  const featureOn = Number(groomingCfg.feature_enabled) === 1;
  if (!featureOn) {
    return {
      featureEnabled: false,
      windowOpen: true,
      pastLock: false,
      needsReasonGate: false
    };
  }

  const w1s = timeToMinutes(groomingCfg.window1_start) ?? 5 * 60;
  const w1e = timeToMinutes(groomingCfg.window1_end) ?? 9 * 60;
  let inWindow = totalMin >= w1s && totalMin < w1e;

  if (Number(groomingCfg.window2_enabled) === 1) {
    const w2s = timeToMinutes(groomingCfg.window2_start);
    const w2e = timeToMinutes(groomingCfg.window2_end);
    if (w2s != null && w2e != null) {
      inWindow = inWindow || (totalMin >= w2s && totalMin < w2e);
    }
  }

  const lockOn = Number(groomingCfg.lock_enabled) === 1;
  const lockAfter = timeToMinutes(groomingCfg.lock_after_time) ?? 11 * 60 + 30;
  const pastLock = lockOn && totalMin >= lockAfter;
  const windowOpen = inWindow && !pastLock;

  return {
    featureEnabled: true,
    windowOpen,
    pastLock,
    needsReasonGate: pastLock && Number(groomingCfg.require_reason_after_lock) === 1,
    lockAfter
  };
}

export async function getWorkDateNow() {
  const cfg = await getTimeMasterConfig();
  const cutoff = timeToMinutes(cfg.attendance.work_date_cutoff_time) ?? 240;
  return getAttendanceWorkDate(new Date(), cutoff);
}

export { timeToMinutes, DEFAULTS as TIME_MASTER_DEFAULTS };
