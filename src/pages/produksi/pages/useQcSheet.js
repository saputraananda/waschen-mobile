import { useState, useRef, useEffect, useCallback } from 'react';
import {
  api, isKiloanItem, prevBagStagesFor, bagGap, BAG_ENTRY_STAGES
} from '../../../utils/produksiShared.js';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';
import { buildProduksiPhotoLines, burnPhotoOverlay, getCurrentUserName } from '../../../utils/photoStamp.js';

const MAX_PHOTOS = 5;
const QC_PHOTO = { maxEdge: 2560, quality: 0.95 };

const TEMUAN_NOTE = {
  frontliner: {
    kiloan: 'Contoh : Ada 1 pcs baju kaos yang robek dibagian ketiak',
    satuan: 'Contoh : Ada noda tinta di bagian lengan'
  },
  washing: {
    kiloan: 'Contoh : Ada 1 pcs baju kaos yang robek dibagian ketiak',
    satuan: 'Contoh : Ada noda tinta di bagian lengan'
  },
  ironing: {
    kiloan: 'Contoh : Ada 1 pcs baju kaos yang robek dibagian ketiak',
    satuan: 'Contoh : Ada noda membandel dibagian dada'
  },
  packing: {
    kiloan: 'Contoh : Ada beberapa baju yang lecak, baju biru, dst.',
    satuan: 'Contoh : Masih ada noda di kerah kemeja'
  },
  delivery: {
    kiloan: 'Contoh : Packing tidak berurutan dan tidak presisi',
    satuan: 'Contoh : Packing tidak sempurna, plastik robek sedikit'
  }
};

export function qcNotePlaceholder(stage, kiloan, status) {
  if (status !== 'temuan') return 'Boleh Kosong Jika Aman';
  const row = TEMUAN_NOTE[stage === 'handover' ? 'delivery' : stage] || TEMUAN_NOTE.frontliner;
  return kiloan ? row.kiloan : row.satuan;
}

/** Bentuk state plastik (kg map + lainnya) → payload kg_items untuk API. */
function bagsToKgItems(bags) {
  return bags.flatMap((b, i) => [
    ...Object.entries(b.kg || {})
      .filter(([, q]) => Number(q) > 0)
      .map(([id, q]) => ({ bag_no: i + 1, item_kg_id: Number(id), qty_pcs: Number(q) })),
    ...(b.others || [])
      .filter((o) => Number(o.qty) > 0)
      .map((o) => ({ bag_no: i + 1, item_name: o.name.trim(), qty_pcs: Number(o.qty) }))
  ]);
}

/** Rincian tersimpan (kg_items API) → state plastik, untuk prefill form Tim Cuci. */
function kgItemsToBags(kgItems, baseBags = []) {
  const count = Math.max(baseBags.length, ...kgItems.map((k) => Number(k.bag_no) || 0), 0);
  return Array.from({ length: count }, (_, i) => {
    const no = i + 1;
    const rows = kgItems.filter((k) => Number(k.bag_no) === no);
    return {
      bag_no: no,
      qty_pcs: '',
      kg: Object.fromEntries(rows.filter((k) => k.item_kg_id).map((k) => [k.item_kg_id, String(k.qty_pcs)])),
      others: rows.filter((k) => !k.item_kg_id).map((k) => ({ name: k.item_name || '', qty: String(k.qty_pcs) }))
    };
  });
}

const RETURN_STAGE_OPTIONS = {
  washing: ['frontliner'],
  ironing: ['washing', 'frontliner'],
  packing: ['ironing', 'washing', 'frontliner'],
  delivery: ['packing']
};

export function useQcSheet({ open, stage, item, txn, onClose, onDone }) {
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
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [bagHistory, setBagHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [kgMaster, setKgMaster] = useState([]);
  const [kgHistory, setKgHistory] = useState([]);
  const [kgSource, setKgSource] = useState(null);

  const buildPhotoOverlay = useCallback((date = new Date()) => buildProduksiPhotoLines({
    orderNo: txn?.order_no,
    stage,
    photographerName: getCurrentUserName(),
    date
  }), [txn?.order_no, stage]);

  const kiloan = isKiloanItem(item);
  const carriedFinding = Number(item?.has_finding) === 1;
  const isHandover = stage === 'handover';
  const needBags = kiloan && BAG_ENTRY_STAGES.includes(stage);
  const askIroning = stage === 'frontliner' && !kiloan;
  const needPackings = kiloan && stage === 'packing';
  const needKgItems = kiloan && stage === 'washing';
  // Frontliner / Pickup Delivery boleh membantu merinci (opsional) saat load Tim Cuci penuh
  const optionalKg = kiloan && stage === 'frontliner';
  const draftKey = `qc-kg-draft:${item?.id}`;
  const showBagHistory = kiloan && prevBagStagesFor(stage).length > 0;
  const returnStageOptions = RETURN_STAGE_OPTIONS[stage] || ['frontliner'];

  useEffect(() => {
    if (!open) return;
    const opts = RETURN_STAGE_OPTIONS[stage] || ['frontliner'];
    setReturnedStage(opts[0]);
  }, [open, stage]);

  useEffect(() => {
    if (!open || !(needKgItems || optionalKg)) return undefined;
    let cancelled = false;
    api.get('/progress/item-kg')
      .then((res) => { if (!cancelled) setKgMaster(res.data?.data || []); })
      .catch(() => { if (!cancelled) setKgMaster([]); });
    return () => { cancelled = true; };
  }, [open, needKgItems, optionalKg]);

  useEffect(() => {
    if (!open || !item?.id || !kiloan || stage === 'frontliner') {
      setBagHistory([]);
      setKgHistory([]);
      setKgSource(null);
      return undefined;
    }

    let cancelled = false;
    setHistoryLoading(true);
    api.get(`/progress/item/${item.id}/bag-history`)
      .then((res) => {
        if (cancelled) return;
        const kgItems = res.data?.kg_items || [];
        const versions = res.data?.kg_versions || [];
        setKgHistory(kgItems);
        setKgSource(versions[versions.length - 1] || null);
        const all = res.data?.data || [];
        const allowed = prevBagStagesFor(stage);
        const filtered = all.filter((h) => allowed.includes(h.stage));
        setBagHistory(filtered);

        const latest = filtered[filtered.length - 1];
        if (needBags && latest?.bags?.length) {
          setBags(latest.bags.map((b) => ({ bag_no: b.bag_no, qty_pcs: '' })));
        }
        if (needKgItems) {
          let draft = null;
          try {
            draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
          } catch { /* draft rusak, abaikan */ }
          if (Array.isArray(draft) && draft.length) setBags(draft);
          // Sudah dirinci Frontliner/Delivery → form Tim Cuci terisi otomatis, tinggal cek & ubah
          else if (kgItems.length) setBags(kgItemsToBags(kgItems, latest?.bags || []));
        }
      })
      .catch(() => { if (!cancelled) { setBagHistory([]); setKgHistory([]); setKgSource(null); } })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });

    return () => { cancelled = true; };
  }, [open, item?.id, stage, kiloan, needBags, needKgItems, draftKey]);

  useEffect(() => {
    if (!open || !needKgItems || historyLoading) return;
    if (bags.some((b) => Object.values(b.kg || {}).some(Boolean) || (b.others || []).length)) {
      localStorage.setItem(draftKey, JSON.stringify(bags));
    }
  }, [open, needKgItems, historyLoading, bags, draftKey]);

  useLockBodyScroll(open || !!photoPreview);

  const referenceBags = bagHistory.length ? bagHistory[bagHistory.length - 1].bags : [];
  const bagSum = (b) =>
    Object.values(b.kg || {}).reduce((s, v) => s + (Number(v) || 0), 0) +
    (b.others || []).reduce((s, o) => s + (Number(o.qty) || 0), 0);

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
        : await burnPhotoOverlay(file, buildPhotoOverlay(), QC_PHOTO);
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
    setKgHistory([]);
    setKgSource(null);
    setHistoryLoading(false);
    setPhotoPreview(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);

    if (qcStatus === 'temuan' && !notes.trim()) {
      setError('Catatan temuan wajib diisi.');
      return;
    }
    if (photos.length === 0) {
      setError(isHandover
        ? 'Serah terima wajib menyertakan minimal 1 foto bukti pengantaran.'
        : 'QC wajib menyertakan minimal 1 foto.');
      return;
    }
    if (needKgItems) {
      const emptyIdx = bags.findIndex((b) => bagSum(b) < 1);
      if (emptyIdx >= 0) {
        setError(`Plastik ${emptyIdx + 1}: isi rincian jenis pakaian (qty) terlebih dahulu.`);
        return;
      }
      if (bags.some((b) => (b.others || []).some((o) => Number(o.qty) > 0 && !o.name.trim()))) {
        setError('Rincian "Lainnya": nama jenis pakaian wajib diisi.');
        return;
      }
    } else if (needBags) {
      const valid = bags.every((b) => Number(b.qty_pcs) > 0);
      if (!valid) {
        setError('Isi jumlah pakaian per plastik (semua plastik).');
        return;
      }
      if (optionalKg) {
        const mismatchIdx = bags.findIndex((b) => bagSum(b) > 0 && bagSum(b) !== Number(b.qty_pcs));
        if (mismatchIdx >= 0) {
          const b = bags[mismatchIdx];
          setError(`Plastik ${mismatchIdx + 1}: total rincian (${bagSum(b)}) harus sama dengan jumlah plastik (${Number(b.qty_pcs)}), atau kosongkan rinciannya.`);
          return;
        }
        if (bags.some((b) => (b.others || []).some((o) => Number(o.qty) > 0 && !o.name.trim()))) {
          setError('Rincian "Lainnya": nama jenis pakaian wajib diisi.');
          return;
        }
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
      fd.append('qc_decision', isHandover ? 'lanjut' : (qcStatus === 'aman' ? 'lanjut' : decision));
      if (!isHandover && qcStatus === 'temuan' && decision === 'kembali') {
        fd.append('returned_to_stage', returnedStage);
      }
      if (notes.trim()) fd.append('notes', notes.trim());
      fd.append('wa_contacted', stage === 'frontliner' && waContacted ? '1' : '0');
      if (askIroning) fd.append('requires_ironing', requiresIroning ? '1' : '0');
      if (needBags) {
        fd.append('bags', JSON.stringify(bags.map((b, i) => ({
          bag_no: i + 1,
          qty_pcs: needKgItems ? bagSum(b) : Number(b.qty_pcs)
        }))));
      }
      if (needKgItems || optionalKg) {
        const kgItems = bagsToKgItems(bags);
        if (needKgItems || kgItems.length) fd.append('kg_items', JSON.stringify(kgItems));
      }
      if (needPackings && qcStatus === 'aman') {
        fd.append('packings', JSON.stringify(packings.map((p, i) => ({ packing_no: i + 1, qty_pcs: Number(p.qty_pcs) }))));
      }
      photos.forEach((p) => fd.append('photos', p.file, p.file.name));

      const res = await api.post('/progress/qc', fd);
      localStorage.removeItem(draftKey);
      resetAndClose();
      onDone(res.data?.message || (isHandover ? 'Serah terima tersimpan' : 'QC tersimpan'));
    } catch (e) {
      setError(e.response?.data?.message || (isHandover ? 'Gagal menyimpan serah terima' : 'Gagal menyimpan QC'));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    open: !!(open && item),
    stage,
    item,
    txn,
    fileInputRef,
    cameraOpen, setCameraOpen,
    qcStatus, setQcStatus,
    decision, setDecision,
    returnedStage, setReturnedStage,
    notes, setNotes,
    waContacted, setWaContacted,
    requiresIroning, setRequiresIroning,
    bags, setBags,
    packings, setPackings,
    photos,
    submitting,
    error, setError,
    bagHistory,
    historyLoading,
    photoProcessing,
    photoPreview, setPhotoPreview,
    kgMaster,
    kgHistory,
    kgSource,
    kiloan,
    carriedFinding,
    isHandover,
    needBags,
    askIroning,
    needPackings,
    needKgItems,
    optionalKg,
    showBagHistory,
    returnStageOptions,
    referenceBags,
    bagSum,
    bagGap,
    addPhoto,
    removePhoto,
    handlePickFile,
    resetAndClose,
    handleSubmit,
    buildPhotoOverlay,
    maxPhotos: MAX_PHOTOS,
    photoQuality: QC_PHOTO,
    notePlaceholder: qcNotePlaceholder(stage, kiloan, qcStatus)
  };
}
