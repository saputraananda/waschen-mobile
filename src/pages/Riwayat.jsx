import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import waschenLogo from '../assets/images/waschen.png';
import Navbar from '../components/Navbar';

// ==========================================
// DUMMY ATTENDANCE DATA
// ==========================================
const generateAttendanceData = () => {
    const data = {};
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const statusPool = [
        { label: 'Hadir', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', shift: 'Pagi (07:00 - 15:00)', in: '06:58', out: '15:03' },
        { label: 'Hadir', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', shift: 'Siang (15:00 - 23:00)', in: '14:55', out: '23:12' },
        { label: 'Izin', color: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500', shift: '-', in: '-', out: '-' },
        { label: 'Sakit', color: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-400', shift: '-', in: '-', out: '-' },
        { label: 'Hadir', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', shift: 'Pagi (07:00 - 15:00)', in: '07:02', out: '15:05' },
    ];

    for (let d = 1; d <= now.getDate(); d++) {
        const date = new Date(year, month, d);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const status = statusPool[d % statusPool.length];
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            data[key] = { ...status, date: key };
        }
    }
    return data;
};

const ATTENDANCE_DATA = generateAttendanceData();

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function Riwayat() {
    const navigate = useNavigate();
    const now = new Date();

    const [currentUser, setCurrentUser] = useState({ fullName: 'Karyawan Waschen', position: '-' });
    const [calMonth, setCalMonth] = useState(now.getMonth());
    const [calYear, setCalYear] = useState(now.getFullYear());
    const [selectedDate, setSelectedDate] = useState(null);

    useEffect(() => {
        document.title = 'Riwayat Absen - Waschen Mobile';
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try { setCurrentUser(JSON.parse(storedUser)); } catch (e) { }
        }
    }, [navigate]);

    // Build calendar grid
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const calCells = [];
    for (let i = 0; i < firstDay; i++) calCells.push(null);
    for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

    const prevMonth = () => {
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
        else setCalMonth(m => m - 1);
        setSelectedDate(null);
    };
    const nextMonth = () => {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
        else setCalMonth(m => m + 1);
        setSelectedDate(null);
    };

    const getKey = (d) => `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const selectedKey = selectedDate ? getKey(selectedDate) : null;
    const selectedRecord = selectedKey ? ATTENDANCE_DATA[selectedKey] : null;

    // Summary stats for current month view
    const monthKeys = Object.keys(ATTENDANCE_DATA).filter(k => k.startsWith(`${calYear}-${String(calMonth + 1).padStart(2, '0')}`));
    const stats = { hadir: 0, izin: 0, sakit: 0 };
    monthKeys.forEach(k => {
        if (ATTENDANCE_DATA[k].label === 'Hadir') stats.hadir++;
        else if (ATTENDANCE_DATA[k].label === 'Izin') stats.izin++;
        else if (ATTENDANCE_DATA[k].label === 'Sakit') stats.sakit++;
    });

    const isToday = (d) => d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
    const isFuture = (d) => new Date(calYear, calMonth, d) > now;

    return (
        <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased">
            <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[90px] font-sans">

                {/* ===== HERO HEADER ===== */}
                <div className="bg-gradient-to-br from-[#2a051b] via-[#4d0f34] to-[#5f1340] pt-8 pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white">
                    {/* Wavy layers */}
                    <div className="absolute top-0 left-[-20%] right-[-20%] h-[70%] bg-[#3d0a28] rounded-b-[45%] transform scale-x-110 origin-top pointer-events-none z-0" />
                    <div className="absolute top-0 left-[-10%] right-[-10%] h-[52%] bg-gradient-to-br from-[#4d0f34] to-[#5f1340] rounded-b-[45%] pointer-events-none z-0" />
                    <div className="absolute top-0 right-[-15%] w-[60%] h-[120px] bg-gradient-to-br from-white/10 to-transparent rounded-bl-[180px] pointer-events-none z-0" />
                    {/* Bubble */}
                    <div className="absolute top-4 right-4 w-16 h-16 rounded-full border border-white/20 bg-white/5 pointer-events-none z-10 animate-bubble-1">
                        <div className="absolute top-2 left-2 w-4 h-2 bg-white/25 rounded-full rotate-[-30deg]" />
                    </div>

                    {/* Top bar */}
                    <div className="relative z-20 flex justify-between items-center mb-4">
                        <img src={waschenLogo} alt="Waschen" className="h-7 w-auto object-contain" />
                        <div className="text-right">
                            <span className="text-[9px] text-pink-200/70 uppercase tracking-widest font-semibold block">Riwayat</span>
                            <span className="text-[12px] font-extrabold text-white">Absensi Kehadiran</span>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="relative z-20 flex gap-2.5 mt-1">
                        {[
                            { label: 'Hadir', val: stats.hadir, color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-400/20' },
                            { label: 'Izin', val: stats.izin, color: 'text-amber-300', bg: 'bg-amber-500/15 border-amber-400/20' },
                            { label: 'Sakit', val: stats.sakit, color: 'text-red-300', bg: 'bg-red-500/15 border-red-400/20' },
                        ].map(s => (
                            <div key={s.label} className={`flex-1 ${s.bg} border rounded-[14px] py-2 px-2 text-center`}>
                                <span className={`text-[18px] font-extrabold font-mono ${s.color} block leading-none`}>{s.val}</span>
                                <span className="text-[9px] text-white/60 font-semibold uppercase tracking-wider">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ===== CONTENT AREA ===== */}
                <div className="w-full relative">

                    {/* CALENDAR CARD */}
                    <div className="mx-4 -mt-6 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.07)] border border-slate-100 overflow-hidden">

                        {/* Month navigation */}
                        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-50">
                            <button onClick={prevMonth} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:scale-95 transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div className="text-center">
                                <span className="text-[14px] font-extrabold text-slate-800">{MONTHS_ID[calMonth]}</span>
                                <span className="text-[13px] font-bold text-slate-400 ml-1.5">{calYear}</span>
                            </div>
                            <button onClick={nextMonth} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:scale-95 transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>

                        {/* Day headers */}
                        <div className="grid grid-cols-7 px-3 pt-2 pb-0">
                            {DAYS.map(d => (
                                <div key={d} className={`text-center text-[9.5px] font-bold py-1 ${d === 'Min' || d === 'Sab' ? 'text-rose-400' : 'text-slate-400'} uppercase tracking-wider`}>{d}</div>
                            ))}
                        </div>

                        {/* Calendar cells */}
                        <div className="grid grid-cols-7 gap-y-1 px-3 pb-4">
                            {calCells.map((d, i) => {
                                if (!d) return <div key={`empty-${i}`} />;
                                const key = getKey(d);
                                const rec = ATTENDANCE_DATA[key];
                                const isSelected = selectedDate === d;
                                const today = isToday(d);
                                const future = isFuture(d);
                                const dayIndex = (firstDay + d - 1) % 7;
                                const isWeekend = dayIndex === 0 || dayIndex === 6;

                                let dotColor = '';
                                if (rec?.label === 'Hadir') dotColor = 'bg-emerald-400';
                                else if (rec?.label === 'Izin') dotColor = 'bg-amber-400';
                                else if (rec?.label === 'Sakit') dotColor = 'bg-red-400';

                                return (
                                    <button
                                        key={key}
                                        disabled={future || isWeekend}
                                        onClick={() => setSelectedDate(isSelected ? null : d)}
                                        className={`flex flex-col items-center justify-center rounded-xl py-1.5 gap-0.5 transition-all duration-150 active:scale-90 ${isSelected
                                                ? 'bg-[#5f1340] text-white scale-[1.08] shadow-md shadow-[#5f1340]/20'
                                                : today
                                                    ? 'bg-[#5f1340]/10 text-[#5f1340]'
                                                    : isWeekend || future
                                                        ? 'opacity-25 cursor-not-allowed'
                                                        : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                    >
                                        <span className={`text-[12px] font-extrabold leading-none ${isSelected ? 'text-white' : isWeekend ? 'text-slate-400' : today ? 'text-[#5f1340]' : 'text-slate-800'}`}>{d}</span>
                                        {dotColor && !isWeekend && (
                                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : dotColor}`} />
                                        )}
                                        {!dotColor && !isWeekend && !future && rec === undefined && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SELECTED DATE DETAIL CARD */}
                    {selectedDate && (
                        <div className="mx-4 mt-3 relative z-10">
                            {selectedRecord ? (
                                <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.05)] p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Detail Absensi</span>
                                            <span className="text-[14px] font-extrabold text-slate-800">{selectedDate} {MONTHS_ID[calMonth]} {calYear}</span>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-extrabold border ${selectedRecord.color}`}>
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
                                                <div key={item.label} className="bg-slate-50 rounded-[12px] p-2.5 text-center">
                                                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">{item.label}</span>
                                                    <span className="text-[13px] font-extrabold text-slate-800 font-mono">{item.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectedRecord.label !== 'Hadir' && (
                                        <div className="bg-slate-50 rounded-[12px] p-3 text-center mt-1">
                                            <span className="text-[12px] text-slate-500 font-medium">Tidak masuk kerja hari ini</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.04)] p-4 text-center">
                                    <span className="text-[12px] text-slate-400 font-medium">Tidak ada data absensi untuk tanggal ini.</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* RECENT HISTORY LIST */}
                    <div className="mx-4 mt-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[12.5px] font-extrabold text-slate-800 uppercase tracking-tight">Log Bulan Ini</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{monthKeys.length} hari kerja</span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {monthKeys.slice().reverse().map(key => {
                                const rec = ATTENDANCE_DATA[key];
                                const d = parseInt(key.split('-')[2]);
                                const dateObj = new Date(calYear, calMonth, d);
                                const dayName = DAYS[dateObj.getDay()];
                                return (
                                    <div key={key} className="bg-white rounded-[18px] border border-slate-100/80 p-3.5 flex items-center gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                                        {/* Date badge */}
                                        <div className={`w-10 h-10 rounded-[12px] flex flex-col items-center justify-center flex-shrink-0 ${rec.label === 'Hadir' ? 'bg-emerald-50' : rec.label === 'Izin' ? 'bg-amber-50' : 'bg-red-50'}`}>
                                            <span className={`text-[14px] font-extrabold leading-none ${rec.label === 'Hadir' ? 'text-emerald-600' : rec.label === 'Izin' ? 'text-amber-600' : 'text-red-500'}`}>{d}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">{dayName}</span>
                                        </div>
                                        {/* Detail */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${rec.dot}`} />
                                                <span className={`text-[12px] font-extrabold ${rec.label === 'Hadir' ? 'text-emerald-700' : rec.label === 'Izin' ? 'text-amber-700' : 'text-red-600'}`}>{rec.label}</span>
                                            </div>
                                            <span className="text-[10.5px] text-slate-400 font-medium block">
                                                {rec.label === 'Hadir' ? `${rec.shift.split(' ')[0]} · ${rec.in} – ${rec.out}` : 'Tidak Hadir'}
                                            </span>
                                        </div>
                                        {rec.label === 'Hadir' && (
                                            <div className="text-right flex-shrink-0">
                                                <span className="text-[10px] text-slate-400 font-mono">8 jam</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ===== BOTTOM NAVBAR ===== */}
                <Navbar />
            </div>
        </div>
    );
}
