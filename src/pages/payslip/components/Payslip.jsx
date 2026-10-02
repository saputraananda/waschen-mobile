import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Download, Eye, Receipt, RefreshCw, X } from 'lucide-react';
import formatName from '../../../utils/FormatName.js';
import { getHeaderSubtitle } from '../../../utils/getDisplayRole.js';
import fetchAssignedRole from '../../../utils/fetchAssignedRole.js';
import useSoftRefresh from '../../../hooks/useSoftRefresh.js';
import DataUpdatedModal from '../../../components/DataUpdatedModal.jsx';
import { setPageTitle } from '../../../utils/pageTitle.js';

const api = axios.create({ baseURL: '/api', timeout: 20000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function monthLabel(ym) {
  const [y, m] = String(ym || '').split('-');
  const name = MONTH_NAMES[Number(m) - 1];
  if (!name || !y) return ym || '-';
  return `${name} ${y}`;
}

export default function Payslip() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState({});
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token');
      navigate('/login');
      return true;
    }
    return false;
  }, [navigate]);

  const load = useCallback(async () => {
    const res = await api.get('/payslips');
    setSlips(res.data?.data || []);
    setError('');
  }, []);

  useEffect(() => {
    setPageTitle('Slip Gaji');
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser(parsed);
        if (!parsed.assignedRole) {
          fetchAssignedRole(token).then((assigned) => {
            if (assigned) setCurrentUser((prev) => ({ ...prev, assignedRole: assigned }));
          });
        }
      } catch (_) { /* ignore */ }
    }
  }, [navigate]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => {
        if (handleAuthError(err)) return;
        setError(err?.response?.data?.message || 'Gagal memuat slip gaji');
      })
      .finally(() => setLoading(false));
  }, [load, handleAuthError]);

  const { refreshing, showUpdated, setShowUpdated, handleRefresh } = useSoftRefresh(load);

  const periods = useMemo(() => {
    const set = new Set(slips.map((s) => String(s.payslip_month || '')).filter((p) => /^\d{4}-\d{2}$/.test(p)));
    return [...set].sort().reverse();
  }, [slips]);

  const years = useMemo(() => [...new Set(periods.map((p) => p.slice(0, 4)))], [periods]);

  const months = useMemo(
    () => periods.filter((p) => p.startsWith(`${filterYear}-`)).map((p) => p.slice(5, 7)),
    [periods, filterYear]
  );

  useEffect(() => {
    if (!years.length) return;
    if (!years.includes(filterYear)) setFilterYear(years[0]);
  }, [years, filterYear]);

  useEffect(() => {
    if (filterMonth && !months.includes(filterMonth)) setFilterMonth('');
  }, [months, filterMonth]);

  const visible = slips.filter((slip) => {
    const period = String(slip.payslip_month || '');
    if (filterYear && !period.startsWith(`${filterYear}-`)) return false;
    if (filterMonth && !period.endsWith(`-${filterMonth}`)) return false;
    return true;
  });

  const fetchSlip = async (slip) => {
    const res = await api.get(`/payslips/${slip.id}/file`, { responseType: 'blob' });
    const name = slip.file_name || 'slip-gaji';
    const type = res.data?.type || '';
    const isPdf = type.includes('pdf') || name.toLowerCase().endsWith('.pdf');
    return { blob: res.data, name, isPdf };
  };

  const closePreview = () => {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const viewSlip = async (slip) => {
    setBusyId(slip.id);
    setError('');
    try {
      const file = await fetchSlip(slip);
      setPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return {
          url: URL.createObjectURL(file.blob),
          name: file.name,
          title: monthLabel(slip.payslip_month),
          isPdf: file.isPdf
        };
      });
    } catch (err) {
      if (!handleAuthError(err)) setError('Gagal membuka slip gaji');
    } finally {
      setBusyId(null);
    }
  };

  const downloadSlip = async (slip) => {
    setBusyId(slip.id);
    setError('');
    try {
      const file = await fetchSlip(slip);
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      if (!handleAuthError(err)) setError('Gagal mengunduh slip gaji');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-200/70 flex justify-center items-start">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col pb-8">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#3a0b28] via-[#5f1340] to-[#8a245c] px-4 pt-5 pb-8">
          <Receipt className="absolute top-3 right-10 w-16 h-16 text-white rotate-12 opacity-20" />
          <div className="flex items-center gap-3 relative z-10 mb-5 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-white truncate">
                {formatName(currentUser.fullName || currentUser.full_name || '')}
              </h2>
              <span className="text-[11px] text-pink-200/80 font-medium truncate block">
                {getHeaderSubtitle(currentUser)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center disabled:opacity-60"
              aria-label="Muat ulang"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="relative z-10 text-center py-2">
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider block">Waschen Laundry</span>
            <span className="text-[22px] font-black text-white tracking-tight block mt-0.5">Slip Gaji</span>
          </div>
        </div>

        <div className="px-4 -mt-4 relative z-10 space-y-3">
          {!loading && years.length > 0 && (
            <div className="bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="flex-1 text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none"
                >
                  <option value="">Semua bulan</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{MONTH_NAMES[Number(m) - 1]}</option>
                  ))}
                </select>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-[92px] text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}
          {loading ? (
            <div className="rounded-2xl bg-white border border-slate-100 p-4 text-sm text-slate-500">Memuat slip gaji…</div>
          ) : slips.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-100 p-4 text-sm text-slate-500">Belum ada slip gaji.</div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-100 p-4 text-sm text-slate-500">Tidak ada slip di periode ini.</div>
          ) : (
            visible.map((slip) => (
              <div
                key={slip.id}
                className="w-full rounded-2xl bg-white border border-slate-100 px-4 py-3 flex items-center justify-between gap-3 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800">{monthLabel(slip.payslip_month)}</p>
                  <p className="text-[11px] text-slate-400 truncate">{slip.file_name || 'Slip gaji'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="Lihat"
                    disabled={busyId === slip.id}
                    onClick={() => viewSlip(slip)}
                    className="w-9 h-9 rounded-xl text-[#5f1340] flex items-center justify-center disabled:opacity-50"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    title="Unduh"
                    disabled={busyId === slip.id}
                    onClick={() => downloadSlip(slip)}
                    className="w-9 h-9 rounded-xl text-[#5f1340] flex items-center justify-center disabled:opacity-50"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <DataUpdatedModal isOpen={showUpdated} onClose={() => setShowUpdated(false)} />
        {preview && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-3" onClick={closePreview}>
            <div className="w-full max-w-[430px] max-h-[88vh] bg-white rounded-[18px] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-extrabold text-slate-900 truncate">{preview.title}</p>
                  <p className="text-[11px] text-slate-400 truncate">{preview.name}</p>
                </div>
                <button type="button" onClick={closePreview} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-600 flex items-center justify-center" aria-label="Tutup">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-slate-50 min-h-[50vh] flex-1">
                {preview.isPdf ? (
                  <iframe title={preview.title} src={preview.url} className="w-full h-[70vh]" />
                ) : (
                  <img src={preview.url} alt={preview.title} className="w-full max-h-[70vh] object-contain p-3" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
