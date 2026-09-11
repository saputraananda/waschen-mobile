import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';
import formatName from '../../../utils/FormatName.js';
import getDisplayRole from '../../../utils/getDisplayRole.js';
import fetchAssignedRole from '../../../utils/fetchAssignedRole.js';
import { useRealtimeRefresh } from '../../../context/SocketContext.jsx';
import {
  ArrowLeft,
  Plus,
  Clock,
  AlertCircle,
  X,
  Loader2,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Timer,
  FileText
} from 'lucide-react';

/**
 * MEMORY LEMBUR (UI):
 * - Start / Close sesi (seperti absen), bukan buat pengajuan di muka
 * - Close → status pengajuan → ACC leader/Alsa
 * - Edit/hapus setelah close (sama flow lama)
 * - Leader: tab Persetujuan
 */

const api = axios.create({ baseURL: '/api', timeout: 45000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const STATUS_META = {
  berlangsung: { label: 'Berlangsung', cls: 'text-sky-800 bg-sky-50 border-sky-200' },
  pengajuan: { label: 'Pengajuan', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  disetujui: { label: 'Disetujui', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  ditolak: { label: 'Ditolak', cls: 'text-red-700 bg-red-50 border-red-200' },
  dibatalkan: { label: 'Dibatalkan', cls: 'text-slate-600 bg-slate-100 border-slate-200' }
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

const fmtTime = (t) => {
  if (!t) return '—';
  return String(t).slice(0, 5);
};

const emptyForm = () => ({
  overtime_date: todayISO(),
  start_time: '19:00',
  end_time: '20:00',
  reason: ''
});

export default function Overtime() {
  const navigate = useNavigate();
  const now = new Date();

  const [currentUser, setCurrentUser] = useState({ fullName: 'Karyawan Waschen', position: 'Staff Waschen' });
  const [isLeader, setIsLeader] = useState(false);

  const [mainTab, setMainTab] = useState('pengajuan');
  const [approvalFilter, setApprovalFilter] = useState('pengajuan');

  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [infoBanner, setInfoBanner] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [sessionBusy, setSessionBusy] = useState(false);

  useLockBodyScroll(formOpen || !!cancelTarget || !!reviewTarget);

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
    document.title = 'Lembur - Waschen Mobile';
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
        const leader = parsed.is_leader === 1 || parsed.is_leader === true || parsed.isLeader === 1 || parsed.is_leader === '1';
        setIsLeader(!!leader);
        if (!parsed.assignedRole) {
          fetchAssignedRole(token).then((role) => {
            if (role) setCurrentUser((prev) => ({ ...prev, assignedRole: role }));
          });
        }
      } catch (_) { /* ignore */ }
    }
    api.get('/overtime/me-meta')
      .then((res) => {
        if (res.data?.data) setIsLeader(!!res.data.data.is_leader);
      })
      .catch(() => {});
  }, [navigate]);

  const tabs = useMemo(() => {
    const base = [
      { key: 'pengajuan', label: 'Pengajuan' },
      { key: 'riwayat', label: 'Riwayat' }
    ];
    if (isLeader) base.push({ key: 'persetujuan', label: 'Persetujuan' });
    return base;
  }, [isLeader]);

  const fetchActive = useCallback(async () => {
    try {
      const res = await api.get('/overtime/active');
      setActiveSession(res.data?.data || null);
    } catch {
      setActiveSession(null);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      if (mainTab === 'persetujuan') {
        const res = await api.get('/overtime/approvals', {
          params: { filter: approvalFilter, month: filterMonth, year: filterYear }
        });
        setItems(res.data?.data || []);
      } else {
        const res = await api.get('/overtime/list', {
          params: {
            scope: mainTab === 'pengajuan' ? 'pengajuan' : 'riwayat',
            month: filterMonth,
            year: filterYear
          }
        });
        setItems(res.data?.data || []);
      }
      await fetchActive();
    } catch (err) {
      if (handleAuthError(err)) return;
      setListError(err.response?.data?.message || 'Gagal memuat data lembur');
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, [mainTab, approvalFilter, filterMonth, filterYear, handleAuthError, fetchActive]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Realtime: ACC leader/Alsa / edit karyawan lain di outlet → auto refetch
  useRealtimeRefresh('overtime', fetchList);

  const handleStartSession = async () => {
    if (sessionBusy) return;
    setSessionBusy(true);
    setListError(null);
    try {
      const res = await api.post('/overtime/start');
      setActiveSession(res.data?.data || null);
      setInfoBanner(res.data?.message || 'Sesi lembur dimulai');
      fetchList();
    } catch (err) {
      if (handleAuthError(err)) return;
      setListError(err.response?.data?.message || 'Gagal start lembur');
    } finally {
      setSessionBusy(false);
    }
  };

  const handleEndSession = async () => {
    if (sessionBusy) return;
    setSessionBusy(true);
    setListError(null);
    try {
      const res = await api.post('/overtime/end');
      setActiveSession(null);
      setInfoBanner(res.data?.message || 'Sesi lembur ditutup — menunggu ACC leader');
      setMainTab('pengajuan');
      fetchList();
    } catch (err) {
      if (handleAuthError(err)) return;
      setListError(err.response?.data?.message || 'Gagal close lembur');
    } finally {
      setSessionBusy(false);
    }
  };

  const stats = useMemo(() => {
    const s = { pengajuan: 0, disetujui: 0, ditolak: 0, berlangsung: 0 };
    items.forEach((it) => {
      if (it.status === 'pengajuan') s.pengajuan += 1;
      else if (it.status === 'disetujui') s.disetujui += 1;
      else if (it.status === 'ditolak') s.ditolak += 1;
      else if (it.status === 'berlangsung') s.berlangsung += 1;
    });
    return s;
  }, [items]);

  const monthOptions = useMemo(
    () => MONTH_NAMES.map((label, idx) => ({ value: idx + 1, label })),
    []
  );

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  const openCreate = () => {
    // Diganti start session — tetap buka form hanya untuk edit
    setEditing(null);
    setForm(emptyForm());
    setSubmitError(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    if (row.status === 'berlangsung') return;
    setEditing(row);
    setForm({
      overtime_date: row.overtime_date || todayISO(),
      start_time: fmtTime(row.start_time),
      end_time: fmtTime(row.end_time),
      reason: row.reason || ''
    });
    setSubmitError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setEditing(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!editing) {
      setSubmitError('Gunakan tombol Start Lembur untuk memulai sesi');
      return;
    }
    if (!form.reason || form.reason.trim().length < 5) {
      setSubmitError('Alasan lembur wajib diisi minimal 5 karakter');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        overtime_date: form.overtime_date,
        start_time: form.start_time,
        end_time: form.end_time,
        reason: form.reason.trim()
      };
      const res = await api.put(`/overtime/${editing.id}`, payload);
      if (res.data?.reset_to_pengajuan) {
        setInfoBanner(res.data.message);
      }
      closeForm();
      fetchList();
    } catch (err) {
      if (handleAuthError(err)) return;
      setSubmitError(err.response?.data?.message || 'Gagal menyimpan perubahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setSubmitting(true);
    try {
      await api.delete(`/overtime/${cancelTarget.id}`);
      setCancelTarget(null);
      fetchList();
    } catch (err) {
      if (handleAuthError(err)) return;
      setListError(err.response?.data?.message || 'Gagal membatalkan');
      setCancelTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (reviewTarget.mode === 'approve') {
        await api.patch(`/overtime/${reviewTarget.row.id}/approve`, {
          approval_note: reviewNote.trim() || undefined
        });
      } else {
        if (reviewNote.trim().length < 3) {
          setSubmitError('Alasan penolakan wajib diisi');
          setSubmitting(false);
          return;
        }
        await api.patch(`/overtime/${reviewTarget.row.id}/reject`, {
          rejection_note: reviewNote.trim()
        });
      }
      setReviewTarget(null);
      setReviewNote('');
      fetchList();
    } catch (err) {
      if (handleAuthError(err)) return;
      setSubmitError(err.response?.data?.message || 'Gagal memproses');
    } finally {
      setSubmitting(false);
    }
  };

  const canEditRow = (row) =>
    mainTab !== 'persetujuan' && (row.status === 'pengajuan' || row.status === 'disetujui');

  const listTitle =
    mainTab === 'persetujuan'
      ? 'Persetujuan Lembur Cabang'
      : mainTab === 'pengajuan'
        ? 'Sesi & Pengajuan Saya'
        : 'Riwayat Lembur Saya';

  const activePastMidnight = Boolean(activeSession?.past_midnight);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[max(16px,env(safe-area-inset-bottom))]">

        {/* HERO HEADER — sama style Kasbon/Leave */}
        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-safe-header pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            <Timer className="absolute -top-2 left-2 w-20 h-20 text-white -rotate-12" />
            <Clock className="absolute top-3 right-10 w-16 h-16 text-white rotate-12" />
          </div>
          <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />

          <div className="flex items-center gap-3 relative z-10 mb-5 min-w-0">
            <button
              type="button"
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
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider block">Sesi Kerja Lembur</span>
            <span className="text-[22px] font-black text-white tracking-tight leading-tight block mt-0.5">
              Lembur
            </span>
          </div>
        </div>

        {/* CONTENT */}
        <div className="w-full relative">

          {/* Filter + tabs + stats + CTA */}
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

            <div className="flex gap-1.5 bg-slate-50 border border-slate-100 p-1 rounded-2xl mb-3">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMainTab(t.key)}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold transition ${
                    mainTab === t.key
                      ? 'bg-[#5f1340] text-white shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {mainTab === 'persetujuan' && (
              <div className="flex gap-1.5 mb-3 overflow-x-auto hide-scrollbar">
                {[
                  { key: 'pengajuan', label: 'Pengajuan' },
                  { key: 'disetujui', label: 'Disetujui' },
                  { key: 'ditolak', label: 'Ditolak' }
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setApprovalFilter(f.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10.5px] font-bold border transition ${
                      approvalFilter === f.key
                        ? 'bg-[#5f1340] text-white border-[#5f1340]'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-2.5 text-center">
                <FileText className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                <div className="text-[16px] font-black text-blue-700">{stats.pengajuan}</div>
                <div className="text-[9.5px] text-slate-400 font-bold">Pengajuan</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-2.5 text-center">
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                <div className="text-[16px] font-black text-emerald-700">{stats.disetujui}</div>
                <div className="text-[9.5px] text-slate-400 font-bold">Disetujui</div>
              </div>
              <div className="rounded-2xl border border-red-100 bg-red-50 p-2.5 text-center">
                <XCircle className="w-4 h-4 mx-auto mb-1 text-red-600" />
                <div className="text-[16px] font-black text-red-700">{stats.ditolak}</div>
                <div className="text-[9.5px] text-slate-400 font-bold">Ditolak</div>
              </div>
            </div>

            {mainTab !== 'persetujuan' && (
              <div className="space-y-2.5">
                {activeSession ? (
                  <div className={`rounded-[18px] border p-3.5 ${
                    activePastMidnight
                      ? 'border-rose-300 bg-rose-50'
                      : 'border-sky-200 bg-sky-50'
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[11px] font-black uppercase tracking-wide ${
                        activePastMidnight ? 'text-rose-700' : 'text-sky-800'
                      }`}>
                        {activePastMidnight ? 'Belum close (ganti hari)' : 'Sesi berlangsung'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600">
                        Mulai {fmtTime(activeSession.start_time)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium mb-3 leading-relaxed">
                      Kerjaan Anda tercatat sebagai lembur sampai close. Setelah close bisa edit jam/alasan.
                    </p>
                    <button
                      type="button"
                      disabled={sessionBusy}
                      onClick={handleEndSession}
                      className={`w-full py-3.5 rounded-[16px] text-white text-[13.5px] font-black disabled:opacity-50 flex items-center justify-center gap-2 ${
                        activePastMidnight ? 'bg-rose-600' : 'bg-sky-700'
                      }`}
                    >
                      {sessionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Timer className="w-4 h-4" />}
                      Close Lembur
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={sessionBusy}
                    onClick={handleStartSession}
                    className="w-full py-3.5 rounded-[18px] bg-[#5f1340] hover:bg-[#4d0f34] text-white text-[13.5px] font-black shadow-md shadow-[#5f1340]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {sessionBusy ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Plus className="w-4.5 h-4.5" />}
                    <span>Start Lembur</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {infoBanner && (
            <div className="mx-4 mt-3 rounded-[16px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11.5px] text-amber-800 font-semibold flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p>{infoBanner}</p>
                <button type="button" className="mt-1 text-[10.5px] font-extrabold underline" onClick={() => setInfoBanner(null)}>
                  Tutup
                </button>
              </div>
            </div>
          )}

          <div className="mx-4 mt-3 rounded-[16px] border border-slate-100 bg-white px-3.5 py-2.5 text-[10.5px] text-slate-500 leading-relaxed font-medium">
            <span className="font-extrabold text-slate-600">Alur:</span> Start → kerja tercatat lembur → Close → status Pengajuan → ACC leader.
            Jika ditolak, kerjaan dianggap sukarela (bukan KPI lembur). Lupa close sampai ganti hari akan mengunci menu lain.
          </div>

          {/* LIST */}
          <div className="mx-4 mt-5 mb-4">
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">{listTitle}</span>
              <span className="text-[10px] text-slate-400 font-semibold">
                {monthOptions.find((m) => m.value === filterMonth)?.label} {filterYear}
              </span>
            </div>

            {loadingList ? (
              <div className="bg-white rounded-[20px] border border-slate-100 p-8 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
                <span className="text-[11.5px] text-slate-400 font-bold">Memuat data...</span>
              </div>
            ) : listError ? (
              <div className="bg-rose-50 border border-rose-200 rounded-[16px] p-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11.5px] text-rose-700 font-bold block">{listError}</span>
                  <button type="button" onClick={fetchList} className="text-[10.5px] text-rose-600 font-extrabold mt-1 underline">
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
                {items.map((row) => {
                  const statusMeta = STATUS_META[row.status] || STATUS_META.pengajuan;
                  return (
                    <div key={row.id} className="bg-white rounded-[20px] border border-slate-100 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10.5 h-10.5 rounded-2xl border border-sky-100 bg-sky-50 text-sky-700 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-black text-slate-800 truncate">
                              {mainTab === 'persetujuan'
                                ? formatName(row.employee_name || `#${row.employee_id}`)
                                : 'Lembur'}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusMeta.cls}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                            {formatDateShort(row.overtime_date)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 bg-slate-50 rounded-[12px] p-3 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Jam Lembur</div>
                        <div className="text-[18px] font-bold text-slate-900">
                          {fmtTime(row.start_time)} – {fmtTime(row.end_time)}
                        </div>
                      </div>

                      <p className="text-[11.5px] text-slate-500 font-medium mt-2.5 leading-relaxed">{row.reason}</p>

                      {row.approval_note && (
                        <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-xl px-2.5 py-2 text-[11px] text-emerald-800 font-semibold">
                          Catatan persetujuan: {row.approval_note}
                        </div>
                      )}
                      {row.rejection_note && (
                        <div className="mt-2 bg-red-50 border border-red-100 rounded-xl px-2.5 py-2 text-[11px] text-red-700 font-semibold">
                          Alasan ditolak: {row.rejection_note}
                        </div>
                      )}
                      {row.reviewed_by_name && (
                        <div className="mt-2 text-[10.5px] text-slate-400 font-medium">
                          Review: {formatName(row.reviewed_by_name)}
                        </div>
                      )}

                      {mainTab === 'persetujuan' && row.status === 'pengajuan' && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setReviewTarget({ row, mode: 'approve' }); setReviewNote(''); setSubmitError(null); }}
                            className="flex-1 h-[32px] rounded-[10px] border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => { setReviewTarget({ row, mode: 'reject' }); setReviewNote(''); setSubmitError(null); }}
                            className="flex-1 h-[32px] rounded-[10px] border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                          >
                            <XCircle className="w-3 h-3" /> Tolak
                          </button>
                        </div>
                      )}

                      {row.status === 'berlangsung' && mainTab !== 'persetujuan' && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={handleEndSession}
                            disabled={sessionBusy}
                            className="flex-1 h-[32px] rounded-[10px] border border-sky-200 bg-sky-50 text-sky-800 text-[10.5px] font-bold flex items-center justify-center gap-1"
                          >
                            <Timer className="w-3 h-3" /> Close
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelTarget(row)}
                            className="flex-1 h-[32px] rounded-[10px] border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-bold flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Batalkan
                          </button>
                        </div>
                      )}

                      {canEditRow(row) && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="flex-1 h-[32px] rounded-[10px] border border-slate-200 bg-slate-50 text-slate-700 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelTarget(row)}
                            className="flex-1 h-[32px] rounded-[10px] border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-bold flex items-center justify-center gap-1 active:scale-[.98] transition"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </div>
                      )}

                      <div className="mt-2 text-[10.5px] text-slate-400">{formatDateTime(row.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FORM MODAL — bottom sheet style Kasbon */}
      {formOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-safe-overlay"
          onClick={closeForm}
        >
          <div
            className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[20px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="text-[14px] font-extrabold text-slate-900">
                Edit Jam / Alasan Lembur
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
              {editing?.status === 'disetujui' && (
                <div className="bg-amber-50 border border-amber-200 rounded-[14px] p-3 text-[11.5px] text-amber-800 font-semibold">
                  Mengedit lembur yang sudah disetujui akan mengembalikan status ke <strong>Pengajuan</strong> dan membutuhkan ACC leader ulang.
                </div>
              )}

              {submitError && (
                <div className="bg-rose-50 border border-rose-200 rounded-[14px] p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span className="text-[11.5px] text-rose-700 font-semibold">{submitError}</span>
                </div>
              )}

              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tanggal Lembur</label>
                <input
                  type="date"
                  required
                  value={form.overtime_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, overtime_date: e.target.value }))}
                  className="w-full text-[12.5px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Jam Mulai</label>
                  <input
                    type="time"
                    required
                    value={form.start_time}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="w-full text-[12.5px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Jam Selesai</label>
                  <input
                    type="time"
                    required
                    value={form.end_time}
                    onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full text-[12.5px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Alasan Lembur</label>
                <textarea
                  required
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Jelaskan alasan lembur (min. 5 karakter)"
                  className="w-full text-[12.5px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-[18px] bg-[#5f1340] hover:bg-[#4d0f34] text-white text-[13.5px] font-black shadow-md shadow-[#5f1340]/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                Simpan Perubahan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cancel confirm */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6" onClick={() => setCancelTarget(null)}>
          <div className="w-full max-w-sm bg-white rounded-[20px] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-extrabold text-slate-900">Batalkan lembur?</h3>
            <p className="mt-2 text-[12px] text-slate-500 font-medium leading-relaxed">
              Item yang sudah dikerjakan di slot ini tidak akan dihitung sebagai KPI lembur.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-2.5 rounded-[14px] border border-slate-200 text-[12px] font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-[14px] bg-red-600 text-white text-[12px] font-bold disabled:opacity-50"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          onClick={() => setReviewTarget(null)}
        >
          <div
            className="w-full max-w-[430px] bg-white rounded-[20px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-[14px] font-extrabold text-slate-900">
                {reviewTarget.mode === 'approve' ? 'Setujui Lembur' : 'Tolak Lembur'}
              </div>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[12px] text-slate-600 font-medium">
                {formatName(reviewTarget.row.employee_name)} · {formatDateShort(reviewTarget.row.overtime_date)} ·{' '}
                {fmtTime(reviewTarget.row.start_time)}–{fmtTime(reviewTarget.row.end_time)}
              </p>
              <div>
                <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
                  {reviewTarget.mode === 'approve' ? 'Catatan (opsional)' : 'Alasan tolak (wajib)'}
                </label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={reviewTarget.mode === 'approve' ? 'Catatan untuk karyawan...' : 'Alasan penolakan...'}
                  className="w-full text-[12.5px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none resize-none"
                />
              </div>
              {submitError && (
                <div className="bg-rose-50 border border-rose-200 rounded-[14px] p-3 text-[11.5px] text-rose-700 font-semibold">
                  {submitError}
                </div>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={handleReview}
                className={`w-full py-3.5 rounded-[18px] text-white text-[13.5px] font-black disabled:opacity-50 ${
                  reviewTarget.mode === 'approve' ? 'bg-emerald-600' : 'bg-red-600'
                }`}
              >
                {submitting ? 'Memproses...' : reviewTarget.mode === 'approve' ? 'Setujui' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
