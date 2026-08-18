import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layers, Clock, User } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'beranda', label: 'Beranda', route: '/', icon: <Layers className="w-5 h-5" /> },
    { id: 'history', label: 'Riwayat', route: '/history', icon: <Clock className="w-5 h-5" /> },
    { id: 'profil', label: 'Profil', route: '/profile', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 bg-white/95 backdrop-blur-[24px] border-t border-slate-200/60 flex items-center justify-around py-2 px-3 shadow-[0_-8px_32px_rgba(0,0,0,0.06)]">
      {tabs.map((tab) => {
        const isActive =
          location.pathname === tab.route ||
          (tab.route !== '/' && location.pathname.startsWith(tab.route));

        return (
          <button
            key={tab.id}
            id={`nav-${tab.id}-btn`}
            onClick={() => navigate(tab.route)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-all relative ${
              isActive ? 'text-[#5f1340]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {isActive && (
              <span className="absolute -top-2 w-8 h-1 bg-[#5f1340] rounded-full shadow-[0_2px_8px_rgba(95,19,64,0.4)]" />
            )}
            <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-[#5f1340]/10' : ''}`}>
              {tab.icon}
            </div>
            <span className={`text-[10px] tracking-wider ${isActive ? 'font-black' : 'font-semibold'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
