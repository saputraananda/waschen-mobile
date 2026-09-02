import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CameraCaptureModal from '../../../components/CameraCaptureModal';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';
import formatName from '../../../utils/FormatName.js';
import getDisplayRole from '../../../utils/getDisplayRole.js';
import fetchAssignedRole from '../../../utils/fetchAssignedRole.js';
import {
  CreditCard,
  Banknote,
  ArrowLeft,
  Plus,
  AlertCircle,
  X,
  Loader2,
  Trash2,
  Pencil,
  ImagePlus,
  Camera,
  Images,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const api = axios.create({ baseURL: '/api', timeout: 45000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const KASBON_TYPES = {
  kasbon: { key: 'kasbon', label: 'Kasbon', desc: 'Dana cepat / darurat', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-100', icon: Banknote },
  pinjaman: { key: 'pinjaman', label: 'Pinjaman', desc: 'Bisa dibayar cicil / lunas', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100', icon: CreditCard }
};

const STATUS_META = {
  pengajuan: { label: 'Pengajuan', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  proses: { label: 'Diproses', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  disetujui: { label: 'Disetujui', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  ditolak: { label: 'Ditolak', cls: 'text-red-700 bg-red-50 border-red-200' }
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatDateShort = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const formatRupiah = (n) => {
  const num = Number(n);
  if (!num || Number.isNaN(num)) return 'Rp 0';
  return 'Rp ' + num.toLocaleString('id-ID');
};

const getPeriodRange = (month, year) => {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
  const end = `${year}-${String(month).padStart(2, '0')}-25`;
  return { start, end };
};

const emptyForm = () => ({
  type: 'kasbon',
  submissionDate: todayISO(),
  purpose: '',
  amountStr: '',
  notes: '',
  proofFile: null,
  proofPreview: null,
  existingProofUrl: null,
  removeProof: false
});

export default function Kasbon() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState({ fullName: 'Karyawan Waschen', position: 'Staff Waschen' });

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [proofItem, setProofItem] = useState(null);

  const [expandedPayments, setExpandedPayments] = useState({});
  const [loadingPayments, setLoadingPayments] = useState({});
  const [cameraOpen, setCameraOpen] = useState(false);

  useLockBodyScroll(formOpen || !!deleteTarget || !!proofItem);

  const handleAuthError = useCallback((error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      return true;
    }
    return false;
  }, [navigate]);

  useEffect(() => {
    document.title = 'Kasbon & Pinjaman - Waschen Mobile';
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser((prev) => ({
          ...prev,
          ...parsed,
          fullName: parsed.fullName || parsed.full_name || prev.fullName,
          position: parsed.position || parsed.position_name || prev.position
        }));
        if (!parsed.assignedRole) {
          fetchAssignedRole(token).then((role) => {
            if (role) setCurrentUser((prev) => ({ ...prev, assignedRole: role }));
          });
        }
      } catch (_) { /* ignore */ }
    }
  }, [navigate]);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const { start, end } = getPeriodRange(filterMonth, filterYear);
      const res = await api.get('/kasbon/list', { params: { startDate: start, endDate: end } });
      setItems(res.data?.data || []);
    } catch (e) {
      if (handleAuthError(e)) return;
      setListError(e.response?.data?.message || 'Gagal memuat riwayat pengajuan');
    } finally {
      setLoadingList(false);
    }
  }, [filterMonth, filterYear, handleAuthError]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const stats = useMemo(() => {
    const s = { kasbon: 0, pinjaman: 0 };
    items.forEach((it) => { s[it.type] = (s[it.type] || 0) + 1; });
    return s;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!typeFilter) return items;
    return items.filter((it) => it.type === typeFilter);
  }, [items, typeFilter]);

  const openCreateForm = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setSubmitError(null);
    setFormOpen(true);
  };

  const openEditForm = (item) => {
    setEditTarget(item);
    setForm({
      type: item.type,
      submissionDate: String(item.submission_date).slice(0, 10),
      purpose: item.purpose || '',
      amountStr: String(Math.round(Number(item.amount_requested))),
      notes: item.notes || '',
      proofFile: null,
      proofPreview: item.proof_url || null,
      existingProofUrl: item.proof_url || null,
      removeProof: false
    });
    setSubmitError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    if (form.proofPreview && !form.existingProofUrl) URL.revokeObjectURL(form.proofPreview);
    setFormOpen(false);
    setEditTarget(null);
    setForm(emptyForm());
    setSubmitError(null);
  };

  const applyProofFile = (file) => {
    if (!file) return;
    if (form.proofPreview && !form.existingProofUrl) URL.revokeObjectURL(form.proofPreview);
    setForm((prev) => ({ ...prev, proofFile: file, proofPreview: URL.createObjectURL(file), removeProof: false }));
  };

  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    applyProofFile(file);
    e.target.value = '';
  };

  const handleCameraCapture = (file) => {
    applyProofFile(file);
    setCameraOpen(false);
  };

  const removeProofPhoto = () => {
    if (form.proofPreview && !form.existingProofUrl) URL.revokeObjectURL(form.proofPreview);
    setForm((prev) => ({ ...prev, proofFile: null, proofPreview: null, existingProofUrl: null, removeProof: !!prev.existingProofUrl }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!form.purpose || form.purpose.trim().length < 5) {
      setSubmitError('Keperluan/tujuan wajib diisi minimal 5 karakter');
      return;
    }
    const amount = Number(form.amountStr);
    if (!amount || amount <= 0) {
      setSubmitError('Jumlah pengajuan harus lebih dari 0');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('type', form.type);
      fd.append('submission_date', form.submissionDate);
      fd.append('purpose', form.purpose.trim());
      fd.append('amount_requested', String(amount));
      fd.append('notes', form.notes.trim());
      if (form.proofFile) fd.append('proof_doc', form.proofFile);
      if (editTarget && form.removeProof && !form.proofFile) fd.append('remove_proof', '1');

      if (editTarget) {
        await api.put(`/kasbon/${editTarget.id}`, fd);
      } else {
        await api.post('/kasbon', fd);
      }

      closeForm();
      await fetchList();
    } catch (e) {
      if (handleAuthError(e)) return;
      setSubmitError(e.response?.data?.message || 'Gagal mengirim pengajuan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/kasbon/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchList();
    } catch (e) {
      if (handleAuthError(e)) return;
      setListError(e.response?.data?.message || 'Gagal menghapus pengajuan');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const togglePayments = async (id) => {
    if (expandedPayments[id] !== undefined) {
      setExpandedPayments((p) => { const n = { ...p }; delete n[id]; return n; });
      return;
    }
    setLoadingPayments((p) => ({ ...p, [id]: true }));
    try {
      const res = await api.get(`/kasbon/${id}`);
      setExpandedPayments((p) => ({ ...p, [id]: res.data?.data?.payments || [] }));
    } catch (e) {
      if (handleAuthError(e)) return;
    } finally {
      setLoadingPayments((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const monthOptions = useMemo(
    () => MONTH_NAMES.map((label, idx) => ({ value: idx + 1, label })),
    []
  );

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[max(16px,env(safe-area-inset-bottom))]">

        {/* HERO HEADER */}
        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-safe-header pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            <CreditCard className="absolute -top-2 left-2 w-20 h-20 text-white -rotate-12" />
            <Banknote className="absolute top-3 right-10 w-16 h-16 text-white rotate-12" />
          </div>
          <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />

          <div className="flex items-center gap-3 relative z-10 mb-5 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-white leading-snug truncate tracking-tight">
                {formatName(currentUser.fullName || currentUser.full_name)}
              </h2>
              <span className="text-[11px] text-pink-200/80 font-medium truncate block">
                {[getDisplayRole(currentUser), currentUser.employeeCode].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>

          <div className="relative z-10 text-center py-2">
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider block">Manajemen Pengajuan</span>
            <span className="text-[22px] font-black text-white tracking-tight leading-tight block mt-0.5">
              Kasbon &amp; Pinjaman
            </span>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="w-full relative">

          {/* Filter periode + stats */}
          <div className="mx-4 -mt-6 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="flex-1 text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="w-[92px] text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {Object.values(KASBON_TYPES).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTypeFilter((prev) => (prev === t.key ? '' : t.key))}
                    className={`rounded-2xl border p-2.5 text-center transition-all ${typeFilter === t.key ? `${t.bg} ${t.color} border-current` : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                  >
                    <Icon className="w-4 h-4 mx-auto mb-1" />
                    <div className={`text-[16px] font-black ${typeFilter === t.key ? '' : 'text-slate-700'}`}>{stats[t.key] || 0}</div>
                    <div className="text-[9.5px] font-bold">{t.label}</div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={openCreateForm}
              className="w-full py-3.5 rounded-[18px] bg-[#5f1340] hover:bg-[#4d0f34] text-white text-[13.5px] font-black shadow-md shadow-[#5f1340]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Buat Pengajuan Baru</span>
            </button>
          </div>

          {/* RIWAYAT PENGAJUAN */}
          <div className="mx-4 mt-5">
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">Riwayat Pengajuan Saya</span>
              <span className="text-[10px] text-slate-400 font-semibold">
                {monthOptions.find((m) => m.value === filterMonth)?.label} {filterYear}
              </span>
            </div>

            {loadingList ? (
              <div className="bg-white rounded-[20px] border border-slate-100 p-8 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
                <span className="text-[11.5px] text-slate-400 font-bold">Memuat riwayat...</span>
              </div>
            ) : listError ? (
              <div className="bg-rose-50 border border-rose-200 rounded-[16px] p-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11.5px] text-rose-700 font-bold block">{listError}</span>
                  <button onClick={fetchList} className="text-[10.5px] text-rose-600 font-extrabold mt-1 underline">
                    Coba muat ulang
                  </button>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-white rounded-[20px] border border-slate-100 p-6 text-center">
                <span className="text-[11.5px] text-slate-400 font-semibold">Belum ada pengajuan pada periode ini.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredItems.map((item) => {
                  const typeMeta = KASBON_TYPES[item.type] || KASBON_TYPES.kasbon;
                  const statusMeta = STATUS_META[item.status] || STATUS_META.pengajuan;
                  const Icon = typeMeta.icon;
                  const isEditable = item.status === 'pengajuan';
                  const isPinjaman = item.type === 'pinjaman';
                  const isApproved = item.status === 'disetujui';
                  const totalPaid = Number(item.total_paid) || 0;
                  const amtApproved = Number(item.amount_approved) || 0;
                  const sisa = amtApproved > 0 ? amtApproved - totalPaid : 0;
                  const payments = expandedPayments[item.id];

                  return (
                    <div key={item.id} className="bg-white rounded-[20px] border border-slate-100 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-10.5 h-10.5 rounded-2xl border flex items-center justify-center flex-shrink-0 ${typeMeta.bg} ${typeMeta.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-black text-slate-800 truncate">{typeMeta.label}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusMeta.cls}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                            {formatDateShort(item.submission_date)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 bg-slate-50 rounded-[12px] p-3 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Jumlah Diajukan</div>
                        <div className="text-[18px] font-bold text-slate-900">{formatRupiah(item.amount_requested)}</div>
                        {isApproved && amtApproved > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-0.5">Jumlah Disetujui</div>
                            <div className="text-[15px] font-bold text-emerald-700">{formatRupiah(amtApproved)}</div>
                          </div>
                        )}
                      </div>

                      <p className="text-[11.5px] text-slate-500 font-medium mt-2.5 leading-relaxed">{item.purpose}</p>
                      {item.notes && <p className="mt-1 text-[11px] text-slate-400 italic">&ldquo;{item.notes}&rdquo;</p>}

                      {item.status === 'proses' && item.process_note && (
                        <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-2 text-[11px] text-amber-800 font-semibold">
                          Catatan proses: {item.process_note}
                        </div>
                      )}
                      {item.status === 'disetujui' && item.approved_note && (
                        <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-xl px-2.5 py-2 text-[11px] text-emerald-800 font-semibold">
                          Catatan persetujuan: {item.approved_note}
                        </div>
                      )}
                      {item.status === 'ditolak' && item.rejection_note && (
                        <div className="mt-2 bg-red-50 border border-red-100 rounded-xl px-2.5 py-2 text-[11px] text-red-700 font-semibold">
                          Alasan ditolak: {item.rejection_note}
                        </div>
                      )}

                      {isPinjaman && isApproved && amtApproved > 0 && (
                        <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-[12px] p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[11px] font-bold text-indigo-700">Pembayaran Pinjaman</div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sisa <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {sisa <= 0 ? 'LUNAS' : `Sisa ${formatRupiah(sisa)}`}
                            </span>
                          </div>
                          <div className="flex gap-4 mb-2">
                            <div>
                              <div className="text-[10px] text-slate-400">Sudah Dibayar</div>
                              <div className="text-[12px] font-bold text-slate-700">{formatRupiah(totalPaid)}</div>
                            </div>
                            <div className="w-px bg-indigo-200" />
                            <div>
                              <div className="text-[10px] text-slate-400">Jumlah Cicilan</div>
                              <div className="text-[12px] font-bold text-slate-700">{Number(item.payment_count) || 0}x</div>
                            </div>
                          </div>
                          <button
                            onClick={() => togglePayments(item.id)}
                            className="w-full text-[11.5px] font-bold text-indigo-600 flex items-center justify-center gap-1.5 cursor-pointer py-1"
                          >
                            {loadingPayments[item.id] ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Memuat...</>
                            ) : payments !== undefined ? (
                              <><ChevronUp className="w-3.5 h-3.5" />Sembunyikan Detail</>
                            ) : (
                              <><ChevronDown className="w-3.5 h-3.5" />Lihat Detail Pembayaran</>
                            )}
                          </button>
                          {payments !== undefined && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              {payments.length === 0 ? (
                                <div className="text-[11px] text-slate-400 text-center py-2">Belum ada pembayaran tercatat.</div>
                              ) : payments.map((p) => (
                                <div key={p.id} className="flex items-start justify-between bg-white rounded-[8px] px-3 py-2 border border-indigo-100">
                                  <div className="min-w-0">
                                    <div className="text-[11.5px] font-bold text-slate-800">{formatRupiah(p.amount)}</div>
                                    <div className="text-[10px] text-slate-400">
                                      {formatDateShort(p.payment_date)}{p.payment_method ? ` · ${p.payment_method.replace('_', ' ')}` : ''}
                                    </div>
                                  </div>
                                  {p.notes && <div className="text-[10.5px] text-slate-500 text-right max-w-[110px] truncate ml-2 flex-shrink-0">{p.notes}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2">
                        {item.proof_url && (
                          <button
                            onClick={() => setProofItem(item)}
                            className="flex-1 h-[32px] rounded-[10px] border border-blue-200 bg-blue-50 text-blue-700 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                          >
                            <Eye className="w-3 h-3" /> Foto Bukti
                          </button>
                        )}
                        {isEditable && (
                          <>
                            <button
                              onClick={() => openEditForm(item)}
                              className="flex-1 h-[32px] rounded-[10px] border border-slate-200 bg-slate-50 text-slate-700 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="flex-1 h-[32px] rounded-[10px] border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                            >
                              <Trash2 className="w-3 h-3" /> Hapus
                            </button>
                          </>
                        )}
                      </div>

                      <div className="mt-2 text-[10.5px] text-slate-400">{formatDateTime(item.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* FORM MODAL — bottom sheet */}
      {formOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-safe-overlay" onClick={closeForm}>
          <div
            className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[20px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="text-[14px] font-extrabold text-slate-900">
                {editTarget ? 'Edit Pengajuan' : 'Buat Pengajuan Baru'}
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto hide-scrollbar flex flex-col gap-4">
              {submitError && (
                <div className="bg-rose-50 border border-rose-200 rounded-[14px] p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span className="text-[11.5px] text-rose-700 font-semibold">{submitError}</span>
                </div>
              )}

              {/* Type */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Jenis Pengajuan</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(KASBON_TYPES).map((t) => {
                    const Icon = t.icon;
                    const active = form.type === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, type: t.key }))}
                        className={`rounded-2xl border p-2.5 text-center transition-all ${active ? `${t.bg} ${t.color} border-current` : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                      >
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        <div className="text-[11px] font-black">{t.label}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10.5px] text-slate-400 font-medium mt-1.5">{KASBON_TYPES[form.type]?.desc}</p>
              </div>

              {/* Submission date */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tanggal Pengajuan</label>
                <input
                  type="date"
                  value={form.submissionDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, submissionDate: e.target.value }))}
                  className="w-full text-[12.5px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none"
                />
              </div>

              {/* Purpose */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Keperluan / Tujuan</label>
                <textarea
                  value={form.purpose}
                  onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))}
                  rows={3}
                  placeholder="Jelaskan keperluan atau tujuan pengajuan (min. 5 karakter)"
                  className="w-full text-[12.5px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none resize-none"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Jumlah Yang Diajukan (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-500 font-semibold select-none">Rp</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="0"
                    value={form.amountStr}
                    onChange={(e) => setForm((prev) => ({ ...prev, amountStr: e.target.value }))}
                    className="w-full text-[12.5px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 outline-none"
                  />
                </div>
                {form.amountStr && Number(form.amountStr) > 0 && (
                  <div className="text-[11px] text-slate-500 font-semibold px-1 mt-1">{formatRupiah(form.amountStr)}</div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Catatan <span className="normal-case font-normal text-slate-300">(opsional)</span></label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Catatan tambahan jika ada…"
                  className="w-full text-[12.5px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none resize-none"
                />
              </div>

              {/* Proof photo upload */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Foto Bukti <span className="normal-case font-normal text-slate-300">(opsional)</span></label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handlePickFile}
                  className="hidden"
                />
                {form.proofPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                    <img
                      src={form.proofPreview}
                      alt="Foto bukti"
                      className="w-full max-h-[180px] object-contain bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={removeProofPhoto}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white grid place-items-center hover:bg-black/70 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-black/60 text-white text-[10.5px] font-bold"
                    >
                      Ganti Foto
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraOpen(true)}
                      className="py-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center gap-2 text-slate-400"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="text-[11px] font-bold">Ambil Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center gap-2 text-slate-400"
                    >
                      <Images className="w-5 h-5" />
                      <span className="text-[11px] font-bold">Dari Galeri</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="h-[44px] rounded-[12px] border border-slate-200 bg-white text-slate-700 text-[12.5px] font-extrabold disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-[44px] rounded-[12px] bg-[#5f1340] text-white text-[12.5px] font-extrabold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editTarget ? 'Simpan Perubahan' : 'Kirim Pengajuan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-safe-modal">
          <div className="w-full max-w-[340px] bg-white rounded-[20px] overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,.3)]">
            <div className="px-5 pt-5 pb-3 text-center">
              <div className="w-14 h-14 rounded-[16px] bg-red-50 border-2 border-red-200 grid place-items-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-[15px] font-extrabold text-slate-900 mb-1.5">Hapus Pengajuan?</div>
              <div className="text-[12.5px] text-slate-500 leading-[1.6] font-medium">
                Pengajuan <span className="font-bold text-slate-700">{KASBON_TYPES[deleteTarget.type]?.label}</span> ini akan dihapus permanen. Lanjutkan?
              </div>
            </div>
            <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="h-[42px] rounded-[12px] border border-slate-200 bg-white text-slate-700 text-[12.5px] font-extrabold transition hover:bg-slate-50"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                className="h-[42px] rounded-[12px] bg-red-500 text-white text-[12.5px] font-extrabold transition hover:bg-red-600 disabled:opacity-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Memproses...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof photo preview modal */}
      {proofItem && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 px-3 py-safe-fullscreen"
          onClick={() => setProofItem(null)}
        >
          <div
            className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[18px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-[13px] font-extrabold text-slate-900">Foto Bukti</div>
              <button
                type="button"
                onClick={() => setProofItem(null)}
                className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto hide-scrollbar">
              <img
                src={proofItem.proof_url}
                alt="Foto bukti pengajuan"
                className="w-full h-auto max-h-[72dvh] object-contain rounded-[12px] bg-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      <CameraCaptureModal
        open={cameraOpen}
        title="Ambil Foto Bukti"
        onCapture={handleCameraCapture}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}
