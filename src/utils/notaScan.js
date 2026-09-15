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

  // Tab Delivery: Siap Diantar (QC) + Sedang Diantar (tetap tampil). Wajib Lunas.
  if (stageKey === 'delivery') {
    const pendingQc = items.filter((it) => it.item_work_status === 'Siap Diantar');
    const inTransit = items.filter((it) => it.item_work_status === 'Sedang Diantar');

    if (pendingQc.length > 0 && paymentStatus !== 'Lunas') {
      return {
        ok: false,
        title: 'Belum Lunas',
        message: `Nota ${orderNo} sudah Siap Diantar, tetapi belum Lunas. Lunasi dulu di POS sebelum QC Delivery & antar.`,
        variant: 'warning',
      };
    }

    if (pendingQc.length > 0) {
      return {
        ok: true,
        title: 'Nota Siap QC Delivery',
        message: `${pendingQc.length} item menunggu QC final. Setelah aman/temuan+catatan lanjut → Sedang Diantar.`,
        variant: 'success',
      };
    }

    if (inTransit.length > 0) {
      return {
        ok: true,
        title: 'Sedang Diantar — Siap Serah Terima',
        message: `Nota ${orderNo}: ${inTransit.length} item sedang diantar. Ketuk item → foto bukti → Tandai Selesai.`,
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
