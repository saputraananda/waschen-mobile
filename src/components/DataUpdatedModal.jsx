import React, { useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';

/**
 * Toast kecil di area header — hilang sendiri (timer utama di useSoftRefresh).
 */
export default function DataUpdatedModal({ isOpen, onClose, duration = 1800 }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    // Fallback timer — tidak bergantung ke identity onClose (hindari reset tiap render)
    const t = setTimeout(() => onCloseRef.current?.(), duration);
    return () => clearTimeout(t);
  }, [isOpen, duration]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-[max(10px,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[160] w-full max-w-[430px] px-4 pointer-events-none">
      <div className="ml-auto w-fit max-w-[min(260px,calc(100%-1rem))] pointer-events-auto rounded-2xl bg-white/95 backdrop-blur-md border border-emerald-100 shadow-[0_8px_24px_rgba(15,23,42,0.14)] px-3 py-2 flex items-center gap-2 animate-slide-up">
        <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center flex-shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11.5px] font-extrabold text-slate-800 leading-tight pr-0.5">
          Data Berhasil Diperbarui
        </span>
      </div>
    </div>
  );
}
