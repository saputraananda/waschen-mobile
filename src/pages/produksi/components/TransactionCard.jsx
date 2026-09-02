import React from 'react';
import { AlertTriangle, PauseCircle, ChevronRight, Scale, Shirt, PauseOctagon } from 'lucide-react';
import { formatDateTime, isKiloanItem } from '../../../utils/produksiShared.js';
import formatName from '../../../utils/FormatName.js';

const STAGE_STATUS = {
  frontliner: 'Antrean',
  washing: 'Pencucian',
  ironing: 'Penyetrikaan',
  packing: 'Pengemasan'
};

/**
 * Kartu nota di list progres — header info nota + nested section item yang bisa di-QC
 * di tahap aktif. Header putih, section item dalam box abu supaya kontras & tidak nyaru.
 */
export default function TransactionCard({ txn, activeStage, onOpen, onItemClick }) {
  const hasFinding = !!txn.has_finding;
  const hasHold = !!txn.has_hold;

  const stageItems = (txn.items || []).filter(
    (it) => it.item_work_status === STAGE_STATUS[activeStage]
  );

  return (
    <div
      className={`w-full bg-white rounded-[20px] border shadow-[0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden ${
        hasFinding ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(txn)}
        className="w-full text-left p-4 active:bg-slate-50 transition"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-black text-slate-800 truncate">{txn.order_no}</span>
              {hasFinding && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
              {hasHold && <PauseCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5 truncate">
              {formatName(txn.customer_name) || 'Customer'} · {formatDateTime(txn.order_date)}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {(txn.items || []).map((item) => (
            <span
              key={item.id}
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${
                Number(item.has_finding) === 1
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : Number(item.is_on_hold) === 1
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {isKiloanItem(item) ? <Scale className="w-3 h-3" /> : <Shirt className="w-3 h-3" />}
              {item.service_name} · {Number(item.qty)} {item.unit}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10.5px] text-slate-400 font-semibold">
            {txn.stage_pending_items} dari {txn.total_items} item belum QC
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#5f1340]"
                style={{ width: `${txn.qc_progress_pct}%` }}
              />
            </div>
            <span className="text-[10px] font-extrabold text-slate-500">{txn.qc_progress_pct}%</span>
          </div>
        </div>
      </button>

      {/* Section item QC — nested box abu supaya kontras dari header putih */}
      {stageItems.length > 0 && (
        <div className="mx-3 mb-3 bg-slate-50 rounded-[14px] border border-slate-200/80 p-2 flex flex-col gap-1.5">
          {stageItems.map((item) => {
            const isHold = Number(item.is_on_hold) === 1;
            const isFinding = Number(item.has_finding) === 1;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isHold}
                onClick={() => onItemClick({ txn, item })}
                className={`text-left pl-2.5 pr-3 py-2.5 rounded-[11px] border text-[11.5px] font-bold flex items-center gap-2.5 transition active:scale-[.98] ${
                  isHold
                    ? 'bg-amber-50 text-amber-700 border-amber-200 opacity-80'
                    : isFinding
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-white text-slate-700 border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-[9px] grid place-items-center flex-shrink-0 ${
                    isHold ? 'bg-amber-100 text-amber-600' : isFinding ? 'bg-red-100 text-red-600' : 'bg-[#5f1340]/10 text-[#5f1340]'
                  }`}
                >
                  {isHold ? <PauseOctagon className="w-3.5 h-3.5" /> : isKiloanItem(item) ? <Scale className="w-3.5 h-3.5" /> : <Shirt className="w-3.5 h-3.5" />}
                </span>
                <span className="flex-1 min-w-0 truncate">
                  {item.service_name} · {Number(item.qty)} {item.unit}
                </span>
                <span className={`text-[9.5px] font-black flex-shrink-0 px-2 py-1 rounded-full ${
                  isHold ? 'bg-amber-200/60 text-amber-800' : 'bg-[#5f1340] text-white'
                }`}>
                  {isHold ? 'HOLD' : 'QC →'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
