/**
 * File foto & dokumen karyawan tinggal di server Alsa (storage/assets/…).
 * mst_employee menyimpan path relatif gaya Alsa ("/assets/avatars/x.jpg").
 * UPLOAD_BASE_PROFILE_DOCUMENT = base URL-nya, contoh:
 *   https://api.waschenalora.com/storage/assets/
 * Di development env ini boleh kosong — path dikembalikan apa adanya.
 */
export const toAssetUrl = (stored) => {
  const raw = String(stored || '').replace(/\\/g, '/').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = String(process.env.UPLOAD_BASE_PROFILE_DOCUMENT || '').trim();
  if (!base) return raw;

  const rel = raw.replace(/^\/+/, '').replace(/^assets\//, '');
  return `${base.replace(/\/+$/, '')}/${rel}`;
};

export default toAssetUrl;
