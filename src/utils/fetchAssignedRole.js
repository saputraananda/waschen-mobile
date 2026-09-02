import axios from 'axios';

/**
 * Ambil role dari mst_role via profile-detail jika belum ada di localStorage.
 * Mengembalikan assignedRole atau null.
 */
export default async function fetchAssignedRole(token) {
  if (!token) return null;

  try {
    const res = await axios.get('/api/employee/profile-detail', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });

    const data = res.data?.data;
    const role = data?.assignedRole || data?.role || null;

    if (role) {
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.assignedRole = role;
          localStorage.setItem('user', JSON.stringify(parsed));
        } catch (_) { /* ignore */ }
      }
    }

    return role;
  } catch (_) {
    return null;
  }
}
