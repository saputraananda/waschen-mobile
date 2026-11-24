import { myWaschenPool } from '../db/pool.js';

/**
 * Outlet Event (mst_outlet.is_event = 1): stand event — absen di sana TANPA cek GPS.
 * Kolom is_event bisa belum ada (prod sebelum migrasi), jadi keberadaannya dicek sekali lalu di-cache;
 * bila belum ada, semua outlet dianggap bukan event (perilaku lama).
 */
let hasColumnPromise = null;

export function hasEventColumn() {
  if (!hasColumnPromise) {
    hasColumnPromise = myWaschenPool.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mst_outlet' AND COLUMN_NAME = 'is_event'`
    )
      .then(([[row]]) => Number(row?.n) > 0)
      .catch(() => false)
      .then((has) => {
        if (!has) hasColumnPromise = null; // cek ulang nanti (migrasi bisa menyusul tanpa restart)
        return has;
      });
  }
  return hasColumnPromise;
}

/** Ekspresi SELECT aman untuk kolom is_event (0 bila kolom belum ada). */
export async function eventColumnSql(alias = '') {
  const col = alias ? `${alias}.is_event` : 'is_event';
  return (await hasEventColumn()) ? `COALESCE(${col}, 0) AS is_event` : '0 AS is_event';
}

/** True bila outlet adalah outlet event (absen tanpa cek GPS). */
export async function isEventOutlet(outletId) {
  const id = Number(outletId) || 0;
  if (!id || !(await hasEventColumn())) return false;
  const [rows] = await myWaschenPool.query('SELECT COALESCE(is_event, 0) AS is_event FROM mst_outlet WHERE id = ? LIMIT 1', [id]);
  return Number(rows[0]?.is_event) === 1;
}
