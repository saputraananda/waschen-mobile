import { mainPool } from '../db/pool.js';

/**
 * PIN karyawan (4 digit, unik) — tabel mst_employee_pin di DB utama (waschen).
 * Satu PIN per karyawan, dipakai bersama POS, SuperApp, Waschen Mobile, dan IKM Mobile.
 */

/** PIN milik karyawan (string 4 digit) atau null. */
export async function getEmployeePin(employeeId) {
  const [rows] = await mainPool.query(
    'SELECT pin FROM mst_employee_pin WHERE employee_id = ? LIMIT 1',
    [employeeId]
  );
  return rows.length ? String(rows[0].pin) : null;
}

/**
 * Validasi input PIN. Kosong/null = hapus PIN.
 * @returns {{ pin: string|null } | { status: number, message: string }}
 */
export function parsePinInput(raw) {
  if (raw === null || raw === undefined || raw === '' || raw === 'null') return { pin: null };
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length !== 4) return { status: 422, message: 'PIN harus 4 digit angka.' };
  return { pin: digits };
}

/**
 * Simpan/hapus PIN. Mengembalikan null bila berhasil, atau { status, message } bila PIN sudah dipakai.
 */
export async function saveEmployeePin(employeeId, pin) {
  if (!pin) {
    await mainPool.query('DELETE FROM mst_employee_pin WHERE employee_id = ?', [employeeId]);
    return null;
  }
  // Bukan ON DUPLICATE KEY UPDATE: bentrok di kunci unik `pin` akan meng-update baris karyawan lain.
  try {
    const [dup] = await mainPool.query(
      'SELECT employee_id FROM mst_employee_pin WHERE pin = ? AND employee_id <> ? LIMIT 1',
      [pin, employeeId]
    );
    if (dup.length) return { status: 409, message: 'Pin telah digunakan, harap ganti' };
    const [upd] = await mainPool.query(
      'UPDATE mst_employee_pin SET pin = ? WHERE employee_id = ?',
      [pin, employeeId]
    );
    if (!upd.affectedRows) {
      await mainPool.query('INSERT INTO mst_employee_pin (employee_id, pin) VALUES (?, ?)', [employeeId, pin]);
    }
    return null;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return { status: 409, message: 'Pin telah digunakan, harap ganti' };
    throw err;
  }
}
