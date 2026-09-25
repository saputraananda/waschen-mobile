import React from 'react';
import { Camera, AlertCircle, Loader2, Eye, Sparkles, Trash2 } from 'lucide-react';
import { formatWibDateTime } from '../../../utils/wib.js';

const SESSIONS = ['Pagi', 'Pulang'];
// Label tombol saja; sesi yang tersimpan tetap ditentukan server (jam WIB).
const wibHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date()));

export default function CleanlinessTab({
  cleanliness,
  hasCheckIn,
  canUseCamera,
  openingCamera,
  isSubmitting,
  onCapture,
  onPreview,
  onDeletePhoto
}) {
  if (!cleanliness) {
    return (
      <div className="bg-white rounded-[24px] border border-slate-100 p-8 flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
        <span className="text-[12px] text-slate-400 font-bold">Memuat kebersihan…</span>
      </div>
    );
  }

  if (!cleanliness.required) {
    return (
      <div className="bg-white rounded-[24px] border border-slate-100 p-6 text-center">
        <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-[13px] font-bold text-slate-700">Foto kebersihan tidak wajib</p>
        <p className="text-[11px] text-slate-400 mt-1">Posisi Anda tidak termasuk area kebersihan harian.</p>
      </div>
    );
  }

  const currentSession = wibHour() >= 16 ? 'Pulang' : 'Pagi';

  return (
    <div className="bg-white rounded-[24px] border border-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-[14px] font-black text-slate-800">Foto Kebersihan</h4>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            Area: {cleanliness.areaLabel}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          cleanliness.unlocked
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          {cleanliness.unlocked ? 'Progress terbuka' : 'Belum ada foto'}
        </span>
      </div>

      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-3">
        Sistem perwakilan: cukup 1 foto dari siapa pun di posisi &amp; outlet yang sama agar Update Progress terbuka.
        Foto boleh lebih dari satu. Hapus hanya untuk foto yang Anda unggah.
      </p>

      {!hasCheckIn && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
          <span className="text-[11px] text-amber-800 font-medium">Absen masuk dulu sebelum upload kebersihan.</span>
        </div>
      )}

      <button
        type="button"
        disabled={!canUseCamera || openingCamera || isSubmitting || !hasCheckIn}
        onClick={onCapture}
        className="w-full h-11 rounded-xl bg-[#5f1340] text-white text-[13px] font-extrabold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98]"
      >
        {openingCamera || isSubmitting
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Camera className="w-4 h-4" />}
        Ambil Foto Kebersihan {currentSession}
      </button>

      {SESSIONS.map((session) => {
        const photos = (cleanliness.photos || []).filter((p) => (p.photo_session || 'Pagi') === session);
        return (
      <div key={session} className="mt-4">
        <div className={`mb-2 flex items-center justify-between rounded-xl px-3 py-2 ${session === 'Pulang' ? 'bg-indigo-50 text-indigo-800' : 'bg-amber-50 text-amber-800'}`}>
          <span className="text-[12px] font-extrabold">Foto Kebersihan {session}</span>
          <span className="text-[11px] font-bold">{photos.length} foto</span>
        </div>
        {photos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center">
            <p className="text-[12px] text-slate-400 font-medium">Belum ada foto kebersihan {session.toLowerCase()}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {photos.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50"
              >
                <div className="aspect-square bg-slate-200 relative">
                  <img src={p.url} alt="Kebersihan" className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={() => onPreview?.({
                        url: p.url,
                        title: `Kebersihan · ${p.uploaded_by_name || '—'}`
                      })}
                      className="w-7 h-7 rounded-lg bg-black/45 grid place-items-center text-white"
                      title="Lihat"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {p.is_mine && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => onDeletePhoto?.(p)}
                        className="w-7 h-7 rounded-lg bg-rose-600/90 grid place-items-center text-white disabled:opacity-40"
                        title="Hapus foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-[10.5px] font-bold text-slate-700 truncate">{p.uploaded_by_name || '—'}</p>
                  <p className="text-[9.5px] text-slate-400 font-medium">
                    {p.taken_at ? formatWibDateTime(p.taken_at) : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        );
      })}
    </div>
  );
}
