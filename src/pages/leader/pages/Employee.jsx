import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Search, X, ChevronRight, Clock, AlertCircle, Loader2, SlidersHorizontal } from 'lucide-react';
import LeaderShell from '../components/LeaderShell.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import {
  leaderApi, cutoffFor, cutoffRange, fmtDay, fmtShort, fmtDur, fmtDays, LEAVE_LABEL, DAY_STATUS,
} from '../utils/leaderUtils.js';
import {
  Avatar, Chip, Stat, Badge, SkeletonRows, CutoffCalendar,
} from '../utils/employeeUi.jsx';
import { setPageTitle } from '../../../utils/pageTitle.js';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';

// Filter cepat berdasarkan kedisiplinan. "Semua" = tanpa filter.
const QUICK = [
  { id: 'all', label: 'Semua', test: () => true },
  { id: 'late', label: 'Pernah telat', test: (e) => e.late.count > 0 },
  { id: 'late3', label: 'Telat ≥3x', test: (e) => e.late.count >= 3 },
  { id: 'early', label: 'Pulang cepat', test: (e) => e.early.count > 0 },
  { id: 'noinfo', label: 'Tanpa keterangan', test: (e) => e.no_info_days > 0 },
  { id: 'leave', label: 'Ada izin/sakit/cuti', test: (e) => e.leave.total_days > 0 },
  { id: 'off', label: 'Ada libur', test: (e) => e.off > 0 },
  { id: 'belumout', label: 'Belum Out', test: (e) => e.belum_out > 0 },
  { id: 'perfect', label: 'Tepat waktu 100%', test: (e) => e.hadir > 0 && e.late.count === 0 },
];

const SORTS = [
  { id: 'name', label: 'Nama A–Z', fn: (a, b) => a.employee_name.localeCompare(b.employee_name, 'id') },
  { id: 'late', label: 'Telat terbanyak', fn: (a, b) => b.late.count - a.late.count || b.late.minutes - a.late.minutes },
  { id: 'lateMin', label: 'Telat terlama', fn: (a, b) => b.late.minutes - a.late.minutes },
  { id: 'hadir', label: 'Hadir terbanyak', fn: (a, b) => b.hadir - a.hadir },
  { id: 'noinfo', label: 'Tanpa keterangan', fn: (a, b) => b.no_info_days - a.no_info_days },
];

function monthKeysBetween(startKey, endKey) {
  const out = [];
  let [y, m] = startKey.split('-').map(Number);
  const [ey, em] = endKey.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

function EmployeeDetail({ employee, period, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('kalender');
  const [selDate, setSelDate] = useState(null);
  useLockBodyScroll(true);

  useEffect(() => {
    let alive = true;
    setDetail(null); setError(null); setSelDate(null);
    leaderApi.get(`/employees/${employee.employee_id}`, { params: { startDate: period.startDate, endDate: period.endDate } })
      .then((r) => {
        if (!alive) return;
        const d = r.data?.data;
        setDetail(d);
        const informative = (d?.days || []).filter((x) => !['belum_berjalan', 'belum_bergabung', 'sudah_keluar'].includes(x.status));
        setSelDate(informative.at(-1)?.date || null);
      })
      .catch((e) => { if (alive) setError(e.response?.data?.message || 'Gagal memuat detail.'); });
    return () => { alive = false; };
  }, [employee.employee_id, period.startDate, period.endDate]);

  const d = detail || employee;
  const sel = detail?.days?.find((x) => x.date === selDate) || null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[430px] max-h-[92vh] bg-slate-50 rounded-t-[28px] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <Avatar name={d.employee_name} photoUrl={d.profile_url} leader={d.is_leader} />
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-black text-slate-800 leading-tight truncate">{d.employee_name}</h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{[d.role, d.employee_code].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-8 h-8 rounded-full bg-slate-200/70 flex items-center justify-center shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 grid grid-cols-3 gap-2 pb-3">
          <Stat label="Hadir" value={`${d.hadir}`} sub="hari" tone="emerald" />
          <Stat label="Telat" value={`${d.late.count}x`} sub={d.late.count ? `${fmtDur(d.late.minutes)} · max ${fmtDur(d.late.max)}` : 'tepat waktu'} tone={d.late.count ? 'rose' : 'slate'} />
          <Stat label="Libur" value={`${d.off}`} sub="hari" tone="sky" />
        </div>

        <div className="px-5 flex gap-1.5 pb-2">
          {[['kalender', 'Kalender'], ['izin', 'Perizinan'], ['lembur', 'Lembur']].map(([k, l]) => (
            <Chip key={k} active={tab === k} onClick={() => setTab(k)}>{l}</Chip>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {error && <p className="text-[12px] font-bold text-rose-600 py-6 text-center">{error}</p>}
          {!error && !detail && <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}

          {detail && tab === 'kalender' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Pulang cepat" value={`${d.early.count}x`} sub={d.early.count ? fmtDur(d.early.minutes) : '—'} tone={d.early.count ? 'amber' : 'slate'} />
                <Stat label="Tanpa keterangan" value={`${d.no_info_days}`} sub="hari" tone={d.no_info_days ? 'rose' : 'slate'} />
                <Stat label="Belum Out" value={`${d.belum_out}x`} sub="belum absen pulang" tone={d.belum_out ? 'amber' : 'slate'} />
                <Stat label="Rata-rata kerja" value={fmtDur(d.avg_work_minutes)} sub="per hari" />
              </div>

              <div className="bg-white rounded-[20px] border border-slate-100 p-3.5">
                <CutoffCalendar days={detail.days} startDate={period.startDate} endDate={period.endDate} selected={selDate} onSelect={setSelDate} />
              </div>

              {sel ? (
                <div className="bg-white rounded-[20px] border border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-extrabold text-slate-700">{fmtDay(sel.date)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${(DAY_STATUS[sel.status] || DAY_STATUS.belum_berjalan).cls}`}>{(DAY_STATUS[sel.status] || DAY_STATUS.belum_berjalan).label}</span>
                  </div>
                  {sel.status === 'hadir' && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                      <span>Masuk <b className="text-slate-800 tabular-nums">{sel.check_in || '—'}</b></span>
                      <span>Pulang <b className={`tabular-nums ${sel.belum_out ? 'text-amber-600' : 'text-slate-800'}`}>{sel.check_out || (sel.belum_out ? 'Belum Out' : '—')}</b></span>
                      {sel.work_minutes > 0 && <span>{fmtDur(sel.work_minutes)}</span>}
                    </div>
                  )}
                  {(sel.late_minutes > 0 || sel.early_minutes > 0 || sel.late_excused || sel.shift_name || sel.half_day_leave || sel.off_but_present) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {sel.shift_name && <Badge tone="slate">{sel.shift_name}{sel.shift_assumed ? ' (asumsi)' : ''}</Badge>}
                      {sel.late_minutes > 0 && <Badge tone="rose">Telat {fmtDur(sel.late_minutes)}</Badge>}
                      {sel.late_excused && <Badge tone="violet">Telat dimaafkan (izin ½ hari)</Badge>}
                      {sel.early_minutes > 0 && <Badge tone="amber">Pulang cepat {fmtDur(sel.early_minutes)}</Badge>}
                      {sel.half_day_leave && <Badge tone="violet">{LEAVE_LABEL[sel.half_day_leave]} ½ hari</Badge>}
                      {sel.off_but_present && <Badge tone="sky">Masuk di hari libur</Badge>}
                    </div>
                  )}
                  {sel.note && <p className="mt-1.5 text-[10.5px] font-medium text-slate-400 leading-snug break-words">“{sel.note}”</p>}
                </div>
              ) : (
                <p className="text-[11px] font-semibold text-slate-400 text-center">Ketuk tanggal untuk melihat detail hari itu.</p>
              )}
            </div>
          )}

          {detail && tab === 'izin' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Izin" value={fmtDays(d.leave.izin)} sub="hari" tone="violet" />
                <Stat label="Sakit" value={fmtDays(d.leave.sakit)} sub="hari" tone="amber" />
                <Stat label="Cuti" value={fmtDays(d.leave.cuti)} sub="hari" tone="sky" />
              </div>
              {detail.leave_list.map((l) => (
                <div key={l.id} className="bg-white rounded-2xl border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-extrabold text-slate-700">{LEAVE_LABEL[l.type] || l.type}{l.duration_type !== 'full_day' ? ' ½ hari' : ''}</span>
                    <Badge tone={l.status === 'disetujui' ? 'emerald' : l.status === 'pengajuan' ? 'amber' : 'rose'}>{l.status}</Badge>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">{fmtDay(l.start_date)}{l.end_date !== l.start_date ? ` – ${fmtDay(l.end_date)}` : ''} · {fmtDays(l.days_in_period)} hari</p>
                  {l.reason && <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">{l.reason}</p>}
                </div>
              ))}
              {!detail.leave_list.length && <p className="text-[12px] font-semibold text-slate-400 py-3 text-center">Tidak ada pengajuan izin di periode ini.</p>}
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pt-2">Libur (Off)</p>
              {detail.off_list.length ? detail.off_list.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-slate-100 px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[12px] font-extrabold text-slate-700">{fmtDay(o.date)}</span>
                    {o.reason && <p className="text-[10.5px] text-slate-400 truncate">{o.reason}</p>}
                  </div>
                  <Badge tone={o.status === 'disetujui' ? 'emerald' : o.status === 'ditolak' ? 'rose' : 'amber'}>{o.status.replace('_', ' ')}</Badge>
                </div>
              )) : <p className="text-[12px] font-semibold text-slate-400 py-3 text-center">Tidak ada libur di periode ini.</p>}
            </div>
          )}

          {detail && tab === 'lembur' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Lembur disetujui" value={fmtDur(d.overtime.approved_minutes)} sub={`${d.overtime.approved_count}x`} tone="sky" />
                <Stat label="Menunggu" value={`${d.overtime.pending_count}`} sub="pengajuan" tone={d.overtime.pending_count ? 'amber' : 'slate'} />
              </div>
              {detail.overtime_list.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-extrabold text-slate-700">{fmtDay(o.date)}</span>
                    <Badge tone={o.status === 'disetujui' ? 'emerald' : o.status === 'ditolak' ? 'rose' : 'amber'}>{o.status}</Badge>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">{o.start || '—'} – {o.end || 'berlangsung'} · {fmtDur(o.minutes)}</p>
                  {o.reason && <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">{o.reason}</p>}
                </div>
              ))}
              {!detail.overtime_list.length && <p className="text-[12px] font-semibold text-slate-400 py-6 text-center">Tidak ada lembur di periode ini.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LeaderEmployee() {
  const now = cutoffFor();
  const [month, setMonth] = useState(now.month);
  const [year, setYear] = useState(now.year);
  const period = useMemo(() => cutoffRange(month, year), [month, year]);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [quick, setQuick] = useState('all');
  const [sortId, setSortId] = useState('name');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => { setPageTitle('Pantau Karyawan'); }, []);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const r = await leaderApi.get('/employees', { params: { startDate: period.startDate, endDate: period.endDate } });
      setRows(r.data?.data || []);
      setMeta(r.data?.meta || null);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat data karyawan.');
      setRows([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, [period.startDate, period.endDate]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const test = QUICK.find((x) => x.id === quick)?.test || (() => true);
    const sorter = SORTS.find((x) => x.id === sortId)?.fn || SORTS[0].fn;
    return rows
      .filter((e) => (!q || e.employee_name.toLowerCase().includes(q) || String(e.employee_code || '').toLowerCase().includes(q))
        && (!role || e.role === role) && test(e))
      .sort(sorter);
  }, [rows, search, role, quick, sortId]);

  const totals = useMemo(() => filtered.reduce((t, e) => ({
    late: t.late + e.late.count, lateMin: t.lateMin + e.late.minutes, lateEmp: t.lateEmp + (e.late.count ? 1 : 0),
    noInfo: t.noInfo + e.no_info_days, leave: t.leave + e.leave.total_days,
  }), { late: 0, lateMin: 0, lateEmp: 0, noInfo: 0, leave: 0 }), [filtered]);

  const activeFilters = (role ? 1 : 0) + (quick !== 'all' ? 1 : 0) + (sortId !== 'name' ? 1 : 0);
  const resetFilters = () => { setSearch(''); setRole(''); setQuick('all'); setSortId('name'); };

  return (
    <LeaderShell title="Pantau Karyawan" caption="Menu Leader" icon={Users} onRefresh={() => load(true)} refreshing={refreshing}>
      <div className="mx-4 -mt-6 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama karyawan…"
              className="w-full h-[40px] rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-[12.5px] font-semibold text-slate-700 outline-none focus:border-[#5f1340]" />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-label="Filter"
            className={`relative w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition ${showFilters ? 'border-[#5f1340] bg-[#5f1340] text-white' : 'border-slate-200 bg-white text-slate-500'}`}>
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">{activeFilters}</span>}
          </button>
        </div>

        <PeriodPicker month={month} year={year} availablePeriods={meta?.availablePeriods} startDate={period.startDate} endDate={period.endDate}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />

        {showFilters && (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">Posisi</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={!role} onClick={() => setRole('')}>Semua</Chip>
                {(meta?.roles || []).map((r) => <Chip key={r} active={role === r} onClick={() => setRole(r)}>{r}</Chip>)}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">Kedisiplinan & Perizinan</p>
              <div className="flex flex-wrap gap-1.5">{QUICK.map((q) => <Chip key={q.id} active={quick === q.id} onClick={() => setQuick(q.id)}>{q.label}</Chip>)}</div>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">Urutkan</p>
              <div className="flex flex-wrap gap-1.5">{SORTS.map((s) => <Chip key={s.id} active={sortId === s.id} onClick={() => setSortId(s.id)}>{s.label}</Chip>)}</div>
            </div>
            <button type="button" onClick={resetFilters} className="text-[11px] font-extrabold text-[#5f1340]">Reset semua filter</button>
          </div>
        )}
      </div>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
        <Stat label="Karyawan" value={`${filtered.length}`} sub={filtered.length !== rows.length ? `dari ${rows.length}` : 'di outlet Anda'} tone="sky" />
        <Stat label="Telat" value={`${totals.late}x`} sub={totals.late ? `${totals.lateEmp} orang · ${fmtDur(totals.lateMin)}` : 'tidak ada'} tone={totals.late ? 'rose' : 'emerald'} />
        <Stat label="Izin/Sakit/Cuti" value={fmtDays(totals.leave)} sub="hari disetujui" tone="violet" />
        <Stat label="Tanpa keterangan" value={`${totals.noInfo}`} sub="hari" tone={totals.noInfo ? 'amber' : 'slate'} />
      </div>

      <div className="mx-4 mt-3 pb-4 space-y-2">
        {loading && <SkeletonRows />}
        {!loading && error && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
            <p className="text-[12px] font-bold text-rose-700">{error}</p>
          </div>
        )}
        {!loading && !error && !filtered.length && (
          <p className="text-[12.5px] font-semibold text-slate-400 py-10 text-center">Tidak ada karyawan yang cocok dengan filter.</p>
        )}
        {!loading && filtered.map((e) => (
          <button key={e.employee_id} type="button" onClick={() => setSelected(e)}
            className="w-full bg-white rounded-[20px] border border-slate-100 px-4 py-3 text-left shadow-[0_2px_10px_rgba(0,0,0,0.03)] active:scale-[0.98] transition">
            <div className="flex items-center gap-3">
              <Avatar name={e.employee_name} photoUrl={e.profile_url} leader={e.is_leader} />
              <div className="min-w-0 flex-1">
                <h4 className="text-[13.5px] font-black text-slate-800 truncate">{e.employee_name}</h4>
                <p className="text-[10.5px] font-semibold text-slate-400 truncate">{e.role || '—'}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge tone="emerald">Hadir {e.hadir}</Badge>
              <Badge tone="rose">Tidak Hadir {e.tidak_hadir ?? e.no_info_days}</Badge>
              <Badge tone="sky">Libur {e.off}</Badge>
              <Badge tone={e.late.count ? 'amber' : 'slate'}>Telat {e.late.count}</Badge>
            </div>
          </button>
        ))}
        {!loading && !!filtered.length && (
          <p className="text-[10px] font-semibold text-slate-400 text-center pt-1 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> Telat: Frontliner ikut shift (Pagi/Siang), lainnya setelah 08:00.
          </p>
        )}
      </div>

      {selected && <EmployeeDetail employee={selected} period={period} onClose={() => setSelected(null)} />}
    </LeaderShell>
  );
}