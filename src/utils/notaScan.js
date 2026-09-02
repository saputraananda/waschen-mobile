/**
 * Ambil nomor nota dari hasil scan QR/barcode.
 * QR nota berisi URL: `{origin}/dashboard?trackingNo=WLCG202608310001`
 */
export function extractNotaSearchKey(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';

  try {
    const url = new URL(text);
    const tracking = url.searchParams.get('trackingNo');
    if (tracking) return decodeURIComponent(tracking).trim();
  } catch {
    // bukan URL — lanjut ke fallback
  }

  return text;
}
