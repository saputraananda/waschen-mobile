import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import formatName from '../../../utils/FormatName.js';
import { getHeaderSubtitle } from '../../../utils/getDisplayRole.js';

/** Header hero + kerangka halaman Menu Leader. Cek akses leader di sini, backend tetap yang memutuskan. */
export default function LeaderShell({ title, caption, icon: Icon, onRefresh, refreshing, children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    try {
      const parsed = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(parsed);
      const leader = [1, '1', true].includes(parsed.is_leader) || [1, '1', true].includes(parsed.isLeader);
      if (!leader) navigate('/', { replace: true });
    } catch (_) { navigate('/', { replace: true }); }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-safe-header pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            {Icon && <Icon className="absolute -top-2 left-2 w-20 h-20 text-white -rotate-12" />}
          </div>
          <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />
          <div className="flex items-center gap-3 relative z-10 mb-5 min-w-0">
            <button type="button" onClick={() => navigate('/')} aria-label="Kembali"
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-all">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-white leading-snug truncate tracking-tight">{formatName(user.fullName || user.full_name)}</h2>
              <span className="text-[11px] text-pink-200/80 font-medium truncate block">{getHeaderSubtitle(user)}</span>
            </div>
            <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Muat ulang"
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-all disabled:opacity-60">
              <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="relative z-10 text-center py-2">
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider block">{caption}</span>
            <span className="text-[22px] font-black text-white tracking-tight leading-tight block mt-0.5">{title}</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}