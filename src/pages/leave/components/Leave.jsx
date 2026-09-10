import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CameraCaptureModal from '../../../components/CameraCaptureModal';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';
import formatName from '../../../utils/FormatName.js';
import getDisplayRole from '../../../utils/getDisplayRole.js';
import fetchAssignedRole from '../../../utils/fetchAssignedRole.js';
import { useRealtimeRefresh } from '../../../context/SocketContext.jsx';
import {
  Sun,
  Calendar,
  Clock,
  FileText,
  ArrowLeft,
  Plus,
  AlertCircle,
  X,
  Loader2,
  Stethoscope,
  Palmtree,
  Trash2,
  Pencil,
  ImagePlus,
  Camera,
  Images,
  Eye
} from 'lucide-react';

const api = axios.create({ baseURL: '/api', timeout: 45000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const LEAVE_TYPES = {
  izin: { key: 'izin', label: 'Izin', desc: 'Keperluan pribadi / keluarga', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', icon: Sun },
  sakit: { key: 'sakit', label: 'Sakit', desc: 'Wajib lampirkan surat dokter', color: 'text-red-700', bg: 'bg-red-50 border-red-100', icon: Stethoscope },
  cuti: { key: 'cuti', label: 'Cuti', desc: 'Cuti tahunan, bisa multi-hari', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', icon: Palmtree }
};

const DURATION_TYPES = {
  full_day: { key: 'full_day', label: 'Sehari Penuh' },
  half_day_morning: { key: 'half_day_morning', label: 'Setengah Hari (Pagi)' },
  half_day_afternoon: { key: 'half_day_afternoon', label: 'Setengah Hari (Siang)' }
};

const STATUS_META = {
  pengajuan: { label: 'Menunggu Persetujuan', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
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

const countDays = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e - s) / 86400000) + 1;
};

const emptyForm = () => ({
  leaveType: 'izin',
  durationType: 'full_day',
  startDate: todayISO(),
  endDate: todayISO(),
  reason: '',
  doctorFile: null,
  doctorPreview: null,
  existingDoctorNoteUrl: null
});

export default function Leave() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState({ fullName: 'Karyawan Waschen', position: 'Staff Waschen' });

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [yearOptions, setYearOptions] = useState([now.getFullYear()]);
  const [stats, setStats] = useState({ izin: 0, sakit: 0, cuti: 0 });

  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [doctorNoteItem, setDoctorNoteItem] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  useLockBodyScroll(formOpen || !!cancelTarget || !!doctorNoteItem);

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
    document.title = 'Pengajuan Izin & Cuti - Waschen Mobile';
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

  const fetchYears = useCallback(async () => {
    try {
      const res = await api.get('/leave/years');
      const years = res.data?.data || [];
      setYearOptions(years.length ? years : [now.getFullYear()]);
    } catch (e) {
      if (handleAuthError(e)) return;
    }
  }, [handleAuthError, now]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/leave/stats', { params: { month: filterMonth, year: filterYear } });
      setStats(res.data?.data || { izin: 0, sakit: 0, cuti: 0 });
    } catch (e) {
      if (handleAuthError(e)) return;
    }
  }, [filterMonth, filterYear, handleAuthError]);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await api.get('/leave/list', { params: { limit: 50, month: filterMonth, year: filterYear } });
      setItems(res.data?.data?.items || []);
    } catch (e) {
      if (handleAuthError(e)) return;
      setListError(e.response?.data?.message || 'Gagal memuat riwayat pengajuan');
    } finally {
      setLoadingList(false);
    }
  }, [filterMonth, filterYear, handleAuthError]);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  useEffect(() => {
    fetchList();
    fetchStats();
  }, [fetchList, fetchStats]);

  useRealtimeRefresh('leave', () => {
    fetchList();
    fetchStats();
  });

  // Sync endDate for non-cuti / half-day requests (single day only)
  useEffect(() => {
    if (form.leaveType !== 'cuti' || form.durationType !== 'full_day') {
      if (form.endDate !== form.startDate) {
        setForm((prev) => ({ ...prev, endDate: prev.startDate }));
      }
    }
  }, [form.leaveType, form.durationType, form.startDate, form.endDate]);

  const openCreateForm = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setSubmitError(null);
    setFormOpen(true);
  };

  const openEditForm = (item) => {
    setEditTarget(item);
    setForm({
      leaveType: item.leave_type,
      durationType: item.duration_type,
      startDate: item.start_date?.slice(0, 10) || todayISO(),
      endDate: item.end_date?.slice(0, 10) || todayISO(),
      reason: item.reason || '',
      doctorFile: null,
      doctorPreview: null,
      existingDoctorNoteUrl: item.doctor_note_url || null
    });
    setSubmitError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setEditTarget(null);
    if (form.doctorPreview) URL.revokeObjectURL(form.doctorPreview);
    setForm(emptyForm());
    setSubmitError(null);
  };

  const applyDoctorFile = (file) => {
    if (!file) return;
    if (form.doctorPreview) URL.revokeObjectURL(form.doctorPreview);
    setForm((prev) => ({ ...prev, doctorFile: file, doctorPreview: URL.createObjectURL(file) }));
  };

  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    applyDoctorFile(file);
    e.target.value = '';
  };

  const handleCameraCapture = (file) => {
    applyDoctorFile(file);
    setCameraOpen(false);
  };

  const isMultiDayAllowed = form.leaveType === 'cuti' && form.durationType === 'full_day';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!form.reason || form.reason.trim().length < 5) {
      setSubmitError('Keterangan wajib diisi minimal 5 karakter');
      return;
    }
    if (form.startDate > form.endDate) {
      setSubmitError('Tanggal selesai tidak boleh sebelum tanggal mulai');
      return;
    }
    if (form.leaveType === 'sakit' && !form.doctorFile && !form.existingDoctorNoteUrl) {
      setSubmitError('Foto surat dokter wajib dilampirkan untuk izin sakit');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('leave_type', form.leaveType);
      fd.append('duration_type', form.durationType);
      fd.append('start_date', form.startDate);
      fd.append('end_date', form.endDate);
      fd.append('reason', form.reason.trim());
      if (form.doctorFile) fd.append('doctor_note', form.doctorFile);

      if (editTarget) {
        await api.put(`/leave/${editTarget.leave_id}`, fd);
      } else {
        await api.post('/leave', fd);
      }

      closeForm();
      await Promise.all([fetchList(), fetchStats(), fetchYears()]);
    } catch (e) {
      if (handleAuthError(e)) return;
      setSubmitError(e.response?.data?.message || 'Gagal mengirim pengajuan izin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.delete(`/leave/${cancelTarget.leave_id}`);
      setCancelTarget(null);
      await Promise.all([fetchList(), fetchStats(), fetchYears()]);
    } catch (e) {
      if (handleAuthError(e)) return;
      setListError(e.response?.data?.message || 'Gagal membatalkan pengajuan');
      setCancelTarget(null);
    } finally {
      setCancelling(false);
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
            <Sun className="absolute -top-2 left-2 w-20 h-20 text-white -rotate-12" />
            <FileText className="absolute top-3 right-10 w-16 h-16 text-white rotate-12" />
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
              Izin, Sakit &amp; Cuti Karyawan
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

            <div className="grid grid-cols-3 gap-2 mb-4">
              {Object.values(LEAVE_TYPES).map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.key} className={`rounded-2xl border p-2.5 text-center ${t.bg}`}>
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${t.color}`} />
                    <div className={`text-[16px] font-black ${t.color}`}>{stats[t.key] || 0}</div>
                    <div className="text-[9.5px] text-slate-400 font-bold">{t.label}</div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={openCreateForm}
              className="w-full py-3.5 rounded-[18px] bg-[#5f1340] hover:bg-[#4d0f34] text-white text-[13.5px] font-black shadow-md shadow-[#5f1340]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Buat Pengajuan Izin Baru</span>
            </button>
          </div>

          {/* RECENT LEAVE REQUESTS */}
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
            ) : items.length === 0 ? (
              <div className="bg-white rounded-[20px] border border-slate-100 p-6 text-center">
                <span className="text-[11.5px] text-slate-400 font-semibold">Belum ada pengajuan pada periode ini.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {items.map((item) => {
                  const typeMeta = LEAVE_TYPES[item.leave_type] || LEAVE_TYPES.izin;
                  const statusMeta = STATUS_META[item.status] || STATUS_META.pengajuan;
                  const Icon = typeMeta.icon;
                  const days = countDays(item.start_date, item.end_date);
                  return (
                    <div key={item.leave_id} className="bg-white rounded-[20px] border border-slate-100 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
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
                            {formatDateShort(item.start_date)}
                            {item.end_date !== item.start_date ? ` – ${formatDateShort(item.end_date)}` : ''}
                            {' · '}{days} Hari
                          </span>
                        </div>
                      </div>

                      <p className="text-[11.5px] text-slate-500 font-medium mt-2.5 leading-relaxed">{item.reason}</p>

                      {item.status === 'ditolak' && item.rejection_note && (
                        <div className="mt-2 bg-red-50 border border-red-100 rounded-xl px-2.5 py-2 text-[11px] text-red-700 font-semibold">
                          Alasan ditolak: {item.rejection_note}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2">
                        {item.doctor_note_url && (
                          <button
                            onClick={() => setDoctorNoteItem(item)}
                            className="flex-1 h-[32px] rounded-[10px] border border-blue-200 bg-blue-50 text-blue-700 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                          >
                            <Eye className="w-3 h-3" /> Surat Dokter
                          </button>
                        )}
                        {item.status === 'pengajuan' && (
                          <>
                            <button
                              onClick={() => openEditForm(item)}
                              className="flex-1 h-[32px] rounded-[10px] border border-slate-200 bg-slate-50 text-slate-700 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => setCancelTarget(item)}
                              className="flex-1 h-[32px] rounded-[10px] border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                            >
                              <Trash2 className="w-3 h-3" /> Batalkan
                            </button>
                          </>
                        )}
                      </div>
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
                {editTarget ? 'Edit Pengajuan Izin' : 'Buat Pengajuan Izin Baru'}
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

              {/* Leave type */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Jenis Pengajuan</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(LEAVE_TYPES).map((t) => {
                    const Icon = t.icon;
                    const active = form.leaveType === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, leaveType: t.key }))}
                        className={`rounded-2xl border p-2.5 text-center transition-all ${active ? `${t.bg} ${t.color} border-current` : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                      >
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        <div className="text-[11px] font-black">{t.label}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10.5px] text-slate-400 font-medium mt-1.5">{LEAVE_TYPES[form.leaveType]?.desc}</p>
              </div>

              {/* Duration type */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Durasi</label>
                <select
                  value={form.durationType}
                  onChange={(e) => setForm((prev) => ({ ...prev, durationType: e.target.value }))}
                  className="w-full text-[12.5px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none"
                >
                  {Object.values(DURATION_TYPES).map((d) => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
                {form.durationType !== 'full_day' && (
                  <p className="text-[10.5px] text-blue-600 font-semibold mt-1.5">Izin setengah hari hanya berlaku untuk 1 hari.</p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                      endDate: isMultiDayAllowed ? prev.endDate : e.target.value
                    }))}
                    className="w-full text-[12.5px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate}
                    disabled={!isMultiDayAllowed}
                    onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full text-[12.5px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Keterangan</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  placeholder="Jelaskan alasan pengajuan (min. 5 karakter)"
                  className="w-full text-[12.5px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none resize-none"
                />
              </div>

              {/* Doctor note upload (only for sakit) */}
              {form.leaveType === 'sakit' && (
                <div>
                  <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Surat Keterangan Dokter</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handlePickFile}
                    className="hidden"
                  />
                  {form.doctorPreview || form.existingDoctorNoteUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                      <img
                        src={form.doctorPreview || form.existingDoctorNoteUrl}
                        alt="Surat dokter"
                        className="w-full max-h-[180px] object-contain bg-slate-50"
                      />
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
              )}

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

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-safe-modal">
          <div className="w-full max-w-[340px] bg-white rounded-[20px] overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,.3)]">
            <div className="px-5 pt-5 pb-3 text-center">
              <div className="w-14 h-14 rounded-[16px] bg-red-50 border-2 border-red-200 grid place-items-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-[15px] font-extrabold text-slate-900 mb-1.5">Batalkan Pengajuan?</div>
              <div className="text-[12.5px] text-slate-500 leading-[1.6] font-medium">
                Pengajuan <span className="font-bold text-slate-700">{LEAVE_TYPES[cancelTarget.leave_type]?.label}</span> ini akan dihapus permanen. Lanjutkan?
              </div>
            </div>
            <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="h-[42px] rounded-[12px] border border-slate-200 bg-white text-slate-700 text-[12.5px] font-extrabold transition hover:bg-slate-50"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                Batal
              </button>
              <button
                type="button"
                className="h-[42px] rounded-[12px] bg-red-500 text-white text-[12.5px] font-extrabold transition hover:bg-red-600 disabled:opacity-50"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Memproses...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor note preview modal */}
      {doctorNoteItem && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 px-3 py-safe-fullscreen"
          onClick={() => setDoctorNoteItem(null)}
        >
          <div
            className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[18px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-[13px] font-extrabold text-slate-900">Surat Keterangan Dokter</div>
              <button
                type="button"
                onClick={() => setDoctorNoteItem(null)}
                className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto hide-scrollbar">
              <img
                src={doctorNoteItem.doctor_note_url}
                alt="Surat keterangan dokter"
                className="w-full h-auto max-h-[72dvh] object-contain rounded-[12px] bg-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      <CameraCaptureModal
        open={cameraOpen}
        title="Ambil Foto Surat Dokter"
        onCapture={handleCameraCapture}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}
