import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, AlertTriangle, PauseCircle, ShieldCheck, Scale, Shirt } from 'lucide-react';
import { api, formatDateTime, isKiloanItem } from '../../../utils/produksiShared.js';
import formatName from '../../../utils/FormatName.js';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';

const STAGE_LABEL = {
  frontliner: 'Frontliner',
  washing: 'Cuci',
  ironing: 'Setrika',
  packing: 'Packing',
  delivery: 'Antar'
};

/**
 * Modal detail nota: info customer + riwayat QC per item (progress, foto, bags, packing).
 */
export default function TransactionDetailModal({ open, transactionId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (!open) {
      setPhotoPreview(null);
      return;
    }
    if (!transactionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    api.get(`/progress/transaction/${transactionId}`)
      .then((res) => { if (!cancelled) setData(res.data?.data || null); })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.message || 'Gagal memuat detail nota'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, transactionId]);

  useLockBodyScroll(open || !!photoPreview);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-safe-overlay"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[20px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold text-slate-900 truncate">{data?.order_no || 'Detail Nota'}</div>
            {data && (
              <div className="text-[10.5px] text-slate-400 font-semibold truncate">
                {formatName(data.customer_name) || 'Customer'} · {formatDateTime(data.order_date)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600 flex-shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto hide-scrollbar flex flex-col gap-4">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-[14px] p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="text-[11.5px] text-rose-700 font-semibold">{error}</span>
            </div>
          )}

          {data && (data.items || []).map((item) => (
            <div key={item.id} className={`rounded-[16px] border p-3.5 ${
              Number(item.has_finding) === 1 ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-white'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isKiloanItem(item) ? <Scale className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <Shirt className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                  <span className="text-[12.5px] font-black text-slate-800 truncate">
                    {item.service_name} · {Number(item.qty)} {item.unit}
                  </span>
                </div>
                <span className="text-[9.5px] font-black uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
                  {item.item_work_status}
                </span>
              </div>

              {Number(item.is_on_hold) === 1 && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
                  <PauseCircle className="w-3.5 h-3.5" /> Hold di tahap {STAGE_LABEL[item.hold_stage] || item.hold_stage}
                </div>
              )}
              {Number(item.has_finding) === 1 && item.finding_note && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {item.finding_note}
                </div>
              )}

              {/* Riwayat progress */}
              {(item.progress || []).length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {item.progress.map((p) => (
                    <div key={p.id} className="border-l-2 border-slate-200 pl-2.5">
                      <div className="flex items-center gap-1.5">
                        {p.qc_status === 'aman'
                          ? <ShieldCheck className="w-3 h-3 text-emerald-500" />
                          : <AlertTriangle className="w-3 h-3 text-red-500" />}
                        <span className="text-[11px] font-extrabold text-slate-700">
                          {STAGE_LABEL[p.stage] || p.stage}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          · {formatName(p.employee_name) || '—'} · {formatDateTime(p.completed_at)}
                        </span>
                      </div>
                      {p.notes && (
                        <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">{p.notes}</p>
                      )}
                      {p.photos?.length > 0 && (
                        <div className="mt-1.5 flex gap-1.5 overflow-x-auto hide-scrollbar">
                          {p.photos.map((ph, pi) => (
                            <button
                              key={ph.id}
                              type="button"
                              onClick={() => setPhotoPreview({
                                url: ph.photo_url,
                                title: `Foto QC — ${STAGE_LABEL[p.stage] || p.stage} (${pi + 1}/${p.photos.length})`
                              })}
                              className="flex-shrink-0 rounded-lg overflow-hidden border border-slate-200"
                              aria-label={`Preview foto QC ${pi + 1}`}
                            >
                              <img src={ph.photo_url} alt="Foto QC" className="w-14 h-14 object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Rincian plastik */}
              {item.bags?.length > 0 && (
                <div className="mt-3">
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Rincian Plastik</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.bags.map((b) => (
                      <span key={b.id} className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                        Plastik {b.bag_no}: {b.qty_pcs} pcs
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rincian packing */}
              {item.packings?.length > 0 && (
                <div className="mt-3">
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Rincian Packing</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.packings.map((pk) => (
                      <span key={pk.id} className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                        pk.is_picked ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-50 border-slate-200'
                      }`}>
                        {pk.label}{pk.is_picked ? ' ✓ Diambil' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {photoPreview && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-3 py-safe-fullscreen"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[18px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="text-[13px] font-extrabold text-slate-900 truncate pr-3">
                {photoPreview.title || 'Preview Foto'}
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600 flex-shrink-0"
                aria-label="Tutup preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto hide-scrollbar">
              <img
                src={photoPreview.url}
                alt={photoPreview.title || 'Preview foto QC'}
                className="w-full h-auto max-h-[72dvh] object-contain rounded-[12px] bg-slate-100"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
