import axios from 'axios';

export const leaderApi = axios.create({ baseURL: '/api/leader', timeout: 30000 });
leaderApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export function todayWib() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

/** Periode cutoff 26 s/d 25 untuk tanggal acuan. Sama dengan backend. */
export function cutoffFor(dateKey = todayWib()) {
  let y = Number(dateKey.slice(0, 4));
  let m = Number(dateKey.slice(5, 7));
  if (Number(dateKey.slice(8, 10)) >= 26) { m += 1; if (m > 12) { m = 1; y += 1; } }
  return cutoffRange(m, y);
}

/** Cutoff 26 bulan (m-1) s/d 25 bulan m tahun y. */
export function cutoffRange(month, year) {
  let py = year;
  let pm = month - 1;
  if (pm < 1) { pm = 12; py -= 1; }
  return { startDate: iso(py, pm, 26), endDate: iso(year, month, 25), year, month };
}

/** Daftar periode cutoff: bulan berjalan + N bulan ke belakang. */
export function cutoffOptions(count = 8) {
  const now = cutoffFor();
  const out = [];
  for (let i = 0; i < count; i += 1) {
    let m = now.month - i;
    let y = now.year;
    while (m < 1) { m += 12; y -= 1; }
    let py = y;
    let pm = m - 1;
    if (pm < 1) { pm = 12; py -= 1; }
    const startDate = iso(py, pm, 26);
    const endDate = iso(y, m, 25);
    out.push({ key: `${y}-${pad(m)}`, startDate, endDate, label: `${fmtShort(startDate)} – ${fmtShort(endDate)}` });
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function fmtShort(dateKey) {
  if (!dateKey) return '—';
  return `${Number(dateKey.slice(8, 10))} ${MONTHS[Number(dateKey.slice(5, 7)) - 1]}`;
}

export function fmtDay(dateKey) {
  if (!dateKey) return '—';
  const dow = new Date(`${dateKey}T12:00:00`).getDay();
  return `${DAYS[dow]}, ${fmtShort(dateKey)}`;
}

export function fmtDur(min) {
  const m = Math.round(Number(min) || 0);
  if (m <= 0) return '0 mnt';
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} j ${r} mnt` : `${h} j`;
}

export const fmtDays = (n) => (Number.isInteger(n) ? `${n}` : String(n).replace('.', ','));

export const LEAVE_LABEL = { izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti' };
export const DAY_STATUS = {
  hadir: { label: 'Hadir', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  off: { label: 'Libur', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  izin: { label: 'Izin', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  sakit: { label: 'Sakit', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cuti: { label: 'Cuti', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  tanpa_keterangan: { label: 'Tanpa Ket.', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  belum_berjalan: { label: 'Belum', cls: 'bg-white text-slate-400 border-slate-200' },
  belum_bergabung: { label: 'Belum gabung', cls: 'bg-slate-50 text-slate-400 border-slate-200' },
  sudah_keluar: { label: 'Sudah keluar', cls: 'bg-slate-50 text-slate-400 border-slate-200' },
};