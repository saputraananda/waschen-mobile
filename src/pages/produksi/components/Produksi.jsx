import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import formatName from '../../../utils/FormatName.js';
import getDisplayRole from '../../../utils/getDisplayRole.js';
import fetchAssignedRole from '../../../utils/fetchAssignedRole.js';
import { ArrowLeft, Loader2, PauseCircle, RefreshCw, PackageSearch, CheckCircle2, Search, ScanLine, X } from 'lucide-react';
import { api, STAGES, stageForRole } from '../../../utils/produksiShared.js';
import TransactionCard from './TransactionCard.jsx';
import ItemQCSheet from './ItemQCSheet.jsx';
import HoldList from './HoldList.jsx';
import TransactionDetailModal from './TransactionDetailModal.jsx';
import BarcodeScannerModal from '../../../components/BarcodeScannerModal.jsx';
import ConfirmModal from '../../../components/ConfirmModal.jsx';

export default function Produksi() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState({ fullName: 'Karyawan Waschen', role: null });
  const [activeStage, setActiveStage] = useState('frontliner');
  const [showHolds, setShowHolds] = useState(false);

  const [summary, setSummary] = useState({});
  const [txns, setTxns] = useState([]);
  const [holds, setHolds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Sheet QC
  const [qcTarget, setQcTarget] = useState(null); // { txn, item }
  const [detailTxnId, setDetailTxnId] = useState(null);

  // Search bar (nota / nama / HP / barcode) + scan barcode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = tidak sedang search
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const searchDebounceRef = useRef(null);
  const [stageSwitchPrompt, setStageSwitchPrompt] = useState(null);

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      return true;
    }
    return false;
  }, [navigate]);

  // Init user + default tab dari role
  useEffect(() => {
    document.title = 'Progres Pengerjaan - Waschen Mobile';
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
    if (parsed) {
      const role = getDisplayRole(parsed);
      setCurrentUser({ fullName: parsed.fullName || parsed.name || 'Karyawan Waschen', role });
      if (role) {
        setActiveStage(stageForRole(role));
      } else {
        fetchAssignedRole(token).then((r) => {
          if (r) {
            setCurrentUser((prev) => ({ ...prev, role: r }));
            setActiveStage(stageForRole(r));
          }
        });
      }
    }
  }, [navigate]);

  const loadData = useCallback(async (stage) => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, listRes, holdsRes] = await Promise.allSettled([
        api.get('/progress/summary'),
        api.get('/progress/list', { params: { stage } }),
        api.get('/progress/holds', { params: { stage } }),
      ]);

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data?.data || {});
      if (holdsRes.status === 'fulfilled') setHolds(holdsRes.value.data?.data || []);

      if (listRes.status === 'fulfilled') {
        setTxns(listRes.value.data?.data || []);
      } else {
        if (handleAuthError(listRes.reason)) return;
        setError(listRes.reason?.response?.data?.message || 'Gagal memuat daftar nota');
      }
    } catch (e) {
      if (!handleAuthError(e)) setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    setShowHolds(false);
    loadData(activeStage);
  }, [activeStage, loadData]);

  const runSearch = useCallback(async (q) => {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.get('/progress/list', { params: { search: q } });
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

  const handleBarcodeDetected = (code) => {
    setScannerOpen(false);
    setSearchQuery(code);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleQCDone = (msg) => {
    setQcTarget(null);
    showToast(msg);
    if (searchResults !== null) runSearch(searchQuery.trim());
    else loadData(activeStage);
  };

  const stageStatusLabel = STAGES.find((s) => s.key === activeStage)?.label || '';
  const holdCount = summary[activeStage]?.confirm_count || 0;
  const userStage = stageForRole(currentUser.role);

  const applyStageSwitch = (stageKey) => {
    setShowHolds(false);
    setActiveStage(stageKey);
  };

  const requestStageSwitch = (stageKey) => {
    if (stageKey === activeStage) {
      setShowHolds(false);
      return;
    }
    if (stageKey === userStage) {
      applyStageSwitch(stageKey);
      return;
    }
    const targetLabel = STAGES.find((s) => s.key === stageKey)?.label || stageKey;
    const userLabel = STAGES.find((s) => s.key === userStage)?.label || 'Anda';
    setStageSwitchPrompt({ stageKey, targetLabel, userLabel });
  };

  const confirmStageSwitch = () => {
    if (stageSwitchPrompt?.stageKey) applyStageSwitch(stageSwitchPrompt.stageKey);
    setStageSwitchPrompt(null);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex justify-center antialiased font-sans">
      <div className="w-full max-w-[430px] bg-slate-50 min-h-[100dvh] shadow-2xl flex flex-col relative pb-[max(16px,env(safe-area-inset-bottom))]">

        {/* Header */}
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
              <h1 className="text-white text-[16px] font-black leading-tight">Progres Pengerjaan</h1>
              <p className="text-pink-100/70 text-[10.5px] font-semibold truncate">
                {formatName(currentUser.fullName || currentUser.full_name)}{currentUser.role ? ` · ${currentUser.role}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadData(activeStage)}
              className="ml-auto w-9 h-9 rounded-[12px] bg-white/10 grid place-items-center text-white"
              aria-label="Muat ulang"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar: nota / nama / HP / barcode */}
        <div className="px-4 -mt-10 relative z-10">
          <div className="bg-white rounded-[16px] border border-slate-200 shadow-[0_10px_30px_rgba(95,19,64,0.18)] flex items-center gap-2 px-3 py-2.5">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nota, nama, HP, atau barcode…"
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

        {/* Tabs tahap */}
        <div className={`px-4 mt-3 relative z-10 ${searchResults !== null ? 'hidden' : ''}`}>
          <div className="bg-white rounded-[18px] border border-slate-200 shadow-[0_10px_30px_rgba(95,19,64,0.18)] p-1.5 grid grid-cols-4 gap-1">
            {STAGES.map((s) => {
              const count = summary[s.key]?.nota_count || 0;
              const active = activeStage === s.key && !showHolds;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => requestStageSwitch(s.key)}
                  className={`relative py-2 rounded-[13px] text-[11px] font-extrabold transition ${
                    active ? 'bg-[#5f1340] text-white' : 'text-slate-500'
                  }`}
                >
                  {s.label}
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

          {/* Tombol hold */}
          <button
            type="button"
            onClick={() => setShowHolds((v) => !v)}
            className={`mt-3 w-full py-2.5 rounded-[14px] border text-[12px] font-extrabold flex items-center justify-center gap-1.5 transition shadow-[0_4px_16px_rgba(0,0,0,0.04)] ${
              showHolds
                ? 'bg-amber-500 text-white border-amber-500'
                : holdCount > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            <PauseCircle className="w-4 h-4" />
            Perlu Konfirmasi {stageStatusLabel}{holdCount > 0 ? ` (${holdCount})` : ''}
          </button>
        </div>

        {/* Content */}
        <div className="px-4 mt-4 flex flex-col gap-3">
          {toast && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-[14px] p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-[11.5px] text-emerald-700 font-semibold">{toast}</span>
            </div>
          )}

          {searchResults !== null ? (
            <>
              <div className="text-[10.5px] font-bold text-slate-400 px-0.5">
                {searching ? 'Mencari…' : `${searchResults.length} nota ditemukan`}
              </div>
              {searching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
                </div>
              ) : searchError ? (
                <div className="bg-rose-50 border border-rose-200 rounded-[16px] p-4 text-[12px] text-rose-700 font-semibold text-center">
                  {searchError}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="bg-white rounded-[20px] border border-slate-100 p-8 text-center">
                  <Search className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-[12px] font-bold text-slate-400">Nota tidak ditemukan</p>
                </div>
              ) : (
                searchResults.map((txn) => (
                  <TransactionCard
                    key={txn.id}
                    txn={txn}
                    activeStage={activeStage}
                    onOpen={(t) => setDetailTxnId(t.id)}
                    onItemClick={setQcTarget}
                  />
                ))
              )}
            </>
          ) : showHolds ? (
            <HoldList holds={holds} loading={loading} stage={activeStage} onResolved={() => loadData(activeStage)} />
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#5f1340] animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-[16px] p-4 text-[12px] text-rose-700 font-semibold text-center">
              {error}
            </div>
          ) : txns.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-slate-100 p-8 text-center">
              <PackageSearch className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-[12px] font-bold text-slate-400">
                Tidak ada nota di tahap {stageStatusLabel}
              </p>
            </div>
          ) : (
            txns.map((txn) => (
              <TransactionCard
                key={txn.id}
                txn={txn}
                activeStage={activeStage}
                onOpen={(t) => setDetailTxnId(t.id)}
                onItemClick={setQcTarget}
              />
            ))
          )}
        </div>

        <ItemQCSheet
          open={!!qcTarget}
          stage={activeStage}
          item={qcTarget?.item}
          txn={qcTarget?.txn}
          onClose={() => setQcTarget(null)}
          onDone={handleQCDone}
        />

        <TransactionDetailModal
          open={!!detailTxnId}
          transactionId={detailTxnId}
          onClose={() => setDetailTxnId(null)}
        />

        <BarcodeScannerModal
          open={scannerOpen}
          onDetect={handleBarcodeDetected}
          onClose={() => setScannerOpen(false)}
        />

        <ConfirmModal
          isOpen={!!stageSwitchPrompt}
          onClose={() => setStageSwitchPrompt(null)}
          onConfirm={confirmStageSwitch}
          title="Buka Tab Tahap Lain?"
          message={
            stageSwitchPrompt
              ? `Anda login sebagai ${currentUser.role || 'karyawan'} (tahap ${stageSwitchPrompt.userLabel}). Yakin ingin melihat tahap ${stageSwitchPrompt.targetLabel}? Pastikan Anda berwenang mengakses tahap tersebut.`
              : ''
          }
          confirmText="Ya, Lanjutkan"
          cancelText="Batal"
          variant="warning"
        />
      </div>
    </div>
  );
}
