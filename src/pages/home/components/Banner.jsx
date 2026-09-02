import React from 'react';
import { RefreshCw, Shirt, Droplets, Waves, Wind, Info } from 'lucide-react';
import waschenLogo from '../../../assets/images/waschen.png';
import formatName from '../../../utils/FormatName.js';
import getDisplayRole from '../../../utils/getDisplayRole.js';

export default function Banner({
  currentUser,
  currentTime,
  onNavigateProfile,
  onInfoClick,
  getInitials,
  formatTime,
  formatDate,
  getGreeting,
}) {
  return (
    <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-safe-header pb-7 px-5 relative overflow-hidden text-white rounded-b-[32px] shadow-lg shadow-[#5f1340]/20">
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

      <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />

      <div className="flex items-center justify-between relative z-10 mb-6">
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div
            onClick={onNavigateProfile}
            className="w-[50px] h-[50px] rounded-[18px] bg-white/15 border border-white/25 flex items-center justify-center font-extrabold text-[17px] text-white flex-shrink-0 cursor-pointer shadow-sm hover:scale-105 transition-transform"
          >
            {getInitials(formatName(currentUser?.fullName || currentUser?.full_name))}
          </div>

          <div className="min-w-0">
            <h2 className="text-[15.5px] font-bold text-white leading-snug truncate tracking-tight">
              {formatName(currentUser?.fullName || currentUser?.full_name || 'Karyawan Waschen')}
            </h2>
            <p className="text-[11.5px] text-white/75 font-medium truncate mt-0.5 tracking-wide">
              {[getDisplayRole(currentUser), currentUser?.employeeCode].filter(Boolean).join(' · ') || 'Karyawan Waschen'}
            </p>
          </div>
        </div>

        <button
          onClick={onInfoClick}
          className="w-10 h-10 rounded-[18px] bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white flex items-center justify-center flex-shrink-0 transition-all active:scale-95 shadow-sm"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      <div className="flex justify-between items-end relative z-10 pt-1">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-white/80 font-medium">
            <span>{getGreeting()}</span>
            <span>🌤️</span>
          </div>

          <div className="text-[32px] font-bold font-mono tracking-tight text-white leading-none mt-1">
            {formatTime(currentTime)}
          </div>

          <p className="text-[12.5px] text-white/70 font-medium mt-1">
            {formatDate(currentTime)}
          </p>
        </div>

        <div className="pb-0.5">
          <img
            src={waschenLogo}
            alt="Waschen Logo"
            className="h-14 sm:h-16 w-auto object-contain filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-all"
          />
        </div>
      </div>
    </div>
  );
}
