import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import LeaderShell from '../components/LeaderShell.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import Receivable from './Receivable.jsx';
import { leaderApi, cutoffFor, cutoffRange, fmtShort } from '../utils/leaderUtils.js';
import { setPageTitle } from '../../../utils/pageTitle.js';

const rp = (n) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const rpShort = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1).replace('.', ',')} M`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (a >= 1e3) return `${Math.round(v / 1e3)} rb`;
  return `${Math.round(v)}`;
};
const pct = (n) => `${(Number(n) || 0).toFixed(1).replace('.', ',')}%`;

function Card({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-100 bg-white', emerald: 'border-emerald-100 bg-emerald-50/60', rose: 'border-rose-100 bg-rose-50/60',
    sky: 'border-sky-100 bg-sky-50/60', amber: 'border-amber-100 bg-amber-50/60',
  };
  return (
    <div className={`rounded-2xl border px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-[16px] font-black text-slate-800 leading-tight mt-0.5 break-words">{value}</p>
      {sub && <p className="text-[10px] font-semibold text-slate-500 leading-tight mt-0.5">{sub}</p>}
    </div>
  );
}

/** Grafik batang harian tanpa library. Tinggi relatif ke hari tertinggi. */
function TrendBars({ data }) {
  const max = Math.max(1, ...data.map((d) => Number(d.sales) || 0));
  const [active, setActive] = useState(null);
  const shown = active != null ? data[active] : null;
  return (
    <div>
      <div className="h-[22px] mb-1 text-[11px] font-bold text-slate-600">
        {shown ? <><span className="text-slate-400">{fmtShort(shown.date)}:</span> {rp(shown.sales)}</> : <span className="text-slate-300">Ketuk batang untuk melihat nominal</span>}
      </div>
      <div className="flex items-end gap-[3px] h-[120px]">
        {data.map((d, i) => (
          <button key={d.date} type="button" onClick={() => setActive(i === active ? null : i)} aria-label={`${d.date} ${rp(d.sales)}`}
            className="flex-1 h-full flex items-end group">
            <span className={`w-full rounded-t-[3px] transition-all ${i === active ? 'bg-[#5f1340]' : 'bg-[#5f1340]/35 group-active:bg-[#5f1340]/60'}`}
              style={{ height: `${Math.max(2, ((Number(d.sales) || 0) / max) * 100)}%` }} />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[9px] font-bold text-slate-300 mt-1">
        <span>{fmtShort(data[0]?.date)}</span><span>{fmtShort(data[data.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

export default function LeaderSales() {
  const now = cutoffFor();
  const [month, setMonth] = useState(now.month);
  const [year, setYear] = useState(now.year);
  const period = useMemo(() => cutoffRange(month, year), [month, year]);
  const isCurrent = month === now.month && year === now.year;
  // Disimpan terpisah: daftar periode tidak boleh hilang saat data sedang dimuat ulang.
  const [availablePeriods, setAvailablePeriods] = useState([]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [trendMode, setTrendMode] = useState('all');
  const [tab, setTab] = useState('sales');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { setPageTitle('Sales & Piutang'); }, [tab]);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      // Periode berjalan: backend memotong ke H-1. Periode lama: kirim rentang penuh.
      const params = isCurrent ? {} : { startDate: period.startDate, endDate: period.endDate };
      const r = await leaderApi.get('/sales', { params });
      setData(r.data);
      if (r.data?.meta?.availablePeriods) setAvailablePeriods(r.data.meta.availablePeriods);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat data penjualan.');
      setData(null);
    } finally { setLoading(false); setRefreshing(false); }
  }, [isCurrent, period.startDate, period.endDate]);

  useEffect(() => { load(); }, [load]);

  const o = data?.outlets?.[0] || null;

  // Sama dengan dashboard ALSA (PenjualanSection): Full Waschen + 30% Cleanox (bagi hasil).
  const CLEANOX_SHARE = 0.30;
  const waschenByDate = useMemo(() => Object.fromEntries((data?.trendWaschen || []).map((d) => [d.date, Number(d.sales) || 0])), [data]);
  const adjustedTrend = useMemo(() => (data?.trend || []).map((d) => {
    const w = waschenByDate[d.date] || 0;
    return { ...d, sales: Math.round(w + CLEANOX_SHARE * ((Number(d.sales) || 0) - w)) };
  }), [data, waschenByDate]);
  const trend = trendMode === 'waschen' ? data?.trendWaschen : adjustedTrend;

  const raw = o ? Number(o.actual_sales) || 0 : 0;
  const cleanox = o ? Number(o.cleanox_sales) || 0 : 0;
  const actual = raw - cleanox + CLEANOX_SHARE * cleanox;
  const target = o ? Number(o.target_bulanan) || 0 : 0;
  const targetKum = o ? Number(o.target_kumulatif_sales) || 0 : 0;
  const gap = actual - targetKum;
  const gapUp = gap >= 0;
  const achievement = target > 0 ? (actual / target) * 100 : 0;
  const lastDay = adjustedTrend.length ? adjustedTrend[adjustedTrend.length - 1].sales : 0;
  const barW = (v) => `${Math.max(0, Math.min(100, Number(v) || 0))}%`;

  return (
    <LeaderShell title="Sales & Piutang" caption="Menu Leader" icon={TrendingUp} onRefresh={() => (tab === 'sales' ? load(true) : setReloadKey((k) => k + 1))} refreshing={refreshing}>
      <div className="mx-4 -mt-6 relative z-30 flex gap-1.5 bg-white border border-slate-100 p-1 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
        {[['sales', 'Sales'], ['piutang', 'Piutang']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-xl text-[12px] font-extrabold transition ${tab === k ? 'bg-[#5f1340] text-white shadow-sm' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>

      {tab === 'piutang' && <Receivable reloadKey={reloadKey} />}
      {tab === 'sales' && (
      <>
      <div className="mx-4 mt-3 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-4">
        <PeriodPicker month={month} year={year} availablePeriods={availablePeriods} startDate={period.startDate} endDate={period.endDate}
          onChange={(m, y) => { setMonth(m); setYear(y); }} noMargin />
        {data?.meta && (
          <p className="text-[10.5px] font-semibold text-slate-400 mt-1">
            Data s/d {fmtShort(data.meta.asOfDate)} (hari berjalan belum masuk)
          </p>
        )}
      </div>

      <div className="mx-4 mt-3 pb-4 space-y-3">
        {loading && <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
        {!loading && error && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
            <p className="text-[12px] font-bold text-rose-700">{error}</p>
          </div>
        )}
        {!loading && !error && !o && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 text-center">
            <p className="text-[13px] font-black text-slate-700">Data penjualan belum tersedia</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">Outlet Anda belum punya target atau transaksi di periode ini.</p>
          </div>
        )}

        {!loading && o && (
          <>
            <div className="bg-white rounded-[22px] border border-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{o.outlet}</p>
              <p className="text-[24px] font-black text-slate-800 leading-tight mt-1">{rp(actual)}</p>
              <p className="text-[11px] font-semibold text-slate-400">dari target {rp(target)} · sudah termasuk 30% Cleanox</p>

              <div className="mt-3 h-3 rounded-full bg-slate-100 overflow-hidden relative">
                <div className={`h-full rounded-full ${gapUp ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: barW(achievement) }} />
                <span className="absolute top-0 bottom-0 w-[2px] bg-slate-700/70" style={{ left: barW(o.persen_target_kumulatif) }} title="Target hari ini" />
              </div>
              <div className="flex justify-between text-[10.5px] font-extrabold mt-1.5">
                <span className={gapUp ? 'text-emerald-600' : 'text-rose-600'}>Capaian {pct(achievement)}</span>
                <span className="text-slate-400">Target s/d kini {pct(o.persen_target_kumulatif)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Card label="Kemarin" value={rp(lastDay)} />
              <Card label="Target s/d kini" value={rp(targetKum)} tone="sky" />
              <Card label={gapUp ? 'Lebih' : 'Kurang'} value={rp(Math.abs(gap))} tone={gapUp ? 'emerald' : 'rose'} />
              <Card label="Cleanox (30%)" value={rp(CLEANOX_SHARE * cleanox)} tone="amber" />
            </div>

            <div className="bg-white rounded-[22px] border border-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[12.5px] font-black text-slate-800">Tren Harian</h4>
                <div className="flex gap-1">
                  {[['all', 'Total'], ['waschen', 'Waschen']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setTrendMode(k)}
                      className={`h-[26px] px-2.5 rounded-full border text-[10.5px] font-extrabold ${trendMode === k ? 'border-[#5f1340] bg-[#5f1340] text-white' : 'border-slate-200 text-slate-500'}`}>{l}</button>
                  ))}
                </div>
              </div>
              {trend?.length ? <TrendBars data={trend} /> : <p className="text-[11px] text-slate-400 py-6 text-center">Belum ada data tren.</p>}
              <p className="text-[10px] font-semibold text-slate-400 mt-2">Total Rp {rpShort((trend || []).reduce((s, d) => s + (Number(d.sales) || 0), 0))} di periode ini.</p>
            </div>
          </>
        )}
      </div>
      </>
      )}
    </LeaderShell>
  );
}