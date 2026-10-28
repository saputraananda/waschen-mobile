import { todayWibISO } from './wib.js';

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Periode cutoff perusahaan: 26 bulan sebelumnya s/d 25 bulan berjalan. */
export function cutoffRangeFor(dateKey = todayWibISO()) {
  let y = Number(dateKey.slice(0, 4));
  let m = Number(dateKey.slice(5, 7));
  const d = Number(dateKey.slice(8, 10));
  if (d >= 26) { m += 1; if (m > 12) { m = 1; y += 1; } }
  let py = y;
  let pm = m - 1;
  if (pm < 1) { pm = 12; py -= 1; }
  return { startDate: iso(py, pm, 26), endDate: iso(y, m, 25) };
}

export const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

export function addDaysISO(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function eachDateISO(from, to) {
  const out = [];
  for (let cur = from; cur <= to; cur = addDaysISO(cur, 1)) out.push(cur);
  return out;
}
