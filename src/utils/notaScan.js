/**
 * Ambil nomor nota dari hasil scan QR/barcode.
 * QR nota biasanya berisi URL: `{origin}/dashboard?trackingNo=WLCG202608310001`
 * atau plain order_no / barcode.
 */
export function extractNotaSearchKey(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';

  try {
    const url = new URL(text);
    const tracking =
      url.searchParams.get('trackingNo') ||
      url.searchParams.get('tracking_no') ||
      url.searchParams.get('orderNo') ||
      url.searchParams.get('order_no') ||
      url.searchParams.get('nota') ||
      url.searchParams.get('barcode');
    if (tracking) return decodeURIComponent(tracking).trim();
  } catch {
    // bukan URL absolut — lanjut fallback
  }

  const qsMatch = text.match(
    /[?&#](?:trackingNo|tracking_no|orderNo|order_no|nota|barcode)=([^&#]+)/i
  );
  if (qsMatch?.[1]) {
    try {
      return decodeURIComponent(qsMatch[1]).trim();
    } catch {
      return qsMatch[1].trim();
    }
  }

  return text;
}

/** Urutan status item untuk bandingkan tahap. */
export const ITEM_STATUS_ORDER = [
  'Antrean',
  'Pencucian',
  'Penyetrikaan',
  'Pengemasan',
  'Siap Diambil',
  'Siap Diantar',
  'Sedang Diantar',
  'Selesai',
];

export const STAGE_ITEM_STATUS = {
  frontliner: 'Antrean',
  washing: 'Pencucian',
  ironing: 'Penyetrikaan',
  packing: 'Pengemasan',
  delivery: 'Siap Diantar',
  handover: 'Sedang Diantar',
};

const statusIndex = (status) => {
  const idx = ITEM_STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : -1;
};

/**
 * Evaluasi apakah nota bisa di-QC di tahap aktif.
 * @returns {{ ok: boolean, title: string, message: string, variant: string }}
 */
export function evaluateNotaForStage(txn, stageKey, stageLabel) {
  const targetStatus = STAGE_ITEM_STATUS[stageKey];
  const targetIdx = statusIndex(targetStatus);
  const items = (txn?.items || []).filter((it) => it.item_work_status !== 'Dibatalkan');
  const orderNo = txn?.order_no || txn?.barcode || '—';
  const paymentStatus = String(txn?.payment_status || '').trim();

  if (!items.length) {
    return {
      ok: false,
      title: 'Nota Tanpa Item',
      message: `Nota ${orderNo} tidak memiliki item pengerjaan.`,
      variant: 'warning',
    };
  }

  // Tab Delivery: Siap Diantar (QC) + Sedang Diantar (tetap tampil). Boleh outstanding.
  if (stageKey === 'delivery') {
    const pendingQc = items.filter((it) => it.item_work_status === 'Siap Diantar');
    const inTransit = items.filter((it) => it.item_work_status === 'Sedang Diantar');
    const payLabel = paymentStatus && paymentStatus !== 'Lunas'
      ? ` Pembayaran: ${paymentStatus}.`
      : '';

    if (pendingQc.length > 0) {
      return {
        ok: true,
        title: 'Nota Siap QC Delivery',
        message: `${pendingQc.length} item menunggu QC final. Setelah aman/temuan+catatan lanjut → Sedang Diantar.${payLabel}`,
        variant: 'success',
      };
    }

    if (inTransit.length > 0) {
      return {
        ok: true,
        title: 'Sedang Diantar — Siap Serah Terima',
        message: `Nota ${orderNo}: ${inTransit.length} item sedang diantar. Ketuk item → foto bukti → Tandai Selesai.${payLabel}`,
        variant: 'info',
      };
    }
  }

  const atStage = items.filter((it) => it.item_work_status === targetStatus);
  if (atStage.length > 0) {
    return {
      ok: true,
      title: 'Nota Siap QC',
      message: `${atStage.length} item di tahap ${stageLabel}.`,
      variant: 'success',
    };
  }

  // Belum sampai tahap ini → tetap bisa di-QC; tahap sebelumnya dicatat "Dilewati"
  const skippable = items.filter((it) => skippedStagesForItem(it, stageKey).length > 0);
  if (skippable.length > 0) {
    return {
      ok: true,
      title: 'Nota Bisa Dilewati',
      message: `${skippable.length} item belum sampai ${stageLabel}. QC di sini menandai tahap sebelumnya sebagai Dilewati.`,
      variant: 'info',
    };
  }

  const indices = items.map((it) => statusIndex(it.item_work_status)).filter((i) => i >= 0);
  if (!indices.length) {
    return {
      ok: false,
      title: 'Status Tidak Dikenali',
      message: `Nota ${orderNo} ditemukan, tetapi status item tidak dikenali untuk tahap ${stageLabel}.`,
      variant: 'warning',
    };
  }

  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);
  const statusSummary = [...new Set(items.map((it) => it.item_work_status))].join(', ');

  if (maxIdx < targetIdx) {
    return {
      ok: false,
      title: `Belum Sampai Tahap ${stageLabel}`,
      message: `Nota ${orderNo} masih di tahap sebelumnya (${statusSummary}). Belum bisa di-QC di ${stageLabel}.`,
      variant: 'info',
    };
  }

  if (minIdx > targetIdx) {
    return {
      ok: false,
      title: `Sudah Lewat Tahap ${stageLabel}`,
      message: `Nota ${orderNo} sudah selesai tahap ${stageLabel}. Status saat ini: ${statusSummary}.`,
      variant: 'success',
    };
  }

  return {
    ok: false,
    title: `Tidak Ada Item di ${stageLabel}`,
    message: `Nota ${orderNo} ditemukan, tetapi tidak ada item yang menunggu di tahap ${stageLabel}. Status item: ${statusSummary}.`,
    variant: 'warning',
  };
}

/**
 * QC lompat tahap lewat pencarian (keputusan user 2026-11-26). Padanan skippedStagesFor di
 * api/controllers/produksi/produksi.controller.js — ubah keduanya bersamaan.
 */
const SKIP_FLOW = ['frontliner', 'washing', 'ironing', 'packing', 'delivery'];
const SKIP_TARGET_STAGES = ['washing', 'ironing', 'packing', 'delivery'];
export const SKIP_STAGE_LABEL = {
  frontliner: 'Frontliner',
  washing: 'Tim Cuci',
  ironing: 'Tim Setrika',
  packing: 'Tim Packing',
  delivery: 'Delivery',
};

/** Tahap yang akan "Dilewati" bila item di-QC di stageKey; [] = tidak bisa lompat. */
export function skippedStagesForItem(item, stageKey) {
  if (!item || !SKIP_TARGET_STAGES.includes(stageKey)) return [];
  if (Number(item.is_on_hold) === 1 || Number(item.is_cleanox) === 1) return [];
  if (stageKey === 'delivery' && item.fulfillment_type !== 'Delivery_Kurir') return [];
  if (stageKey === 'ironing' && Number(item.requires_ironing) === 0) return [];
  const current = SKIP_FLOW.find((s) => STAGE_ITEM_STATUS[s] === item.item_work_status);
  const ci = SKIP_FLOW.indexOf(current);
  const ti = SKIP_FLOW.indexOf(stageKey);
  if (ci < 0 || ti < 0 || ci >= ti) return [];
  return SKIP_FLOW.slice(ci, ti).filter((s) => !(s === 'ironing' && Number(item.requires_ironing) === 0));
}

export const skipLabel = (stages) => stages.map((s) => SKIP_STAGE_LABEL[s] || s).join(', ');
