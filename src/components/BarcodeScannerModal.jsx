import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, ScanLine } from 'lucide-react';
import useLockBodyScroll from '../hooks/useLockBodyScroll.js';
import { extractNotaSearchKey } from '../utils/notaScan.js';

const SCANNER_ID = 'waschen-mobile-qr-scanner';

/**
 * Modal scan QR/barcode nota pakai kamera belakang.
 * Pakai html5-qrcode (kompatibel Safari/Firefox/Chrome Android & iOS).
 */
export default function BarcodeScannerModal({ open, onDetect, onClose }) {
  const scannerRef = useRef(null);
  const onDetectRef = useRef(onDetect);
  const handledRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [scannerError, setScannerError] = useState(null);

  onDetectRef.current = onDetect;

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      /* ignore cleanup errors */
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setScannerError(null);
      setStarting(false);
      handledRef.current = false;
      return undefined;
    }

    let cancelled = false;
    handledRef.current = false;
    setStarting(true);
    setScannerError(null);

    const startScanner = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (cancelled) return;

      // Pastikan elemen target kosong sebelum init ulang
      const el = document.getElementById(SCANNER_ID);
      if (el) el.innerHTML = '';

      const scanner = new Html5Qrcode(SCANNER_ID, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
        ],
      });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: (viewW, viewH) => {
              const side = Math.floor(Math.min(viewW, viewH) * 0.72);
              return { width: side, height: side };
            },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (cancelled || handledRef.current) return;
            const key = extractNotaSearchKey(decodedText);
            if (!key) return;
            handledRef.current = true;
            stopScanner().then(() => {
              onDetectRef.current?.(key);
            });
          },
          () => {}
        );
        if (!cancelled) setStarting(false);
      } catch (err) {
        if (!cancelled) {
          setStarting(false);
          setScannerError(
            err?.message?.includes('NotAllowed')
              ? 'Izin kamera ditolak. Izinkan akses kamera di browser lalu coba lagi.'
              : (err?.message || 'Tidak dapat membuka kamera. Pastikan perangkat memiliki kamera dan menggunakan HTTPS.')
          );
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {}).finally(() => {
          try { scanner.clear(); } catch { /* ignore */ }
        });
      }
    };
  }, [open, stopScanner]);

  useLockBodyScroll(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-safe-overlay">
      <div className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[18px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="text-[13px] font-extrabold text-slate-900 flex items-center gap-1.5">
            <ScanLine className="w-4 h-4 text-[#5f1340]" /> Scan QR Nota
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3">
          {scannerError ? (
            <div className="rounded-[16px] bg-slate-900 aspect-square flex items-center justify-center px-6 text-center">
              <div>
                <div className="text-red-400 text-[13px] font-semibold mb-1">Kamera Tidak Tersedia</div>
                <div className="text-white/60 text-[11px] leading-relaxed">{scannerError}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-[16px] overflow-hidden bg-black relative aspect-square qr-scanner-wrap">
              <div id={SCANNER_ID} className="w-full h-full min-h-[280px]" />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-10">
                  <span className="text-white text-[11px] font-semibold">Menyiapkan kamera…</span>
                </div>
              )}
              {!starting && (
                <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none z-10">
                  <span className="text-white/90 text-[11px] font-semibold bg-black/40 px-3 py-1.5 rounded-full">
                    Arahkan kamera ke QR code nota
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full h-[42px] rounded-[12px] border border-slate-200 bg-white text-slate-700 text-[12px] font-extrabold"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
