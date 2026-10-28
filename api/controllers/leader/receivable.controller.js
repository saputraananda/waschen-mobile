import { smartlinkPool } from '../../db/pool.js';

// Menu Leader > Piutang. Query disalin dari AloraSuperApp/backend/controllers/salesDashboard/piutangController.js.
// Beda: outlet dikunci ke outlet leader di server (req.leader.smartlinkOutlets), hanya baca,
// dan daftar digabung per customer (ALSA menampilkan per nota).
// ponytail: salinan, bukan import (dua repo terpisah). Samakan manual bila query ALSA berubah.

const PAGE_SIZES = [25, 50, 100];
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function computeDateRange(asOfDate) {
  const d = new Date(`${asOfDate}T12:00:00`);
  const day = d.getDate();
  const start = day >= 26 ? new Date(d.getFullYear(), d.getMonth(), 26) : new Date(d.getFullYear(), d.getMonth() - 1, 26);
  const end = day >= 26 ? new Date(d.getFullYear(), d.getMonth() + 1, 25) : new Date(d.getFullYear(), d.getMonth(), 25);
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return { dateStart: fmt(start), dateEnd: fmt(end) };
}

/** GET /api/leader/receivable?startDate&endDate&page&pageSize&search */
export const getReceivable = async (req, res) => {
  try {
    const outlets = req.leader.smartlinkOutlets;
    if (!outlets.length) {
      return res.json({ success: true, summary: { total: 0, customers: 0, notas: 0 }, rows: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 }, meta: {} });
    }

    let { asOfDate, startDate, endDate } = req.query;
    if ([asOfDate, startDate, endDate].some((v) => v && !dateRe.test(v))) {
      return res.status(400).json({ success: false, message: 'Format tanggal harus YYYY-MM-DD.' });
    }
    let dateStart;
    let dateEnd;
    if (startDate && endDate) {
      dateStart = startDate;
      dateEnd = endDate;
    } else {
      asOfDate = asOfDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      ({ dateStart, dateEnd } = computeDateRange(asOfDate));
    }

    const pageSize = PAGE_SIZES.includes(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 25;
    const search = String(req.query.search || '').trim().toLowerCase();

    // Dua query independen -> jalan paralel. Rentang tgl_terima dipush ke WHERE (sargable) alih-alih
    // disaring setelah GROUP BY; semua baris satu nota punya tgl_terima yang sama.
    const outletIn = outlets.map(() => '?').join(',');
    const [[rows], [periodRows]] = await Promise.all([
      smartlinkPool.query(
        `SELECT
           MAX(rtr.customer_nama)              AS customer_nama,
           MAX(rtr.customer_telepon)           AS customer_telepon,
           COALESCE(MAX(rtr.total_tagihan), 0) AS total_tagihan
         FROM rekap_transaksi_reguler rtr
         WHERE rtr.outlet IN (${outletIn})
           AND rtr.pembayaran = 'Belum Lunas'
           AND rtr.pengambilan IN ('Belum Diambil', 'Diambil Semua')
           AND rtr.tgl_selesai IS NOT NULL
           AND rtr.tgl_terima >= ? AND rtr.tgl_terima < DATE_ADD(?, INTERVAL 1 DAY)
           AND rtr.customer_nama NOT LIKE '%dum%'
           AND rtr.customer_nama NOT LIKE '%test%'
           AND rtr.customer_nama NOT LIKE '%nur kholifah%'
           AND rtr.customer_nama NOT LIKE '%kiyalalala%'
           AND rtr.customer_nama NOT LIKE 'Tiya Raffles'
           AND rtr.nama_item     NOT LIKE '%haji%'
           AND rtr.customer_nama NOT LIKE '%haji%'
           AND rtr.nama_item     NOT LIKE '%cleanox%'
         GROUP BY rtr.no_nota`,
        [...outlets, dateStart, dateEnd]
      ),
      // Periode cutoff (26–25) yang punya nota belum lunas di outlet ini, untuk pilihan bulan/tahun di UI.
      smartlinkPool.query(
        `SELECT YEAR(DATE_ADD(tgl_terima, INTERVAL IF(DAY(tgl_terima) >= 26, 1, 0) MONTH)) AS y,
                MONTH(DATE_ADD(tgl_terima, INTERVAL IF(DAY(tgl_terima) >= 26, 1, 0) MONTH)) AS m
         FROM rekap_transaksi_reguler
         WHERE outlet IN (${outletIn})
           AND pembayaran = 'Belum Lunas' AND tgl_selesai IS NOT NULL
           AND pengambilan IN ('Belum Diambil', 'Diambil Semua')
         GROUP BY y, m
         ORDER BY y, m`,
        outlets
      ),
    ]);
    const availablePeriods = periodRows.map((r) => ({ year: Number(r.y), month: Number(r.m) }));

    // Gabung per customer: jumlah = total tagihan semua nota yang belum lunas.
    const byCustomer = new Map();
    for (const r of rows) {
      const phone = String(r.customer_telepon || '').trim();
      const key = `${String(r.customer_nama || '').trim().toLowerCase()}|${phone.replace(/\D/g, '')}`;
      const cur = byCustomer.get(key) || { customer: String(r.customer_nama || '-').trim(), phone, amount: 0, notas: 0 };
      cur.amount += Number(r.total_tagihan) || 0;
      cur.notas += 1;
      byCustomer.set(key, cur);
    }
    const all = [...byCustomer.values()].sort((a, b) => b.amount - a.amount || a.customer.localeCompare(b.customer, 'id'));
    const total = all.reduce((s, r) => s + r.amount, 0);

    const filtered = search
      ? all.filter((r) => r.customer.toLowerCase().includes(search) || r.phone.replace(/\D/g, '').includes(search.replace(/\D/g, '') || '\u0000'))
      : all;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(Math.max(1, Number(req.query.page) || 1), totalPages);

    return res.json({
      success: true,
      summary: { total, customers: all.length, notas: rows.length },
      rows: filtered.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page, pageSize, total: filtered.length, totalPages },
      meta: { dateStart, dateEnd, outlet: outlets[0], availablePeriods },
    });
  } catch (err) {
    console.error('[leader.getReceivable]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data piutang.' });
  }
};