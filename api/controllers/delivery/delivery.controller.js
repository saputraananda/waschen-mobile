import { myWaschenPool } from '../../db/pool.js';

const FULFILLMENT_DELIVERY = 'Delivery_Kurir';
const DELIVERY_TAB_STATUSES = ['Siap Diantar', 'Sedang Diantar'];

const ADDRESS_SQL = `
  COALESCE(
    NULLIF(TRIM(t.delivery_address), ''),
    NULLIF(TRIM(c.full_address), ''),
    NULLIF(TRIM(CONCAT_WS(', ',
      NULLIF(TRIM(c.address), ''),
      NULLIF(TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.block), ''), NULLIF(TRIM(c.house_number), ''))), ''),
      NULLIF(TRIM(c.sub_district), ''),
      NULLIF(TRIM(c.district), ''),
      NULLIF(TRIM(c.city), ''),
      NULLIF(TRIM(c.postal_code), '')
    )), ''),
    '-'
  )
`;

const mapTxnRows = (txns, details, waitingStatuses = null) => {
  const statusSet = waitingStatuses
    ? new Set(Array.isArray(waitingStatuses) ? waitingStatuses : [waitingStatuses])
    : null;

  return txns.map((t) => {
    const allItems = details.filter((d) => d.transaction_id === t.id);
    const deliveryItems = allItems.filter(
      (d) => d.fulfillment_type === FULFILLMENT_DELIVERY && d.item_work_status !== 'Dibatalkan'
    );
    const items = deliveryItems.length ? deliveryItems : allItems;
    const stageItems = statusSet
      ? items.filter((d) => statusSet.has(d.item_work_status))
      : items;
    // Pending QC = masih Siap Diantar; Sedang Diantar = sudah QC final
    const pendingQc = items.filter((d) => d.item_work_status === 'Siap Diantar').length;
    const inTransit = items.filter((d) => d.item_work_status === 'Sedang Diantar').length;
    const clearedItems = statusSet
      ? Math.max(0, items.length - pendingQc)
      : items.filter((d) => !['Antrean', 'Siap Diantar'].includes(d.item_work_status)).length;

    return {
      ...t,
      is_delivery: 1,
      fulfillment_type: FULFILLMENT_DELIVERY,
      delivery_address: t.delivery_address_full || t.delivery_address_raw || '-',
      has_finding: items.some((d) => Number(d.has_finding) === 1),
      has_hold: items.some((d) => Number(d.is_on_hold) === 1),
      total_items: items.length,
      stage_pending_items: pendingQc,
      in_transit_items: inTransit,
      qc_progress_pct: items.length ? Math.round((clearedItems / items.length) * 100) : 0,
      payment_status: t.payment_status || null,
      items
    };
  });
};

const fetchDetailsForTxns = async (txnIds) => {
  if (!txnIds.length) return [];
  const [details] = await myWaschenPool.query(
    `SELECT d.id, d.transaction_id, d.service_id, d.service_name, d.qty, d.unit,
            d.item_work_status, d.has_finding, d.finding_note, d.is_on_hold, d.hold_stage,
            d.requires_ironing, d.fulfillment_type, d.brand, d.color, d.material, d.size,
            d.condition_notes,
            s.category_id,
            cat.code AS category_code
     FROM tr_transaction_detail d
     LEFT JOIN mst_service s ON s.id = d.service_id
     LEFT JOIN mst_service_category cat ON cat.id = s.category_id
     WHERE d.transaction_id IN (?)`,
    [txnIds]
  );
  return details;
};

const composeListQuery = async (req, { waitingStatuses, requireLunas = false }) => {
  const outletId = Number(req.query.outlet_id) || req.user.assignedOutletId;
  if (!outletId) {
    return { error: { status: 422, message: 'Outlet belum ditetapkan' } };
  }

  const statuses = Array.isArray(waitingStatuses) ? waitingStatuses : [waitingStatuses];
  const placeholders = statuses.map(() => '?').join(',');
  const params = [outletId, FULFILLMENT_DELIVERY, ...statuses];

  let paymentClause = '';
  if (requireLunas) {
    paymentClause = ` AND t.payment_status = 'Lunas'`;
  }

  const [txns] = await myWaschenPool.query(
    `SELECT DISTINCT
            t.id, t.order_no, t.barcode, t.customer_id, t.order_category,
            t.total_weight_kg, t.total_pcs, t.work_status, t.order_date,
            t.estimated_finished_at, t.special_notes, t.delivery_notes,
            t.is_delivery, t.delivery_address AS delivery_address_raw,
            t.payment_status,
            c.name AS customer_name, c.phone AS customer_phone,
            c.full_address, c.address, c.block, c.house_number,
            c.sub_district, c.district, c.city, c.postal_code, c.landmark,
            ${ADDRESS_SQL} AS delivery_address_full
     FROM tr_transaction t
     JOIN tr_transaction_detail d ON d.transaction_id = t.id
     LEFT JOIN mst_customer c ON c.id = t.customer_id
     WHERE t.outlet_id = ?
       AND d.fulfillment_type = ?
       AND d.item_work_status IN (${placeholders})
       AND d.item_work_status != 'Dibatalkan'
       ${paymentClause}
     ORDER BY t.order_date ASC`,
    params
  );

  if (txns.length === 0) {
    return { data: [], outletId };
  }

  const details = await fetchDetailsForTxns(txns.map((t) => t.id));
  return { data: mapTxnRows(txns, details, statuses), outletId };
};

/**
 * GET /api/delivery/search?q=
 * Cari nota delivery (fulfillment_type = Delivery_Kurir) by order_no / barcode / nama / HP.
 */
export const searchDelivery = async (req, res) => {
  try {
    const search = String(req.query.q || req.query.search || '').trim();
    const outletId = Number(req.query.outlet_id) || req.user.assignedOutletId;
    if (!outletId) {
      return res.status(422).json({ success: false, message: 'Outlet belum ditetapkan' });
    }
    if (!search) {
      return res.status(422).json({ success: false, message: 'Kata kunci pencarian wajib diisi' });
    }

    const like = `%${search}%`;
    const [txns] = await myWaschenPool.query(
      `SELECT DISTINCT
              t.id, t.order_no, t.barcode, t.customer_id, t.order_category,
              t.total_weight_kg, t.total_pcs, t.work_status, t.order_date,
              t.estimated_finished_at, t.special_notes, t.delivery_notes,
              t.is_delivery, t.delivery_address AS delivery_address_raw,
              t.payment_status,
              c.name AS customer_name, c.phone AS customer_phone,
              c.full_address, c.address, c.block, c.house_number,
              c.sub_district, c.district, c.city, c.postal_code, c.landmark,
              ${ADDRESS_SQL} AS delivery_address_full
       FROM tr_transaction t
       JOIN tr_transaction_detail d ON d.transaction_id = t.id
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.outlet_id = ?
         AND d.fulfillment_type = ?
         AND (
           t.order_no = ? OR t.barcode = ? OR CAST(t.id AS CHAR) = ?
           OR t.order_no LIKE ? OR t.barcode LIKE ?
           OR c.name LIKE ? OR c.phone LIKE ?
         )
       ORDER BY
         CASE
           WHEN t.order_no = ? OR t.barcode = ? OR CAST(t.id AS CHAR) = ? THEN 0
           ELSE 1
         END,
         t.order_date DESC
       LIMIT 50`,
      [
        outletId, FULFILLMENT_DELIVERY,
        search, search, search, like, like, like, like,
        search, search, search
      ]
    );

    if (txns.length === 0) {
      return res.status(200).json({ success: true, message: 'OK', data: [] });
    }

    const details = await fetchDetailsForTxns(txns.map((t) => t.id));
    return res.status(200).json({
      success: true,
      message: 'OK',
      data: mapTxnRows(txns, details, null)
    });
  } catch (error) {
    console.error('delivery.searchDelivery error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mencari nota delivery',
      error: error.message
    });
  }
};

/**
 * GET /api/delivery/summary
 * Badge: Pickup (Antrean) & Delivery (Siap Diantar + Sedang Diantar, Lunas).
 */
export const getSummary = async (req, res) => {
  try {
    const outletId = Number(req.query.outlet_id) || req.user.assignedOutletId;
    if (!outletId) {
      return res.status(422).json({ success: false, message: 'Outlet belum ditetapkan' });
    }

    const [rows] = await myWaschenPool.query(
      `SELECT d.item_work_status AS status,
              COUNT(DISTINCT d.transaction_id) AS nota_count,
              COUNT(*) AS item_count
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       WHERE t.outlet_id = ?
         AND d.fulfillment_type = ?
         AND (
           d.item_work_status = 'Antrean'
           OR (
             d.item_work_status IN ('Siap Diantar', 'Sedang Diantar')
             AND t.payment_status = 'Lunas'
           )
         )
       GROUP BY d.item_work_status`,
      [outletId, FULFILLMENT_DELIVERY]
    );

    const pickup = rows.find((r) => r.status === 'Antrean');
    const siap = rows.find((r) => r.status === 'Siap Diantar');
    const sedang = rows.find((r) => r.status === 'Sedang Diantar');

    // Count distinct nota for delivery tab (union of both statuses)
    const [deliveryNota] = await myWaschenPool.query(
      `SELECT COUNT(DISTINCT t.id) AS nota_count,
              COUNT(d.id) AS item_count
       FROM tr_transaction t
       JOIN tr_transaction_detail d ON d.transaction_id = t.id
       WHERE t.outlet_id = ?
         AND d.fulfillment_type = ?
         AND d.item_work_status IN ('Siap Diantar', 'Sedang Diantar')
         AND t.payment_status = 'Lunas'
         AND d.item_work_status != 'Dibatalkan'`,
      [outletId, FULFILLMENT_DELIVERY]
    );

    return res.status(200).json({
      success: true,
      message: 'OK',
      data: {
        pickup: {
          nota_count: Number(pickup?.nota_count) || 0,
          item_count: Number(pickup?.item_count) || 0
        },
        delivery: {
          nota_count: Number(deliveryNota[0]?.nota_count) || 0,
          item_count: Number(deliveryNota[0]?.item_count)
            || (Number(siap?.item_count) || 0) + (Number(sedang?.item_count) || 0),
          pending_qc: Number(siap?.item_count) || 0,
          in_transit: Number(sedang?.item_count) || 0
        }
      }
    });
  } catch (error) {
    console.error('delivery.getSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil ringkasan delivery',
      error: error.message
    });
  }
};

/**
 * GET /api/delivery/pickup
 * Item Delivery_Kurir yang masih Antrean — QC pickup.
 */
export const getPickupList = async (req, res) => {
  try {
    const result = await composeListQuery(req, { waitingStatuses: ['Antrean'] });
    if (result.error) {
      return res.status(result.error.status).json({ success: false, message: result.error.message });
    }
    return res.status(200).json({ success: true, message: 'OK', data: result.data });
  } catch (error) {
    console.error('delivery.getPickupList error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar pickup',
      error: error.message
    });
  }
};

/**
 * GET /api/delivery/ready
 * Siap Diantar + Sedang Diantar (Lunas) — tetap di tab Delivery setelah QC.
 */
export const getReadyList = async (req, res) => {
  try {
    const result = await composeListQuery(req, {
      waitingStatuses: DELIVERY_TAB_STATUSES,
      requireLunas: true
    });
    if (result.error) {
      return res.status(result.error.status).json({ success: false, message: result.error.message });
    }
    return res.status(200).json({ success: true, message: 'OK', data: result.data });
  } catch (error) {
    console.error('delivery.getReadyList error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar siap antar',
      error: error.message
    });
  }
};
