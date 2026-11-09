import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';

export default function AcademyShell({ title, subtitle, backTo = '/', children }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-200/70 flex justify-center items-start">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col pb-8">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#3a0b28] via-[#5f1340] to-[#8a245c] px-4 pt-5 pb-8">
          <GraduationCap className="absolute top-3 right-6 w-16 h-16 text-white rotate-12 opacity-20" aria-hidden="true" />
          <div className="flex items-center gap-3 relative z-10 mb-5">
            <button
              type="button"
              onClick={() => navigate(backTo)}
              aria-label="Kembali"
              className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider">Alora Academy</span>
          </div>
          <div className="relative z-10 text-center py-1">
            <h1 className="text-[20px] font-black text-white tracking-tight leading-tight">{title}</h1>
            {subtitle && <p className="text-[11px] text-pink-200/80 font-medium mt-1">{subtitle}</p>}
          </div>
        </div>
        <div className="px-4 -mt-4 relative z-10 space-y-3">{children}</div>
      </div>
    </div>
  );
}

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Message({ children, tone = 'muted' }) {
  const cls = tone === 'error' ? 'text-rose-600' : 'text-slate-400';
  return <Card className={`text-center text-[12px] font-semibold ${cls}`}>{children}</Card>;
}
