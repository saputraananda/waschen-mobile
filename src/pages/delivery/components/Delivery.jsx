import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, RefreshCw, PackageOpen,
  MapPin, Phone, ChevronRight, Scale, Shirt, AlertTriangle, PauseOctagon,
  CheckCircle2, PackageSearch, Search, ScanLine, X
} from 'lucide-react';
import formatName from '../../../utils/FormatName.js';
import getDisplayRole from '../../../utils/getDisplayRole.js';
import fetchAssignedRole from '../../../utils/fetchAssignedRole.js';
import { api, formatDateTime, isKiloanItem } from '../../../utils/produksiShared.js';
import {
  extractNotaSearchKey,
  evaluateNotaForStage,
  STAGE_ITEM_STATUS
} from '../../../utils/notaScan.js';
import ItemQCSheet from '../../produksi/components/ItemQCSheet.jsx';
import TransactionDetailModal from '../../produksi/components/TransactionDetailModal.jsx';
import BarcodeScannerModal from '../../../components/BarcodeScannerModal.jsx';
import ConfirmModal from '../../../components/ConfirmModal.jsx';
import { setPageTitle } from '../../../utils/pageTitle.js';
import { useRealtimeRefresh } from '../../../context/SocketContext.jsx';

const DELIVERY_ROLE = 'Delivery Staff';

function MotorbikeIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path d="M8 17.5h5.5l1.2-3.2H18" />
      <path d="M12 8.5h3.2L18 14.3" />
      <path d="M8.2 14.3 10 10h2.8" />
      <path d="M5.5 15.2 8 10.5l1.2-2H12" />
    </svg>
  );
}

const TABS = [
  { key: 'pickup', label: 'Pickup', icon: PackageOpen, stageKey: 'frontliner', stageLabel: 'Pickup QC' },
  { key: 'delivery', label: 'Delivery', icon: MotorbikeIcon, stageKey: 'delivery', stageLabel: 'Delivery QC' }
];

function openGoogleMaps(address) {
  const query = String(address || '').trim();
  if (!query || query === '-') return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function AddressBlock({ txn }) {
  const address =
    txn.delivery_address ||
    txn.delivery_address_full ||
    txn.full_address ||
    txn.address ||
    '-';
  const landmark = txn.landmark ? String(txn.landmark).trim() : '';
  const notes = txn.delivery_notes ? String(txn.delivery_notes).trim() : '';
  const canOpenMaps = Boolean(address && address !== '-');

  return (
    <div className="mt-2.5 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5">
      <button   
        type="button"
        disabled={!canOpenMaps}
        onClick={(e) => {
          e.stopPropagation();
          openGoogleMaps(address);
        }}
        className={`w-full text-left flex items-start gap-2 ${
          canOpenMaps ? 'active:opacity-70' : 'cursor-default'
        }`}
        aria-label={canOpenMaps ? 'Buka alamat di Google Maps' : undefined}
      >
        <MapPin className="w-3.5 h-3.5 text-[#5f1340] mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-bold leading-snug whitespace-pre-line ${
            canOpenMaps ? 'text-[#5f1340] underline underline-offset-2 decoration-[#5f1340]/30' : 'text-slate-700'
          }`}>
            {address}
          </p>
          {landmark && (
            <p className="text-[10px] text-slate-500 font-medium mt-1">
              Landmark: {landmark}
            </p>
          )}
          {notes && (
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
              Catatan: {notes}
            </p>
          )}
          {canOpenMaps && (
            <p className="text-[9.5px] text-slate-400 font-semibold mt-1">
              Ketuk untuk buka Google Maps
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

function DeliveryCard({ txn, tab, onOpen, onItemClick }) {
  const isPickup = tab === 'pickup';
  const pendingQcItems = (txn.items || []).filter((it) =>
    isPickup ? it.item_work_status === 'Antrean' : it.item_work_status === 'Siap Diantar'
  );
  const inTransitItems = isPickup
    ? []
    : (txn.items || []).filter((it) => it.item_work_status === 'Sedang Diantar');
  const hasFinding = !!txn.has_finding;
  const hasHold = !!txn.has_hold;
  const isLunas = String(txn.payment_status || '') === 'Lunas';
  const badgeLabel = isPickup
    ? 'PICKUP QC'
    : inTransitItems.length && !pendingQcItems.length
      ? 'SEDANG DIANTAR'
      : pendingQcItems.length && inTransitItems.length
        ? 'QC / ANTAR'
        : 'SIAP ANTAR';

  return (
    <div
      className={`w-full bg-white rounded-[20px] border shadow-[0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden ${
        hasFinding ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(txn)}
        className="w-full text-left p-4 active:bg-slate-50 transition"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-black text-slate-800 truncate">{txn.order_no}</span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                badgeLabel === 'SEDANG DIANTAR'
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'bg-[#5f1340]/8 text-[#5f1340] border-[#5f1340]/15'
              }`}>
                {badgeLabel}
              </span>
              {!isPickup && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                  isLunas
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {isLunas ? 'LUNAS' : 'BELUM LUNAS'}
                </span>
              )}
              {hasFinding && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
              {hasHold && <PauseOctagon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5 truncate">
              {formatName(txn.customer_name) || 'Customer'} · {formatDateTime(txn.order_date)}
            </span>
            {txn.customer_phone && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold mt-1">
                <Phone className="w-3 h-3" /> {txn.customer_phone}
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
        </div>

        <AddressBlock txn={txn} />

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {(txn.items || []).map((item) => (
            <span
              key={item.id}
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${
                Number(item.has_finding) === 1
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : item.item_work_status === 'Sedang Diantar'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : Number(item.is_on_hold) === 1
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {isKiloanItem(item) ? <Scale className="w-3 h-3" /> : <Shirt className="w-3 h-3" />}
              {item.service_name} · {Number(item.qty)} {item.unit}
              {item.item_work_status === 'Sedang Diantar' ? ' · antar' : ''}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10.5px] text-slate-400 font-semibold">
            {isPickup
              ? `${txn.stage_pending_items} dari ${txn.total_items} item belum QC`
              : pendingQcItems.length
                ? `${pendingQcItems.length} item menunggu QC final`
                : `${inTransitItems.length} item siap serah terima`}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#5f1340]"
                style={{ width: `${txn.qc_progress_pct}%` }}
              />
            </div>
            <span className="text-[10px] font-extrabold text-slate-500">{txn.qc_progress_pct}%</span>
          </div>
        </div>
      </button>

      {pendingQcItems.length > 0 && (
        <div className="mx-3 mb-3 bg-slate-50 rounded-[14px] border border-slate-200/80 p-2 flex flex-col gap-1.5">
          {pendingQcItems.map((item) => {
            const isHold = Number(item.is_on_hold) === 1;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isHold}
                onClick={() => onItemClick({ txn, item, stage: isPickup ? 'frontliner' : 'delivery' })}
                className={`text-left pl-2.5 pr-3 py-2.5 rounded-[11px] border text-[11.5px] font-bold flex items-center gap-2.5 transition active:scale-[.98] ${
                  isHold
                    ? 'bg-amber-50 text-amber-700 border-amber-200 opacity-80'
                    : 'bg-white text-slate-700 border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                }`}
              >
                <span className={`w-7 h-7 rounded-[9px] grid place-items-center flex-shrink-0 ${
                  isHold ? 'bg-amber-100 text-amber-600' : 'bg-[#5f1340]/10 text-[#5f1340]'
                }`}>
                  {isHold ? <PauseOctagon className="w-3.5 h-3.5" /> : isKiloanItem(item) ? <Scale className="w-3.5 h-3.5" /> : <Shirt className="w-3.5 h-3.5" />}
                </span>
                <span className="flex-1 min-w-0 truncate">
                  {item.service_name} · {Number(item.qty)} {item.unit}
                </span>
                <span className={`text-[9.5px] font-black flex-shrink-0 px-2 py-1 rounded-full ${
                  isHold ? 'bg-amber-200/60 text-amber-800' : 'bg-[#5f1340] text-white'
                }`}>
                  {isHold ? 'HOLD' : 'QC →'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!isPickup && inTransitItems.length > 0 && (
        <div className="mx-3 mb-3 bg-orange-50/70 rounded-[14px] border border-orange-100 p-2 flex flex-col gap-1.5">
          {inTransitItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick({ txn, item, stage: 'handover' })}
              className="text-left pl-2.5 pr-3 py-2 rounded-[11px] border border-orange-100 bg-white text-[11.5px] font-bold text-orange-800 flex items-center gap-2.5 transition active:scale-[.98] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <span className="w-7 h-7 rounded-[9px] grid place-items-center flex-shrink-0 bg-orange-100 text-orange-600">
                {isKiloanItem(item) ? <Scale className="w-3.5 h-3.5" /> : <Shirt className="w-3.5 h-3.5" />}
              </span>
              <span className="flex-1 min-w-0 truncate">
                {item.service_name} · {Number(item.qty)} {item.unit}
              </span>
              <span className="text-[9.5px] font-black flex-shrink-0 px-2 py-1 rounded-full bg-orange-500 text-white">
                Selesai →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Delivery() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState({ fullName: 'Karyawan Waschen', role: null });
  const [tab, setTab] = useState('pickup'); // pickup | delivery
  const [summary, setSummary] = useState({ pickup: {}, delivery: {} });
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [qcTarget, setQcTarget] = useState(null);
  const [detailTxnId, setDetailTxnId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState(null);
  const searchDebounceRef = useRef(null);
  const skipSearchEffectRef = useRef(false);

  const activeTabMeta = TABS.find((t) => t.key === tab) || TABS[0];
  const qcStage = activeTabMeta.stageKey;
  const waitingStatus = STAGE_ITEM_STATUS[qcStage];
  const role = currentUser.role;

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      return true;
    }
    return false;
  }, [navigate]);

  useEffect(() => {
    setPageTitle('Delivery');
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const stored = localStorage.getItem('user');
    let parsed = null;
    if (stored) {
      try { parsed = JSON.parse(stored); } catch (_) { /* ignore */ }
    }
    const displayRole = getDisplayRole(parsed);
    const fullName = parsed?.fullName || parsed?.name || 'Karyawan Waschen';
    if (displayRole) {
      setCurrentUser({ fullName, role: displayRole });
      if (displayRole !== DELIVERY_ROLE) navigate('/', { replace: true });
    } else {
      fetchAssignedRole(token).then((r) => {
        setCurrentUser({ fullName, role: r });
        if (r !== DELIVERY_ROLE) navigate('/', { replace: true });
      });
    }
  }, [navigate]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const endpoint = tab === 'pickup' ? '/delivery/pickup' : '/delivery/ready';
      const [summaryRes, listRes] = await Promise.allSettled([
        api.get('/delivery/summary'),
        api.get(endpoint)
      ]);
      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data?.data || { pickup: {}, delivery: {} });
      }
      if (listRes.status === 'fulfilled') {
        setTxns(listRes.value.data?.data || []);
      } else {
        throw listRes.reason;
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err?.response?.data?.message || err.message || 'Gagal memuat data');
      setTxns([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab, handleAuthError]);

  const runSearch = useCallback(async (q) => {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.get('/delivery/search', { params: { q } });
      setSearchResults(res.data?.data || []);
    } catch (e) {
      if (handleAuthError(e)) return;
      setSearchError(e.response?.data?.message || 'Gagal mencari nota');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    if (role === DELIVERY_ROLE) {
      setSearchQuery('');
      setSearchResults(null);
      setSearchError(null);
      loadData();
    }
  }, [role, tab, loadData]);

  useRealtimeRefresh(['progress', 'delivery'], () => {
    loadData({ silent: true });
    const q = searchQuery.trim();
    if (q) runSearch(q);
  });

  useEffect(() => {
    if (skipSearchEffectRef.current) {
      skipSearchEffectRef.current = false;
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }
    searchDebounceRef.current = setTimeout(() => runSearch(q), 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery, runSearch]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const pickExactTxn = (list, key) => {
    const q = String(key || '').trim().toLowerCase();
    if (!q || !Array.isArray(list)) return null;
    return (
      list.find((t) => String(t.order_no || '').toLowerCase() === q) ||
      list.find((t) => String(t.barcode || '').toLowerCase() === q) ||
      list.find((t) => String(t.id) === q) ||
      list[0] ||
      null
    );
  };

  const handleBarcodeDetected = useCallback(async (raw) => {
    setScannerOpen(false);
    const key = extractNotaSearchKey(raw);
    if (!key) return;

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    skipSearchEffectRef.current = true;
    setSearchQuery(key);
    setSearching(true);
    setSearchError(null);
    setScanNotice(null);

    try {
      const res = await api.get('/delivery/search', { params: { q: key } });
      const list = res.data?.data || [];
      const txn = pickExactTxn(list, key);

      if (!txn) {
        setSearchResults([]);
        setSearching(false);
        setScanNotice({
          title: 'Nota Tidak Ditemukan',
          message: `Nota "${key}" tidak ditemukan sebagai nota delivery di outlet ini. Pastikan QR/barcode sesuai dan fulfillment_type = Delivery_Kurir.`,
          variant: 'warning'
        });
        return;
      }

      const verdict = evaluateNotaForStage(txn, qcStage, activeTabMeta.stageLabel);
      if (verdict.ok) {
        const matchStatuses =
          tab === 'delivery' ? ['Siap Diantar', 'Sedang Diantar'] : [waitingStatus];
        const matched = list.filter((t) =>
          (t.items || []).some((it) => matchStatuses.includes(it.item_work_status))
        );
        setSearchResults(matched.length ? matched : [txn]);
        setSearching(false);
        showToast(
          String(verdict.title || '').includes('Serah Terima') || String(verdict.title || '').includes('Sedang Diantar')
            ? `Nota ${txn.order_no}: siap serah terima (foto → Selesai)`
            : `Nota ${txn.order_no} siap QC di ${activeTabMeta.stageLabel}`
        );
        return;
      }

      setSearchResults(null);
      setSearchQuery('');
      setSearching(false);
      setScanNotice({
        title: verdict.title,
        message: verdict.message,
        variant: verdict.variant === 'success' ? 'success' : verdict.variant === 'info' ? 'info' : 'warning'
      });
    } catch (e) {
      if (handleAuthError(e)) return;
      setSearching(false);
      setSearchResults([]);
      setScanNotice({
        title: 'Gagal Memuat Nota',
        message: e.response?.data?.message || 'Tidak dapat mencari nota dari hasil scan.',
        variant: 'danger'
      });
    }
  }, [qcStage, activeTabMeta.stageLabel, waitingStatus, tab, handleAuthError]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
  };

  const handleQCDone = () => {
    setQcTarget(null);
    showToast(tab === 'pickup' ? 'QC pickup berhasil' : 'QC delivery berhasil');
    if (searchResults !== null) runSearch(searchQuery.trim());
    else loadData({ silent: true });
  };

  if (role && role !== DELIVERY_ROLE) return null;

  const displayList = searchResults !== null ? searchResults : txns;
  const isSearchMode = searchResults !== null;

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex justify-center antialiased font-sans">
      <div className="w-full max-w-[430px] bg-slate-50 min-h-[100dvh] shadow-2xl flex flex-col relative pb-[max(16px,env(safe-area-inset-bottom))]">

        <div className="bg-[#5f1340] px-5 pt-safe-header pb-16 rounded-b-[28px] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-[12px] bg-white/10 grid place-items-center text-white"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-white text-[16px] font-black leading-tight">Delivery</h1>
              <p className="text-pink-100/70 text-[10.5px] font-semibold truncate">
                {formatName(currentUser.fullName)}
                {currentUser.role ? ` · ${currentUser.role}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (isSearchMode ? runSearch(searchQuery.trim()) : loadData())}
              className="ml-auto w-9 h-9 rounded-[12px] bg-white/10 grid place-items-center text-white"
              aria-label="Muat ulang"
            >
              <RefreshCw className={`w-4 h-4 ${loading || searching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search bar + barcode */}
        <div className="px-4 -mt-10 relative z-10">
          <div className="bg-white rounded-[16px] border border-slate-200 shadow-[0_10px_30px_rgba(95,19,64,0.18)] flex items-center gap-2 px-3 py-2.5">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Contoh : WLCG202609150001 / Budi / 0877…"
              className="flex-1 min-w-0 text-[12.5px] font-semibold text-slate-700 placeholder:text-slate-300 outline-none bg-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="w-6 h-6 rounded-full bg-slate-100 grid place-items-center text-slate-400 flex-shrink-0"
                aria-label="Bersihkan pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="w-8 h-8 rounded-[10px] bg-[#5f1340]/10 text-[#5f1340] grid place-items-center flex-shrink-0"
              aria-label="Scan barcode"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`px-4 mt-3 relative z-10 ${isSearchMode ? 'hidden' : ''}`}>
          <div className="bg-white rounded-[18px] border border-slate-200 shadow-[0_10px_30px_rgba(95,19,64,0.18)] p-1.5 grid grid-cols-2 gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              const count = Number(summary[t.key]?.nota_count) || 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`relative py-2.5 rounded-[13px] text-[12px] font-extrabold transition flex items-center justify-center gap-1.5 ${
                    active ? 'bg-[#5f1340] text-white' : 'text-slate-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {count > 0 && (
                    <span className={`absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black grid place-items-center ${
                      active ? 'bg-white text-[#5f1340]' : 'bg-[#5f1340] text-white'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-[14px] border border-slate-200 bg-white px-3.5 py-2.5 text-[11px] text-slate-600 font-medium leading-relaxed shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            {tab === 'pickup'
              ? 'Nota delivery masuk antrian. Lakukan QC seperti frontliner. Jika berhalangan, frontliner juga bisa QC dari Update Progress.'
              : 'Boleh antar meski belum lunas. QC final → Sedang Diantar. Item Sedang Diantar: ketuk → foto bukti → Tandai Selesai. Temuan fatal di QC final → kembalikan ke packing.'}
          </div>
        </div>

        <div className="px-4 mt-4 flex flex-col gap-3">
          {toast && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-[14px] p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-[11.5px] text-emerald-700 font-semibold">{toast}</span>
            </div>
          )}

          {isSearchMode ? (
            <>
              <div className="text-[10.5px] font-bold text-slate-400 px-0.5">
                {searching ? 'Mencari…' : `${displayList.length} nota delivery ditemukan`}
              </div>
              {searching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
                </div>
              ) : searchError ? (
                <div className="bg-rose-50 border border-rose-200 rounded-[16px] p-4 text-[12px] text-rose-700 font-semibold text-center">
                  {searchError}
                </div>
              ) : displayList.length === 0 ? (
                <div className="bg-white rounded-[20px] border border-slate-100 p-8 text-center">
                  <Search className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-[12px] font-bold text-slate-400">Nota delivery tidak ditemukan</p>
                </div>
              ) : (
                displayList.map((txn) => (
                  <DeliveryCard
                    key={txn.id}
                    txn={txn}
                    tab={tab}
                    onOpen={(t) => setDetailTxnId(t.id)}
                    onItemClick={setQcTarget}
                  />
                ))
              )}
            </>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-[16px] p-4 text-[12px] text-rose-700 font-semibold text-center">
              {error}
            </div>
          ) : displayList.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-slate-100 p-8 text-center">
              <PackageSearch className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-[12px] font-bold text-slate-400">
                {tab === 'pickup' ? 'Tidak ada nota pickup' : 'Tidak ada nota delivery'}
              </p>
            </div>
          ) : (
            displayList.map((txn) => (
              <DeliveryCard
                key={txn.id}
                txn={txn}
                tab={tab}
                onOpen={(t) => setDetailTxnId(t.id)}
                onItemClick={setQcTarget}
              />
            ))
          )}
        </div>

        {qcTarget && (
          <ItemQCSheet
            open={!!qcTarget}
            stage={qcTarget.stage || qcStage}
            item={qcTarget.item}
            txn={qcTarget.txn}
            roleUsed="Delivery Staff"
            onClose={() => setQcTarget(null)}
            onDone={handleQCDone}
          />
        )}

        {detailTxnId && (
          <TransactionDetailModal
            open={!!detailTxnId}
            transactionId={detailTxnId}
            onClose={() => setDetailTxnId(null)}
          />
        )}

        <BarcodeScannerModal
          open={scannerOpen}
          onDetect={handleBarcodeDetected}
          onClose={() => setScannerOpen(false)}
        />

        <ConfirmModal
          isOpen={!!scanNotice}
          onClose={() => setScanNotice(null)}
          onConfirm={() => setScanNotice(null)}
          title={scanNotice?.title || 'Info Scan'}
          message={scanNotice?.message || ''}
          confirmText="Mengerti"
          cancelText=""
          variant={scanNotice?.variant || 'info'}
        />
      </div>
    </div>
  );
}
