import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import waschenLogo from '../assets/images/waschen.png';
import Navbar from '../components/Navbar';
import {
  Calendar,
  Clock,
  FileText,
  DollarSign,
  User,
  Sparkles,
  MapPin,
  Bell,
  RefreshCw,
  Layers,
  Check,
  CreditCard,
  Sun,
  Info,
  Shirt,
  Droplets,
  Waves,
  Wind
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  // User Session State
  const [currentUser, setCurrentUser] = useState({
    fullName: 'Ananda Saputra',
    employeeCode: 'WAI2026029',
    position: 'Valet Lead & Admin',
    department: 'Waschen HQ',
    role: 'admin',
    assignedOutletName: 'Waschen Head Office (Jakarta Selatan)',
    avatar: null
  });

  // Real-time Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check auth token and set document title
  useEffect(() => {
    document.title = 'Dasbor Utama - Waschen Mobile';
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token) {
      navigate('/login');
    } else if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser(prev => ({
          ...prev,
          ...parsed,
          assignedOutletName: parsed.assignedOutletName || prev.assignedOutletName || 'Waschen Head Office'
        }));
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }
  }, [navigate]);

  // Real-time Clock Ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Safe Get Initials Helper
  const getInitials = (name) => {
    if (!name) return 'WS';
    const parts = String(name).trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name).slice(0, 2).toUpperCase() || 'WS';
  };

  // Safe Outlet Name Helper
  const getOutletDisplay = (outlet) => {
    if (!outlet) return 'Waschen Head Office';
    return String(outlet).split('(')[0].trim() || 'Waschen Head Office';
  };

  // Format Time & Date
  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Dynamic Greeting based on current hour
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 4) return 'Selamat Malam';
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // Handler for menu clicks targeting future pages
  const handleMenuClick = (path, menuName) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-slate-200/70 flex justify-center items-start antialiased font-sans select-none">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col justify-between relative pb-[90px]">

        {/* ==========================================
            MAIN CONTENT AREA
            ========================================== */}
        <div className="w-full relative">

          {/* ==========================================
              IKM-STYLE HERO HEADER WITH WASCHEN COLORS
              ========================================== */}
          <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-6 pb-7 px-5 relative overflow-hidden text-white rounded-b-[32px] shadow-lg shadow-[#5f1340]/20">
            
            {/* Laundry Floating Watermark Icons (Mesin Cuci, Baju, Air, Angin, Kilau) - Low Opacity */}
            <div className="absolute inset-0 opacity-[0.08] pointer-events-none z-0 overflow-hidden select-none">
              <div className="absolute -top-1 left-2 transform -rotate-12">
                <RefreshCw className="w-16 h-16 text-white" />
              </div>
              <div className="absolute top-2 right-14 transform rotate-12">
                <Shirt className="w-14 h-14 text-white" />
              </div>
              <div className="absolute bottom-2 left-1/3 transform -rotate-6">
                <Droplets className="w-12 h-12 text-white" />
              </div>
              <div className="absolute bottom-4 left-6 transform rotate-45">
                <Waves className="w-14 h-14 text-white" />
              </div>
              <div className="absolute top-1/2 right-2 transform -rotate-12">
                <Wind className="w-12 h-12 text-white" />
              </div>
            </div>

            {/* Ambient Glow Spot */}
            <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />

            {/* TOP ROW: User Avatar + Name + Info Button */}
            <div className="flex items-center justify-between relative z-10 mb-6">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                {/* Squircle Avatar Box */}
                <div 
                  onClick={() => navigate('/profile')}
                  className="w-[50px] h-[50px] rounded-[18px] bg-white/15 border border-white/25 flex items-center justify-center font-extrabold text-[17px] text-white flex-shrink-0 cursor-pointer shadow-sm hover:scale-105 transition-transform"
                >
                  {getInitials(currentUser?.fullName)}
                </div>

                {/* User Name & Employee Code */}
                <div className="min-w-0">
                  <h2 className="text-[15.5px] font-bold text-white leading-snug truncate tracking-tight">
                    {currentUser?.fullName || 'Karyawan Waschen'}
                  </h2>
                  <p className="text-[11.5px] text-white/75 font-medium truncate mt-0.5 tracking-wide">
                    Karyawan &middot; {currentUser?.employeeCode || 'WAI2026029'}
                  </p>
                </div>
              </div>

              {/* Info Button Icon (Squircle Glass) */}
              <button
                onClick={() => handleMenuClick('/notifikasi', 'Notifikasi')}
                className="w-10 h-10 rounded-[18px] bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white flex items-center justify-center flex-shrink-0 transition-all active:scale-95 shadow-sm"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>

            {/* BOTTOM ROW: Greeting + Big Clock + Date (Left) & Waschen Logo (Right) */}
            <div className="flex justify-between items-end relative z-10 pt-1">
              {/* Left Side: Greeting, Clock, Date */}
              <div>
                <div className="flex items-center gap-1.5 text-[13px] text-white/80 font-medium">
                  <span>{getGreeting()}</span>
                  <span>🌤️</span>
                </div>

                {/* Clock Display */}
                <div className="text-[32px] font-bold font-mono tracking-tight text-white leading-none mt-1">
                  {formatTime(currentTime)}
                </div>

                {/* Date Display */}
                <p className="text-[12.5px] text-white/70 font-medium mt-1">
                  {formatDate(currentTime)}
                </p>
              </div>

              {/* Right Side: Enlarged Waschen Brand Logo */}
              <div className="pb-0.5">
                <img
                  src={waschenLogo}
                  alt="Waschen Logo"
                  className="h-14 sm:h-16 w-auto object-contain filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-all"
                />
              </div>
            </div>

          </div>

          {/* ==========================================
              MENU & LAYANAN UTAMA SECTION
              ========================================== */}
          <div className="mx-4 mt-6 relative z-20">
            <div className="flex justify-between items-center mb-3.5 px-1">
              <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">
                Menu Utama
              </h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Waschen Mobile
              </span>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-2 gap-3.5">

              {/* Menu 1: Absensi */}
              <button
                id="menu-absensi-btn"
                onClick={() => handleMenuClick('/absensi', 'Absensi')}
                className="bg-white border border-slate-100 rounded-[22px] p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(16,185,129,0.12)] hover:-translate-y-0.5 active:scale-[0.97] transition-all relative overflow-hidden flex flex-col justify-between min-h-[120px] group"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-100/70 to-transparent rounded-bl-[40px] pointer-events-none" />
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-black text-slate-800 group-hover:text-emerald-600 transition-colors leading-tight">
                    Absensi
                  </h4>
                  <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5">
                    Clock In & Out GPS
                  </span>
                </div>
              </button>

              {/* Menu 2: Izin / Libur */}
              <button
                id="menu-izin-btn"
                onClick={() => handleMenuClick('/izin', 'Izin / Libur')}
                className="bg-white border border-slate-100 rounded-[22px] p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(245,158,11,0.12)] hover:-translate-y-0.5 active:scale-[0.97] transition-all relative overflow-hidden flex flex-col justify-between min-h-[120px] group"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-100/70 to-transparent rounded-bl-[40px] pointer-events-none" />
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-black text-slate-800 group-hover:text-amber-600 transition-colors leading-tight">
                    Izin / Libur
                  </h4>
                  <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5">
                    Pengajuan Sakit & Cuti
                  </span>
                </div>
              </button>

              {/* Menu 3: Kasbon & Pinjaman */}
              <button
                id="menu-kasbon-btn"
                onClick={() => handleMenuClick('/kasbon', 'Kasbon & Pinjaman')}
                className="bg-white border border-slate-100 rounded-[22px] p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(168,85,247,0.12)] hover:-translate-y-0.5 active:scale-[0.97] transition-all relative overflow-hidden flex flex-col justify-between min-h-[120px] group"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-purple-100/70 to-transparent rounded-bl-[40px] pointer-events-none" />
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-black text-slate-800 group-hover:text-purple-600 transition-colors leading-tight">
                    Kasbon & Pinjaman
                  </h4>
                  <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5">
                    Pengajuan & Limit Gaji
                  </span>
                </div>
              </button>

              {/* Menu 4: Update Progress */}
              <button
                id="menu-progress-btn"
                onClick={() => handleMenuClick('/update-progres', 'Update Progress')}
                className="bg-white border border-slate-100 rounded-[22px] p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(95,19,64,0.12)] hover:-translate-y-0.5 active:scale-[0.97] transition-all relative overflow-hidden flex flex-col justify-between min-h-[120px] group"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#5f1340]/10 to-transparent rounded-bl-[40px] pointer-events-none" />
                <div className="w-10 h-10 rounded-2xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-black text-slate-800 group-hover:text-[#5f1340] transition-colors leading-tight">
                    Update Progress
                  </h4>
                  <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5">
                    Status Pipeline Pakaian
                  </span>
                </div>
              </button>

            </div>
          </div>

        </div>

        {/* ==========================================
            MODULAR FLOATING BOTTOM NAVIGATION
            ========================================== */}
        <Navbar />

      </div>
    </div>
  );
}
