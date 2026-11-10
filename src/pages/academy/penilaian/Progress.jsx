import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

// Naik, Turun, dan Tetap memakai ikon dan teks, bukan hanya warna.
const PROGRESS = {
  NAIK: { label: 'Naik', Icon: TrendingUp, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  TURUN: { label: 'Turun', Icon: TrendingDown, cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  TETAP: { label: 'Tetap', Icon: Minus, cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

/** progress: NAIK, TURUN, TETAP, atau null kalau hari terakhir belum dinilai. */
export function ProgressBadge({ progress }) {
  const meta = PROGRESS[progress];
  if (!meta) return <span className="text-[11px] font-bold text-slate-400">Belum ada</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${meta.cls}`}>
      <meta.Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Kemajuan tiap sub-skill per kriteria: nilai hari pertama, nilai hari terakhir, dan labelnya. */
export function SubskillProgress({ criteria }) {
  return criteria.map((c) => (
    <div key={c.id} className="pt-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-[#5f1340]">{c.name}</p>
      {c.subskills.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 pt-1.5 text-[12px] text-slate-600">
          <span className="min-w-0">{s.name}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="font-black text-slate-800">
              {s.first_score ?? '-'} → {s.last_score ?? '-'}
            </span>
            <ProgressBadge progress={s.progress} />
          </span>
        </div>
      ))}
    </div>
  ));
}
