import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Loader2, AlertCircle, Camera, Images, Trash2, Plus,
  MessageCircle, ShieldCheck, AlertTriangle
} from 'lucide-react';
import CameraCaptureModal from '../../../components/CameraCaptureModal';
import {
  api, isKiloanItem, buildWaLink, prevBagStagesFor, STAGE_LABEL, bagGap
} from '../../../utils/produksiShared.js';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';
import StageBagHistory from './StageBagHistory.jsx';
import { buildProduksiPhotoLines, burnPhotoOverlay, getCurrentUserName } from '../../../utils/photoStamp.js';

const MAX_PHOTOS = 5;

/** Tahap yang bisa dituju saat QC temuan → kembalikan */
const RETURN_STAGE_OPTIONS = {
  washing: ['frontliner'],
  ironing: ['washing', 'frontliner'],
  packing: ['ironing', 'washing', 'frontliner'],
};

/**
 * Bottom-sheet QC per item: aman/temuan, rincian plastik (kiloan),
 * rincian packing (tahap packing), foto (kamera/galeri), keputusan lanjut/hold/kembali.
 */
export default function ItemQCSheet({ open, stage, item, txn, onClose, onDone }) {
  const fileInputRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [qcStatus, setQcStatus] = useState('aman');
  const [decision, setDecision] = useState('lanjut');
  const [returnedStage, setReturnedStage] = useState('frontliner');
  const [notes, setNotes] = useState('');
  const [waContacted, setWaContacted] = useState(false);
  const [requiresIroning, setRequiresIroning] = useState(true);
  const [bags, setBags] = useState([{ bag_no: 1, qty_pcs: '' }]);
  const [packings, setPackings] = useState([{ packing_no: 1, qty_pcs: '' }]);
  const [photos, setPhotos] = useState([]); // [{file, preview}]
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [bagHistory, setBagHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const buildPhotoOverlay = useCallback((date = new Date()) => buildProduksiPhotoLines({
    orderNo: txn?.order_no,
    stage,
    photographerName: getCurrentUserName(),
    date
  }), [txn?.order_no, stage]);

  const kiloan = isKiloanItem(item);
  const carriedFinding = Number(item?.has_finding) === 1;
  const needBags = kiloan && ['frontliner', 'washing'].includes(stage);
  const needPackings = kiloan && stage === 'packing';
  const showBagHistory = kiloan && prevBagStagesFor(stage).length > 0;
  const returnStageOptions = RETURN_STAGE_OPTIONS[stage] || ['frontliner'];

  useEffect(() => {
    if (!open) return;
    const opts = RETURN_STAGE_OPTIONS[stage] || ['frontliner'];
    setReturnedStage(opts[0]);
  }, [open, stage]);

  // Riwayat rincian plastik tahap sebelumnya
  useEffect(() => {
    if (!open || !item?.id || !showBagHistory) {
      setBagHistory([]);
      return undefined;
    }

    let cancelled = false;
    setHistoryLoading(true);
    api.get(`/progress/item/${item.id}/bag-history`)
      .then((res) => {
        if (cancelled) return;
        const all = res.data?.data || [];
        const allowed = prevBagStagesFor(stage);
        const filtered = all.filter((h) => allowed.includes(h.stage));
        setBagHistory(filtered);

        // Pre-fill jumlah baris plastik mengikuti tahap terakhir yang merinci
        const latest = filtered[filtered.length - 1];
        if (needBags && latest?.bags?.length) {
          setBags(latest.bags.map((b) => ({ bag_no: b.bag_no, qty_pcs: '' })));
        }
      })
      .catch(() => { if (!cancelled) setBagHistory([]); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });

    return () => { cancelled = true; };
  }, [open, item?.id, stage, showBagHistory, needBags]);

  useLockBodyScroll(open || !!photoPreview);

  if (!open || !item) return null;

  const referenceBags = bagHistory.length ? bagHistory[bagHistory.length - 1].bags : [];

  const pushPhoto = (file) => {
    setPhotos((prev) => [...prev, { file, preview: URL.createObjectURL(file) }]);
  };

  const addPhoto = async (file, { alreadyStamped = false } = {}) => {
    if (!file || photos.length >= MAX_PHOTOS || photoProcessing) return;
    setPhotoProcessing(true);
    setError(null);
    try {
      const finalFile = alreadyStamped
        ? file
        : await burnPhotoOverlay(file, buildPhotoOverlay());
      pushPhoto(finalFile);
    } catch {
      setError('Gagal memproses foto. Coba lagi.');
    } finally {
      setPhotoProcessing(false);
    }
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx]?.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handlePickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await addPhoto(file);
  };

  const resetAndClose = () => {
    if (submitting) return;
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setQcStatus('aman');
    setDecision('lanjut');
    setNotes('');
    setWaContacted(false);
    setRequiresIroning(true);
    setBags([{ bag_no: 1, qty_pcs: '' }]);
    setPackings([{ packing_no: 1, qty_pcs: '' }]);
    setBagHistory([]);
    setHistoryLoading(false);
    setPhotoPreview(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);

    if (qcStatus === 'temuan' && photos.length === 0) {
      setError('Temuan wajib menyertakan minimal 1 foto bukti.');
      return;
    }
    if (needBags) {
      const valid = bags.every((b) => Number(b.qty_pcs) > 0);
      if (!valid) {
        setError('Isi jumlah pakaian per plastik (semua plastik).');
        return;
      }
    }
    if (needPackings && qcStatus === 'aman') {
      const valid = packings.every((p) => Number(p.qty_pcs) > 0);
      if (!valid) {
        setError('Isi jumlah pcs per packing (semua packing).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('transaction_detail_id', String(item.id));
      fd.append('stage', stage);
      fd.append('qc_status', qcStatus);
      fd.append('qc_decision', qcStatus === 'aman' ? 'lanjut' : decision);
      if (qcStatus === 'temuan' && decision === 'kembali') {
        fd.append('returned_to_stage', returnedStage);
      }
      if (notes.trim()) fd.append('notes', notes.trim());
      fd.append('wa_contacted', stage === 'frontliner' && waContacted ? '1' : '0');
      if (stage === 'frontliner') fd.append('requires_ironing', requiresIroning ? '1' : '0');
      if (needBags) {
        fd.append('bags', JSON.stringify(bags.map((b, i) => ({ bag_no: i + 1, qty_pcs: Number(b.qty_pcs) }))));
      }
      if (needPackings && qcStatus === 'aman') {
        fd.append('packings', JSON.stringify(packings.map((p, i) => ({ packing_no: i + 1, qty_pcs: Number(p.qty_pcs) }))));
      }
      photos.forEach((p) => fd.append('photos', p.file, p.file.name));

      const res = await api.post('/progress/qc', fd);
      resetAndClose();
      onDone(res.data?.message || 'QC tersimpan');
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan QC');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-safe-overlay" onClick={resetAndClose}>
        <div
          className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[20px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div className="min-w-0">
              <div className="text-[14px] font-extrabold text-slate-900 truncate">QC — {item.service_name}</div>
              <div className="text-[10.5px] text-slate-400 font-semibold truncate">
                {txn?.order_no} · {Number(item.qty)} {item.unit}
              </div>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600 flex-shrink-0"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto hide-scrollbar flex flex-col gap-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-[14px] p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="text-[11.5px] text-rose-700 font-semibold">{error}</span>
              </div>
            )}

            {carriedFinding && (
              <div className="bg-red-50 border border-red-200 rounded-[14px] p-3">
                <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5" /> Label Merah — Temuan dari tahap sebelumnya
                </div>
                {item.finding_note && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{item.finding_note}</p>
                )}
                <p className="text-[10.5px] text-red-500 mt-1 font-medium">
                  Lanjutkan dengan hati-hati — perhatikan pemilihan chemical/treatment sesuai noda.
                </p>
              </div>
            )}

            {/* Riwayat rincian plastik tahap sebelumnya */}
            {showBagHistory && (
              <StageBagHistory loading={historyLoading} history={bagHistory} />
            )}

            {/* Rincian plastik (kiloan, frontliner & washing) */}
            {needBags && (
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                  Rincian Plastik — {STAGE_LABEL[stage] || stage}
                  {bagHistory.length > 0 && (
                    <span className="normal-case font-normal text-slate-300"> (isi ulang & bandingkan)</span>
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
                          placeholder="Jumlah pakaian"
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
            )}

            {/* Toggle perlu setrika (frontliner) */}
            {stage === 'frontliner' && (
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Perlu Setrika?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequiresIroning(true)}
                    className={`py-2.5 rounded-xl border text-[12px] font-extrabold ${requiresIroning ? 'bg-[#5f1340] text-white border-[#5f1340]' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                  >
                    Ya, Perlu
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequiresIroning(false)}
                    className={`py-2.5 rounded-xl border text-[12px] font-extrabold ${!requiresIroning ? 'bg-[#5f1340] text-white border-[#5f1340]' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                  >
                    Tidak (Skip Setrika)
                  </button>
                </div>
              </div>
            )}

            {/* Hasil QC */}
            <div>
              <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Hasil QC</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setQcStatus('aman'); setDecision('lanjut'); }}
                  className={`py-3 rounded-2xl border flex flex-col items-center gap-1 ${qcStatus === 'aman' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[11.5px] font-black">Aman</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setQcStatus('temuan'); setDecision(stage === 'frontliner' ? 'lanjut' : 'kembali'); }}
                  className={`py-3 rounded-2xl border flex flex-col items-center gap-1 ${qcStatus === 'temuan' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-[11.5px] font-black">Temuan</span>
                </button>
              </div>
            </div>

            {/* Catatan */}
            <div>
              <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                Catatan {qcStatus === 'aman' && <span className="normal-case font-normal text-slate-300">(opsional)</span>}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={qcStatus === 'temuan' ? 'Jelaskan temuan (noda, kerusakan, dll)…' : 'Catatan tambahan jika ada…'}
                className="w-full text-[12.5px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none resize-none"
              />
            </div>

            {/* Foto */}
            <div>
              <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                Foto {qcStatus === 'temuan' ? 'Bukti Temuan (wajib, maks 5)' : 'Hasil (opsional)'}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePickFile}
                className="hidden"
              />
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {photos.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoPreview({ url: p.preview, index: i + 1 })}
                      className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square"
                      aria-label={`Preview foto ${i + 1}`}
                    >
                      <img src={p.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removePhoto(i); } }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center"
                        aria-label={`Hapus foto ${i + 1}`}
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {photos.length < MAX_PHOTOS && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    disabled={photoProcessing}
                    className="py-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center gap-1.5 text-slate-400 disabled:opacity-50"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[11px] font-bold">{photoProcessing ? 'Memproses…' : 'Ambil Foto'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoProcessing}
                    className="py-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center gap-1.5 text-slate-400 disabled:opacity-50"
                  >
                    <Images className="w-5 h-5" />
                    <span className="text-[11px] font-bold">{photoProcessing ? 'Memproses…' : 'Dari Galeri'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Temuan: WA + keputusan */}
            {qcStatus === 'temuan' && (
              <>
                {stage === 'frontliner' && txn?.customer_phone && (
                  <a
                    href={buildWaLink(txn.customer_phone, kiloan)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setWaContacted(true)}
                    className="w-full py-3 rounded-[14px] bg-emerald-500 text-white text-[12.5px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Hubungi Customer via WA
                  </a>
                )}

                <div>
                  <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tindak Lanjut</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision(stage === 'frontliner' ? 'hold' : 'kembali')}
                      className={`py-2.5 rounded-xl border text-[12px] font-extrabold ${decision !== 'lanjut' ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                    >
                      {stage === 'frontliner' ? 'Hold (Tunggu Customer)' : 'Hold / Kembalikan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('lanjut')}
                      className={`py-2.5 rounded-xl border text-[12px] font-extrabold ${decision === 'lanjut' ? 'bg-[#5f1340] text-white border-[#5f1340]' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                    >
                      Lanjutkan + Catatan
                    </button>
                  </div>
                  {decision === 'kembali' && stage !== 'frontliner' && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                        Kembalikan ke
                      </span>
                      {returnStageOptions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setReturnedStage(s)}
                          className={`w-full py-2.5 rounded-xl border text-[12px] font-extrabold text-left px-3 transition ${
                            returnedStage === s
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {STAGE_LABEL[s] || s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Rincian packing (kiloan, tahap packing, aman) */}
            {needPackings && qcStatus === 'aman' && (
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                  Rincian Packing (Kiloan)
                </label>
                <div className="flex flex-col gap-2">
                  {packings.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500 w-[75px] flex-shrink-0">Packing {i + 1}</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="Jumlah pcs"
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
            )}

            {/* Submit */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={resetAndClose}
                disabled={submitting}
                className="h-[44px] rounded-[12px] border border-slate-200 bg-white text-slate-700 text-[12.5px] font-extrabold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="h-[44px] rounded-[12px] bg-[#5f1340] text-white text-[12.5px] font-extrabold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan QC'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <CameraCaptureModal
        open={cameraOpen}
        title="Ambil Foto QC"
        buildOverlayLines={buildPhotoOverlay}
        onCapture={(file) => { addPhoto(file, { alreadyStamped: true }); setCameraOpen(false); }}
        onClose={() => setCameraOpen(false)}
      />

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
              <div className="text-[13px] font-extrabold text-slate-900">
                Preview Foto {photoPreview.index}
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600"
                aria-label="Tutup preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto hide-scrollbar">
              <img
                src={photoPreview.url}
                alt={`Preview foto ${photoPreview.index}`}
                className="w-full h-auto max-h-[72dvh] object-contain rounded-[12px] bg-slate-100"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
