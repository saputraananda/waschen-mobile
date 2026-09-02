import formatName from './FormatName.js';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const STAGE_PROCESS_LABEL = {
  frontliner: 'Frontliner',
  washing: 'Pencucian',
  ironing: 'Penyetrikaan',
  packing: 'Pengemasan',
  delivery: 'Pengantaran'
};

/** Contoh: Jumat, 13 April 2023, 20:30 WIB */
export function formatPhotoTimestampWib(date = new Date()) {
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm} WIB`;
}

export function getCurrentUserName() {
  try {
    const parsed = JSON.parse(localStorage.getItem('user') || '{}');
    const raw = parsed.fullName || parsed.full_name || parsed.name || 'Karyawan';
    return formatName(raw) || 'Karyawan';
  } catch {
    return 'Karyawan';
  }
}

/** 3 baris watermark foto QC produksi */
export function buildProduksiPhotoLines({ orderNo, stage, photographerName, date = new Date() }) {
  const process = STAGE_PROCESS_LABEL[stage] || stage || '-';
  return [
    formatPhotoTimestampWib(date),
    `${orderNo || '-'} - ${process}`,
    photographerName || getCurrentUserName()
  ];
}

function truncateLine(ctx, text, maxWidth) {
  const raw = String(text || '');
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let t = raw;
  while (t.length > 3 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Gambar kotak teks multi-baris di pojok kiri bawah canvas */
export function drawTextOverlay(ctx, width, height, lines = []) {
  const safeLines = (lines || []).map((l) => String(l || '').trim()).filter(Boolean);
  if (!safeLines.length) return;

  const pad = Math.max(12, Math.floor(Math.min(width, height) * 0.02));
  const primarySize = Math.max(13, Math.floor(Math.min(width, height) * 0.032));
  const secondarySize = Math.max(11, Math.floor(primarySize * 0.82));
  const lineGap = Math.max(3, Math.floor(primarySize * 0.3));
  const maxTextW = Math.min(width * 0.92, width - pad * 4);

  ctx.textBaseline = 'alphabetic';
  const sizes = safeLines.map((_, i) => (i === 0 ? primarySize : secondarySize));
  let boxW = 0;
  const measured = safeLines.map((line, i) => {
    ctx.font = `${i === 0 ? 700 : 600} ${sizes[i]}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const text = truncateLine(ctx, line, maxTextW);
    boxW = Math.max(boxW, ctx.measureText(text).width);
    return { text, size: sizes[i], bold: i === 0 };
  });

  const boxH = pad * 2 + measured.reduce((sum, m, i) => sum + m.size + (i < measured.length - 1 ? lineGap : 0), 0);
  const x = pad;
  const y = height - boxH - pad;

  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillRect(x, y, boxW + pad * 2, boxH);

  let cursorY = y + pad;
  measured.forEach((m, i) => {
    cursorY += m.size;
    ctx.fillStyle = i === 0 ? '#ffffff' : 'rgba(255,255,255,0.94)';
    ctx.font = `${m.bold ? 700 : 600} ${m.size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.fillText(m.text, x + pad, cursorY);
    if (i < measured.length - 1) cursorY += lineGap;
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl = null;

    if (source instanceof HTMLCanvasElement) {
      img.src = source.toDataURL('image/jpeg', 0.92);
    } else if (source instanceof File || source instanceof Blob) {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    } else {
      img.src = source;
    }

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (e) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(e);
    };
  });
}

/** Burn watermark ke file/gambar — dipakai upload galeri */
export async function burnPhotoOverlay(source, lines) {
  const img = await loadImage(source);
  const maxW = 1600;
  const scale = img.width > maxW ? maxW / img.width : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');

  ctx.drawImage(img, 0, 0, w, h);
  drawTextOverlay(ctx, w, h, lines);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Gagal memproses foto');

  const baseName = source instanceof File
    ? source.name.replace(/\.[^.]+$/, '')
    : `qc_${Date.now()}`;
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
