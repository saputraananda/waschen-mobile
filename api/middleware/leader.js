import { myWaschenPool } from '../db/pool.js';

// mst_outlet.id (myWaschen) -> nama outlet di data penjualan (waschen_smartlink).
// ponytail: dipetakan manual; outlet baru perlu ditambah di sini. 6 (Event Haji) tidak punya data penjualan.
export const SMARTLINK_OUTLET_BY_ID = {
  1: 'Waschen Laundry Raffles Hills',
  2: 'Waschen Citra Grand',
  3: 'Waschen Laundry Legenda Wisata',
  4: 'Waschen Laundry Canadian',
  5: 'Waschen Laundry Kota Wisata', // Sentra Eropa = Kota Wisata
};

/**
 * Hanya leader (mst_role.is_leader = 1). Dipasang setelah requireAuth.
 * Outlet diambil dari DB, bukan dari token/query, jadi tidak bisa dipalsukan client.
 * req.leader = { outletId, role, smartlinkOutlets }
 */
export const requireLeader = async (req, res, next) => {
  try {
    const [rows] = await myWaschenPool.query(
      'SELECT outlet_id, role FROM mst_role WHERE employee_id = ? AND is_leader = 1 AND outlet_id IS NOT NULL LIMIT 1',
      [req.user.employee_id]
    );
    if (!rows[0]) {
      return res.status(403).json({ success: false, message: 'Menu ini hanya untuk Leader.' });
    }
    const outletId = Number(rows[0].outlet_id);
    const smartlink = SMARTLINK_OUTLET_BY_ID[outletId];
    req.leader = { outletId, role: rows[0].role, smartlinkOutlets: smartlink ? [smartlink] : [] };
    next();
  } catch (err) {
    console.error('requireLeader error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memeriksa akses Leader.' });
  }
};