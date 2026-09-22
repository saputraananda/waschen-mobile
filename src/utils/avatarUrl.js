/**
 * URL foto profil karyawan.
 * Backend sudah mengubah mst_employee.profile_path jadi URL penuh
 * (UPLOAD_BASE_PROFILE_DOCUMENT) lewat profile_url / profilePath.
 * Di development env itu kosong, jadi nilainya masih path relatif — dipakai apa adanya.
 */
export default function getAvatarUrl(user) {
  const raw = String(
    user?.profile_url || user?.profilePath || user?.profile_path || user?.avatar || ''
  ).replace(/\\/g, '/').trim();
  return raw || null;
}
