import React, { useState } from 'react';
import { Camera, CheckCircle2, AlertCircle, Loader2, Eye } from 'lucide-react';
import { formatWibDateTime } from '../../../utils/wib.js';

const STATUS_CLS = {
  lengkap: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  kurang: 'bg-amber-50 text-amber-800 border-amber-200',
  kosong: 'bg-rose-50 text-rose-700 border-rose-200',
  tidak_wajib: 'bg-slate-50 text-slate-500 border-slate-200'
};

const STATUS_LABEL = {
  lengkap: 'Lengkap',
  kurang: 'Kurang',
  kosong: 'Kosong',
  tidak_wajib: 'Tidak Wajib'
};

export default function GroomingSection({
  grooming,
  hasCheckIn,
  canUseCamera,
  openingCamera,
  onCaptureStep,
  onSubmitReason,
  onPreview
}) {
  const savedReason = String(grooming?.incompleteReason || '').trim();
  const [reason, setReason] = useState(savedReason);
  const [editingReason, setEditingReason] = useState(false);
  const [savingReason, setSavingReason] = useState(false);
  const [reasonErr, setReasonErr] = useState(null);

  if (!grooming?.required) return null;

  const w = grooming.windows || {};
  const windowLabel = [w.window1, w.window2].filter(Boolean).join(' & ') || '—';
  const lockLabel = w.lockAfter || '—';
  // Tersimpan & tidak sedang diedit → tampilkan ringkasan, bukan form kosong.
  const showReasonForm = !savedReason || editingReason;

  const handleReason = async () => {
    setSavingReason(true);
    setReasonErr(null);
    try {
      await onSubmitReason(reason);
      setEditingReason(false);
    } catch (e) {
      setReasonErr(e?.response?.data?.message || e.message || 'Gagal simpan alasan');
    } finally {
      setSavingReason(false);
    }
  };

  return (
    <div className="mt-4 bg-white rounded-[22px] border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-[13px] font-black text-slate-800">Grooming Harian</h4>
          <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
            {windowLabel} WIB · {grooming.doneCount}/{grooming.totalSteps} selesai
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLS[grooming.status] || STATUS_CLS.kosong}`}>
          {STATUS_LABEL[grooming.status] || grooming.status}
        </span>
      </div>

      {!hasCheckIn && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
          <span className="text-[11px] text-amber-800 font-medium">Absen masuk dulu sebelum foto grooming.</span>
        </div>
      )}

      {grooming.pastLock && grooming.status !== 'lengkap' && (
        <div className="mb-3 bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
          <span className="text-[11px] text-rose-800 font-medium">
            Grooming terkunci setelah {lockLabel}.
            {String(grooming.incompleteReason || '').trim()
              ? ' Alasan sudah terisi.'
              : ' Wajib isi alasan — tanpa alasan tidak bisa absen pulang.'}
          </span>
        </div>
      )}

      {!grooming.windowOpen && !grooming.pastLock && (
        <div className="mb-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
          <span className="text-[11px] text-slate-600 font-medium">
            Jendela upload grooming sedang tutup. Buka lagi {windowLabel}.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(grooming.steps || []).map((step) => (
          <div
            key={step.code}
            className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
          >
            <div className={`w-7 h-7 rounded-lg grid place-items-center text-[11px] font-black shrink-0 ${
              step.photo ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-400'
            }`}>
              {step.order}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[12px] font-bold text-slate-800 truncate">{step.label}</p>
              {step.photo?.taken_at && (
                <p className="text-[9.5px] text-slate-400 font-medium">
                  {formatWibDateTime(step.photo.taken_at)}
                </p>
              )}
            </div>
            {step.photo ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onPreview?.({ url: step.photo.url, title: step.label })}
                  className="h-8 px-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Lihat
                </button>
                {grooming.canUpload && (
                  <button
                    type="button"
                    disabled={!canUseCamera || openingCamera || !hasCheckIn}
                    onClick={() => onCaptureStep(step.code, step.label, { retake: true, photoId: step.photo?.id })}
                    className="h-8 px-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-bold disabled:opacity-40 flex items-center gap-1"
                  >
                    Ulang
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={!canUseCamera || openingCamera || !hasCheckIn || !grooming.canUpload}
                onClick={() => onCaptureStep(step.code, step.label)}
                className="h-8 px-2.5 rounded-lg bg-[#5f1340] text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-40"
              >
                {openingCamera ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                Foto
              </button>
            )}
          </div>
        ))}
      </div>

      {grooming.pastLock && grooming.status !== 'lengkap' && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
            Alasan belum lengkap
          </label>

          {showReasonForm ? (
            <>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={1000}
                autoFocus={editingReason}
                placeholder={`Wajib diisi setelah ${lockLabel} jika grooming belum lengkap…`}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-[#5f1340]/40 resize-none"
              />
              {reasonErr && (
                <p className="mt-1.5 text-[11px] font-semibold text-rose-700">{reasonErr}</p>
              )}
              <div className={`mt-2 grid gap-2 ${savedReason ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {savedReason && (
                  <button
                    type="button"
                    disabled={savingReason}
                    onClick={() => {
                      setReason(savedReason);
                      setReasonErr(null);
                      setEditingReason(false);
                    }}
                    className="h-9 rounded-xl border border-slate-200 bg-white text-slate-700 text-[12px] font-extrabold disabled:opacity-40"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="button"
                  disabled={savingReason || !reason.trim()}
                  onClick={handleReason}
                  className="h-9 rounded-xl bg-amber-600 text-white text-[12px] font-extrabold disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {savingReason ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Simpan Alasan
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                    Alasan tersimpan
                  </p>
                  <p className="mt-0.5 text-[12px] font-semibold text-emerald-900 leading-snug break-words whitespace-pre-wrap">
                    {savedReason}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReason(savedReason);
                  setReasonErr(null);
                  setEditingReason(true);
                }}
                className="mt-2 w-full h-8 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-[11.5px] font-extrabold"
              >
                Ubah Alasan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
