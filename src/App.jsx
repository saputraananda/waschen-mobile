import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Login from './pages/auth/Login.jsx';
import Riwayat from './pages/Riwayat.jsx';
import Profile from './pages/Profile.jsx';
import EditProfile from './pages/EditProfile.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import waschenLogo from './assets/images/waschen.png';

// ==========================================
// ELEGANT STARTUP SPLASH SCREEN COMPONENT (morphs transition to login)
// ==========================================
function SplashScreen({ isTransitioning }) {
  return (
    <div className={`fixed inset-0 bg-slate-100/90 backdrop-blur-[1px] flex justify-center items-center antialiased z-50 transition-opacity duration-700 ease-in-out ${isTransitioning ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="w-full max-w-[430px] h-[100dvh] bg-[#2a051b] flex flex-col justify-between items-center py-20 px-6 relative overflow-hidden font-sans text-white shadow-2xl">

        {/* ==========================================
            ABSTRACT WAVY BACKDROP (Screenshot 1 Visuals)
            ========================================== */}
        {/* Wave Layer 1 */}
        <div className="absolute top-0 left-[-20%] right-[-20%] h-[70%] bg-[#3d0a28] rounded-b-[45%] transform scale-x-110 origin-top pointer-events-none z-0" />

        {/* Wave Layer 2 */}
        <div className="absolute top-0 left-[-10%] right-[-10%] h-[55%] bg-gradient-to-br from-[#4d0f34] to-[#5f1340] rounded-b-[45%] shadow-[0_12px_36px_rgba(0,0,0,0.18)] pointer-events-none z-0" />

        {/* Wave Layer 3 (Liquid Accent) */}
        <div className="absolute top-0 right-0 left-[15%] h-[35%] bg-[#8c2060]/30 rounded-bl-[120px] rounded-br-[60px] pointer-events-none z-0" />

        {/* Wave Layer 4 (Top White Accent) */}
        <div className="absolute top-0 right-[-15%] w-[60%] h-[200px] bg-gradient-to-br from-white/20 to-transparent rounded-bl-[180px] pointer-events-none z-0" />

        {/* ==========================================
            3D FLOATING SOAP BUBBLES (Laundry Vibe)
            ========================================== */}
        {/* Bubble 1: Top Left (Large Glossy Bubble) */}
        <div className="absolute top-8 left-6 w-28 h-28 rounded-full border border-white/20 bg-gradient-to-br from-white/10 via-[#5f1340]/5 to-white/5 backdrop-blur-[1px] shadow-[inset_-6px_-6px_16px_rgba(255,255,255,0.15),0_12px_28px_rgba(0,0,0,0.2)] pointer-events-none z-10 animate-bubble-1">
          <div className="absolute top-3 left-3 w-7 h-3.5 bg-white/30 rounded-full rotate-[-30deg] blur-[0.5px]" />
          <div className="absolute bottom-3 right-3 w-4 h-4 bg-pink-300/10 rounded-full blur-[0.5px]" />
        </div>

        {/* Bubble 2: Top Right (Medium Glossy Bubble) */}
        <div className="absolute top-24 right-8 w-20 h-20 rounded-full border border-white/30 bg-gradient-to-br from-white/20 via-[#8c2060]/10 to-[#5f1340]/15 backdrop-blur-[1px] shadow-[inset_-4px_-4px_12px_rgba(255,255,255,0.2),0_8px_20px_rgba(95,19,64,0.15)] pointer-events-none z-10 animate-bubble-2">
          <div className="absolute top-2 left-2 w-5 h-2.5 bg-white/45 rounded-full rotate-[-30deg] blur-[0.5px]" />
          <div className="absolute bottom-2 right-2 w-3.5 h-3.5 bg-pink-200/15 rounded-full blur-[0.5px]" />
        </div>

        {/* Bubble 3: Mid Left (Small Glossy Bubble) */}
        <div className="absolute bottom-1/3 left-8 w-14 h-14 rounded-full border border-white/40 bg-gradient-to-br from-white/30 via-transparent to-white/10 backdrop-blur-[1px] shadow-[inset_-3px_-3px_8px_rgba(255,255,255,0.25),0_6px_14px_rgba(0,0,0,0.12)] pointer-events-none z-10 animate-bubble-3">
          <div className="absolute top-1.5 left-1.5 w-3.5 h-1.5 bg-white/60 rounded-full rotate-[-30deg] blur-[0.5px]" />
        </div>

        {/* Bubble 4: Bottom Center (Large Glossy Bubble) */}
        <div className="absolute bottom-16 left-1/4 w-36 h-36 rounded-full border border-white/15 bg-gradient-to-br from-white/5 via-[#5f1340]/10 to-[#250418]/20 backdrop-blur-[1px] shadow-[inset_-8px_-8px_20px_rgba(255,255,255,0.1),0_20px_40px_rgba(0,0,0,0.3)] pointer-events-none z-10 animate-bubble-1">
          <div className="absolute top-4 left-4 w-9 h-4.5 bg-white/20 rounded-full rotate-[-30deg] blur-[0.5px]" />
        </div>

        {/* Top spacer */}
        <div />

        {/* ==========================================
            CENTER BRAND LOGO & PREMIUM INDICATOR
            ========================================== */}
        <div className="flex flex-col items-center gap-4 text-center animate-fade-up relative z-20">
          {/* Pure Logo image waschen.png with Sparkles (shrinks and morphs up) */}
          <div className={`relative transition-all duration-700 ease-in-out ${isTransitioning ? 'scale-[0.64] -translate-y-[13vh] opacity-0' : 'scale-100 translate-y-0 opacity-100'}`}>
            <img
              src={waschenLogo}
              alt="Waschen Logo"
              className="w-56 h-auto object-contain filter drop-shadow-[0_6px_16px_rgba(255,255,255,0.18)]"
            />
            {/* Sparkles of Cleanliness */}
            <svg className="absolute -top-3 -right-3 w-7 h-7 text-yellow-300 animate-pulse pointer-events-none drop-shadow-[0_2px_8px_rgba(253,224,71,0.5)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2c0 5.52-4.48 10-10 10 5.52 0 10 4.48 10 10 0-5.52 4.48-10 10-10-5.52 0-10-4.48-10-10z" />
            </svg>
          </div>
        </div>

        {/* Bottom Loading Progress Indicator */}
        <div className={`w-full max-w-[300px] flex flex-col items-center gap-4 relative z-20 transition-all duration-500 ${isTransitioning ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0'}`}>
          {/* Loading bar line */}
          <div className="w-full max-w-[200px] h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-white rounded-full animate-loading-bar" />
          </div>
          <span className="text-[9.5px] text-pink-200/40 font-bold tracking-[0.2em] uppercase whitespace-nowrap">
            Aplikasi Karyawan Waschen Laundry
          </span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Start transition animation at 2.0s
    const transTimer = setTimeout(() => {
      setIsTransitioning(true);
    }, 2000);

    // Completely remove splash screen from DOM at 2.8s
    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);

    return () => {
      clearTimeout(transTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/riwayat" element={<Riwayat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/edit-profile" element={<EditProfile />} />
        {/* Fallback route redirection */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showSplash && (
        <SplashScreen isTransitioning={isTransitioning} />
      )}
    </Router>
  );
}
