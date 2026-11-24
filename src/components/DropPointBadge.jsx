import React from 'react';

/**
 * Penanda kecil untuk nota dari outlet drop point (mst_outlet.is_drop_point = 1, dikirim API
 * sebagai drop_point_name / is_drop_point). Tidak tampil untuk nota outlet biasa.
 */
export default function DropPointBadge({ txn, className = '' }) {
  if (!txn?.drop_point_name && Number(txn?.is_drop_point) !== 1) return null;
  return (
    <span
      className={`inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 flex-shrink-0 uppercase tracking-wide ${className}`}
    >
      {txn.drop_point_name || 'Drop Point'}
    </span>
  );
}
