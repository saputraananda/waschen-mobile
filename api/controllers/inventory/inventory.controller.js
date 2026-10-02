import { myWaschenPool } from '../../db/pool.js';
import { todayWibISO, toWibDateKey } from '../../utils/wib.js';

const OWNER_ROLES = ['Frontliner', 'Washing Staff', 'Ironing Staff', 'Packing Staff', 'Delivery Staff'];

function periodStartOf(stock, today) {
  return toWibDateKey(stock.period_start) || `${today.slice(0, 7)}-01`;
}

export const listMyStock = async (req, res) => {
  try {
    const outletId = Number(req.user.assignedOutletId);
    if (!outletId) {
      return res.status(400).json({ success: false, message: 'Outlet belum ditetapkan untuk akun ini.' });
    }
    const role = String(req.query.role || '').trim();
    if (role && !OWNER_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role tidak valid' });
    }

    const today = todayWibISO();
    const params = [today, outletId];
    let roleSql = '';
    if (role) {
      roleSql = ' AND FIND_IN_SET(?, i.owner_role)';
      params.push(role);
    }

    const [[outlet]] = await myWaschenPool.query(
      'SELECT name, full_name FROM mst_outlet WHERE id = ? LIMIT 1',
      [outletId]
    );
    const [rows] = await myWaschenPool.query(
      `SELECT s.id AS stock_id, i.id AS item_id, i.name, i.owner_role, u.symbol AS unit,
              s.qty_opening, s.qty_current,
              COALESCE((
                SELECT o.qty_used FROM tr_stock_opname o
                WHERE o.outlet_id = s.outlet_id AND o.item_id = s.item_id AND o.usage_date = ?
                LIMIT 1
              ), 0) AS qty_today
       FROM tr_inventory_stock s
       INNER JOIN mst_inventory_item i ON i.id = s.item_id AND i.is_active = 1
       LEFT JOIN mst_unit u ON u.id = i.unit_id
       WHERE s.outlet_id = ? AND s.is_active = 1${roleSql}
       ORDER BY i.name ASC`,
      params
    );

    return res.json({
      success: true,
      data: {
        outletId,
        outletName: outlet?.full_name || outlet?.name || '',
        usageDate: today,
        items: rows
      }
    });
  } catch (error) {
    console.error('listMyStock:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat stok' });
  }
};

export const saveOpname = async (req, res) => {
  const outletId = Number(req.user.assignedOutletId);
  const itemId = Number(req.body?.item_id);
  const qty = Number(req.body?.qty);
  if (!outletId) {
    return res.status(400).json({ success: false, message: 'Outlet belum ditetapkan untuk akun ini.' });
  }
  if (!itemId || !Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ success: false, message: 'Jumlah pemakaian tidak valid' });
  }

  const today = todayWibISO();
  const employeeId = Number(req.user.employee_id) || null;
  const conn = await myWaschenPool.getConnection();
  try {
    await conn.beginTransaction();
    const [[stock]] = await conn.query(
      `SELECT id, qty_opening, period_start, qty_current
       FROM tr_inventory_stock
       WHERE outlet_id = ? AND item_id = ? AND is_active = 1
       LIMIT 1`,
      [outletId, itemId]
    );
    if (!stock) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Stok item tidak ditemukan di outlet ini.' });
    }

    const [[existing]] = await conn.query(
      `SELECT qty_used FROM tr_stock_opname
       WHERE outlet_id = ? AND item_id = ? AND usage_date = ?
       LIMIT 1`,
      [outletId, itemId, today]
    );
    const beforeUsed = parseFloat(existing?.qty_used) || 0;
    const qtyBefore = parseFloat(stock.qty_current) || 0;

    await conn.query(
      `INSERT INTO tr_stock_opname (outlet_id, item_id, stock_id, usage_date, qty_used, employee_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         stock_id = VALUES(stock_id),
         qty_used = VALUES(qty_used),
         employee_id = VALUES(employee_id),
         updated_at = NOW()`,
      [outletId, itemId, stock.id, today, qty, employeeId, 'SO Waschen Mobile']
    );

    const start = periodStartOf(stock, today);
    const [[sumRow]] = await conn.query(
      `SELECT COALESCE(SUM(qty_used), 0) AS total
       FROM tr_stock_opname
       WHERE outlet_id = ? AND item_id = ? AND usage_date >= ? AND usage_date <= ?`,
      [outletId, itemId, start, today]
    );
    const qtyAfter = (parseFloat(stock.qty_opening) || 0) - (parseFloat(sumRow?.total) || 0);
    await conn.query(
      'UPDATE tr_inventory_stock SET qty_current = ?, updated_at = NOW() WHERE id = ?',
      [qtyAfter, stock.id]
    );

    const logQty = Math.abs(qty - beforeUsed);
    if (logQty > 0) {
      await conn.query(
        `INSERT INTO tr_inventory_log
         (outlet_id, item_id, stock_id, movement_type, qty, qty_before, qty_after, employee_id, reference_type, notes)
         VALUES (?, ?, ?, 'Adjust', ?, ?, ?, ?, 'opname', 'SO Waschen Mobile')`,
        [outletId, itemId, stock.id, logQty, qtyBefore, qtyAfter, employeeId]
      );
    }

    await conn.commit();
    return res.json({ success: true, message: 'Stok diperbarui', data: { qty_today: qty, qty_current: qtyAfter } });
  } catch (error) {
    await conn.rollback();
    console.error('saveOpname:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan stok' });
  } finally {
    conn.release();
  }
};
