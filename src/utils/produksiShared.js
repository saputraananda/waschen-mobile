import axios from 'axios';

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
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};

export function qcItemLabel(item) {
  const name = String(item?.service_name || 'Item').trim();
  const qtyNum = Number(item?.qty);
  const unit = String(item?.unit || '').trim();
  const qty = Number.isFinite(qtyNum) && qtyNum > 0
    ? (Number.isInteger(qtyNum) ? String(qtyNum) : String(qtyNum).replace('.', ','))
    : '';
  const prefix = qty && unit ? `${qty} ${unit}` : '';
  if (!prefix || name.toLowerCase().startsWith(prefix.toLowerCase())) return name;
  return `${prefix} ${name}`;
}

export function sortirWaText(notes, itemLabel) {
  return [
    'Halo Bapak/Ibu 🙏',
    '',
    `Saat proses sortir sebelum pencucian, kami menemukan ${String(notes || '').trim()} pada item`,
    '',
    `*${itemLabel}* (foto terlampir).`,
    '',
    'Mohon konfirmasinya apakah kami boleh melanjutkan ke proses pencucian dengan kondisi tersebut.',
    'Jika tidak ada konfirmasi, akan kami lanjutkan ke proses pencucian.',
    '',
    'Terima kasih 🙏',
    '*Total Care For Happy Life*'
  ].join('\n');
}

function saveBlob(blobOrUrl, name, revoke) {
  const a = document.createElement('a');
  a.href = blobOrUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(blobOrUrl), 5000);
}

export function downloadQcPhotos(photos) {
  photos.forEach((p, i) => {
    if (!p?.file) return;
    const name = photos.length > 1 ? `temuan-${i + 1}.jpg` : 'temuan-qc.jpg';
    saveBlob(URL.createObjectURL(p.file), name, true);
  });
}

export async function downloadPhotoUrls(urls) {
  const list = (urls || []).filter(Boolean);
  await Promise.all(list.map(async (url, i) => {
    const name = list.length > 1 ? `temuan-${i + 1}.jpg` : 'temuan-qc.jpg';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('foto');
      saveBlob(URL.createObjectURL(await res.blob()), name, true);
    } catch {
      saveBlob(url, name, false);
    }
  }));
}

export function holdWaText(finding, itemLabel) {
  return [
    'Halo Bapak/Ibu. Kami dari Waschen Laundry ingin menginformasikan terkait item.',
    '',
    `*${itemLabel}*`,
    '',
    `Tim kami menemukan kondisi pada cucian kiloan Bapak/Ibu berupa ${String(finding || '').trim()}`,
    '',
    'Mohon konfirmasinya, terima kasih 🙏'
  ].join('\n');
}

export const buildWaLink = (phone, notes, itemLabel) => {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0/, '62');
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(sortirWaText(notes, itemLabel))}`;
};

export const buildHoldWaLink = (phone, finding, itemLabel) => {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0/, '62');
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(holdWaText(finding, itemLabel))}`;
};

export const STAGE_LABEL = {
  frontliner: 'Frontliner',
  washing: 'Tim Cuci',
  ironing: 'Tim Setrika',
  packing: 'Packing',
  delivery: 'Antar',
  handover: 'Serah Terima'
};

/** Tahap yang mengisi rincian plastik kiloan */
export const BAG_ENTRY_STAGES = ['frontliner', 'washing', 'ironing'];

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
