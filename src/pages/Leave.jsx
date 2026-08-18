import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import formatName from '../utils/FormatName.js';
import { 
  Sun, 
  Calendar, 
  Clock, 
  FileText, 
  ArrowLeft, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  FileCheck
} from 'lucide-react';

export default function Leave() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState({
    fullName: 'Karyawan Waschen',
    position: 'Staff Waschen'
  });

  useEffect(() => {
    document.title = 'Pengajuan Izin & Cuti - Waschen Mobile';
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

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased select-none font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[90px]">

        {/* HERO HEADER */}
        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-6 pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            <div className="absolute -top-2 left-2 transform -rotate-12">
              <Sun className="w-20 h-20 text-white" />
            </div>
            <div className="absolute top-3 right-10 transform rotate-12">
              <FileText className="w-16 h-16 text-white" />
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
              <Sun className="w-3.5 h-3.5 text-pink-200" />
              <span>Izin &amp; Cuti</span>
            </div>
          </div>

          {/* Header Title */}
          <div className="relative z-10 text-center py-2">
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider block">Manajemen Pengajuan</span>
            <span className="text-[22px] font-black text-white tracking-tight leading-tight block mt-0.5">
              Izin, Sakit &amp; Cuti Karyawan
            </span>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="w-full relative">

          {/* LEAVE STATS CARD */}
          <div className="mx-4 -mt-6 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Sisa Kuota Cuti Tahunan</span>
              <span className="text-[12px] font-black text-[#5f1340] bg-[#5f1340]/10 px-2.5 py-0.5 rounded-full">12 Hari</span>
            </div>

            <button 
              className="w-full py-3.5 rounded-[18px] bg-[#5f1340] hover:bg-[#4d0f34] text-white text-[13.5px] font-black shadow-md shadow-[#5f1340]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-1 cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Buat Pengajuan Izin Baru</span>
            </button>
          </div>

          {/* RECENT LEAVE REQUESTS */}
          <div className="mx-4 mt-5">
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">Riwayat Pengajuan Saya</span>
              <span className="text-[10px] text-slate-400 font-semibold">Tahun 2026</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="bg-white rounded-[20px] border border-slate-100 p-4 flex items-center gap-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
                <div className="w-10.5 h-10.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center flex-shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-black text-slate-800">Izin Keperluan Keluarga</span>
                    <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Menunggu</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium block mt-0.5">20 Februari 2026 &bull; 1 Hari</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <Navbar />
      </div>
    </div>
  );
}
