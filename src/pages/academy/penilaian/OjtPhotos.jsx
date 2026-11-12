import React, { useRef, useState } from 'react';
import { Camera, Images, X } from 'lucide-react';
import CameraCaptureModal from '../../../components/CameraCaptureModal.jsx';
import ConfirmModal, { AlertModal } from '../../../components/ConfirmModal.jsx';
import { buildOjtPhotoLines, burnPhotoOverlay } from '../../../utils/photoStamp.js';
import { api, errorMessage } from '../academyShared.js';

const MAX_PHOTOS = 5;
// Mutu sama dengan foto QC produksi.
const PHOTO_QUALITY = { maxEdge: 2560, quality: 0.95 };
const KIND_LABEL = { FIRST: 'Hari pertama', LAST: 'Hari terakhir' };

/** Foto tersimpan, hanya untuk dilihat (peserta). Ketuk untuk membuka ukuran penuh di tab baru. */
export function PhotoGrid({ photos }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo, index) => (
        <a
          key={photo.id}
          href={photo.url}
          target="_blank"
          rel="noreferrer"
          className="block aspect-square overflow-hidden rounded-xl border border-slate-200"
        >
          <img src={photo.url} alt={`Foto ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

/** Foto peserta untuk satu hari penilaian OJT. Tiap foto diunggah dan dihapus langsung, tidak menunggu simpan nilai. */
export default function OjtPhotos({ ojtId, day, participantName, onChanged }) {
  const fileInputRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const base = `/academy/penilaian/ojt/${ojtId}/days/${day.date}/photos`;
  const overlayLines = (date = new Date()) =>
    buildOjtPhotoLines({ participantName, kindLabel: KIND_LABEL[day.kind], date });

  const upload = async (file, { stamped = false } = {}) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const finalFile = stamped ? file : await burnPhotoOverlay(file, overlayLines(), PHOTO_QUALITY);
      const fd = new FormData();
      fd.append('photos', finalFile, finalFile.name);
      await api.post(base, fd, { timeout: 60000 });
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan foto'));
    } finally {
      setBusy(false);
    }
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    upload(file);
  };

  const remove = async () => {
    const photoId = toDelete;
    setToDelete(null);
    setBusy(true);
    try {
      await api.delete(`${base}/${photoId}`);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Gagal menghapus foto'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-3">
      <p className="mb-2 text-[11.5px] font-black uppercase tracking-wider text-[#5f1340]">Foto peserta (wajib, maks {MAX_PHOTOS})</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={pickFile}
        className="hidden"
      />
      {day.photos.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {day.photos.map((photo, index) => (
            <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200">
              <a href={photo.url} target="_blank" rel="noreferrer" aria-label={`Buka foto ${index + 1}`}>
                <img src={photo.url} alt={`Foto ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => setToDelete(photo.id)}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white disabled:opacity-50"
                aria-label={`Hapus foto ${index + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {day.photos.length < MAX_PHOTOS && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={busy}
            className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-4 text-slate-400 disabled:opacity-50"
          >
            <Camera className="h-5 w-5" />
            <span className="text-[11px] font-bold">{busy ? 'Memproses…' : 'Ambil Foto'}</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-4 text-slate-400 disabled:opacity-50"
          >
            <Images className="h-5 w-5" />
            <span className="text-[11px] font-bold">{busy ? 'Memproses…' : 'Dari Galeri'}</span>
          </button>
        </div>
      )}

      <CameraCaptureModal
        open={cameraOpen}
        title="Ambil Foto Peserta"
        buildOverlayLines={overlayLines}
        jpegQuality={PHOTO_QUALITY.quality}
        maxEdge={PHOTO_QUALITY.maxEdge}
        onCapture={(file) => {
          setCameraOpen(false);
          upload(file, { stamped: true });
        }}
        onClose={() => setCameraOpen(false)}
      />
      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title="Hapus foto"
        message="Hapus foto ini? Foto tidak bisa dikembalikan."
        confirmText="Hapus"
      />
      <AlertModal message={error} onClose={() => setError('')} />
    </div>
  );
}
