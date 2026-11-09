import axios from 'axios';

export const api = axios.create({ baseURL: '/api', timeout: 20000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

export const RESULT_META = {
  LULUS: { label: 'Lulus', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LULUS_PERBAIKAN: { label: 'Lulus dengan perbaikan', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  TIDAK_LULUS: { label: 'Tidak lulus', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

/** Warna teks nilai test menurut batas lulus versi training. Palet sama dengan RESULT_META. */
export const scoreTone = (score, passScore, passWithFixScore) => {
  if (score === null || score === undefined) return 'text-slate-800';
  if (Number(score) >= Number(passScore)) return 'text-emerald-700';
  if (Number(score) >= Number(passWithFixScore)) return 'text-amber-700';
  return 'text-rose-700';
};

/** Angka desimal dengan koma. */
export const fmt = (value) => (value === null || value === undefined ? '-' : String(Number(value)).replace('.', ','));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "2026-11-10 08:00:00" menjadi "10 Nov 2026, 08.00". */
export const fmtDatetime = (value) => {
  if (!value) return '-';
  const [date, time = ''] = String(value).split(/[ T]/);
  const [y, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}, ${time.slice(0, 5).replace(':', '.')}`;
};

/** Keterangan langkah berikutnya untuk peserta. */
export function nextStep(training) {
  if (training.status === 'ABSENT') return 'Tidak hadir';
  if (training.report_ready) return null;
  if (!training.started) return `Mulai ${fmtDatetime(training.start_at)}`;
  if (training.status === 'ASSIGNED') return 'Kerjakan pre-test';
  if (training.status === 'PRE_DONE') return 'Kerjakan post-test';
  if (training.status === 'POST_DONE') return 'Isi feedback';
  return 'Menunggu penilaian';
}
