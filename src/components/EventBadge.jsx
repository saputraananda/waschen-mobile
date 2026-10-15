import React from 'react';

/** Penanda kecil untuk nota event (tr_transaction.is_event = 1). Tidak tampil untuk nota biasa. */
export default function EventBadge({ txn, className = '' }) {
  if (Number(txn?.is_event) !== 1) return null;
  return (
    <span
      className={`inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 flex-shrink-0 uppercase tracking-wide ${className}`}
    >
      {txn.event_name || 'Event'}
    </span>
  );
}
