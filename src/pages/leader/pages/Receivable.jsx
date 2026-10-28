import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, MessageCircle, Search, X, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import PeriodPicker from '../components/PeriodPicker.jsx';
import { leaderApi, cutoffFor, cutoffRange } from '../utils/leaderUtils.js';

const rp = (n) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const PAGE_SIZES = [25, 50, 100];
// Lebar kolom tetap, dipakai header dan setiap baris supaya sejajar.
const COLS = 'grid-cols-[minmax(0,1fr)_136px_88px]';

/** 6287897974000 -> 0878 9797 4000 (tampilan saja; tautan WA tetap memakai nomor penuh). */
function fmtPhone(phone) {
  const d = String(phone ?? '').replace(/\D/g, '');
  if (!d) return '—';
  const local = d.startsWith('62') ? `0${d.slice(2)}` : d.startsWith('8') ? `0${d}` : d;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1 $2 $3');
}

/** Nomor ke tautan WhatsApp (format 62...). Null bila bukan nomor yang valid. */
function waUrl(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('62')) return `https://wa.me/${digits}`;
  if (digits.startsWith('0')) return `https://wa.me/62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `https://wa.me/62${digits}`;
  return `https://wa.me/${digits}`;
}

/** Tab Piutang (Receivable): total piutang outlet + daftar customer, 25/50/100 per halaman. */
export default function Receivable({ reloadKey }) {
  const now = cutoffFor();
  const [month, setMonth] = useState(now.month);
  const [year, setYear] = useState(now.year);
  const period = useMemo(() => cutoffRange(month, year), [month, year]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Disimpan terpisah: pilihan periode tidak boleh hilang saat data dimuat ulang.
  const [periods, setPeriods] = useState([]);

  // Cari ditunda 350 ms supaya tidak memanggil API di setiap ketikan.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await leaderApi.get('/receivable', {
        params: { startDate: period.startDate, endDate: period.endDate, page, pageSize, search: query || undefined },
      });
      setData(r.data);
      if (r.data?.meta?.availablePeriods) setPeriods(r.data.meta.availablePeriods);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat data piutang.');
      setData(null);
    } finally { setLoading(false); }
  }, [period.startDate, period.endDate, page, pageSize, query]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const rows = data?.rows || [];
  const pg = data?.pagination || { page: 1, pageSize, total: 0, totalPages: 1 };
  const from = pg.total ? (pg.page - 1) * pg.pageSize + 1 : 0;
  const to = Math.min(pg.page * pg.pageSize, pg.total);

  return (
    <>
      <div className="mx-4 -mt-1 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-4">
        <PeriodPicker month={month} year={year} availablePeriods={periods} startDate={period.startDate} endDate={period.endDate}
          onChange={(m, y) => { setMonth(m); setYear(y); setPage(1); }} noMargin />
      </div>

      <div className="mx-4 mt-3 pb-4 space-y-3">
        <div className="bg-white rounded-[22px] border border-rose-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{data?.meta?.outlet || 'Piutang outlet'}</p>
          <p className="text-[24px] font-black text-rose-600 leading-tight mt-1">{rp(data?.summary?.total)}</p>
          <p className="text-[11px] font-semibold text-slate-400">
            {data ? `${data.summary.customers} customer · ${data.summary.notas} nota belum lunas` : '—'}
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau nomor telepon…"
            className="w-full h-[40px] rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-[12.5px] font-semibold text-slate-700 outline-none focus:border-[#5f1340]" />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-[22px] border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="px-4 pt-3.5 pb-2.5 bg-gradient-to-b from-[#5f1340]/[0.07] to-transparent border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[13px] font-black text-slate-800 flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-lg bg-[#5f1340]/10 text-[#5f1340] grid place-items-center"><Users className="w-3.5 h-3.5" /></span>
                Daftar Customer
              </h4>
              <span className="text-[10.5px] font-extrabold text-[#5f1340] bg-[#5f1340]/10 rounded-full px-2 py-0.5">{pg.total} orang</span>
            </div>
            <div className={`grid ${COLS} gap-x-3 mt-3 text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400`}>
              <span>Customer</span>
              <span className="text-center">No Telp</span>
              <span className="text-right">Jumlah</span>
            </div>
          </div>

          {loading && <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
          {!loading && error && (
            <div className="p-4 flex items-start gap-2 bg-rose-50">
              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-[12px] font-bold text-rose-700">{error}</p>
            </div>
          )}
          {!loading && !error && !rows.length && (
            <p className="py-10 text-center text-[12px] font-semibold text-slate-400">{query ? 'Tidak ada customer yang cocok.' : 'Tidak ada piutang di periode ini.'}</p>
          )}
          {!loading && !error && rows.map((r, i) => {
            const url = waUrl(r.phone);
            return (
              <div key={`${r.customer}-${r.phone}-${i}`} className={`grid ${COLS} items-center gap-x-3 px-4 py-2.5 border-b border-slate-50 last:border-0 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-extrabold text-slate-800 truncate">{r.customer}</p>
                  {r.notas > 1 && <p className="text-[10px] font-semibold text-slate-400">{r.notas} nota</p>}
                </div>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" aria-label={`Chat WhatsApp ${r.customer}`}
                    className="w-full inline-flex items-center justify-center gap-1 rounded-full bg-emerald-50 ring-1 ring-emerald-200 px-2 py-1 text-[10.5px] font-bold text-emerald-700 active:scale-95 transition">
                    <MessageCircle className="w-3 h-3 shrink-0" />
                    <span className="tabular-nums whitespace-nowrap">{fmtPhone(r.phone)}</span>
                  </a>
                ) : <span className="text-center text-[10.5px] font-semibold text-slate-300">{fmtPhone(r.phone)}</span>}
                <span className="text-[12px] font-black text-slate-800 tabular-nums text-right whitespace-nowrap">{rp(r.amount)}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
            Tampil
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="text-[12px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="text-[10.5px] font-semibold text-slate-400">{from}–{to} dari {pg.total}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pg.page <= 1 || loading} aria-label="Halaman sebelumnya"
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center disabled:opacity-40 active:scale-95">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-[11px] font-extrabold text-slate-600 tabular-nums px-1">{pg.page}/{pg.totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(pg.totalPages, p + 1))} disabled={pg.page >= pg.totalPages || loading} aria-label="Halaman berikutnya"
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center disabled:opacity-40 active:scale-95">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}