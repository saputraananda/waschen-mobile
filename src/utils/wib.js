/**
 * Util tampilan tanggal/jam Asia/Jakarta — pasangan api/utils/wib.js.
 * Pakai di UI agar DATE/DATETIME dari API tidak bergeser di browser non-WIB.
 */

export const WIB_TZ = 'Asia/Jakarta';

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
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function formatWibTime(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('id-ID', {
    timeZone: WIB_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function formatWibDateTime(value, options = {}) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', {
    timeZone: WIB_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options
  });
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

/** Hari ini YYYY-MM-DD (WIB) — ganti new Date().toISOString().slice(0,10). */
export function todayWibISO(date = new Date()) {
  return toWibDateKey(date);
}

export function getWibYearMonth(date = new Date()) {
  const key = toWibDateKey(date);
  if (!key) return { year: 0, month: 0 };
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}

/** Tambah/kurang hari pada YYYY-MM-DD (kalender WIB). */
export function addWibDays(dateKeyOrValue, days) {
  const key = toWibDateKey(dateKeyOrValue);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}
