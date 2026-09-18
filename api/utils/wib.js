/**
 * Util tanggal/jam Asia/Jakarta (WIB, UTC+7).
 * Hostinger Node sering jalan di UTC — jangan pakai getFullYear/getDate lokal server
 * untuk kolom DATE/DATETIME dari MySQL (timezone pool +07:00).
 */

export const WIB_TZ = 'Asia/Jakarta';

const pad2 = (n) => String(n).padStart(2, '0');

/** Instant sekarang sebagai Date (UTC epoch; format lewat WIB). */
export const getWibNow = () => new Date();

/**
 * YYYY-MM-DD menurut kalender WIB.
 * Aman untuk: Date dari mysql2 DATE/DATETIME, string ISO, atau "YYYY-MM-DD …".
 */
export function toWibDateKey(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : null;
  }

  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/** HH:mm menurut jam WIB (untuk check_in / check_out di kalender riwayat). */
export function formatWibTime(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);

  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('hour')}:${get('minute')}`;
}

/** Bagian jam/menit WIB dari Instant (untuk lock absen). */
export function getWibHoursMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { hours: get('hour'), minutes: get('minute') };
}

/**
 * Work-date absensi: 00:00–03:59 WIB masih dihitung hari sebelumnya.
 * @returns {string} YYYY-MM-DD
 */
export function getAttendanceWorkDate(date = new Date()) {
  const { hours, minutes } = getWibHoursMinutes(date);
  const totalMin = hours * 60 + minutes;
  const key = toWibDateKey(date);
  if (totalMin < 240) {
    const [y, m, d] = key.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    return `${prev.getUTCFullYear()}-${pad2(prev.getUTCMonth() + 1)}-${pad2(prev.getUTCDate())}`;
  }
  return key;
}

export function getWibYearMonth(date = new Date()) {
  const key = toWibDateKey(date);
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}

/** YYYY-MM-DD HH:mm:ss wall-clock WIB (untuk INSERT manual, bukan NOW()). */
export function formatWibSqlDateTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function todayWibISO(date = new Date()) {
  return toWibDateKey(date);
}

/** YYYYMMDD untuk nomor nota / batch. */
export function toWibYmdCompact(date = new Date()) {
  return String(toWibDateKey(date) || '').replace(/-/g, '');
}

export function formatWibDateLong(value) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', {
    timeZone: WIB_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function formatWibDateTime(value, options = {}) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { timeZone: WIB_TZ, ...options });
}

export function formatWibWeekdayLong(value) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', {
    timeZone: WIB_TZ,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/** Tambah/kurang hari pada YYYY-MM-DD (kalender WIB, tidak pakai local TZ). */
export function addWibDays(dateKeyOrValue, days) {
  const key = toWibDateKey(dateKeyOrValue);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

/** Nama hari singkat uppercase WIB (MINGGU, SENIN, …). */
export function formatWibWeekdayUpper(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const name = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TZ,
    weekday: 'long'
  }).format(d);
  return String(name || '').toUpperCase();
}
