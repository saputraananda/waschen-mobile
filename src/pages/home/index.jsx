import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { resetPageView } from '../../utils/resetPageView.js';
import fetchAssignedRole from '../../utils/fetchAssignedRole.js';
import Banner from './components/Banner.jsx';
import MenuSection from './components/MenuSection.jsx';

export default function Home() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState({
    fullName: 'Ananda Saputra',
    employeeCode: 'WAI2026029',
    position: 'Valet Lead & Admin',
    department: 'Waschen HQ',
    role: 'admin',
    assignedOutletName: 'Waschen Head Office (Jakarta Selatan)',
    avatar: null
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    document.title = 'Dasbor Utama';
    resetPageView();

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

        if (!parsed.assignedRole) {
          fetchAssignedRole(token).then((role) => {
            if (role) setCurrentUser((prev) => ({ ...prev, assignedRole: role }));
          });
        }
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'WS';
    const parts = String(name).trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name).slice(0, 2).toUpperCase() || 'WS';
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 4) return 'Selamat Malam';
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const handleMenuClick = (path) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-slate-200/70 flex justify-center items-start antialiased font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col justify-between relative pb-safe-nav">
        <div className="w-full relative">
          <Banner
            currentUser={currentUser}
            currentTime={currentTime}
            onNavigateProfile={() => navigate('/profile')}
            onInfoClick={() => handleMenuClick('/notifikasi')}
            getInitials={getInitials}
            formatTime={formatTime}
            formatDate={formatDate}
            getGreeting={getGreeting}
          />

          <MenuSection onMenuClick={handleMenuClick} />
        </div>

        <Navbar />
      </div>
    </div>
  );
}
