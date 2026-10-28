// Menu Leader > Sales. Query disalin dari AloraSuperApp/backend/controllers/salesDashboard/salesController.js
// (getPenjualan). Beda: outlet dikunci ke outlet leader di server, hanya baca.
// ponytail: salinan, bukan import (dua repo terpisah). Samakan manual bila query ALSA berubah.
import { smartlinkPool } from '../../db/pool.js';

const EXCLUDED_NOTAS = [
  'JDS250308134809893','JRC250412083723856','LKZ250422142258203','QSE250429084550314','POS250430090223407',
  'MDR250430160351857','TSI250501092607556','YOX250501094449877','PWX250501094618850','CAY250501162309243',
  'AIR250502165019925','VYO250504101231388','BPZ250505153114890','YNZ250506084550029','LPA250509104354921',
  'JKM250509133602454','ATR250509155731919','UVN250509155937609','COZ250510085855458','KCE250510092127311',
  'PPR250511104248281','ULX250511141125683','CPD250511150921365','MSB250512102328567','YSS250512142214977',
  'ESY250514094634398','VOE250514104206010','NPA250514134849617','KIZ250514150134296','RJR250514150240950',
  'VBJ250521105035645','WSL250612090231990','XND250612090410209','ESZ250622092835859','VRB250705145607387',
  'WNP250707092257535','ZQN250707095003871','ZQG250723150341368','SNR250726152557061','ZTZ250819164141353',
  'MLL250911095440273','OXI250916160645735','TYO250919133458354','OSD250919135615402','QGC250927143951995',
  'FGH251010145932475','EYF251013085108373','VPA251015090406450','LIZ251019134650581','DOT251027093136503',
  'ORC251027100046038','KZZ251119154110977',
];

function todayWIB() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

/** H-1 WIB. Hari berjalan belum ditutup, jadi tidak masuk capaian. */
function yesterdayWIB() {
  const d = new Date(`${todayWIB()}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fillDailyTrend(rows, dateStart, dateEnd) {
  const byDate = new Map(rows.map((r) => [r.date, r.sales]));
  const out = [];
  const cur = new Date(`${dateStart}T12:00:00`);
  const end = new Date(`${dateEnd}T12:00:00`);
  while (cur <= end) {
    const date = [
      cur.getFullYear(),
      String(cur.getMonth() + 1).padStart(2, "0"),
      String(cur.getDate()).padStart(2, "0"),
    ].join("-");
    out.push({ day: String(cur.getDate()), date, sales: byDate.get(date) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// Compute billing period (26th–25th) from a reference date
function computeDateRange(asOfDate) {
  const d = new Date(asOfDate + "T12:00:00");
  const day = d.getDate();
  let dateStart, dateEnd;
  if (day >= 26) {
    dateStart = new Date(d.getFullYear(), d.getMonth(), 26);
    dateEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 25);
  } else {
    dateStart = new Date(d.getFullYear(), d.getMonth() - 1, 26);
    dateEnd   = new Date(d.getFullYear(), d.getMonth(), 25);
  }
  const fmt = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  return { dateStart: fmt(dateStart), dateEnd: fmt(dateEnd) };
}

// Filter outlet sargable (kolom outlet bertipe *_ci, jadi IN sudah tidak peka huruf besar/kecil).
// Params HARUS satu set per placeholder: urutan params di bawah mengikuti urutan "?" di SQL.
function outletIn(col, outlets) {
  if (!outlets || outlets.length === 0) return { clause: "1=1", params: [] };
  return { clause: `${col} IN (${outlets.map(() => "?").join(",")})`, params: outlets };
}

const toUtcDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const daysBetween = (a, b) => Math.round((toUtcDay(b) - toUtcDay(a)) / 86400000);

/** Kunci periode cutoff (tahun*100+bulan akhir periode): tgl >= 26 masuk bulan berikutnya. */
function periodKey(dateStr) {
  let y = +dateStr.slice(0, 4);
  let m = +dateStr.slice(5, 7);
  if (+dateStr.slice(8, 10) >= 26) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return y * 100 + m;
}

const round2 = (n) => Math.round(n * 100) / 100;

export const getSales = async (req, res) => {
  try {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    let { asOfDate, startDate, endDate } = req.query;
    // Outlet SELALU dari akun leader (mst_role); parameter outlets dari client diabaikan.
    const outlets = req.leader.smartlinkOutlets;

    if (asOfDate   && !dateRe.test(asOfDate))   return res.status(400).json({ success: false, message: "Format asOfDate harus YYYY-MM-DD" });
    if (startDate  && !dateRe.test(startDate))  return res.status(400).json({ success: false, message: "Format startDate harus YYYY-MM-DD" });
    if (endDate    && !dateRe.test(endDate))     return res.status(400).json({ success: false, message: "Format endDate harus YYYY-MM-DD" });

    const isRange = !!(startDate && endDate);

    // Determine effective dates
    let effectiveAsOfDate, dateStart, dateEnd;
    if (isRange) {
      effectiveAsOfDate = endDate;
      dateStart = startDate;
      dateEnd   = endDate;
    } else {
      if (!asOfDate) asOfDate = yesterdayWIB();
      effectiveAsOfDate = asOfDate;
      ({ dateStart, dateEnd } = computeDateRange(asOfDate));
    }

    // Periode berjalan dipotong ke H-1 (WIB). Hari ini belum masuk.
    {
      const yesterday = yesterdayWIB();
      if (effectiveAsOfDate > yesterday) effectiveAsOfDate = yesterday;
      if (effectiveAsOfDate < dateStart) effectiveAsOfDate = dateStart;
    }

    const EP = EXCLUDED_NOTAS.map(() => "?").join(",");
    const hasOutletFilter = outlets.length > 0;

    // ── 1) Pembayaran reguler: SATU kali scan, per outlet+hari ───────────
    // Sebelumnya tiga query terpisah (utama, tren, tren Waschen) memindai tabel pembayaran
    // dan tabel nota masing-masing. Total, cleanox, dan tren semuanya diturunkan dari hasil ini.
    // Kolom tanggal dibandingkan sebagai rentang (bukan DATE(kolom)) supaya index bisa dipakai.
    // Pengecualian "haji Legenda" ikut dihitung di agregat nota (is_haji), bukan subquery per baris.
    const payOutletInner = outletIn("p2.outlet", outlets);
    const payOutlet = outletIn("rtrp.outlet", outlets);
    const dailySql = `
SELECT rtrp.outlet AS outlet,
       DATE(rtrp.waktu_pembayaran) AS tanggal,
       SUM(rtrp.nominal_bayar) AS total,
       SUM(CASE WHEN nf.is_cleanox = 1 THEN rtrp.nominal_bayar ELSE 0 END) AS cleanox
FROM rekap_transaksi_reguler_pembayaran rtrp
LEFT JOIN (
    SELECT rtr.no_nota COLLATE utf8mb4_unicode_ci AS no_nota,
           MAX(CASE WHEN LOWER(COALESCE(rtr.nama_item, '')) LIKE '%cleanox%'
                      OR LOWER(COALESCE(rtr.nama_item, '')) LIKE '%karpet%'
                    THEN 1 ELSE 0 END) AS is_cleanox,
           MAX(CASE WHEN rtr.outlet LIKE '%legenda%'
                     AND (rtr.nama_item LIKE '%haji%' OR rtr.customer_nama LIKE '%haji%')
                    THEN 1 ELSE 0 END) AS is_haji
    FROM rekap_transaksi_reguler rtr
    -- Hanya nota yang dibayar di periode ini; tanpa batas ini seluruh tabel dipindai.
    WHERE rtr.no_nota IN (
        SELECT p2.no_nota
        FROM rekap_transaksi_reguler_pembayaran p2
        WHERE p2.waktu_pembayaran >= ? AND p2.waktu_pembayaran < DATE_ADD(?, INTERVAL 1 DAY)
          AND p2.jenis_bayar <> 'e-money'
          AND ${payOutletInner.clause}
    )
    GROUP BY 1
) nf ON rtrp.no_nota COLLATE utf8mb4_unicode_ci = nf.no_nota
WHERE rtrp.waktu_pembayaran >= ? AND rtrp.waktu_pembayaran < DATE_ADD(?, INTERVAL 1 DAY)
  AND rtrp.jenis_bayar <> 'e-money'
  AND rtrp.no_nota NOT IN (${EP})
  AND ${payOutlet.clause}
  AND COALESCE(nf.is_haji, 0) = 0
GROUP BY rtrp.outlet, DATE(rtrp.waktu_pembayaran)`;
    const dailyParams = [
      dateStart, effectiveAsOfDate, ...payOutletInner.params,
      dateStart, effectiveAsOfDate, ...EXCLUDED_NOTAS, ...payOutlet.params,
    ];

    // ── 2) Pembelian e-money per outlet+hari ─────────────────────────────
    const emoneyOutlet = outletIn("outlet", outlets);
    const emoneySql = `
SELECT outlet AS outlet, DATE(tanggal_beli) AS tanggal, SUM(grand_total) AS total
FROM rekap_pembelian_emoney
WHERE tanggal_beli >= ? AND tanggal_beli < DATE_ADD(?, INTERVAL 1 DAY)
  AND ${emoneyOutlet.clause}
GROUP BY outlet, DATE(tanggal_beli)`;
    const emoneyParams = [dateStart, effectiveAsOfDate, ...emoneyOutlet.params];

    // ── 3) Target periode (hanya outlet yang punya target) ───────────────
    const targetOutlet = outletIn("outlet", outlets);
    const targetSql = `
SELECT outlet, SUM(nominal) AS nominal
FROM target_sales
WHERE (tahun * 100 + bulan) BETWEEN ? AND ?
  AND ${targetOutlet.clause}
GROUP BY outlet
ORDER BY outlet`;
    const targetParams = [periodKey(dateStart), periodKey(dateEnd), ...targetOutlet.params];

    // ── 4) Segmentasi pelanggan per outlet ───────────────────────────────
    const custOutlet = outletIn("c.outlet", outlets);
    const customerSql = `
SELECT x.outlet,
       SUM(x.segmentasi = 'Loyal')              AS loyal_count,
       SUM(x.segmentasi = 'Regular')            AS regular_count,
       SUM(x.segmentasi = 'One Time')           AS one_time_count,
       SUM(x.status_pelanggan = 'Pelanggan Baru') AS new_customer_count
FROM (
    SELECT c.outlet AS outlet,
           CASE WHEN c.terdaftar_sejak >= ? THEN 'Pelanggan Baru' ELSE 'Pelanggan Lama' END AS status_pelanggan,
           CASE WHEN COUNT(DISTINCT DATE(r.tgl_terima)) >= 4 THEN 'Loyal'
                WHEN COUNT(DISTINCT DATE(r.tgl_terima)) >= 2 THEN 'Regular'
                ELSE 'One Time' END AS segmentasi
    FROM customer c
    JOIN rekap_transaksi_reguler r ON c.nama = r.customer_nama
    WHERE c.nama NOT LIKE '%dumm%' AND c.nama NOT LIKE '%tes%'
      AND c.nama NOT LIKE '%haiyun%' AND c.nama NOT LIKE '%kiyalalala%'
      AND c.nama NOT LIKE '%puspaaa%' AND c.nama NOT LIKE '%haji%'
      AND ${custOutlet.clause}
      AND r.tgl_terima >= ?
      AND r.tgl_terima < DATE_ADD(?, INTERVAL 1 DAY)
      AND r.nama_item NOT LIKE '%haji%'
    GROUP BY c.nama, c.outlet, status_pelanggan
) x
GROUP BY x.outlet`;
    const customerParams = [dateStart, ...custOutlet.params, dateStart, effectiveAsOfDate];

    const [[dailyRows], [emoneyRows], [targetRows], [custRows], [periodRows]] = await Promise.all([
      smartlinkPool.query(dailySql, dailyParams),
      smartlinkPool.query(emoneySql, emoneyParams),
      smartlinkPool.query(targetSql, targetParams),
      smartlinkPool.query(customerSql, customerParams),
      // Periode cutoff yang punya target di database utk outlet ini (tahun, bulan = bulan akhir periode)
      hasOutletFilter
        ? smartlinkPool.query(`SELECT DISTINCT tahun, bulan FROM target_sales WHERE outlet IN (${outlets.map(() => '?').join(',')}) ORDER BY tahun, bulan`, outlets)
        : Promise.resolve([[]]),
    ]);

    // ── Agregasi di memori (hasilnya hanya puluhan baris) ────────────────
    const key = (o) => String(o ?? "").trim().toLowerCase();
    const byOutlet = new Map(); // key -> { actual, today, cleanox }
    const trendAll = new Map(); // tanggal -> sales (semua jenis)
    const trendWaschen = new Map(); // tanggal -> sales tanpa cleanox
    const bump = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
    const entry = (o) => {
      const k = key(o);
      if (!byOutlet.has(k)) byOutlet.set(k, { actual: 0, today: 0, cleanox: 0 });
      return byOutlet.get(k);
    };

    for (const r of dailyRows) {
      const total = Number(r.total) || 0;
      const cleanox = Number(r.cleanox) || 0;
      const e = entry(r.outlet);
      e.actual += total;
      e.cleanox += cleanox;
      if (r.tanggal === effectiveAsOfDate) e.today += total;
      bump(trendAll, r.tanggal, total);
      bump(trendWaschen, r.tanggal, total - cleanox);
    }
    for (const r of emoneyRows) {
      const total = Number(r.total) || 0;
      const e = entry(r.outlet);
      e.actual += total;
      if (r.tanggal === effectiveAsOfDate) e.today += total;
      bump(trendAll, r.tanggal, total);
      bump(trendWaschen, r.tanggal, total);
    }

    const custByOutlet = new Map(custRows.map((r) => [key(r.outlet), r]));
    const dateCount = daysBetween(dateStart, effectiveAsOfDate) + 1;
    const totalDay = daysBetween(dateStart, dateEnd) + 1;
    const ratio = dateCount / totalDay;

    const outletRows = targetRows.map((t) => {
      const k = key(t.outlet);
      const e = byOutlet.get(k) || { actual: 0, today: 0, cleanox: 0 };
      const c = custByOutlet.get(k) || {};
      const target = Number(t.nominal) || 0;
      const targetKum = ratio * target;
      return {
        outlet: t.outlet,
        date_count: dateCount,
        total_day: totalDay,
        persen_target_kumulatif: round2(ratio * 100),
        target_kumulatif_sales: targetKum,
        target_bulanan: target,
        actual_sales: e.actual,
        actual_hari_ini: e.today,
        gap_nominal: e.actual - targetKum,
        persen_actual: target ? round2((e.actual / target) * 100) : null,
        persen_gap: target ? round2((e.actual / target - ratio) * 100) : null,
        cleanox_sales: e.cleanox,
        loyal_count: Number(c.loyal_count) || 0,
        regular_count: Number(c.regular_count) || 0,
        one_time_count: Number(c.one_time_count) || 0,
        new_customer_count: Number(c.new_customer_count) || 0,
      };
    });

    const toTrend = (m) =>
      fillDailyTrend([...m].map(([date, sales]) => ({ date, sales })), dateStart, effectiveAsOfDate);

    res.json({
      success: true,
      outlets: outletRows,
      trend:        toTrend(trendAll),
      trendWaschen: toTrend(trendWaschen),
      meta: {
        asOfDate: effectiveAsOfDate,
        dateStart,
        dateEnd,
        availablePeriods: periodRows.map((r) => ({ year: Number(r.tahun), month: Number(r.bulan) })),
      },
    });
  } catch (err) {
    console.error("[leader.getSales]", err);
    res.status(500).json({ success: false, message: 'Gagal memuat data penjualan.' });
  }
};
