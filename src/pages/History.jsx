import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { 
  Calendar, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  User, 
  Sparkles, 
  History as HistoryIcon, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  FileText,
  Building2,
  CalendarDays,
  X
} from 'lucide-react';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Available years for Google Calendar style year picker
const AVAILABLE_YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

/**
 * Generate Realistic Attendance Data for a specific Month & Year
 * Includes: Hadir, Izin, Sakit, and Jadwal Libur (1x per week)
 */
const generateAttendanceDataForMonth = (year, month) => {
  const data = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const shifts = ['Pagi (07:00 - 15:00)', 'Siang (15:00 - 23:00)'];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // 1x per week: Mark Sunday (or day 7 of week) as "Jadwal Libur"
    if (dayOfWeek === 0 || d % 7 === 0) {
      data[key] = {
        date: key,
        day: d,
        label: 'Jadwal Libur',
        color: 'text-purple-700 bg-purple-50 border-purple-200',
        badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-400/20',
        dot: 'bg-purple-500',
        shift: 'Jadwal Libur',
        in: '-',
        out: '-'
      };
    } else if (d % 9 === 0) {
      // Periodic Izin
      data[key] = {
        date: key,
        day: d,
        label: 'Izin',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/20',
        dot: 'bg-amber-500',
        shift: '-',
        in: '-',
        out: '-',
        catatan: 'Ada urusan keluarga mendesak Pak/Bu, mohon izin tidak masuk dulu hari ini.'
      };
    } else if (d % 13 === 0) {
      // Periodic Sakit
      data[key] = {
        date: key,
        day: d,
        label: 'Sakit',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-400/20',
        dot: 'bg-rose-500',
        shift: '-',
        in: '-',
        out: '-',
        catatan: 'Sakit demam tinggi Pak/Bu, maaf yaa izin dulu'
      };
    } else {
      // Hadir / Masuk Kerja
      const shiftType = shifts[d % 2];
      const inTime = d % 2 === 0 ? '06:55' : '14:52';
      const outTime = d % 2 === 0 ? '15:04' : '23:08';

      data[key] = {
        date: key,
        day: d,
        label: 'Hadir',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20',
        dot: 'bg-emerald-500',
        shift: shiftType,
        in: inTime,
        out: outTime
      };
    }
  }

  return data;
};

export default function History() {
  const navigate = useNavigate();
  const now = new Date();

  const [currentUser, setCurrentUser] = useState({ 
    fullName: 'Karyawan Waschen', 
    position: 'Staff Waschen' 
  });
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);

  // Month & Year Picker Modal State (Google Calendar style)
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [tempPickerMonth, setTempPickerMonth] = useState(now.getMonth());
  const [tempPickerYear, setTempPickerYear] = useState(now.getFullYear());

  // Prevent background scroll when Month & Year picker modal is open
  useEffect(() => {
    if (showPickerModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showPickerModal]);

  useEffect(() => {
    document.title = 'Riwayat Absensi Karyawan - Waschen Mobile';
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try { 
        const parsed = JSON.parse(storedUser);
        setCurrentUser(prev => ({
          ...prev,
          ...parsed,
          fullName: parsed.fullName || parsed.full_name || prev.fullName,
          position: parsed.position || parsed.position_name || prev.position
        }));
      } catch (e) { }
    }
  }, [navigate]);

  // Generate dynamic attendance data for current chosen month & year
  const currentAttendanceData = generateAttendanceDataForMonth(calYear, calMonth);

  // Build calendar grid
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells = [];
  for (let i = 0; i < firstDay; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  const prevMonth = () => {
    if (calMonth === 0) { 
      setCalMonth(11); 
      setCalYear(y => y - 1); 
    } else { 
      setCalMonth(m => m - 1); 
    }
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (calMonth === 11) { 
      setCalMonth(0); 
      setCalYear(y => y + 1); 
    } else { 
      setCalMonth(m => m + 1); 
    }
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

  const getKey = (d) => `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const selectedKey = selectedDate ? getKey(selectedDate) : null;
  const selectedRecord = selectedKey ? currentAttendanceData[selectedKey] : null;

  // Dynamic summary stats according to user filter (Month & Year)
  const monthKeys = Object.keys(currentAttendanceData);
  const stats = { hadir: 0, izin: 0, sakit: 0, libur: 0 };
  monthKeys.forEach(k => {
    const item = currentAttendanceData[k];
    if (item.label === 'Hadir') stats.hadir++;
    else if (item.label === 'Izin') stats.izin++;
    else if (item.label === 'Sakit') stats.sakit++;
    else if (item.label === 'Jadwal Libur') stats.libur++;
  });

  const isToday = (d) => d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
  const isFuture = (d) => new Date(calYear, calMonth, d) > now;

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased select-none font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[90px]">

        {/* ==========================================
            HERO HEADER WITH WASCHEN COLORS & TITLE
            ========================================== */}
        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-6 pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">

          {/* Floating Watermark Icons */}
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            <div className="absolute -top-2 left-2 transform -rotate-12">
              <Calendar className="w-20 h-20 text-white" />
            </div>
            <div className="absolute top-3 right-10 transform rotate-12">
              <Clock className="w-16 h-16 text-white" />
            </div>
            <div className="absolute bottom-2 left-1/3 transform -rotate-6">
              <HistoryIcon className="w-14 h-14 text-white" />
            </div>
            <div className="absolute top-1/2 right-2 transform -rotate-12">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Ambient Glow Spot */}
          <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />

          {/* TOP HEADER TITLE */}
          <div className="relative z-10 text-center mb-5 pt-1">
            <h1 className="text-[17.5px] font-black text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              Riwayat Absensi Karyawan
            </h1>
            <span className="text-[11px] text-pink-200/80 font-medium block mt-0.5">
              Rekapitulasi Kehadiran &amp; Jadwal Kerja
            </span>
          </div>

          {/* MONTH STATS CARDS STRIP (DYNAMIC FILTERED DATA) */}
          <div className="relative z-10 grid grid-cols-4 gap-2">
            {/* Hadir */}
            <div className="bg-white/12 backdrop-blur-md border border-white/15 rounded-[16px] p-2 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] text-pink-100/90 font-extrabold uppercase tracking-wider">Hadir</span>
              </div>
              <span className="text-[18px] font-black text-white font-mono leading-none">{stats.hadir}</span>
              <span className="text-[8.5px] text-emerald-300 font-bold mt-1 bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-400/20">Hari</span>
            </div>

            {/* Izin */}
            <div className="bg-white/12 backdrop-blur-md border border-white/15 rounded-[16px] p-2 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[9px] text-pink-100/90 font-extrabold uppercase tracking-wider">Izin</span>
              </div>
              <span className="text-[18px] font-black text-white font-mono leading-none">{stats.izin}</span>
              <span className="text-[8.5px] text-amber-300 font-bold mt-1 bg-amber-500/20 px-1.5 py-0.5 rounded-full border border-amber-400/20">Hari</span>
            </div>

            {/* Sakit */}
            <div className="bg-white/12 backdrop-blur-md border border-white/15 rounded-[16px] p-2 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span className="text-[9px] text-pink-100/90 font-extrabold uppercase tracking-wider">Sakit</span>
              </div>
              <span className="text-[18px] font-black text-white font-mono leading-none">{stats.sakit}</span>
              <span className="text-[8.5px] text-rose-300 font-bold mt-1 bg-rose-500/20 px-1.5 py-0.5 rounded-full border border-rose-400/20">Hari</span>
            </div>

            {/* Libur */}
            <div className="bg-white/12 backdrop-blur-md border border-white/15 rounded-[16px] p-2 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="text-[9px] text-pink-100/90 font-extrabold uppercase tracking-wider">Libur</span>
              </div>
              <span className="text-[18px] font-black text-white font-mono leading-none">{stats.libur}</span>
              <span className="text-[8.5px] text-purple-300 font-bold mt-1 bg-purple-500/20 px-1.5 py-0.5 rounded-full border border-purple-400/20">Hari</span>
            </div>
          </div>

        </div>

        {/* ===== CONTENT AREA ===== */}
        <div className="w-full relative">

          {/* CALENDAR CARD */}
          <div className="mx-4 -mt-6 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">

            {/* Month & Year Navigation Header with Google Calendar Picker Trigger */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-100">
              <button 
                onClick={prevMonth} 
                className="w-8.5 h-8.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-[#5f1340]/10 hover:text-[#5f1340] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>

              {/* Clickable Month & Year Header (Google Calendar Style Picker) */}
              <button
                onClick={openPickerModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-[#5f1340]/5 hover:border-[#5f1340]/30 transition-all active:scale-95 group"
              >
                <CalendarDays className="w-4 h-4 text-[#5f1340]" />
                <span className="text-[14px] font-black text-slate-800 tracking-tight group-hover:text-[#5f1340] transition-colors">
                  {MONTHS_ID[calMonth]} {calYear}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#5f1340] transition-colors" />
              </button>

              <button 
                onClick={nextMonth} 
                className="w-8.5 h-8.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-[#5f1340]/10 hover:text-[#5f1340] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Day headers (Minggu - Sabtu) */}
            <div className="grid grid-cols-7 px-3 pt-3 pb-1">
              {DAYS.map(d => (
                <div key={d} className={`text-center text-[10px] font-black py-1 ${d === 'Min' || d === 'Sab' ? 'text-purple-600' : 'text-slate-400'} uppercase tracking-wider`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells (Sat & Sun UNLOCKED!) */}
            <div className="grid grid-cols-7 gap-y-1.5 px-3 pb-4">
              {calCells.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />;
                const key = getKey(d);
                const rec = currentAttendanceData[key];
                const isSelected = selectedDate === d;
                const today = isToday(d);
                const future = isFuture(d);
                const dayIndex = (firstDay + d - 1) % 7;
                const isWeekend = dayIndex === 0 || dayIndex === 6;

                let dotColor = '';
                if (rec?.label === 'Hadir') dotColor = 'bg-emerald-500';
                else if (rec?.label === 'Izin') dotColor = 'bg-amber-500';
                else if (rec?.label === 'Sakit') dotColor = 'bg-rose-500';
                else if (rec?.label === 'Jadwal Libur') dotColor = 'bg-purple-500';

                return (
                  <button
                    key={key}
                    disabled={future}
                    onClick={() => setSelectedDate(isSelected ? null : d)}
                    className={`flex flex-col items-center justify-center rounded-[14px] py-2 gap-0.5 transition-all duration-150 active:scale-90 ${
                      isSelected
                        ? 'bg-[#5f1340] text-white scale-[1.08] shadow-md shadow-[#5f1340]/25'
                        : today
                          ? 'bg-[#5f1340]/10 text-[#5f1340] border border-[#5f1340]/30 font-black'
                          : future
                            ? 'opacity-30 cursor-not-allowed'
                            : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className={`text-[12.5px] font-extrabold leading-none ${
                      isSelected ? 'text-white' : today ? 'text-[#5f1340]' : isWeekend ? 'text-purple-700' : 'text-slate-800'
                    }`}>
                      {d}
                    </span>
                    {dotColor && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor}`} />
                    )}
                    {!dotColor && !future && rec === undefined && (
                      <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SELECTED DATE DETAIL CARD */}
          {selectedDate && (
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

                  {selectedRecord.label === 'Hadir' && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[
                        { label: 'Shift', value: selectedRecord.shift.split(' ')[0] },
                        { label: 'Masuk', value: selectedRecord.in },
                        { label: 'Keluar', value: selectedRecord.out },
                      ].map(item => (
                        <div key={item.label} className="bg-slate-50 rounded-[14px] p-2.5 text-center border border-slate-100">
                          <span className="text-[9.5px] text-slate-400 uppercase font-extrabold tracking-wider block">{item.label}</span>
                          <span className="text-[13px] font-black text-slate-800 font-mono">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedRecord.label === 'Jadwal Libur' && (
                    <div className="bg-purple-50/70 rounded-[14px] p-3 text-center mt-1 border border-purple-100">
                      <span className="text-[12px] text-purple-800 font-bold block">🌴 Jadwal Libur Mingguan Karyawan</span>
                      <span className="text-[10.5px] text-purple-600 font-medium block mt-0.5">Hari libur resmi jadwal kerja operasional</span>
                    </div>
                  )}

                  {selectedRecord.label !== 'Hadir' && selectedRecord.label !== 'Jadwal Libur' && (
                    <div className="bg-slate-50 rounded-[16px] p-3 text-center mt-1 border border-slate-100 flex flex-col items-center justify-center gap-2">
                      <span className="text-[13px] font-bold text-slate-700">
                        Tidak masuk kerja ({selectedRecord.label})
                      </span>
                      {(selectedRecord.catatan || selectedRecord.notes || selectedRecord.reason) && (
                        <div className="w-full pt-2 border-t border-slate-200/70 text-left px-1">
                          <span className="text-[11.5px] font-medium text-slate-600 leading-relaxed block">
                            <strong className="font-extrabold text-slate-800">Catatan : </strong>
                            {selectedRecord.catatan || selectedRecord.notes || selectedRecord.reason}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-[22px] border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.03)] p-4 text-center">
                  <span className="text-[12px] text-slate-400 font-bold">Tidak ada data absensi untuk tanggal ini.</span>
                </div>
              )}
            </div>
          )}

          {/* RECENT HISTORY LIST FOR CHOSEN MONTH & YEAR */}
          <div className="mx-4 mt-5">
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block">Log Absensi Bulan Ini</span>
              <span className="text-[10px] text-[#5f1340] font-black uppercase tracking-wider bg-[#5f1340]/10 px-2.5 py-0.5 rounded-full">
                {monthKeys.length} Hari {MONTHS_ID[calMonth]}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {monthKeys.slice().reverse().map(key => {
                const rec = currentAttendanceData[key];
                const d = parseInt(key.split('-')[2]);
                const dateObj = new Date(calYear, calMonth, d);
                const dayName = DAYS[dateObj.getDay()];
                return (
                  <div key={key} className="bg-white rounded-[20px] border border-slate-100 p-3.5 flex items-center gap-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
                    {/* Date badge */}
                    <div className={`w-10.5 h-10.5 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${
                      rec.label === 'Hadir' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : rec.label === 'Izin' 
                          ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                          : rec.label === 'Sakit' 
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : 'bg-purple-50 text-purple-600 border border-purple-100'
                    }`}>
                      <span className="text-[14.5px] font-black leading-none">{d}</span>
                      <span className="text-[8.5px] font-extrabold uppercase mt-0.5 opacity-80">{dayName}</span>
                    </div>

                    {/* Detail */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${rec.dot}`} />
                        <span className={`text-[13px] font-black ${
                          rec.label === 'Hadir' 
                            ? 'text-emerald-700' 
                            : rec.label === 'Izin' 
                              ? 'text-amber-700' 
                              : rec.label === 'Sakit'
                                ? 'text-rose-600'
                                : 'text-purple-700'
                        }`}>
                          {rec.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-bold block mt-0.5">
                        {rec.label === 'Hadir' 
                          ? `${rec.shift.split(' ')[0]} · ${rec.in} – ${rec.out}` 
                          : rec.label === 'Jadwal Libur' 
                            ? 'Libur Mingguan Operasional' 
                            : 'Tidak Hadir'}
                      </span>
                    </div>

                    {rec.label === 'Hadir' && (
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10.5px] text-slate-400 font-mono font-bold">8 Jam</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ==========================================
            GOOGLE CALENDAR STYLE MONTH & YEAR PICKER MODAL
            ========================================== */}
        {showPickerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-[360px] bg-white rounded-[28px] shadow-2xl p-5 border border-slate-100 flex flex-col gap-4">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-[#5f1340]" />
                  <h3 className="text-[15px] font-black text-slate-800">Pilih Bulan &amp; Tahun</h3>
                </div>
                <button
                  onClick={() => setShowPickerModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Year Select Pills */}
              <div>
                <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tahun</span>
                <div className="grid grid-cols-4 gap-2">
                  {AVAILABLE_YEARS.map(y => (
                    <button
                      key={y}
                      onClick={() => setTempPickerYear(y)}
                      className={`py-2 rounded-xl text-[12.5px] font-black transition-all ${
                        tempPickerYear === y
                          ? 'bg-[#5f1340] text-white shadow-md shadow-[#5f1340]/25'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              {/* Month Select Grid */}
              <div>
                <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Bulan</span>
                <div className="grid grid-cols-3 gap-2">
                  {MONTHS_ID.map((m, idx) => (
                    <button
                      key={m}
                      onClick={() => setTempPickerMonth(idx)}
                      className={`py-2.5 px-2 rounded-xl text-[12px] font-black transition-all text-center ${
                        tempPickerMonth === idx
                          ? 'bg-[#5f1340] text-white shadow-md shadow-[#5f1340]/25'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowPickerModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 text-[12.5px] font-extrabold hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={applyMonthYearPicker}
                  className="flex-1 py-3 rounded-2xl bg-[#5f1340] text-white text-[12.5px] font-black shadow-md shadow-[#5f1340]/25 hover:bg-[#4d0f34] transition-all"
                >
                  Terapkan Filter
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ===== BOTTOM NAVBAR ===== */}
        <Navbar />
      </div>
    </div>
  );
}
