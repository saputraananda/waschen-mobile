import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, ArrowLeft, Loader2, Package, RefreshCw } from 'lucide-react';
import formatName from '../../../utils/FormatName.js';
import { getHeaderSubtitle } from '../../../utils/getDisplayRole.js';
import fetchAssignedRole from '../../../utils/fetchAssignedRole.js';
import useSoftRefresh from '../../../hooks/useSoftRefresh.js';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';
import DataUpdatedModal from '../../../components/DataUpdatedModal.jsx';
import { setPageTitle } from '../../../utils/pageTitle.js';

const ROLES = [
  ['', 'Semua tim'],
  ['Frontliner', 'Frontliner'],
  ['Washing Staff', 'Tim Cuci'],
  ['Ironing Staff', 'Tim Setrika'],
  ['Packing Staff', 'Tim Packing'],
  ['Delivery Staff', 'Tim Delivery']
];

const api = axios.create({ baseURL: '/api', timeout: 20000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function fmtQty(n) {
  const v = parseFloat(n);
  if (Number.isNaN(v)) return '0';
  return v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function isLowStock(item) {
  const min = parseFloat(item?.min_stock);
  const qty = parseFloat(item?.qty_current);
  return Number.isFinite(min) && min > 0 && Number.isFinite(qty) && qty < min;
}

function initialRole() {
  try {
    const parsed = JSON.parse(localStorage.getItem('user') || 'null');
    const role = parsed?.assignedRole || '';
    return ROLES.some(([value]) => value === role) ? role : '';
  } catch {
    return '';
  }
}

export default function StockItems() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState({ fullName: 'Karyawan Waschen', position: 'Staff Waschen' });
  const [role, setRole] = useState(initialRole);
  const [search, setSearch] = useState('');
  const [outletName, setOutletName] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [mode, setMode] = useState('add');
  const [qtyInput, setQtyInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      return true;
    }
    return false;
  }, [navigate]);

  const load = useCallback(async () => {
    setError('');
    const res = await api.get('/inventory/mine', { params: role ? { role } : {} });
    const data = res.data?.data || {};
    const rows = data.items || [];
    setOutletName(data.outletName || '');
    setItems(rows);
  }, [role]);

  useEffect(() => {
    setPageTitle('Stok Barang');
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
        setError(err?.response?.data?.message || 'Gagal memuat stok');
      })
      .finally(() => setLoading(false));
  }, [load, handleAuthError]);

  const { refreshing, showUpdated, setShowUpdated, handleRefresh } = useSoftRefresh(load);
  useLockBodyScroll(Boolean(active));

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [items, search]);

  const openItem = (item) => {
    setActive(item);
    setMode('add');
    setQtyInput('');
    setError('');
  };

  const save = async () => {
    if (!active) return;
    const raw = qtyInput.trim();
    const qty = Number(raw);
    if (raw === '' || !Number.isFinite(qty) || qty < 0 || (mode === 'add' && qty <= 0)) {
      setError(mode === 'set' ? 'Isi sisa stok dengan angka' : 'Isi jumlah pemakaian dengan angka');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/inventory/opname', { item_id: active.item_id, qty, mode });
      const next = res.data?.data || {};
      const updated = { ...active, qty_today: next.qty_today, qty_current: next.qty_current };
      setItems((prev) => prev.map((row) => (row.item_id === active.item_id ? { ...row, ...updated } : row)));
      setActive(null);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err?.response?.data?.message || 'Gagal menyimpan stok');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[max(16px,env(safe-area-inset-bottom))]">

        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-safe-header pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            <Package className="absolute -top-2 left-2 w-20 h-20 text-white -rotate-12" />
            <Package className="absolute top-3 right-10 w-16 h-16 text-white rotate-12" />
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
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-white leading-snug truncate tracking-tight">
                {formatName(currentUser.fullName || currentUser.full_name)}
              </h2>
              <span className="text-[11px] text-pink-200/80 font-medium truncate block">
                {getHeaderSubtitle(currentUser)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-all disabled:opacity-60"
              aria-label="Muat ulang"
            >
              <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative z-10 text-center py-2">
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider block">Stock Opname</span>
            <span className="text-[22px] font-black text-white tracking-tight leading-tight block mt-0.5">
              Stok Barang
            </span>
          </div>
        </div>

        <div className="w-full relative">
          <div className="mx-4 -mt-6 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-5">
            <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tim</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 outline-none"
            >
              {ROLES.map(([value, label]) => (
                <option key={value || 'all'} value={value}>{label}</option>
              ))}
            </select>
            <label className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block mt-3 mb-2">Cari</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari barang"
              className="w-full text-[12px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 outline-none placeholder:font-medium placeholder:text-slate-400"
            />
            <p className="mt-2 text-[11px] text-slate-400 font-medium">
              {outletName || 'Outlet belum ditetapkan'}
            </p>
            {role ? (
              <button
                type="button"
                onClick={() => setRole('')}
                className="mt-3 w-full rounded-xl border border-[#5f1340]/30 bg-[#5f1340]/5 py-2.5 text-[12px] font-black text-[#5f1340] active:scale-[0.98]"
              >
                Tampilkan Semua Item
              </button>
            ) : null}
          </div>

          <div className="mx-4 mt-5">
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">Daftar Barang</span>
              <span className="text-[10px] text-slate-400 font-semibold">{loading ? '' : `${visibleItems.length} item`}</span>
            </div>

            {error ? (
              <div className="bg-rose-50 border border-rose-200 rounded-[16px] p-4 flex items-start gap-2 mb-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="text-[11.5px] text-rose-700 font-bold">{error}</span>
              </div>
            ) : null}

            {loading ? (
              <div className="bg-white rounded-[20px] border border-slate-100 p-8 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
                <span className="text-[11.5px] text-slate-400 font-bold">Memuat stok...</span>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="bg-white rounded-[20px] border border-slate-100 p-6 text-center">
                <span className="text-[11.5px] text-slate-400 font-semibold">
                  {search.trim() ? 'Barang tidak ditemukan.' : 'Tidak ada barang untuk tim ini.'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visibleItems.map((item) => (
                  <button
                    key={item.item_id}
                    type="button"
                    onClick={() => openItem(item)}
                    className="bg-white rounded-[20px] border border-slate-100 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] text-left active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[13px] font-black text-slate-800">{item.name}</span>
                      <span className={`text-[11px] font-bold flex-shrink-0 ${isLowStock(item) ? 'text-rose-600' : 'text-emerald-600'}`}>
                        Sisa {fmtQty(item.qty_current)} {item.unit || ''}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">
                      Pemakaian hari ini {fmtQty(item.qty_today)} {item.unit || ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DataUpdatedModal isOpen={showUpdated} onClose={() => setShowUpdated(false)} />

        {active ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-slate-900/40" onClick={() => !saving && setActive(null)}>
            <div
              className="w-full max-w-[430px] rounded-t-[28px] bg-white px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[15px] font-black text-slate-800">{active.name}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                <span className={isLowStock(active) ? 'text-rose-600' : 'text-emerald-600'}>
                  Sisa {fmtQty(active.qty_current)} {active.unit || ''}
                </span>
                {' · Hari ini '}{fmtQty(active.qty_today)}
              </p>
              <div className="mt-4 flex rounded-xl bg-slate-100 p-1">
                {[['add', 'Pemakaian'], ['set', 'Set']].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setMode(id); setQtyInput(''); setError(''); }}
                    className={`flex-1 rounded-lg py-2 text-[12px] font-black ${mode === id ? 'bg-white text-[#5f1340] shadow-sm' : 'text-slate-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {mode === 'set' ? 'Sisa stok sekarang' : 'Tambah pemakaian'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                placeholder="Isi dengan angka"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-bold text-slate-700 outline-none"
              />
              <p className="mt-2 text-[11px] font-medium text-slate-400">
                {mode === 'set'
                  ? 'Angka ini langsung menjadi sisa stok.'
                  : 'Ditambahkan ke pemakaian hari ini. 5 lalu 5 menjadi 10.'}
              </p>
              {error ? <p className="mt-2 text-[11px] font-bold text-rose-600">{error}</p> : null}
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="mt-4 w-full rounded-xl bg-[#5f1340] py-3 text-[13px] font-black text-white disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
