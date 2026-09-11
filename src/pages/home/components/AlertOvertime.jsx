import React from 'react';
import { AlertTriangle, Timer, X } from 'lucide-react';

/**
 * Banner + modal sesi lembur.
 * - Same-day active → sky/amber info
 * - past_midnight (lupa close) → merah + wajib close sebelum menu lain
 */
export default function AlertOvertime({
  active,
  locked = false,
  onGoOvertime,
  forceModal = false,
  onDismissModal
}) {
  if (!active) return null;

  const startLabel = active.start_at
    ? new Date(String(active.start_at).replace(' ', 'T')).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
    : '—';

  const bannerCls = locked
    ? 'border-rose-300 bg-rose-50 text-rose-900'
    : 'border-sky-200 bg-sky-50 text-sky-900';
  const iconWrap = locked
    ? 'bg-rose-600 text-white'
    : 'bg-sky-600 text-white';

  return (
    <>
      <div className={`mx-4 mt-4 rounded-[18px] border px-3.5 py-3 shadow-sm ${bannerCls}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconWrap}`}>
            {locked ? <AlertTriangle className="w-4.5 h-4.5" /> : <Timer className="w-4.5 h-4.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black leading-snug">
              {locked ? 'Lembur belum di-close (ganti hari)' : 'Sesi lembur sedang berlangsung'}
            </p>
            <p className="text-[10.5px] font-medium opacity-80 mt-0.5 leading-relaxed">
              Mulai {startLabel}
              {locked
                ? '. Close lembur dulu sebelum absen/menu lain.'
                : '. Kerjaan Anda tercatat sebagai lembur sampai close.'}
            </p>
            <button
              type="button"
              onClick={onGoOvertime}
              className={`mt-2 inline-flex items-center px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold text-white ${
                locked ? 'bg-rose-600' : 'bg-sky-700'
              }`}
            >
              {locked ? 'Close Lembur Sekarang' : 'Buka Menu Lembur'}
            </button>
          </div>
        </div>
      </div>

      {forceModal && locked && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 backdrop-blur-sm px-5">
          <div className="w-full max-w-[360px] bg-white rounded-[22px] border border-rose-200 shadow-2xl overflow-hidden">
            <div className="bg-rose-600 px-4 py-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5" />
                <span className="text-[13px] font-black">Peringatan Lembur</span>
              </div>
              {typeof onDismissModal === 'function' && (
                <button type="button" onClick={onDismissModal} className="p-1 rounded-lg hover:bg-white/15" aria-label="Tutup">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[12.5px] text-slate-700 font-semibold leading-relaxed">
                Anda masih memiliki sesi lembur dari <strong>{startLabel}</strong> yang belum di-close
                setelah ganti hari. Tutup sesi lembur terlebih dahulu sebelum absen atau membuka menu lain.
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Menu yang masih bisa dibuka: Lembur, Riwayat, dan Profil.
              </p>
              <button
                type="button"
                onClick={onGoOvertime}
                className="w-full py-3 rounded-[16px] bg-rose-600 text-white text-[13px] font-black"
              >
                Ke Menu Lembur &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
