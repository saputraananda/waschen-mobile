import { myWaschenPool } from '../../db/pool.js';
import {
  getProduksiPhotoPublicPath,
  deleteProduksiPhotoFile,
  saveProduksiPhotoBuffers
} from '../../middleware/upload.js';

const STAGES = ['frontliner', 'washing', 'ironing', 'packing'];

// Mapping tahap → item_work_status yang sedang menunggu di tahap tsb
const STAGE_STATUS = {
  frontliner: 'Antrean',
  washing: 'Pencucian',
  ironing: 'Penyetrikaan',
  packing: 'Pengemasan'
};

// Persentase progress per item_work_status (mengikuti mst_work_status)
const STATUS_PERCENT = {
  'Antrean': 10,
  'Pencucian': 25,
  'Penyetrikaan': 50,
  'Pengemasan': 75,
  'Siap Diambil': 90,
  'Siap Diantar': 90,
  'Selesai': 100,
  'Dibatalkan': 0
};

const buildPhotoUrl = (req, photoPath) => {
  if (!photoPath) return null;
  const normalized = photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
  return `${req.protocol}://${req.get('host')}${normalized}`;
};

const nextStatusFor = (stage, detail) => {
  if (stage === 'frontliner') return 'Pencucian';
  if (stage === 'washing') return Number(detail.requires_ironing) === 0 ? 'Pengemasan' : 'Penyetrikaan';
  if (stage === 'ironing') return 'Pengemasan';
  if (stage === 'packing') return detail.fulfillment_type === 'Delivery_Kurir' ? 'Siap Diantar' : 'Siap Diambil';
  return null;
};

/** Rekalkulasi tr_transaction.work_status = rata-rata persentase item */
const recalcWorkStatus = async (conn, transactionId) => {
  const [items] = await conn.query(
    'SELECT item_work_status FROM tr_transaction_detail WHERE transaction_id = ?',
    [transactionId]
  );
  if (items.length === 0) return;
  const avg =
    items.reduce((sum, it) => sum + (STATUS_PERCENT[it.item_work_status] ?? 0), 0) / items.length;
  await conn.query('UPDATE tr_transaction SET work_status = ? WHERE id = ?', [
    Math.round(avg * 100) / 100,
    transactionId
  ]);
};

const resolveEmployeeName = async (employeeId, fallback) => {
  try {
    const [rows] = await myWaschenPool.query(
      `SELECT employee_name FROM mst_role
       WHERE employee_id = ?
         AND employee_name IS NOT NULL AND TRIM(employee_name) != ''
       LIMIT 1`,
      [employeeId]
    );
    return rows[0]?.employee_name || fallback || 'Unknown';
  } catch (_) {
    return fallback || 'Unknown';
  }
};

/**
 * GET /api/progress/summary?outlet_id=
 * Count nota (distinct transaksi) per tahap untuk badge tab.
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
         AND d.item_work_status IN ('Antrean','Pencucian','Penyetrikaan','Pengemasan')
       GROUP BY d.item_work_status`,
      [outletId]
    );

    const [holdRows] = await myWaschenPool.query(
      `SELECT COALESCE(p.returned_to_stage, p.stage) AS resolver_stage,
              COUNT(*) AS confirm_count
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       JOIN tr_item_progress p ON p.transaction_detail_id = d.id
         AND p.status IN ('hold','returned') AND p.hold_resolved_at IS NULL
       WHERE d.is_on_hold = 1 AND t.outlet_id = ?
       GROUP BY resolver_stage`,
      [outletId]
    );

    const summary = {};
    for (const stage of STAGES) {
      const row = rows.find((r) => r.status === STAGE_STATUS[stage]);
      const holdRow = holdRows.find((r) => r.resolver_stage === stage);
      summary[stage] = {
        nota_count: Number(row?.nota_count) || 0,
        item_count: Number(row?.item_count) || 0,
        confirm_count: Number(holdRow?.confirm_count) || 0
      };
    }

    return res.status(200).json({ success: true, message: 'OK', data: summary });
  } catch (error) {
    console.error('getSummary error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil ringkasan progres', error: error.message });
  }
};

/**
 * GET /api/progress/list?stage=&outlet_id=&date=
 * GET /api/progress/list?search=&outlet_id=  (lintas tahap: nota/nama/HP/barcode)
 * List nota + item untuk tahap tertentu, atau hasil pencarian lintas tahap.
 */
export const getList = async (req, res) => {
  try {
    const { stage, date } = req.query;
    const search = (req.query.search || '').trim();
    const outletId = Number(req.query.outlet_id) || req.user.assignedOutletId;
    if (!outletId) {
      return res.status(422).json({ success: false, message: 'Outlet belum ditetapkan' });
    }

    let whereClause;
    let params;
    let orderClause;

    if (search) {
      const like = `%${search}%`;
      whereClause = `t.outlet_id = ? AND (
        t.order_no = ? OR t.barcode = ? OR CAST(t.id AS CHAR) = ?
        OR t.order_no LIKE ? OR t.barcode LIKE ?
        OR c.name LIKE ? OR c.phone LIKE ?
      )`;
      params = [outletId, search, search, search, like, like, like, like];
      orderClause = `ORDER BY
        CASE
          WHEN t.order_no = ? OR t.barcode = ? OR CAST(t.id AS CHAR) = ? THEN 0
          ELSE 1
        END,
        t.order_date DESC
        LIMIT 50`;
      params.push(search, search, search);
    } else {
      if (!STAGES.includes(stage)) {
        return res.status(422).json({ success: false, message: 'Tahap tidak valid' });
      }
      const stageStatus = STAGE_STATUS[stage];
      whereClause = 'd.item_work_status = ? AND t.outlet_id = ?';
      params = [stageStatus, outletId];
      if (stage === 'frontliner' && date) {
        whereClause += ' AND DATE(t.order_date) = ?';
        params.push(date);
      }
      orderClause = 'ORDER BY t.order_date ASC';
    }

    const [txns] = await myWaschenPool.query(
      `SELECT DISTINCT t.id, t.order_no, t.barcode, t.customer_id, t.order_category,
              t.total_weight_kg, t.total_pcs, t.work_status, t.order_date,
              t.estimated_finished_at, t.special_notes, t.is_delivery,
              c.name AS customer_name, c.phone AS customer_phone
       FROM tr_transaction t
       JOIN tr_transaction_detail d ON d.transaction_id = t.id
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE ${whereClause}
       ${orderClause}`,
      params
    );

    if (txns.length === 0) {
      return res.status(200).json({ success: true, message: 'OK', data: [] });
    }

    const txnIds = txns.map((t) => t.id);
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

    const stageStatus = STAGE_STATUS[stage] || null;
    const data = txns.map((t) => {
      const items = details.filter((d) => d.transaction_id === t.id);
      const stageItems = stageStatus ? items.filter((d) => d.item_work_status === stageStatus) : [];
      const clearedItems = items.length - stageItems.length;
      return {
        ...t,
        has_finding: items.some((d) => Number(d.has_finding) === 1),
        has_hold: items.some((d) => Number(d.is_on_hold) === 1),
        total_items: items.length,
        stage_pending_items: stageItems.length,
        qc_progress_pct: items.length ? Math.round((clearedItems / items.length) * 100) : 0,
        items
      };
    });

    return res.status(200).json({ success: true, message: 'OK', data });
  } catch (error) {
    console.error('getList error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar nota', error: error.message });
  }
};

/**
 * GET /api/progress/transaction/:id
 * Detail 1 nota: item + riwayat progress + foto + bags + packing.
 */
export const getTransactionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [txns] = await myWaschenPool.query(
      `SELECT t.*, c.name AS customer_name, c.phone AS customer_phone
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.id = ? LIMIT 1`,
      [id]
    );
    if (txns.length === 0) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const [details] = await myWaschenPool.query(
      `SELECT d.*, s.category_id, cat.code AS category_code
       FROM tr_transaction_detail d
       LEFT JOIN mst_service s ON s.id = d.service_id
       LEFT JOIN mst_service_category cat ON cat.id = s.category_id
       WHERE d.transaction_id = ?`,
      [id]
    );

    const detailIds = details.map((d) => d.id);
    let progress = [];
    let photos = [];
    let bags = [];
    let packings = [];

    if (detailIds.length > 0) {
      [[progress], [bags], [packings]] = await Promise.all([
        myWaschenPool.query(
          `SELECT * FROM tr_item_progress WHERE transaction_detail_id IN (?) ORDER BY created_at ASC`,
          [detailIds]
        ),
        myWaschenPool.query(
          `SELECT * FROM tr_item_bag_detail WHERE transaction_detail_id IN (?) ORDER BY bag_no ASC`,
          [detailIds]
        ),
        myWaschenPool.query(
          `SELECT * FROM tr_item_packing WHERE transaction_detail_id IN (?) ORDER BY packing_no ASC`,
          [detailIds]
        )
      ]);

      const progressIds = progress.map((p) => p.id);
      if (progressIds.length > 0) {
        const [photoRows] = await myWaschenPool.query(
          `SELECT * FROM tr_item_progress_photo WHERE progress_id IN (?) ORDER BY id ASC`,
          [progressIds]
        );
        photos = photoRows.map((p) => ({ ...p, photo_url: buildPhotoUrl(req, p.photo_path) }));
      }
    }

    const data = {
      ...txns[0],
      items: details.map((d) => ({
        ...d,
        progress: progress
          .filter((p) => p.transaction_detail_id === d.id)
          .map((p) => ({ ...p, photos: photos.filter((f) => f.progress_id === p.id) })),
        bags: bags.filter((b) => b.transaction_detail_id === d.id),
        packings: packings.filter((k) => k.transaction_detail_id === d.id)
      }))
    };

    return res.status(200).json({ success: true, message: 'OK', data });
  } catch (error) {
    console.error('getTransactionDetail error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail nota', error: error.message });
  }
};

/**
 * POST /api/progress/qc (multipart, photos[] max 5)
 * Fields: transaction_detail_id, stage, qc_status(aman|temuan),
 *         qc_decision(lanjut|hold|kembali), returned_to_stage?, notes?,
 *         wa_contacted?(0|1), requires_ironing?(0|1, khusus frontliner),
 *         role_used?, bags?(JSON [{bag_no, qty_pcs, notes}]),
 *         packings?(JSON [{packing_no, qty_pcs}])
 */
export const submitQC = async (req, res) => {
  const incomingPhotos = req.files || [];
  const savedPhotoPaths = [];
  const cleanupFiles = async () => {
    await Promise.all(savedPhotoPaths.map((p) => deleteProduksiPhotoFile(p.filePath)));
  };

  let conn;
  try {
    const employeeId = req.user.employee_id;
    const {
      transaction_detail_id,
      stage,
      qc_status,
      qc_decision = 'lanjut',
      returned_to_stage,
      notes,
      wa_contacted,
      requires_ironing,
      role_used
    } = req.body;

    if (!STAGES.includes(stage)) {
      await cleanupFiles();
      return res.status(422).json({ success: false, message: 'Tahap tidak valid' });
    }
    if (!['aman', 'temuan'].includes(qc_status)) {
      await cleanupFiles();
      return res.status(422).json({ success: false, message: 'Status QC tidak valid' });
    }
    if (!['lanjut', 'hold', 'kembali'].includes(qc_decision)) {
      await cleanupFiles();
      return res.status(422).json({ success: false, message: 'Keputusan QC tidak valid' });
    }
    if (qc_status === 'temuan' && incomingPhotos.length === 0) {
      await cleanupFiles();
      return res.status(422).json({ success: false, message: 'Temuan wajib menyertakan minimal 1 foto bukti' });
    }
    if (qc_decision === 'kembali' && !STAGES.includes(returned_to_stage)) {
      await cleanupFiles();
      return res.status(422).json({ success: false, message: 'Tahap tujuan pengembalian tidak valid' });
    }

    let bags = [];
    let packings = [];
    try {
      if (req.body.bags) bags = JSON.parse(req.body.bags);
      if (req.body.packings) packings = JSON.parse(req.body.packings);
    } catch (_) {
      await cleanupFiles();
      return res.status(422).json({ success: false, message: 'Format rincian plastik/packing tidak valid' });
    }

    // Ambil item + validasi posisi
    const [detailRows] = await myWaschenPool.query(
      `SELECT d.*, t.outlet_id, t.id AS txn_id,
              cat.code AS category_code
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       LEFT JOIN mst_service s ON s.id = d.service_id
       LEFT JOIN mst_service_category cat ON cat.id = s.category_id
       WHERE d.id = ? LIMIT 1`,
      [transaction_detail_id]
    );
    if (detailRows.length === 0) {
      await cleanupFiles();
      return res.status(404).json({ success: false, message: 'Item tidak ditemukan' });
    }
    const detail = detailRows[0];

    if (detail.item_work_status !== STAGE_STATUS[stage]) {
      await cleanupFiles();
      return res.status(409).json({
        success: false,
        message: `Item tidak berada di tahap ini (posisi sekarang: ${detail.item_work_status})`
      });
    }
    if (Number(detail.is_on_hold) === 1) {
      await cleanupFiles();
      return res.status(409).json({ success: false, message: 'Item sedang di-hold, selesaikan konfirmasi terlebih dahulu' });
    }

    const isKiloan = detail.category_code === 'KILOAN' || String(detail.unit).toLowerCase() === 'kg';
    if (isKiloan && ['frontliner', 'washing'].includes(stage) && bags.length === 0) {
      await cleanupFiles();
      return res.status(422).json({ success: false, message: 'Item kiloan wajib diisi rincian plastik' });
    }
    if (stage === 'packing' && isKiloan && packings.length === 0) {
      await cleanupFiles();
      return res.status(422).json({ success: false, message: 'Item kiloan wajib diisi rincian packing' });
    }

    const employeeName = await resolveEmployeeName(employeeId, req.user.email);

    conn = await myWaschenPool.getConnection();
    await conn.beginTransaction();

    const progressStatus =
      qc_decision === 'hold' ? 'hold' : qc_decision === 'kembali' ? 'returned' : 'done';

    const [progressResult] = await conn.query(
      `INSERT INTO tr_item_progress
         (transaction_id, transaction_detail_id, stage, employee_id, employee_name, role_used,
          outlet_id, qc_status, qc_decision, returned_to_stage, notes, wa_contacted, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        detail.txn_id,
        detail.id,
        stage,
        employeeId,
        employeeName,
        role_used || null,
        detail.outlet_id,
        qc_status,
        qc_decision,
        qc_decision === 'kembali' ? returned_to_stage : null,
        notes?.trim() || null,
        stage === 'frontliner' && (wa_contacted === '1' || wa_contacted === 1) ? 1 : 0,
        progressStatus
      ]
    );
    const progressId = progressResult.insertId;

    // Rincian plastik
    if (bags.length > 0) {
      const bagValues = bags.map((b, i) => [
        progressId,
        detail.id,
        Number(b.bag_no) || i + 1,
        Number(b.qty_pcs) || 0,
        b.notes?.trim() || null
      ]);
      await conn.query(
        'INSERT INTO tr_item_bag_detail (progress_id, transaction_detail_id, bag_no, qty_pcs, notes) VALUES ?',
        [bagValues]
      );
    }

    // Rincian packing (replace existing utk item ini)
    if (stage === 'packing' && packings.length > 0) {
      await conn.query('DELETE FROM tr_item_packing WHERE transaction_detail_id = ?', [detail.id]);
      const packValues = packings.map((p, i) => {
        const no = Number(p.packing_no) || i + 1;
        const qty = Number(p.qty_pcs) || 0;
        return [detail.txn_id, detail.id, progressId, no, qty, `Packing ${no} — ${qty} pcs`];
      });
      await conn.query(
        'INSERT INTO tr_item_packing (transaction_id, transaction_detail_id, progress_id, packing_no, qty_pcs, label) VALUES ?',
        [packValues]
      );
    }

    // Update state item
    const detailUpdates = [];
    const detailParams = [];

    if (qc_decision === 'lanjut') {
      const nextStatus = nextStatusFor(stage, {
        ...detail,
        requires_ironing:
          stage === 'frontliner' && requires_ironing !== undefined
            ? Number(requires_ironing)
            : detail.requires_ironing
      });
      detailUpdates.push('item_work_status = ?');
      detailParams.push(nextStatus);
      if (['Siap Diambil', 'Siap Diantar'].includes(nextStatus)) {
        detailUpdates.push('item_completed_at = NOW()');
      }
      if (qc_status === 'temuan') {
        detailUpdates.push('has_finding = 1', 'finding_note = ?');
        detailParams.push(notes?.trim() || 'Temuan dilanjutkan dengan catatan');
      }
    } else {
      // hold / kembali → item tetap di posisi, ditandai hold
      detailUpdates.push('is_on_hold = 1', 'hold_stage = ?');
      detailParams.push(stage);
      if (qc_status === 'temuan') {
        detailUpdates.push('finding_note = ?');
        detailParams.push(notes?.trim() || 'Temuan menunggu konfirmasi');
      }
    }

    if (stage === 'frontliner' && requires_ironing !== undefined) {
      detailUpdates.push('requires_ironing = ?');
      detailParams.push(Number(requires_ironing) === 0 ? 0 : 1);
    }

    detailParams.push(detail.id);
    await conn.query(
      `UPDATE tr_transaction_detail SET ${detailUpdates.join(', ')} WHERE id = ?`,
      detailParams
    );

    // Log status
    const logStatus = qc_decision === 'lanjut' ? nextStatusFor(stage, detail) : detail.item_work_status;
    await conn.query(
      `INSERT INTO tr_transaction_status_log (transaction_id, transaction_detail_id, status, employee_id, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        detail.txn_id,
        detail.id,
        logStatus,
        employeeId,
        `[${stage}] QC ${qc_status} — ${qc_decision}${notes ? ` : ${notes.trim()}` : ''}`
      ]
    );

    await recalcWorkStatus(conn, detail.txn_id);

    // Simpan foto ke disk SETELAH data QC siap — baru catat path di DB
    if (incomingPhotos.length > 0) {
      const savedPhotos = await saveProduksiPhotoBuffers(stage, incomingPhotos, req);
      savedPhotoPaths.push(...savedPhotos);
      const photoType = qc_status === 'temuan' ? 'temuan' : 'qc';
      const publicPath = getProduksiPhotoPublicPath(stage);
      const photoValues = savedPhotos.map(({ fileName }) => [
        progressId,
        `${publicPath}/${fileName}`,
        photoType
      ]);
      await conn.query(
        'INSERT INTO tr_item_progress_photo (progress_id, photo_path, photo_type) VALUES ?',
        [photoValues]
      );
    }

    await conn.commit();

    // Verifikasi balik
    const [verify] = await myWaschenPool.query(
      'SELECT id, item_work_status, has_finding, is_on_hold, hold_stage, requires_ironing FROM tr_transaction_detail WHERE id = ?',
      [detail.id]
    );

    return res.status(201).json({
      success: true,
      message:
        qc_decision === 'lanjut'
          ? 'QC tersimpan, item lanjut ke tahap berikutnya'
          : qc_decision === 'hold'
            ? 'QC tersimpan, item di-hold menunggu konfirmasi'
            : 'QC tersimpan, item dikembalikan untuk konfirmasi',
      data: { progress_id: progressId, item: verify[0] }
    });
  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) { /* ignore */ } }
    await cleanupFiles();
    console.error('submitQC error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan QC', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * GET /api/progress/holds?stage=&outlet_id=
 * Daftar item hold per role/tahap penyelesaian (resolver).
 * Contoh: temuan cuci dikembalikan ke frontliner → muncul di holds?stage=frontliner
 */
export const getHolds = async (req, res) => {
  try {
    const { stage } = req.query;
    const outletId = Number(req.query.outlet_id) || req.user.assignedOutletId;
    if (!outletId) {
      return res.status(422).json({ success: false, message: 'Outlet belum ditetapkan' });
    }
    if (!stage || !STAGES.includes(stage)) {
      return res.status(422).json({ success: false, message: 'Tahap tidak valid' });
    }

    const [rows] = await myWaschenPool.query(
      `SELECT d.id AS detail_id, d.transaction_id, d.service_name, d.qty, d.unit,
              d.item_work_status, d.has_finding, d.finding_note, d.hold_stage,
              t.order_no, c.name AS customer_name, c.phone AS customer_phone,
              cat.code AS category_code,
              p.id AS progress_id, p.stage AS reported_stage, p.qc_decision, p.returned_to_stage,
              p.notes AS report_notes, p.employee_name AS reported_by, p.created_at AS reported_at,
              COALESCE(p.returned_to_stage, p.stage) AS resolver_stage
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       LEFT JOIN mst_service s ON s.id = d.service_id
       LEFT JOIN mst_service_category cat ON cat.id = s.category_id
       JOIN tr_item_progress p ON p.transaction_detail_id = d.id AND p.status IN ('hold','returned')
         AND p.hold_resolved_at IS NULL
       WHERE d.is_on_hold = 1 AND t.outlet_id = ?
         AND COALESCE(p.returned_to_stage, p.stage) = ?
       ORDER BY p.created_at ASC`,
      [outletId, stage]
    );

    // Foto laporan hold
    const progressIds = rows.map((r) => r.progress_id);
    let photos = [];
    if (progressIds.length > 0) {
      const [photoRows] = await myWaschenPool.query(
        'SELECT * FROM tr_item_progress_photo WHERE progress_id IN (?)',
        [progressIds]
      );
      photos = photoRows.map((p) => ({ ...p, photo_url: buildPhotoUrl(req, p.photo_path) }));
    }

    const data = rows.map((r) => ({
      ...r,
      photos: photos.filter((p) => p.progress_id === r.progress_id)
    }));

    return res.status(200).json({ success: true, message: 'OK', data });
  } catch (error) {
    console.error('getHolds error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar hold', error: error.message });
  }
};

/**
 * POST /api/progress/hold/:detailId/resolve
 * Body: { decision: 'lanjut'|'batal', note }
 * lanjut → hold dilepas, item tetap di tahap sekarang (dikerjakan ulang dgn label temuan)
 * batal  → item dibatalkan
 */
export const resolveHold = async (req, res) => {
  let conn;
  try {
    const employeeId = req.user.employee_id;
    const { detailId } = req.params;
    const { decision, note } = req.body;

    if (!['lanjut', 'batal'].includes(decision)) {
      return res.status(422).json({ success: false, message: 'Keputusan tidak valid' });
    }

    const [detailRows] = await myWaschenPool.query(
      `SELECT d.*, t.id AS txn_id FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       WHERE d.id = ? LIMIT 1`,
      [detailId]
    );
    if (detailRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item tidak ditemukan' });
    }
    const detail = detailRows[0];
    if (Number(detail.is_on_hold) !== 1) {
      return res.status(409).json({ success: false, message: 'Item tidak sedang di-hold' });
    }

    const employeeName = await resolveEmployeeName(employeeId, req.user.email);

    conn = await myWaschenPool.getConnection();
    await conn.beginTransaction();

    // Tutup progress hold yang masih terbuka
    await conn.query(
      `UPDATE tr_item_progress
       SET hold_resolved_at = NOW(), hold_resolved_by = ?, hold_resolution_note = ?
       WHERE transaction_detail_id = ? AND status IN ('hold','returned') AND hold_resolved_at IS NULL`,
      [employeeId, note?.trim() || null, detailId]
    );

    if (decision === 'lanjut') {
      await conn.query(
        `UPDATE tr_transaction_detail
         SET is_on_hold = 0, hold_stage = NULL, has_finding = 1,
             finding_note = COALESCE(?, finding_note)
         WHERE id = ?`,
        [note?.trim() || null, detailId]
      );
    } else {
      await conn.query(
        `UPDATE tr_transaction_detail
         SET is_on_hold = 0, hold_stage = NULL, item_work_status = 'Dibatalkan'
         WHERE id = ?`,
        [detailId]
      );
    }

    await conn.query(
      `INSERT INTO tr_transaction_status_log (transaction_id, transaction_detail_id, status, employee_id, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        detail.txn_id,
        detailId,
        decision === 'batal' ? 'Dibatalkan' : detail.item_work_status,
        employeeId,
        `Hold resolved (${decision}) oleh ${employeeName}${note ? ` : ${note.trim()}` : ''}`
      ]
    );

    await recalcWorkStatus(conn, detail.txn_id);
    await conn.commit();

    const [verify] = await myWaschenPool.query(
      'SELECT id, item_work_status, has_finding, is_on_hold FROM tr_transaction_detail WHERE id = ?',
      [detailId]
    );

    return res.status(200).json({
      success: true,
      message: decision === 'lanjut' ? 'Konfirmasi selesai, item dapat diproses kembali' : 'Item dibatalkan',
      data: verify[0]
    });
  } catch (error) {
    if (conn) { try { await conn.rollback(); } catch (_) { /* ignore */ } }
    console.error('resolveHold error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyelesaikan konfirmasi', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * GET /api/progress/item/:detailId/bag-history
 * Riwayat rincian plastik kiloan per tahap (frontliner, washing, …).
 */
export const getItemBagHistory = async (req, res) => {
  try {
    const detailId = Number(req.params.detailId);
    if (!detailId) {
      return res.status(422).json({ success: false, message: 'ID item tidak valid' });
    }

    const [rows] = await myWaschenPool.query(
      `SELECT b.bag_no, b.qty_pcs, b.notes,
              p.id AS progress_id, p.stage, p.employee_name, p.completed_at
       FROM tr_item_bag_detail b
       JOIN tr_item_progress p ON p.id = b.progress_id
       WHERE b.transaction_detail_id = ?
       ORDER BY FIELD(p.stage, 'frontliner', 'washing', 'ironing', 'packing'), b.bag_no ASC`,
      [detailId]
    );

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.stage]) {
        grouped[row.stage] = {
          stage: row.stage,
          employee_name: row.employee_name,
          completed_at: row.completed_at,
          bags: []
        };
      }
      grouped[row.stage].bags.push({
        bag_no: row.bag_no,
        qty_pcs: row.qty_pcs,
        notes: row.notes
      });
    }

    const data = STAGES.filter((s) => grouped[s]).map((s) => ({
      ...grouped[s],
      total_pcs: grouped[s].bags.reduce((sum, b) => sum + Number(b.qty_pcs || 0), 0)
    }));

    return res.status(200).json({ success: true, message: 'OK', data });
  } catch (error) {
    console.error('getItemBagHistory error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat rincian plastik', error: error.message });
  }
};
