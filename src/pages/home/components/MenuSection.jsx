import React from 'react';
import { Calendar, Sun, CreditCard, RefreshCw, Timer, Lock } from 'lucide-react';

export default function MenuSection({ onMenuClick, menusLocked = false }) {
  const lockBadge = menusLocked ? (
    <span className="absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[9px] font-black text-rose-700">
      <Lock className="w-2.5 h-2.5" /> Lock
    </span>
  ) : null;

  return (
    <div className="mx-4 mt-6 relative z-20">
      <div className="flex justify-between items-center mb-3.5 px-1">
        <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">
          Menu Utama
        </h3>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          Waschen Mobile
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <button
          id="menu-absensi-btn"
          type="button"
          disabled={menusLocked}
          onClick={() => !menusLocked && onMenuClick('/attendance', 'Absensi')}
          className={`bg-white border border-slate-100 rounded-[22px] p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all relative overflow-hidden flex flex-col justify-between min-h-[120px] group ${
            menusLocked ? 'opacity-55 cursor-not-allowed' : 'hover:shadow-[0_8px_24px_rgba(16,185,129,0.12)] hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer'
          }`}
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-100/70 to-transparent rounded-bl-[40px] pointer-events-none" />
          {lockBadge}
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[13.5px] font-black text-slate-800 leading-tight">Absensi</h4>
            <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5">
              {menusLocked ? 'Tutup lembur dulu' : 'Absen Masuk & Pulang GPS'}
            </span>
          </div>
        </button>

        <button
          id="menu-izin-btn"
          type="button"
          disabled={menusLocked}
          onClick={() => !menusLocked && onMenuClick('/leave', 'Izin / Libur')}
          className={`bg-white border border-slate-100 rounded-[22px] p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all relative overflow-hidden flex flex-col justify-between min-h-[120px] group ${
            menusLocked ? 'opacity-55 cursor-not-allowed' : 'hover:shadow-[0_8px_24px_rgba(245,158,11,0.12)] hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer'
          }`}
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-100/70 to-transparent rounded-bl-[40px] pointer-events-none" />
          {lockBadge}
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[13.5px] font-black text-slate-800 leading-tight">Izin / Libur</h4>
            <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5">
              {menusLocked ? 'Tutup lembur dulu' : 'Pengajuan Sakit & Cuti'}
            </span>
          </div>
        </button>

        <button
          id="menu-kasbon-btn"
          type="button"
          disabled={menusLocked}
          onClick={() => !menusLocked && onMenuClick('/kasbon', 'Kasbon & Pinjaman')}
          className={`bg-white border border-slate-100 rounded-[22px] p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all relative overflow-hidden flex flex-col justify-between min-h-[120px] group ${
            menusLocked ? 'opacity-55 cursor-not-allowed' : 'hover:shadow-[0_8px_24px_rgba(168,85,247,0.12)] hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer'
          }`}
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-purple-100/70 to-transparent rounded-bl-[40px] pointer-events-none" />
          {lockBadge}
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[13.5px] font-black text-slate-800 leading-tight">Kasbon & Pinjaman</h4>
            <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5">
              {menusLocked ? 'Tutup lembur dulu' : 'Pengajuan & Limit Gaji'}
            </span>
          </div>
        </button>

        <button
          id="menu-lembur-btn"
          type="button"
          onClick={() => onMenuClick('/overtime', 'Lembur')}
          className="bg-white border border-slate-100 rounded-[22px] p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(14,165,233,0.12)] hover:-translate-y-0.5 active:scale-[0.97] transition-all relative overflow-hidden flex flex-col justify-between min-h-[120px] group cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-sky-100/70 to-transparent rounded-bl-[40px] pointer-events-none" />
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[13.5px] font-black text-slate-800 group-hover:text-sky-600 transition-colors leading-tight">Lembur</h4>
            <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5">Start / Close Sesi</span>
          </div>
        </button>
      </div>

      <button
        id="menu-progress-btn"
        type="button"
        disabled={menusLocked}
        onClick={() => !menusLocked && onMenuClick('/produksi', 'Update Progress')}
        className={`mt-3.5 w-full bg-white border border-slate-100 rounded-[22px] p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all relative overflow-hidden flex items-center gap-4 min-h-[88px] group ${
          menusLocked ? 'opacity-55 cursor-not-allowed' : 'hover:shadow-[0_8px_24px_rgba(95,19,64,0.12)] hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer'
        }`}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#5f1340]/10 to-transparent rounded-bl-[48px] pointer-events-none" />
        {lockBadge}
        <div className="w-12 h-12 rounded-2xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
          <RefreshCw className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1 relative z-10">
          <h4 className="text-[14px] font-black text-slate-800 group-hover:text-[#5f1340] transition-colors leading-tight">
            Update Progress
          </h4>
          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
            {menusLocked ? 'Tutup lembur dulu sebelum update progress' : 'Status Pipeline Pakaian — cuci, setrika, packing'}
          </span>
        </div>
      </button>
    </div>
  );
}
