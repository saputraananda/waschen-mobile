import React from 'react';
import { Loader2 } from 'lucide-react';
import { STAGE_LABEL, bagTotal, formatDateTime } from '../../../utils/produksiShared.js';
import formatName from '../../../utils/FormatName.js';

/**
 * Tampilan read-only riwayat rincian plastik dari tahap sebelumnya.
 * Dipakai di form QC agar tim bisa lihat angka tahap 1, 2, dst & gap-nya.
 */
export default function StageBagHistory({ loading, history = [] }) {
  if (loading) {
    return (
      <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 text-[#5f1340] animate-spin" />
        <span className="text-[11px] font-semibold text-slate-500">Memuat riwayat rincian…</span>
      </div>
    );
  }

  if (!history.length) return null;

  const maxBags = Math.max(...history.map((h) => h.bags?.length || 0), 0);

  return (
    <div>
      <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
        Riwayat Rincian Plastik
      </label>
      <div className="rounded-[14px] border border-slate-200 overflow-hidden">
        {/* Header kolom */}
        <div
          className="grid gap-px bg-slate-200 text-[9.5px] font-extrabold text-slate-500 uppercase"
          style={{ gridTemplateColumns: `minmax(88px,1.1fr) repeat(${maxBags}, minmax(44px,1fr)) minmax(52px,0.8fr)` }}
        >
          <div className="bg-slate-50 px-2.5 py-2">Tahap</div>
          {Array.from({ length: maxBags }, (_, i) => (
            <div key={i} className="bg-slate-50 px-1 py-2 text-center">P{i + 1}</div>
          ))}
          <div className="bg-slate-50 px-1 py-2 text-center">Total</div>
        </div>

        {history.map((row, ri) => (
          <div
            key={row.stage}
            className={`grid gap-px bg-slate-200 text-[11px] ${ri < history.length - 1 ? '' : ''}`}
            style={{ gridTemplateColumns: `minmax(88px,1.1fr) repeat(${maxBags}, minmax(44px,1fr)) minmax(52px,0.8fr)` }}
          >
            <div className="bg-white px-2.5 py-2.5 min-w-0">
              <div className="font-extrabold text-slate-800 leading-tight">
                {STAGE_LABEL[row.stage] || row.stage}
              </div>
              <div className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
                {formatName(row.employee_name) || '—'}
                {row.completed_at ? ` · ${formatDateTime(row.completed_at)}` : ''}
              </div>
            </div>
            {Array.from({ length: maxBags }, (_, i) => {
              const bag = row.bags?.find((b) => Number(b.bag_no) === i + 1);
              return (
                <div key={i} className="bg-white px-1 py-2.5 text-center font-black text-slate-700">
                  {bag ? Number(bag.qty_pcs) : '—'}
                </div>
              );
            })}
            <div className="bg-white px-1 py-2.5 text-center font-black text-[#5f1340]">
              {bagTotal(row.bags)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
