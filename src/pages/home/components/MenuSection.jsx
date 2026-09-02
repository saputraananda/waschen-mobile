import React from 'react';
import { Calendar, Sun, CreditCard, RefreshCw } from 'lucide-react';

export default function MenuSection({ onMenuClick }) {
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
          onClick={() => onMenuClick('/attendance', 'Absensi')}
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
              Absen Masuk & Pulang GPS
            </span>
          </div>
        </button>

        <button
          id="menu-izin-btn"
          onClick={() => onMenuClick('/leave', 'Izin / Libur')}
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

        <button
          id="menu-kasbon-btn"
          onClick={() => onMenuClick('/kasbon', 'Kasbon & Pinjaman')}
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

        <button
          id="menu-progress-btn"
          onClick={() => onMenuClick('/produksi', 'Update Progress')}
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
  );
}
