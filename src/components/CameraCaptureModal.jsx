import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import useLockBodyScroll from '../hooks/useLockBodyScroll.js';
import { drawTextOverlay } from '../utils/photoStamp.js';

function formatStamp(date) {
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Reusable bottom-sheet camera capture modal.
 * Opens device camera, burns overlay text into captured photo,
 * and returns the result via onCapture(file: File).
 *
 * @param buildOverlayLines — (date: Date) => string[]  multi-line watermark
 */
export default function CameraCaptureModal({
  open,
  title = 'Ambil Foto',
  onCapture,
  onClose,
  initialFacingMode = 'environment',
  buildOverlayLines = null
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState(initialFacingMode);
  const [videoReady, setVideoReady] = useState(false);
  const [camError, setCamError] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [now, setNow] = useState(new Date());

  const overlayLines = buildOverlayLines
    ? buildOverlayLines(now)
    : [formatStamp(now)];

  useEffect(() => {
    if (!open) return;
    setFacingMode(initialFacingMode);
  }, [open, initialFacingMode]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setVideoReady(false);
  }, []);

  useEffect(() => {
    if (!open) { stopStream(); return; }
    setCamError(null);
    setVideoReady(false);
    let cancelled = false;
    stopStream();

    const getStream = (c) => navigator.mediaDevices.getUserMedia({ video: c, audio: false });
    (async () => {
      try {
        let stream;
        try { stream = await getStream({ facingMode }); }
        catch {
          try { stream = await getStream({ facingMode: { ideal: facingMode } }); }
          catch { stream = await getStream(true); }
        }
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => { if (!cancelled) setVideoReady(true); }).catch(() => {});
        }
      } catch (e) {
        if (!cancelled) {
          const n = e?.name || '';
          setCamError(n === 'NotAllowedError' ? 'Izin kamera ditolak.' : 'Kamera tidak tersedia.');
        }
      }
    })();

    return () => { cancelled = true; stopStream(); };
  }, [open, facingMode, stopStream]);

  const switchCamera = () => setFacingMode((p) => (p === 'user' ? 'environment' : 'user'));

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || capturing) return;
    setCapturing(true);

    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setCapturing(false); return; }

    if (facingMode === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, w, h);
    if (facingMode === 'user') ctx.setTransform(1, 0, 0, 1, 0, 0);

    const lines = buildOverlayLines ? buildOverlayLines(now) : [formatStamp(now)];
    drawTextOverlay(ctx, w, h, lines);

    canvas.toBlob((blob) => {
      setCapturing(false);
      if (!blob) return;
      onCapture(new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.88);
  };

  useLockBodyScroll(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-safe-overlay">
      <div className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[18px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="text-[13px] font-extrabold text-slate-900">{title}</div>
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
          {camError ? (
            <div className="rounded-[16px] bg-slate-900 aspect-[3/4] flex items-center justify-center px-6 text-center">
              <div>
                <div className="text-red-400 text-[13px] font-semibold mb-1">Kamera Tidak Tersedia</div>
                <div className="text-white/60 text-[11px] leading-relaxed">{camError}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-[16px] overflow-hidden bg-black relative aspect-[3/4]">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
                style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined}
              />

              <button
                type="button"
                onClick={switchCamera}
                className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/50 grid place-items-center text-white"
                aria-label="Ganti kamera"
              >
                <RefreshCw className="w-4.5 h-4.5" />
              </button>

              {videoReady && (
                <div
                  className="absolute left-3 bottom-3 text-white px-2.5 py-2 rounded-xl max-w-[calc(100%-24px)]"
                  style={{ background: 'rgba(0,0,0,0.58)' }}
                >
                  {overlayLines.map((line, i) => (
                    <div
                      key={i}
                      className={`leading-snug ${i === 0 ? 'text-[11px] font-extrabold' : 'text-[10px] font-semibold text-white/95'}`}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {!videoReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
          )}

          {!videoReady && !camError && (
            <div className="mt-2 text-[11px] font-semibold text-slate-500">Menyiapkan kamera…</div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[42px] rounded-[12px] border border-slate-200 bg-white text-slate-700 text-[12px] font-extrabold"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleCapture}
              disabled={!videoReady || !!camError || capturing}
              className="h-[42px] rounded-[12px] bg-[#5f1340] text-white text-[12px] font-extrabold disabled:opacity-50"
            >
              {capturing ? 'Memproses…' : 'Ambil Foto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
