import React, { useMemo, useState } from 'react';
import { fmtShort, fmtDay, DAY_STATUS } from './leaderUtils.js';

// Warna avatar konsisten per nama.
const AVATAR_TONES = [
  'from-[#5f1340] to-[#8c2060]', 'from-sky-500 to-cyan-500', 'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500',
];

export const avatarTone = (name) =>
  AVATAR_TONES[[...String(name)].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];

export const initials = (name) => {
  const p = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase();
};

export function Avatar({ name, photoUrl = null, leader = false }) {
  return (
    <div className={`relative w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarTone(name)} text-white grid place-items-center text-[13px] font-black shrink-0 overflow-hidden`}>
      {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : initials(name)}
      {leader && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#5f1340] ring-2 ring-white grid place-items-center">
          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#fff"><path d="M12 2 3 6v6c0 5 4 9 9 10 5-1 9-5 9-10V6l-9-4Z" /></svg>
        </span>
      )}
    </div>
  );
}

const STRIP_CLS = { h: 'bg-emerald-400', o: 'bg-sky-300', l: 'bg-violet-400', x: 'bg-rose-400', B: 'bg-amber-400', '.': 'bg-slate-200/80' };
const STRIP_LABEL = { h: 'Hadir', o: 'Libur', l: 'Izin/sakit/cuti', x: 'Tanpa keterangan', B: 'Hadir, belum pulang', '.': 'Belum berjalan' };

/** Strip status harian (maks 31 hari terakhir periode) di kartu karyawan. */
export function DayStrip({ strip }) {
  if (!strip) return null;
  return (
    <div className="flex items-end gap-[2px] h-[14px] mt-2.5">
      {[...strip].map((c, i) => (
        <span key={i} title={STRIP_LABEL[c] || STRIP_LABEL['.']}
          className={`flex-1 rounded-[2px] ${STRIP_CLS[c] || STRIP_CLS['.']}`} style={{ height: c === '.' ? '45%' : '100%' }} />
      ))}
    </div>
  );
}

/** Cincin % tepat waktu: hadir tanpa telat dan lengkap absen pulang. */
export function PunctualityRing({ employee }) {
  const pct = employee.hadir
    ? Math.round(((employee.hadir - employee.late.count - employee.belum_out) / employee.hadir) * 100)
    : null;
  const val = Math.max(0, Math.min(100, pct ?? 0));
  const color = pct == null ? '#cbd5e1' : val >= 90 ? '#10b981' : val >= 70 ? '#f59e0b' : '#f43f5e';
  const C = 2 * Math.PI * 15.5;
  return (
    <div className="relative w-[42px] h-[42px] shrink-0 grid place-items-center">
      <svg viewBox="0 0 36 36" className="w-[42px] h-[42px] -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="4" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(val / 100) * C} ${C}`} />
      </svg>
      <span className="absolute text-[8.5px] font-black" style={{ color: pct == null ? '#94a3b8' : color }}>
        {pct == null ? '—' : `${val}%`}
      </span>
    </div>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`shrink-0 h-[30px] px-3 rounded-full border text-[11px] font-extrabold transition active:scale-95 ${
        active ? 'border-[#5f1340] bg-[#5f1340] text-white' : 'border-slate-200 bg-white text-slate-600'
      }`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-100 bg-white', rose: 'border-rose-100 bg-rose-50/60', amber: 'border-amber-100 bg-amber-50/60',
    emerald: 'border-emerald-100 bg-emerald-50/60', sky: 'border-sky-100 bg-sky-50/60', violet: 'border-violet-100 bg-violet-50/60',
  };
  return (
    <div className={`rounded-2xl border px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-[18px] font-black text-slate-800 leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[10px] font-semibold text-slate-500 leading-tight mt-0.5">{sub}</p>}
    </div>
  );
}

export function Badge({ tone, children }) {
  const t = {
    rose: 'bg-rose-100 text-rose-700', amber: 'bg-amber-100 text-amber-700', sky: 'bg-sky-100 text-sky-700',
    violet: 'bg-violet-100 text-violet-700', emerald: 'bg-emerald-100 text-emerald-700', slate: 'bg-slate-100 text-slate-600',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${t}`}>{children}</span>;
}

export function SkeletonRows() {
  return (
    <div className="space-y-2 animate-pulse" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-[20px] border border-slate-100 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-2.5 bg-slate-100 rounded w-1/3" />
            </div>
          </div>
          <div className="h-2 mt-3 rounded bg-slate-100 w-3/4" />
        </div>
      ))}
    </div>
  );
}

const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const WD = ['S', 'S', 'R', 'K', 'J', 'S', 'M'];

const CELL_CLS = {
  hadir: 'bg-emerald-100 text-emerald-800', off: 'bg-sky-100 text-sky-700',
  izin: 'bg-violet-100 text-violet-700', sakit: 'bg-amber-100 text-amber-700', cuti: 'bg-indigo-100 text-indigo-700',
  tanpa_keterangan: 'bg-rose-100 text-rose-700',
};
export const statusCellCls = (st) => CELL_CLS[st] || 'bg-slate-50 text-slate-400';

/** Kalender status bulanan; ketuk tanggal untuk melihat detailnya. */
export function MonthCalendar({ days, monthKey, selected, onSelect }) {
  const [y, m] = monthKey.split('-').map(Number);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const cells = [];
  const first = new Date(Date.UTC(y, m - 1, 1));
  for (let i = 0; i < first.getUTCDay(); i += 1) cells.push(null);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let dd = 1; dd <= dim; dd += 1) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    cells.push({ key, day: byDate.get(key) || null });
  }
  return (
    <div>
      <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">{MONTH_NAMES[m]} {y}</p>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WD.map((w, i) => <span key={i} className="text-[9.5px] font-black text-slate-300">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => !c ? <span key={`e${i}`} /> : (
          <button key={c.key} type="button" onClick={() => c.day && onSelect(c.key)} disabled={!c.day}
            title={c.day ? `${fmtDay(c.key)} · ${(DAY_STATUS[c.day.status] || DAY_STATUS.belum_berjalan).label}` : undefined}
            className={`aspect-square rounded-xl text-[11px] font-extrabold transition active:scale-90 ${statusCellCls(c.day?.status)} ${
              selected === c.key ? 'ring-2 ring-offset-1 ring-[#5f1340]' : ''
            } ${c.day ? '' : 'opacity-50'}`}>
            {dd(c.key)}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
        {[['hadir', 'Hadir'], ['off', 'Libur'], ['izin', 'Izin'], ['sakit', 'Sakit'], ['cuti', 'Cuti'], ['tanpa_keterangan', 'Tanpa ket.']].map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-400">
            <span className={`w-2.5 h-2.5 rounded ${statusCellCls(k)}`} /> {l}
          </span>
        ))}
      </div>
    </div>
  );
}

const dd = (key) => Number(key.slice(8, 10));

export function CutoffCalendar({ days, startDate, endDate, selected, onSelect }) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const dates = [];
  for (let cur = startDate; cur <= endDate; ) {
    dates.push(cur);
    const [y, m, d] = cur.split('-').map(Number);
    cur = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Periode cutoff</p>
        <span className="text-[10px] font-bold text-slate-400">{fmtShort(startDate)} – {fmtShort(endDate)}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((w, i) => <span key={i} className="text-[9.5px] font-black text-slate-300">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const day = byDate.get(date);
          return <button key={date} type="button" disabled={!day} onClick={() => day && onSelect(date)}
            title={day ? `${fmtDay(date)} · ${(DAY_STATUS[day.status] || DAY_STATUS.belum_berjalan).label}` : undefined}
            className={`aspect-square rounded-xl text-[10px] font-extrabold ${statusCellCls(day?.status)} ${selected === date ? 'ring-2 ring-offset-1 ring-[#5f1340]' : ''} ${day ? '' : 'opacity-50'}`}>
            {Number(date.slice(8, 10))}
          </button>;
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
        {[['hadir', 'Hadir'], ['off', 'Libur'], ['izin', 'Izin'], ['sakit', 'Sakit'], ['cuti', 'Cuti'], ['tanpa_keterangan', 'Tidak hadir']].map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-400"><span className={`w-2.5 h-2.5 rounded ${statusCellCls(k)}`} /> {l}</span>
        ))}
      </div>
    </div>
  );
}

export function useNow() {
  const [now, setNow] = useState(() => new Date());
  return now;
}
