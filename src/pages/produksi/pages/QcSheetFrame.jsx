import React from 'react';
import {
  X, Loader2, Camera, Images, Trash2, Plus,
  ShieldCheck, AlertTriangle, ChevronDown
} from 'lucide-react';
import CameraCaptureModal from '../../../components/CameraCaptureModal';
import { AlertModal } from '../../../components/ConfirmModal.jsx';
import { STAGE_LABEL, bagTotal, formatDateTime } from '../../../utils/produksiShared.js';
import formatName from '../../../utils/FormatName.js';

export function QcModal({ qc, title, subtitle, children }) {
  if (!qc.open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={qc.resetAndClose}>
        <div
          className="w-full max-w-[430px] max-h-[min(88dvh,760px)] bg-white rounded-[20px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div className="min-w-0">
              <div className="text-[14px] font-extrabold text-slate-900 truncate">{title}</div>
              <div className="text-[10.5px] text-slate-400 font-semibold truncate">{subtitle}</div>
            </div>
            <button
              type="button"
              onClick={qc.resetAndClose}
              className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600 flex-shrink-0"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 overflow-y-auto hide-scrollbar flex flex-col gap-4">
            {children}
          </div>
        </div>
      </div>
      <AlertModal message={qc.error} onClose={() => qc.setError(null)} />
      <CameraCaptureModal
        open={qc.cameraOpen}
        title={qc.isHandover ? 'Ambil Foto Serah Terima' : 'Ambil Foto QC'}
        buildOverlayLines={qc.buildPhotoOverlay}
        jpegQuality={qc.photoQuality.quality}
        maxEdge={qc.photoQuality.maxEdge}
        onCapture={(file) => { qc.addPhoto(file, { alreadyStamped: true }); qc.setCameraOpen(false); }}
        onClose={() => qc.setCameraOpen(false)}
      />
      {qc.photoPreview && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-3 py-safe-fullscreen"
          onClick={() => qc.setPhotoPreview(null)}
        >
          <div
            className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[18px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="text-[13px] font-extrabold text-slate-900">Preview Foto {qc.photoPreview.index}</div>
              <button
                type="button"
                onClick={() => qc.setPhotoPreview(null)}
                className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600"
                aria-label="Tutup preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto hide-scrollbar">
              <img
                src={qc.photoPreview.url}
                alt={`Preview foto ${qc.photoPreview.index}`}
                className="w-full h-auto max-h-[72dvh] object-contain rounded-[12px] bg-slate-100"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function CarriedFinding({ qc }) {
  if (!qc.carriedFinding) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-[14px] p-3">
      <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-red-700">
        <AlertTriangle className="w-3.5 h-3.5" /> Label Merah — Temuan dari tahap sebelumnya
      </div>
      {qc.item.finding_note && (
        <p className="text-[11px] text-red-600 font-medium mt-1">{qc.item.finding_note}</p>
      )}
      <p className="text-[10.5px] text-red-500 mt-1 font-medium">
        Lanjutkan dengan hati-hati — perhatikan pemilihan chemical/treatment sesuai noda.
      </p>
    </div>
  );
}

function StageBagHistory({ loading, history = [] }) {
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
  const cols = `minmax(88px,1.1fr) repeat(${maxBags}, minmax(44px,1fr)) minmax(52px,0.8fr)`;

  return (
    <div>
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block mb-2">
        Riwayat Rincian Plastik
      </label>
      <div className="rounded-[14px] border border-slate-200 overflow-hidden">
        <div className="grid gap-px bg-slate-200 text-[9.5px] font-extrabold text-slate-500 uppercase" style={{ gridTemplateColumns: cols }}>
          <div className="bg-slate-50 px-2.5 py-2">Tahap</div>
          {Array.from({ length: maxBags }, (_, i) => (
            <div key={i} className="bg-slate-50 px-1 py-2 text-center">P{i + 1}</div>
          ))}
          <div className="bg-slate-50 px-1 py-2 text-center">Total</div>
        </div>
        {history.map((row) => (
          <div key={row.stage} className="grid gap-px bg-slate-200 text-[11px]" style={{ gridTemplateColumns: cols }}>
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

export function BagHistoryBlock({ qc }) {
  if (!qc.showBagHistory) return null;
  return <StageBagHistory loading={qc.historyLoading} history={qc.bagHistory} />;
}

export function SimpleBags({ qc }) {
  if (!qc.needBags || qc.needKgItems) return null;
  const { bags, setBags, referenceBags, bagGap, stage } = qc;
  return (
    <div>
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block mb-2">
        Rincian Plastik — {STAGE_LABEL[stage] || stage}
        {qc.bagHistory.length > 0 && (
          <span className="normal-case font-normal text-slate-500"> (isi ulang & bandingkan)</span>
        )}
      </label>
      <div className="flex flex-col gap-2">
        {bags.map((b, i) => {
          const refBag = referenceBags.find((x) => Number(x.bag_no) === i + 1);
          const gap = refBag ? bagGap(b.qty_pcs, refBag.qty_pcs) : null;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 w-[70px] flex-shrink-0">Plastik {i + 1}</span>
              <input
                type="number"
                min="1"
                placeholder="Contoh : 10"
                value={b.qty_pcs}
                onChange={(e) => setBags((prev) => prev.map((x, xi) => (xi === i ? { ...x, qty_pcs: e.target.value } : x)))}
                className="flex-1 text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
              />
              {refBag && (
                <span className={`text-[10px] font-extrabold w-[52px] text-right flex-shrink-0 ${
                  !gap ? 'text-slate-300' : gap.diff === 0 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {gap ? gap.label : '—'}
                </span>
              )}
              {bags.length > 1 && (
                <button
                  type="button"
                  onClick={() => setBags((prev) => prev.filter((_, xi) => xi !== i))}
                  className="w-8 h-8 rounded-[10px] border border-red-200 bg-red-50 text-red-500 grid place-items-center flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setBags((prev) => [...prev, { bag_no: prev.length + 1, qty_pcs: '' }])}
        className="mt-2 text-[11px] font-extrabold text-[#5f1340] flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" /> Tambah Plastik
      </button>
    </div>
  );
}

export function KgBags({ qc }) {
  if (!qc.needKgItems) return null;
  const { bags, setBags, referenceBags, bagGap, bagSum, kgMaster } = qc;
  return (
    <div>
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block mb-2">
        Rincian Plastik & Jenis Pakaian
      </label>
      <div className="flex flex-col gap-2">
        {bags.map((b, i) => {
          const refBag = referenceBags.find((x) => Number(x.bag_no) === i + 1);
          const sum = bagSum(b);
          const gap = refBag ? bagGap(sum, refBag.qty_pcs) : null;
          const patchBag = (fn) => setBags((prev) => prev.map((x, xi) => (xi === i ? fn(x) : x)));
          return (
            <details key={i} className="group rounded-[14px] border border-slate-200 bg-white overflow-hidden">
              <summary className="list-none cursor-pointer px-3 py-2.5 flex items-center justify-between gap-2 bg-[#5f1340]/5">
                <span className="text-[12px] font-extrabold text-[#5f1340]">Plastik {i + 1}</span>
                <span className="flex items-center gap-2 text-[11.5px] font-extrabold">
                  <span className="text-slate-800">{sum} pcs</span>
                  {refBag && (
                    <span className={!gap ? 'text-slate-400' : gap.diff === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                      / FL {Number(refBag.qty_pcs)}{gap && gap.diff !== 0 ? ` (${gap.label})` : ''}
                    </span>
                  )}
                  <ChevronDown className="w-4 h-4 text-[#5f1340] transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="border-t border-slate-100 p-2 flex flex-col gap-1.5">
                {kgMaster.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-slate-700 min-w-0 truncate">{m.name}</span>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`Plastik ${i + 1} ${m.name}`}
                      value={b.kg?.[m.id] ?? ''}
                      onChange={(e) => patchBag((x) => ({ ...x, kg: { ...x.kg, [m.id]: e.target.value } }))}
                      className="w-[64px] flex-shrink-0 text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 outline-none text-center"
                    />
                  </div>
                ))}
                {(b.others || []).map((o, oi) => {
                  const patchOther = (p) => patchBag((x) => ({ ...x, others: x.others.map((y, yi) => (yi === oi ? { ...y, ...p } : y)) }));
                  return (
                    <div key={`o${oi}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={100}
                        placeholder="Lainnya, contoh : Selimut"
                        value={o.name}
                        onChange={(e) => patchOther({ name: e.target.value })}
                        className="flex-1 min-w-0 text-[12px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        max="999"
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`Plastik ${i + 1} lainnya ${oi + 1}`}
                        value={o.qty}
                        onChange={(e) => patchOther({ qty: e.target.value })}
                        className="w-[64px] flex-shrink-0 text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 outline-none text-center"
                      />
                      <button
                        type="button"
                        onClick={() => patchBag((x) => ({ ...x, others: x.others.filter((_, yi) => yi !== oi) }))}
                        className="w-8 h-8 rounded-[10px] border border-red-200 bg-red-50 text-red-500 grid place-items-center flex-shrink-0"
                        aria-label={`Hapus lainnya ${oi + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => patchBag((x) => ({ ...x, others: [...(x.others || []), { name: '', qty: '' }] }))}
                    className="text-[11px] font-extrabold text-[#5f1340] flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Lainnya
                  </button>
                  {bags.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setBags((prev) => prev.filter((_, xi) => xi !== i))}
                      className="text-[11px] font-extrabold text-red-500 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Plastik
                    </button>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setBags((prev) => [...prev, { bag_no: prev.length + 1, qty_pcs: '', kg: {}, others: [] }])}
        className="mt-2 text-[11px] font-extrabold text-[#5f1340] flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" /> Tambah Plastik
      </button>
    </div>
  );
}

export function KgHistory({ qc }) {
  if (!qc.kiloan || qc.needKgItems || !qc.kgHistory.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block">
        Rincian Jenis Pakaian (Tim Cuci)
      </label>
      {[...new Set(qc.kgHistory.map((k) => Number(k.bag_no)))].map((no) => {
        const rows = qc.kgHistory.filter((k) => Number(k.bag_no) === no);
        return (
          <details key={no} className="group rounded-[14px] border border-[#5f1340]/20 bg-[#5f1340]/5 overflow-hidden">
            <summary className="list-none cursor-pointer px-3 py-2.5 flex items-center justify-between gap-2 text-[12px] font-extrabold text-[#5f1340]">
              <span>Plastik {no}</span>
              <span className="flex items-center gap-1.5">
                {rows.reduce((s, k) => s + Number(k.qty_pcs || 0), 0)} pcs
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="bg-white border-t border-[#5f1340]/10 divide-y divide-slate-100">
              {rows.map((k, i) => (
                <div key={i} className="px-3 py-2 flex justify-between text-[12px]">
                  <span className="font-semibold text-slate-700">{k.item_name}</span>
                  <span className="font-black text-slate-800">{Number(k.qty_pcs)} pcs</span>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function IroningAsk({ qc }) {
  if (!qc.askIroning) return null;
  return (
    <div>
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block mb-2">Perlu Setrika?</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => qc.setRequiresIroning(true)}
          className={`py-2.5 rounded-xl border text-[12px] font-extrabold ${qc.requiresIroning ? 'bg-[#5f1340] text-white border-[#5f1340]' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
        >
          Ya, Perlu
        </button>
        <button
          type="button"
          onClick={() => qc.setRequiresIroning(false)}
          className={`py-2.5 rounded-xl border text-[12px] font-extrabold ${!qc.requiresIroning ? 'bg-[#5f1340] text-white border-[#5f1340]' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
        >
          Tidak (Skip Setrika)
        </button>
      </div>
    </div>
  );
}

export function QcVerdict({ qc, temuanDecision }) {
  return (
    <div>
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block mb-2">
        {qc.isHandover ? 'Kondisi Serah Terima' : 'Hasil QC'}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { qc.setQcStatus('aman'); qc.setDecision('lanjut'); }}
          className={`py-3 rounded-2xl border flex flex-col items-center gap-1 ${qc.qcStatus === 'aman' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[11.5px] font-black">Aman</span>
        </button>
        <button
          type="button"
          onClick={() => { qc.setQcStatus('temuan'); qc.setDecision(temuanDecision); }}
          className={`py-3 rounded-2xl border flex flex-col items-center gap-1 ${qc.qcStatus === 'temuan' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="text-[11.5px] font-black">Temuan</span>
        </button>
      </div>
    </div>
  );
}

export function QcNotes({ qc }) {
  return (
    <div>
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block mb-2">
        Catatan{qc.qcStatus === 'temuan' ? ' (Wajib)' : ''}
      </label>
      <textarea
        value={qc.notes}
        onChange={(e) => qc.setNotes(e.target.value)}
        rows={2}
        placeholder={qc.notePlaceholder}
        className="w-full text-[12.5px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none resize-none"
      />
    </div>
  );
}

export function QcPhotos({ qc }) {
  return (
    <div>
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block mb-2">
        {qc.isHandover
          ? 'Foto Bukti Diantar (wajib, maks 5)'
          : qc.qcStatus === 'temuan'
            ? 'Foto Bukti Temuan (wajib, maks 5)'
            : 'Foto Hasil (wajib, maks 5)'}
      </label>
      <input
        ref={qc.fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={qc.handlePickFile}
        className="hidden"
      />
      {qc.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {qc.photos.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => qc.setPhotoPreview({ url: p.preview, index: i + 1 })}
              className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square"
              aria-label={`Preview foto ${i + 1}`}
            >
              <img src={p.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); qc.removePhoto(i); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); qc.removePhoto(i); } }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center"
                aria-label={`Hapus foto ${i + 1}`}
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      )}
      {qc.photos.length < qc.maxPhotos && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => qc.setCameraOpen(true)}
            disabled={qc.photoProcessing}
            className="py-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center gap-1.5 text-slate-400 disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            <span className="text-[11px] font-bold">{qc.photoProcessing ? 'Memproses…' : 'Ambil Foto'}</span>
          </button>
          <button
            type="button"
            onClick={() => qc.fileInputRef.current?.click()}
            disabled={qc.photoProcessing}
            className="py-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center gap-1.5 text-slate-400 disabled:opacity-50"
          >
            <Images className="w-5 h-5" />
            <span className="text-[11px] font-bold">{qc.photoProcessing ? 'Memproses…' : 'Dari Galeri'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function ReturnPicker({ qc }) {
  if (qc.decision !== 'kembali') return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Kembalikan ke</span>
      {qc.returnStageOptions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => qc.setReturnedStage(s)}
          className={`w-full py-2.5 rounded-xl border text-[12px] font-extrabold text-left px-3 transition ${
            qc.returnedStage === s
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          {STAGE_LABEL[s] || s}
        </button>
      ))}
    </div>
  );
}

export function DecisionPair({ qc, holdLabel, holdDecision }) {
  const active = qc.decision !== 'lanjut';
  return (
    <div>
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block mb-2">Tindak Lanjut</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => qc.setDecision(holdDecision)}
          className={`py-2.5 rounded-xl border text-[12px] font-extrabold ${active ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
        >
          {holdLabel}
        </button>
        <button
          type="button"
          onClick={() => qc.setDecision('lanjut')}
          className={`py-2.5 rounded-xl border text-[12px] font-extrabold ${qc.decision === 'lanjut' ? 'bg-[#5f1340] text-white border-[#5f1340]' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
        >
          Lanjutkan + Catatan
        </button>
      </div>
    </div>
  );
}

export function PackingLines({ qc }) {
  if (!qc.needPackings || qc.qcStatus !== 'aman') return null;
  const { packings, setPackings } = qc;
  return (
    <div>
      <label className="text-[10.5px] text-slate-700 font-extrabold uppercase tracking-wider block mb-2">
        Rincian Packing (Kiloan)
      </label>
      <div className="flex flex-col gap-2">
        {packings.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 w-[75px] flex-shrink-0">Packing {i + 1}</span>
            <input
              type="number"
              min="1"
              placeholder="Contoh : 5"
              value={p.qty_pcs}
              onChange={(e) => setPackings((prev) => prev.map((x, xi) => (xi === i ? { ...x, qty_pcs: e.target.value } : x)))}
              className="flex-1 text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
            />
            {packings.length > 1 && (
              <button
                type="button"
                onClick={() => setPackings((prev) => prev.filter((_, xi) => xi !== i))}
                className="w-8 h-8 rounded-[10px] border border-red-200 bg-red-50 text-red-500 grid place-items-center flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPackings((prev) => [...prev, { packing_no: prev.length + 1, qty_pcs: '' }])}
        className="mt-2 text-[11px] font-extrabold text-[#5f1340] flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" /> Tambah Packing
      </button>
    </div>
  );
}

export function QcActions({ qc }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-1">
      <button
        type="button"
        onClick={qc.resetAndClose}
        disabled={qc.submitting}
        className="h-[44px] rounded-[12px] border border-slate-200 bg-white text-slate-700 text-[12.5px] font-extrabold disabled:opacity-50"
      >
        Batal
      </button>
      <button
        type="button"
        onClick={qc.handleSubmit}
        disabled={qc.submitting}
        className="h-[44px] rounded-[12px] bg-[#5f1340] text-white text-[12.5px] font-extrabold disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {qc.submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (qc.isHandover ? 'Tandai Selesai' : 'Simpan QC')}
      </button>
    </div>
  );
}

export function sheetSubtitle(qc) {
  return `${qc.txn?.order_no} · ${Number(qc.item?.qty)} ${qc.item?.unit}${qc.isHandover ? ' · Sedang Diantar → Selesai' : ''}`;
}
