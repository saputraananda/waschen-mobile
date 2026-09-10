import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../../../components/Navbar';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';
import { useRealtimeRefresh } from '../../../context/SocketContext.jsx';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  History as HistoryIcon,
  CalendarDays,
  X,
  Loader2,
  Palmtree,
  Send,
  Trash2
} from 'lucide-react';

const api = axios.create({ baseURL: '/api', timeout: 45000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const AVAILABLE_YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

const UI_BY_KIND = {
  hadir: {
    label: 'Hadir',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20',
    dot: 'bg-emerald-500',
    listColor: 'text-emerald-700',
    listBg: 'bg-emerald-50 text-emerald-600 border-emerald-100'
  },
  leave: {
    color: 'text-red-700 bg-red-50 border-red-200',
    badgeBg: 'bg-red-500/20 text-red-300 border-red-400/20',
    dot: 'bg-red-500',
    listColor: 'text-red-700',
    listBg: 'bg-red-50 text-red-600 border-red-100'
  },
  libur: {
    label: 'Jadwal Libur',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-400/20',
    dot: 'bg-purple-500',
    listColor: 'text-purple-700',
    listBg: 'bg-purple-50 text-purple-600 border-purple-100'
  },
  libur_pengajuan: {
    label: 'Pengajuan Libur',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-400/20',
    dot: 'bg-purple-400 ring-2 ring-purple-300 ring-offset-1',
    listColor: 'text-purple-600',
    listBg: 'bg-purple-50/80 text-purple-500 border-purple-100 border-dashed'
  },
  tidak_masuk: {
    label: 'Tidak Masuk',
    color: 'text-red-700 bg-red-50 border-red-200',
    badgeBg: 'bg-red-500/20 text-red-300 border-red-400/20',
    dot: 'bg-red-500',
    listColor: 'text-red-700',
    listBg: 'bg-red-50 text-red-600 border-red-100'
  }
};

const mapDayRecord = (raw) => {
  if (!raw) return null;
  const base = UI_BY_KIND[raw.kind] || UI_BY_KIND.leave;
  return {
    ...raw,
    label: raw.label || base.label || 'Izin',
    color: base.color,
    badgeBg: base.badgeBg,
    dot: base.dot,
    listColor: base.listColor,
    listBg: base.listBg,
    in: raw.check_in || '-',
    out: raw.check_out || '-'
  };
};

export default function History() {
  const navigate = useNavigate();
  const now = new Date();

  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);

  const [calendarDays, setCalendarDays] = useState({});
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0, cuti: 0, libur: 0, pengajuan_libur: 0, tidak_masuk: 0 });
  const [policy, setPolicy] = useState({ max_days_per_month: 4 });
  const [dayOffList, setDayOffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showDayOffFilter, setShowDayOffFilter] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState('');

  const [tempPickerMonth, setTempPickerMonth] = useState(now.getMonth());
  const [tempPickerYear, setTempPickerYear] = useState(now.getFullYear());

  useLockBodyScroll(showPickerModal || showRequestModal);

  useEffect(() => {
    document.title = 'Riwayat Absensi Karyawan - Waschen Mobile';
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
  }, [navigate]);

  const monthParam = calMonth + 1;

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/history/calendar', {
        params: { year: calYear, month: monthParam }
      });
      if (!data.success) throw new Error(data.message || 'Gagal memuat data');
      const mapped = {};
      Object.entries(data.data.days || {}).forEach(([key, val]) => {
        mapped[key] = mapDayRecord(val);
      });
      setCalendarDays(mapped);
      setStats(data.data.stats || { hadir: 0, izin: 0, sakit: 0, cuti: 0, libur: 0, pengajuan_libur: 0, tidak_masuk: 0 });
      setPolicy(data.data.policy || { max_days_per_month: 4 });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Gagal memuat kalender');
      setCalendarDays({});
    } finally {
      setLoading(false);
    }
  }, [calYear, monthParam]);

  const fetchDayOffs = useCallback(async () => {
    try {
      const { data } = await api.get('/history/day-offs', {
        params: { year: calYear, month: monthParam, status: 'all' }
      });
      if (data.success) setDayOffList(data.data || []);
    } catch {
      setDayOffList([]);
    }
  }, [calYear, monthParam]);

  useEffect(() => {
    fetchCalendar();
    fetchDayOffs();
  }, [fetchCalendar, fetchDayOffs]);

  useRealtimeRefresh(['history', 'attendance', 'leave'], () => {
    fetchCalendar();
    fetchDayOffs();
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells = [];
  for (let i = 0; i < firstDay; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  const getKey = (d) => `${calYear}-${String(monthParam).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const selectedKey = selectedDate ? getKey(selectedDate) : null;
  const selectedRecord = selectedKey ? calendarDays[selectedKey] : null;

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
    setSelectedDate(null);
  };

  const openPickerModal = () => {
    setTempPickerMonth(calMonth);
    setTempPickerYear(calYear);
    setShowPickerModal(true);
  };

  const applyMonthYearPicker = () => {
    setCalMonth(tempPickerMonth);
    setCalYear(tempPickerYear);
    setSelectedDate(null);
    setShowPickerModal(false);
  };

  const isToday = (d) => d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();

  const openRequestModal = () => {
    setRequestReason('');
    setRequestError('');
    setShowRequestModal(true);
  };

  const submitDayOffRequest = async () => {
    if (!selectedKey || !requestReason.trim()) {
      setRequestError('Alasan libur wajib diisi');
      return;
    }
    setRequestLoading(true);
    setRequestError('');
    try {
      const { data } = await api.post('/history/day-off', {
        off_date: selectedKey,
        reason: requestReason.trim()
      });
      if (!data.success) throw new Error(data.message);
      setShowRequestModal(false);
      await fetchCalendar();
      await fetchDayOffs();
    } catch (err) {
      setRequestError(err.response?.data?.message || err.message || 'Gagal mengajukan libur');
    } finally {
      setRequestLoading(false);
    }
  };

  const cancelDayOff = async (dayOffId) => {
    try {
      await api.delete(`/history/day-off/${dayOffId}`);
      await fetchCalendar();
      await fetchDayOffs();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membatalkan pengajuan');
    }
  };

  const monthLogKeys = Object.keys(calendarDays).sort();
  const filteredLogKeys = showDayOffFilter
    ? monthLogKeys.filter((k) => ['libur', 'libur_pengajuan'].includes(calendarDays[k]?.kind))
    : monthLogKeys;

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const canRequestDayOff = selectedKey && selectedKey >= todayKey && !selectedRecord && !loading;

  const liburUsed = (stats.libur || 0) + (stats.pengajuan_libur || 0);
  const tidakMasukTotal = (stats.izin || 0) + (stats.sakit || 0) + (stats.cuti || 0) + (stats.tidak_masuk || 0);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-safe-nav">

        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-safe-header pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            <div className="absolute -top-2 left-2 transform -rotate-12"><Calendar className="w-20 h-20 text-white" /></div>
            <div className="absolute top-3 right-10 transform rotate-12"><Clock className="w-16 h-16 text-white" /></div>
            <div className="absolute bottom-2 left-1/3 transform -rotate-6"><HistoryIcon className="w-14 h-14 text-white" /></div>
            <div className="absolute top-1/2 right-2 transform -rotate-12"><Sparkles className="w-12 h-12 text-white" /></div>
          </div>
          <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />

          <div className="relative z-10 text-center mb-5 pt-1">
            <h1 className="text-[17.5px] font-black text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              Riwayat Absensi Karyawan
            </h1>
            <span className="text-[11px] text-pink-200/80 font-medium block mt-0.5">
              Rekapitulasi Kehadiran &amp; Jadwal Libur
            </span>
          </div>

          <div className="relative z-10 grid grid-cols-4 gap-2">
            {[
              { key: 'hadir', label: 'Hadir', dot: 'bg-emerald-400', val: stats.hadir, sub: 'text-emerald-300', subBg: 'bg-emerald-500/20 border-emerald-400/20' },
              { key: 'tidak_masuk', label: 'Tidak Masuk', dot: 'bg-red-400', val: tidakMasukTotal, sub: 'text-red-300', subBg: 'bg-red-500/20 border-red-400/20' },
              { key: 'libur', label: 'Libur', dot: 'bg-purple-400', val: stats.libur, sub: 'text-purple-300', subBg: 'bg-purple-500/20 border-purple-400/20' },
              { key: 'pending', label: 'Pending', dot: 'bg-purple-300', val: stats.pengajuan_libur, sub: 'text-purple-200', subBg: 'bg-purple-400/20 border-purple-300/20' }
            ].map((s) => (
              <div key={s.key} className="bg-white/12 backdrop-blur-md border border-white/15 rounded-[16px] p-2 text-center flex flex-col items-center justify-center shadow-sm">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <span className="text-[9px] text-pink-100/90 font-extrabold uppercase tracking-wider">{s.label}</span>
                </div>
                <span className="text-[18px] font-black text-white font-mono leading-none">{s.val}</span>
                <span className={`text-[8.5px] font-bold mt-1 px-1.5 py-0.5 rounded-full border ${s.sub} ${s.subBg}`}>Hari</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full relative">
          {error && (
            <div className="mx-4 mt-3 p-3 rounded-2xl bg-red-50 border border-red-200 text-[12px] text-red-700 font-bold">
              {error}
            </div>
          )}

          <div className="mx-4 -mt-6 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-100">
              <button onClick={prevMonth} className="w-8.5 h-8.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-[#5f1340]/10 hover:text-[#5f1340] active:scale-95 transition-all flex items-center justify-center flex-shrink-0">
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              <button onClick={openPickerModal} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-[#5f1340]/5 hover:border-[#5f1340]/30 transition-all active:scale-95 group">
                <CalendarDays className="w-4 h-4 text-[#5f1340]" />
                <span className="text-[14px] font-black text-slate-800 tracking-tight group-hover:text-[#5f1340] transition-colors">
                  {MONTHS_ID[calMonth]} {calYear}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#5f1340] transition-colors" />
              </button>
              <button onClick={nextMonth} className="w-8.5 h-8.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-[#5f1340]/10 hover:text-[#5f1340] active:scale-95 transition-all flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => setShowDayOffFilter((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                  showDayOffFilter
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                    : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                <Palmtree className="w-3.5 h-3.5" />
                Jadwal Libur Anda
              </button>
              <span className="text-[10px] text-slate-400 font-bold">
                Kuota: {liburUsed}/{policy.max_days_per_month || 4}
              </span>
            </div>

            <div className="px-4 py-2 flex flex-wrap gap-3 text-[9.5px] font-bold text-slate-500 border-b border-slate-50">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Masuk</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Tidak Masuk</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Libur</span>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-[#5f1340]" />
                <span className="text-[12px] font-bold">Memuat data...</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-[10px] font-black py-1 text-slate-400 uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1.5 px-3 pb-4">
                  {calCells.map((d, i) => {
                    if (!d) return <div key={`empty-${i}`} />;
                    const key = getKey(d);
                    const rec = calendarDays[key];
                    const isSelected = selectedDate === d;
                    const today = isToday(d);
                    const dotColor = rec?.dot || '';

                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDate(isSelected ? null : d)}
                        className={`flex flex-col items-center justify-center rounded-[14px] py-2 gap-0.5 transition-all duration-150 active:scale-90 ${
                          isSelected
                            ? 'bg-[#5f1340] text-white scale-[1.08] shadow-md shadow-[#5f1340]/25'
                            : today
                              ? 'bg-[#5f1340]/10 text-[#5f1340] border border-[#5f1340]/30 font-black'
                              : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className={`text-[12.5px] font-extrabold leading-none ${
                          isSelected ? 'text-white' : today ? 'text-[#5f1340]' : 'text-slate-800'
                        }`}>
                          {d}
                        </span>
                        {dotColor && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor}`} />}
                        {!dotColor && <span className="w-1.5 h-1.5 rounded-full bg-transparent" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {selectedDate && !loading && (
            <div className="mx-4 mt-3 relative z-10 animate-fade-in">
              {selectedRecord ? (
                <div className="bg-white rounded-[22px] border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.04)] p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Detail Absensi</span>
                      <span className="text-[14px] font-black text-slate-800">{selectedDate} {MONTHS_ID[calMonth]} {calYear}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-black border ${selectedRecord.color}`}>
                      {selectedRecord.label}
                    </span>
                  </div>

                  {selectedRecord.kind === 'hadir' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        { label: 'Absen Masuk', value: selectedRecord.in },
                        { label: 'Absen Keluar', value: selectedRecord.out }
                      ].map((item) => (
                        <div key={item.label} className="bg-slate-50 rounded-[14px] p-2.5 text-center border border-slate-100">
                          <span className="text-[9.5px] text-slate-400 uppercase font-extrabold tracking-wider block">{item.label}</span>
                          <span className="text-[13px] font-black text-slate-800 font-mono">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedRecord.kind === 'libur' && (
                    <div className="bg-purple-50/70 rounded-[14px] p-3 text-center mt-1 border border-purple-100">
                      <span className="text-[12px] text-purple-800 font-bold block">Jadwal libur disetujui</span>
                      {selectedRecord.reason && (
                        <span className="text-[10.5px] text-purple-600 font-medium block mt-1">{selectedRecord.reason}</span>
                      )}
                    </div>
                  )}

                  {selectedRecord.kind === 'libur_pengajuan' && (
                    <div className="bg-purple-50/70 rounded-[14px] p-3 mt-1 border border-purple-100">
                      <span className="text-[12px] text-purple-800 font-bold block">Menunggu persetujuan admin</span>
                      {selectedRecord.reason && (
                        <span className="text-[10.5px] text-purple-600 font-medium block mt-1">{selectedRecord.reason}</span>
                      )}
                      {selectedRecord.day_off_id && (
                        <button
                          onClick={() => cancelDayOff(selectedRecord.day_off_id)}
                          className="mt-3 w-full py-2 rounded-xl bg-white border border-red-200 text-red-600 text-[11px] font-black flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Batalkan Pengajuan
                        </button>
                      )}
                    </div>
                  )}

                  {(selectedRecord.kind === 'leave' || selectedRecord.kind === 'tidak_masuk') && (
                    <div className="bg-red-50 rounded-[16px] p-3 text-center mt-1 border border-red-100">
                      <span className="text-[13px] font-bold text-red-700">
                        {selectedRecord.kind === 'tidak_masuk'
                          ? 'Tidak masuk kerja — tidak ada absensi'
                          : `Tidak masuk kerja (${selectedRecord.label})`}
                      </span>
                      {selectedRecord.reason && (
                        <span className="text-[11.5px] font-medium text-red-600 leading-relaxed block mt-2 text-left">
                          <strong className="font-extrabold">Catatan: </strong>{selectedRecord.reason}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-[22px] border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.03)] p-4">
                  <span className="text-[12px] text-slate-500 font-bold block text-center mb-3">
                    Belum ada data absensi untuk tanggal ini.
                  </span>
                  {canRequestDayOff && (
                    <button
                      onClick={openRequestModal}
                      className="w-full py-3 rounded-2xl bg-purple-600 text-white text-[12.5px] font-black shadow-md shadow-purple-500/25 flex items-center justify-center gap-2"
                    >
                      <Palmtree className="w-4 h-4" /> Permintaan Libur
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mx-4 mt-5 mb-4">
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block">
                {showDayOffFilter ? 'Jadwal Libur Bulan Ini' : 'Riwayat Absensi Bulan Ini'}
              </span>
              <span className="text-[10px] text-[#5f1340] font-black uppercase tracking-wider bg-[#5f1340]/10 px-2.5 py-0.5 rounded-full">
                {filteredLogKeys.length} Hari
              </span>
            </div>

            {showDayOffFilter && dayOffList.length === 0 && !loading && (
              <div className="bg-white rounded-[20px] border border-dashed border-purple-200 p-6 text-center text-[12px] text-purple-600 font-bold">
                Belum ada jadwal libur di bulan ini. Tap tanggal di kalender untuk permintaan libur.
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {(showDayOffFilter ? dayOffList.map((row) => {
                const d = new Date(`${String(row.off_date).slice(0, 10)}T12:00:00`);
                const dayNum = d.getDate();
                const dayName = DAYS[d.getDay()];
                const isApproved = row.status === 'disetujui';
                const rec = mapDayRecord({
                  kind: isApproved ? 'libur' : 'libur_pengajuan',
                  label: isApproved ? 'Jadwal Libur' : 'Pengajuan Libur',
                  reason: row.reason
                });
                return (
                  <div key={row.day_off_id} className="bg-white rounded-[20px] border border-slate-100 p-3.5 flex items-center gap-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
                    <div className={`w-10.5 h-10.5 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border ${rec.listBg}`}>
                      <span className="text-[14.5px] font-black leading-none">{dayNum}</span>
                      <span className="text-[8.5px] font-extrabold uppercase mt-0.5 opacity-80">{dayName}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${rec.dot}`} />
                        <span className={`text-[13px] font-black ${rec.listColor}`}>{rec.label}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-bold block mt-0.5 truncate">{row.reason}</span>
                    </div>
                    {row.status === 'pengajuan' && (
                      <button onClick={() => cancelDayOff(row.day_off_id)} className="p-2 rounded-xl text-red-500 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              }) : filteredLogKeys.slice().reverse().map((key) => {
                const rec = calendarDays[key];
                const d = parseInt(key.split('-')[2], 10);
                const dateObj = new Date(calYear, calMonth, d);
                const dayName = DAYS[dateObj.getDay()];
                return (
                  <div key={key} className="bg-white rounded-[20px] border border-slate-100 p-3.5 flex items-center gap-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
                    <div className={`w-10.5 h-10.5 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border ${rec.listBg}`}>
                      <span className="text-[14.5px] font-black leading-none">{d}</span>
                      <span className="text-[8.5px] font-extrabold uppercase mt-0.5 opacity-80">{dayName}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${rec.dot}`} />
                        <span className={`text-[13px] font-black ${rec.listColor}`}>{rec.label}</span>
                      </div>
                      {rec.kind === 'hadir' ? (
                        <span className="text-[11px] text-slate-400 font-bold block mt-0.5 leading-relaxed">
                          <span className="block">Absen Masuk <span className="font-mono text-slate-600">{rec.in}</span></span>
                          <span className="block">Absen Keluar <span className="font-mono text-slate-600">{rec.out}</span></span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-bold block mt-0.5">{rec.reason || '—'}</span>
                      )}
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>
        </div>

        {showPickerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-safe-modal animate-fade-in">
            <div className="w-full max-w-[360px] bg-white rounded-[28px] shadow-2xl p-5 border border-slate-100 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-[#5f1340]" />
                  <h3 className="text-[15px] font-black text-slate-800">Pilih Bulan &amp; Tahun</h3>
                </div>
                <button onClick={() => setShowPickerModal(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tahun</span>
                <div className="grid grid-cols-4 gap-2">
                  {AVAILABLE_YEARS.map((y) => (
                    <button key={y} onClick={() => setTempPickerYear(y)} className={`py-2 rounded-xl text-[12.5px] font-black transition-all ${tempPickerYear === y ? 'bg-[#5f1340] text-white shadow-md shadow-[#5f1340]/25' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'}`}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Bulan</span>
                <div className="grid grid-cols-3 gap-2">
                  {MONTHS_ID.map((m, idx) => (
                    <button key={m} onClick={() => setTempPickerMonth(idx)} className={`py-2.5 px-2 rounded-xl text-[12px] font-black transition-all text-center ${tempPickerMonth === idx ? 'bg-[#5f1340] text-white shadow-md shadow-[#5f1340]/25' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setShowPickerModal(false)} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 text-[12.5px] font-extrabold hover:bg-slate-200 transition-all">Batal</button>
                <button onClick={applyMonthYearPicker} className="flex-1 py-3 rounded-2xl bg-[#5f1340] text-white text-[12.5px] font-black shadow-md shadow-[#5f1340]/25 hover:bg-[#4d0f34] transition-all">Terapkan Filter</button>
              </div>
            </div>
          </div>
        )}

        {showRequestModal && selectedKey && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-safe-modal animate-fade-in">
            <div className="w-full max-w-[430px] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl p-5 border border-slate-100 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-[15px] font-black text-slate-800">Permintaan Libur</h3>
                  <span className="text-[11px] text-slate-400 font-bold">{selectedKey}</span>
                </div>
                <button onClick={() => setShowRequestModal(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={4}
                placeholder="Alasan libur (wajib diisi)..."
                className="w-full rounded-2xl border border-slate-200 p-3 text-[13px] font-medium text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400/40"
              />
              {requestError && <p className="text-[11px] text-red-600 font-bold">{requestError}</p>}
              <button
                onClick={submitDayOffRequest}
                disabled={requestLoading}
                className="w-full py-3.5 rounded-2xl bg-purple-600 text-white text-[13px] font-black shadow-md shadow-purple-500/25 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {requestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Kirim Pengajuan Libur
              </button>
            </div>
          </div>
        )}

        <Navbar />
      </div>
    </div>
  );
}
