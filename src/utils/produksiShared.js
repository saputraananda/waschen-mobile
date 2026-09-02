import axios from 'axios';
import formatName from './FormatName.js';

export const api = axios.create({ baseURL: '/api', timeout: 45000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const STAGES = [
  { key: 'frontliner', label: 'Frontliner', role: 'Frontliner' },
  { key: 'washing', label: 'Cuci', role: 'Washing Staff' },
  { key: 'ironing', label: 'Setrika', role: 'Ironing Staff' },
  { key: 'packing', label: 'Packing', role: 'Packing Staff' }
];

export const stageForRole = (role) => {
  const found = STAGES.find((s) => s.role === role);
  return found ? found.key : 'frontliner';
};

export const isKiloanItem = (item) =>
  item?.category_code === 'KILOAN' || String(item?.unit || '').toLowerCase() === 'kg';

export const formatDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};

export const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 11) return 'pagi';
  if (h < 15) return 'siang';
  return 'sore';
};

export const buildWaLink = (phone, isKiloan) => {
  const normalized = String(phone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
  let msg = `Selamat ${getGreeting()}, Kak. Saat proses sortir sebelum pencucian, kami menemukan noda/kerusakan pada salah satu cucian ${isKiloan ? 'kiloan ' : ''}Kakak. Berikut foto kondisinya sebagai referensi`;
  if (isKiloan) {
    msg += '\n\nUntuk hasil terbaik, kami sarankan cucian ini diproses sebagai layanan satuan agar penanganannya lebih optimal. Apakah Kakak berkenan kami proses sebagai satuan? Mohon konfirmasinya, Kak';
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
};

/** Template WA hold list frontliner — temuan dari tahap produksi lain */
export const buildHoldWaLink = (phone, { customerName, orderNo, reportedStage, reportNotes, isKiloan }) => {
  const normalized = String(phone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
  const team = STAGE_LABEL[reportedStage] || reportedStage || 'Produksi';
  let msg = `Selamat ${getGreeting()}, Kak ${formatName(customerName) || ''}. Kami dari Waschen ingin menginformasikan terkait nota ${orderNo || '-'}.`;
  msg += `\n\nTim ${team} kami menemukan kondisi pada cucian ${isKiloan ? 'kiloan ' : ''}Kakak:`;
  msg += `\n"${reportNotes || 'Temuan pada proses pengerjaan — mohon konfirmasi.'}"`;
  if (isKiloan) {
    msg += '\n\nUntuk hasil terbaik, kami sarankan cucian ini diproses sebagai layanan satuan. Apakah Kakak berkenan? Mohon konfirmasinya, Kak.';
  } else {
    msg += '\n\nMohon konfirmasinya agar kami dapat melanjutkan proses, Kak. Terima kasih.';
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
};

export const STAGE_LABEL = {
  frontliner: 'Frontliner',
  washing: 'Tim Cuci',
  ironing: 'Tim Setrika',
  packing: 'Packing',
  delivery: 'Antar'
};

/** Tahap yang mengisi rincian plastik kiloan */
export const BAG_ENTRY_STAGES = ['frontliner', 'washing'];

/** Tahap sebelumnya yang punya rincian plastik (untuk tampilan riwayat) */
export const prevBagStagesFor = (stage) => {
  const order = ['frontliner', 'washing', 'ironing', 'packing'];
  const idx = order.indexOf(stage);
  if (idx <= 0) return [];
  return BAG_ENTRY_STAGES.filter((s) => order.indexOf(s) < idx);
};

export const bagTotal = (bags = []) =>
  bags.reduce((sum, b) => sum + (Number(b.qty_pcs) || 0), 0);

export const bagGap = (current, reference) => {
  const a = Number(current) || 0;
  const b = Number(reference) || 0;
  if (!a || !b) return null;
  const diff = a - b;
  if (diff === 0) return { diff: 0, label: 'sama' };
  return { diff, label: diff > 0 ? `+${diff}` : `${diff}` };
};
