import React, { useEffect } from 'react';

/**
 * Standar Komponen Popup Konfirmasi untuk Aplikasi Waschen / IKM Mobile
 * 
 * Props:
 * - isOpen (boolean): Menentukan apakah popup tampil
 * - onClose (function): Callback saat tombol Batal / overlay diklik
 * - onConfirm (function): Callback saat tombol Konfirmasi diklik
 * - title (string): Judul konfirmasi (contoh: "Hapus Laporan?")
 * - message (string | ReactNode): Deskripsi penjelasan konfirmasi
 * - confirmText (string): Label tombol konfirmasi (default: "Ya, Lanjutkan")
 * - cancelText (string): Label tombol batal (default: "Batal")
 * - variant ('danger' | 'warning' | 'info' | 'success'): Tipe/tema popup
 * - isLoading (boolean): Indikator proses async sedang berjalan
 * - closeOnOverlayClick (boolean): Izinkan tutup modal dengan klik backdrop
 * - icon (ReactNode): Custom icon jika ingin mengganti icon bawaan variant
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  variant = 'danger',
  isLoading = false,
  closeOnOverlayClick = true,
  icon,
}) {
  // Prevent background scroll saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Visual Theme configs berdasarkan variant
  const themes = {
    danger: {
      iconBg: 'bg-red-50 border-red-100 text-red-500',
      confirmBtn: 'bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 text-white shadow-red-200/50',
      defaultIcon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
      ),
    },
    warning: {
      iconBg: 'bg-amber-50 border-amber-100 text-amber-500',
      confirmBtn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-200/50',
      defaultIcon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    info: {
      iconBg: 'bg-blue-50 border-blue-100 text-blue-600',
      confirmBtn: 'bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-800 hover:to-indigo-700 text-white shadow-blue-200/50',
      defaultIcon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
    success: {
      iconBg: 'bg-emerald-50 border-emerald-100 text-emerald-600',
      confirmBtn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-200/50',
      defaultIcon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
  };

  const currentTheme = themes[variant] || themes.danger;

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-[3px] flex items-center justify-center p-4 animate-fade-in"
      onClick={() => closeOnOverlayClick && !isLoading && onClose()}
    >
      <div
        className="bg-white rounded-[24px] p-6 max-w-[340px] w-full shadow-2xl text-center animate-toast-pop relative overflow-hidden border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon Circle Header */}
        <div className={`w-14 h-14 rounded-full border-2 grid place-items-center mx-auto mb-4 ${currentTheme.iconBg}`}>
          {icon || currentTheme.defaultIcon}
        </div>

        {/* Header Title */}
        <h3 className="text-[16px] font-bold text-slate-900 mb-1.5 leading-snug">
          {title}
        </h3>

        {/* Message / Description */}
        <div className="text-[13px] text-slate-500 leading-relaxed mb-6 font-normal">
          {message}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-[12px] border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 text-[13px] font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-[12px] text-[13px] font-bold shadow-sm transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${currentTheme.confirmBtn}`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Memproses...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
