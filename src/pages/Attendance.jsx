import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import formatName from '../utils/FormatName.js';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Shirt, 
  Droplets, 
  Waves, 
  Wind,
  ArrowLeft
} from 'lucide-react';

export default function Attendance() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentUser, setCurrentUser] = useState({
    fullName: 'Karyawan Waschen',
    employeeCode: 'WAI2026029',
    position: 'Staff Waschen'
  });
  const [clockInTime, setClockInTime] = useState(null);
  const [clockOutTime, setClockOutTime] = useState(null);

  useEffect(() => {
    document.title = 'Presensi Absensi - Waschen Mobile';
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'WS';
    const parts = String(name).trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name).slice(0, 2).toUpperCase() || 'WS';
  };

  const handleClockIn = () => {
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setClockInTime(timeStr);
  };

  const handleClockOut = () => {
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setClockOutTime(timeStr);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased select-none font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[90px]">

        {/* HERO HEADER WITH WASCHEN COLORS */}
        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-6 pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            <div className="absolute -top-2 left-2 transform -rotate-12">
              <Calendar className="w-20 h-20 text-white" />
            </div>
            <div className="absolute top-3 right-10 transform rotate-12">
              <Clock className="w-16 h-16 text-white" />
            </div>
          </div>

          <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />

          {/* Top Bar */}
          <div className="flex items-center justify-between relative z-10 mb-5">
            <div className="flex items-center gap-3 min-w-0">
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
                  {currentUser.position}
                </span>
              </div>
            </div>

            <div className="px-3 py-1 rounded-full bg-white/12 border border-white/15 text-[11px] font-extrabold text-pink-100 backdrop-blur-md flex items-center gap-1.5 flex-shrink-0 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-pink-200" />
              <span>Presensi GPS</span>
            </div>
          </div>

          {/* Realtime Clock & Date Display */}
          <div className="relative z-10 text-center py-2">
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider block">Waktu Saat Ini</span>
            <span className="text-[34px] font-black text-white font-mono tracking-tight leading-tight block">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[12px] text-pink-100/90 font-bold block mt-0.5">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="w-full relative">

          {/* CLOCK IN/OUT CARD */}
          <div className="mx-4 -mt-6 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-5 flex flex-col items-center gap-4 text-center">
            
            {/* Location Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 text-[11px] font-bold">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="truncate">Waschen Head Office &bull; GPS Terverifikasi</span>
            </div>

            {/* Shift Badge */}
            <div className="bg-pink-50/70 border border-pink-100 rounded-2xl px-4 py-2.5 w-full">
              <span className="text-[10px] text-[#5f1340] font-black uppercase tracking-wider block">Jadwal Shift Hari Ini</span>
              <span className="text-[13.5px] font-extrabold text-slate-800 block mt-0.5">Shift Pagi (07:00 – 15:00 WIB)</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 w-full mt-1">
              <button
                onClick={handleClockIn}
                disabled={!!clockInTime}
                className={`py-3.5 rounded-[18px] text-[13px] font-black shadow-md transition-all flex items-center justify-center gap-2 ${
                  clockInTime 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-none cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-emerald-500/20'
                }`}
              >
                <CheckCircle2 className="w-4.5 h-4.5" />
                <span>{clockInTime ? `Masuk: ${clockInTime}` : 'Clock In'}</span>
              </button>

              <button
                onClick={handleClockOut}
                disabled={!clockInTime || !!clockOutTime}
                className={`py-3.5 rounded-[18px] text-[13px] font-black shadow-md transition-all flex items-center justify-center gap-2 ${
                  clockOutTime 
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-none cursor-default'
                    : !clockInTime 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white shadow-rose-500/20'
                }`}
              >
                <Clock className="w-4.5 h-4.5" />
                <span>{clockOutTime ? `Keluar: ${clockOutTime}` : 'Clock Out'}</span>
              </button>
            </div>

          </div>

          {/* INFO BANNER */}
          <div className="mx-4 mt-5 bg-white border border-slate-100 rounded-[22px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-4">
            <h4 className="text-[13px] font-black text-slate-800 mb-1">Catatan Presensi</h4>
            <p className="text-[11.5px] text-slate-400 font-medium leading-relaxed">
              Pastikan Anda berada dalam radius area operasional outlet Waschen sebelum menekan tombol Clock In / Clock Out.
            </p>
          </div>

        </div>

        <Navbar />
      </div>
    </div>
  );
}
