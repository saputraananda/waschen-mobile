import React from 'react';
import { cutoffFor, fmtShort } from '../utils/leaderUtils.js';

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Filter periode seperti halaman Lembur/Kasbon: bulan + tahun (cutoff 26–25). Pilihan hanya periode yang ada datanya di database. */
export default function PeriodPicker({ month, year, onChange, availablePeriods, startDate, endDate, noMargin = false }) {
  const now = cutoffFor();
  // Periode berjalan selalu bisa dipilih walau belum ada absensi.
  const list = [...(availablePeriods || []), { year: now.year, month: now.month }];
  const years = [...new Set(list.map((p) => p.year))].sort((a, b) => a - b);
  const monthsOf = (y) => [...new Set(list.filter((p) => p.year === y).map((p) => p.month))].sort((a, b) => a - b);
  const months = monthsOf(year);
  const selCls = 'text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none';

  const changeYear = (y) => {
    const ms = monthsOf(y);
    onChange(ms.includes(month) ? month : ms[ms.length - 1], y);
  };
  return (
    <div className={noMargin ? '' : 'mt-2.5'}>
      <div className="flex items-center gap-2">
        <select value={month} onChange={(e) => onChange(Number(e.target.value), year)} className={`flex-1 ${selCls}`}>
          {months.map((m) => <option key={m} value={m}>{MONTHS_ID[m - 1]}</option>)}
        </select>
        <select value={year} onChange={(e) => changeYear(Number(e.target.value))} className={`w-[92px] ${selCls}`}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <p className="text-[10.5px] font-semibold text-slate-400 mt-1.5 px-0.5">Periode {fmtShort(startDate)} – {fmtShort(endDate)}</p>
    </div>
  );
}
