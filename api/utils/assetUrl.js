/**
 * File foto & dokumen karyawan tinggal di server Alsa (storage/assets/…).
 * mst_employee menyimpan path relatif gaya Alsa ("/assets/avatars/x.jpg").
 * UPLOAD_BASE_PROFILE_DOCUMENT = base URL-nya, contoh:
 *   https://api.waschenalora.com/storage/assets/
 * Bila kosong, jatuh ke ALSA_SERVICE_URL + /assets/ (route bawaan Alsa),
 * supaya development tidak menghasilkan path relatif yang gagal dimuat.
 */
const assetBase = () => {
  const explicit = String(process.env.UPLOAD_BASE_PROFILE_DOCUMENT || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const service = String(process.env.ALSA_SERVICE_URL || '').trim();
  return service ? `${service.replace(/\/+$/, '')}/assets` : '';
};

export const toAssetUrl = (stored) => {
  const raw = String(stored || '').replace(/\\/g, '/').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = assetBase();
  if (!base) return raw;

  const rel = raw.replace(/^\/+/, '').replace(/^assets\//, '');
  return `${base.replace(/\/+$/, '')}/${rel}`;
};

export default toAssetUrl;
