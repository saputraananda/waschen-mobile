import React, { useState } from 'react';
import { PauseCircle, Loader2, CheckCircle2, XCircle, X, MessageCircle } from 'lucide-react';
import {
  api, formatDateTime, STAGE_LABEL, buildHoldWaLink, isKiloanItem
} from '../../../utils/produksiShared.js';
import formatName from '../../../utils/FormatName.js';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';

/**
 * Daftar "Perlu Konfirmasi" per role/tahap aktif.
 * Frontliner: bisa hubungi customer via WA jika temuan dari tahap lain.
 */
export default function HoldList({ holds, loading, stage, onResolved }) {
  const [resolvingId, setResolvingId] = useState(null);
  const [noteMap, setNoteMap] = useState({});
  const [error, setError] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useLockBodyScroll(!!photoPreview);

  const isFrontliner = stage === 'frontliner';
  const stageLabel = STAGE_LABEL[stage] || stage;

  const resolve = async (detailId, decision) => {
    if (decision === 'batal') {
      const ok = window.confirm(
        'Yakin membatalkan item ini? Item tidak akan diproses lebih lanjut dan status menjadi Dibatalkan.'
      );
      if (!ok) return;
    }
    setResolvingId(detailId);
    setError(null);
    try {
      await api.post(`/progress/hold/${detailId}/resolve`, {
        decision,
        note: noteMap[detailId]?.trim() || null
      });
      onResolved();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyelesaikan konfirmasi');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
      </div>
    );
  }

  if (!holds.length) {
    return (
      <div className="bg-white rounded-[20px] border border-slate-100 p-8 text-center">
        <PauseCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
        <p className="text-[12px] font-bold text-slate-400">
          Tidak ada item yang perlu dikonfirmasi {stageLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-[14px] p-3 text-[11.5px] text-rose-700 font-semibold">
          {error}
        </div>
      )}
      {holds.map((h) => {
        const fromOtherStage = h.reported_stage && h.reported_stage !== 'frontliner';
        const kiloan = isKiloanItem(h);
        const showWa = isFrontliner && fromOtherStage && h.customer_phone;

        return (
          <div key={h.progress_id} className="bg-white rounded-[20px] border border-amber-200 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-black text-slate-800 truncate">{h.order_no}</div>
                <div className="text-[11px] text-slate-400 font-medium truncate">
                  {formatName(h.customer_name) || 'Customer'} · {h.service_name} · {Number(h.qty)} {h.unit}
                </div>
              </div>
              <span className="text-[9.5px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full flex-shrink-0 uppercase">
                dari {STAGE_LABEL[h.reported_stage] || h.reported_stage}
              </span>
            </div>

            {fromOtherStage && h.report_notes && (
              <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                <div className="text-[9.5px] font-extrabold text-amber-700 uppercase tracking-wider mb-1">
                  Catatan dari {STAGE_LABEL[h.reported_stage] || h.reported_stage}
                </div>
                <p className="text-[11.5px] text-slate-700 font-medium leading-relaxed">{h.report_notes}</p>
              </div>
            )}

            {!fromOtherStage && h.report_notes && (
              <p className="mt-2 text-[11.5px] text-slate-600 font-medium bg-slate-50 rounded-xl px-3 py-2">
                {h.report_notes}
              </p>
            )}

            <div className="mt-1.5 text-[10px] text-slate-400 font-semibold">
              Dilaporkan {formatName(h.reported_by) || '-'} · {formatDateTime(h.reported_at)}
            </div>

            {h.photos?.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar">
                {h.photos.map((p, pi) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPhotoPreview({
                      url: p.photo_url,
                      title: `Bukti Temuan — ${h.order_no} (${pi + 1}/${h.photos.length})`
                    })}
                    className="flex-shrink-0 rounded-xl overflow-hidden border border-slate-200"
                    aria-label={`Preview bukti temuan ${pi + 1}`}
                  >
                    <img src={p.photo_url} alt="Bukti temuan" className="w-16 h-16 object-cover" />
                  </button>
                ))}
              </div>
            )}

            {showWa && (
              <a
                href={buildHoldWaLink(h.customer_phone, {
                  customerName: h.customer_name,
                  orderNo: h.order_no,
                  reportedStage: h.reported_stage,
                  reportNotes: h.report_notes,
                  isKiloan: kiloan
                })}
                target="_blank"
                rel="noreferrer"
                className="mt-3 w-full py-3 rounded-[14px] bg-emerald-500 text-white text-[12.5px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
              >
                <MessageCircle className="w-4 h-4" />
                Hubungi Customer via WA
              </a>
            )}

            <input
              type="text"
              placeholder={isFrontliner ? 'Catatan konfirmasi frontliner (opsional)…' : 'Catatan konfirmasi (opsional)…'}
              value={noteMap[h.detail_id] || ''}
              onChange={(e) => setNoteMap((prev) => ({ ...prev, [h.detail_id]: e.target.value }))}
              className="mt-3 w-full text-[12px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none"
            />

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => resolve(h.detail_id, 'batal')}
                disabled={resolvingId === h.detail_id}
                className="h-[40px] rounded-[12px] border border-red-200 bg-red-50 text-red-600 text-[12px] font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Batalkan Item
              </button>
              <button
                type="button"
                onClick={() => resolve(h.detail_id, 'lanjut')}
                disabled={resolvingId === h.detail_id}
                className="h-[40px] rounded-[12px] bg-emerald-500 text-white text-[12px] font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {resolvingId === h.detail_id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4" /> Lanjutkan</>}
              </button>
            </div>
          </div>
        );
      })}

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
                alt={photoPreview.title || 'Preview bukti temuan'}
                className="w-full h-auto max-h-[72dvh] object-contain rounded-[12px] bg-slate-100"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
