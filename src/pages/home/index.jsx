import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import { resetPageView } from '../../utils/resetPageView.js';
import fetchAssignedRole from '../../utils/fetchAssignedRole.js';
import Banner from './components/Banner.jsx';
import MenuSection from './components/MenuSection.jsx';
import AlertOvertime from './components/AlertOvertime.jsx';
import useActiveOvertime from '../../hooks/useActiveOvertime.js';
import useSoftRefresh from '../../hooks/useSoftRefresh.js';
import DataUpdatedModal from '../../components/DataUpdatedModal.jsx';
import { useRealtimeRefresh } from '../../context/SocketContext.jsx';
import { setPageTitle } from '../../utils/pageTitle.js';

export default function Home() {
  const navigate = useNavigate();
  const { active, locked, isActive, refresh: refreshOvertime } = useActiveOvertime(true);
  const [forceOtModal, setForceOtModal] = useState(true);
  const [progressGate, setProgressGate] = useState({ unlocked: true, message: null });

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

  const fetchProgressGate = useCallback(async (token) => {
    if (!token) return;
    try {
      const res = await axios.get('/api/attendance/progress-gate', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 12000
      });
      const data = res.data?.data;
      setProgressGate({
        unlocked: data?.unlocked !== false,
        message: data?.message || null
      });
    } catch (_) {
      setProgressGate({ unlocked: true, message: null });
    }
  }, []);

  const softRefresh = useCallback(async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser((prev) => ({
          ...prev,
          ...parsed,
          assignedOutletName: parsed.assignedOutletName || prev.assignedOutletName || 'Waschen Head Office'
        }));
      } catch (_) { /* ignore */ }
    }
    if (token) {
      const role = await fetchAssignedRole(token);
      if (role) setCurrentUser((prev) => ({ ...prev, assignedRole: role }));
      await fetchProgressGate(token);
    }
    await refreshOvertime();
  }, [refreshOvertime, fetchProgressGate]);
  const { refreshing, showUpdated, setShowUpdated, handleRefresh } = useSoftRefresh(softRefresh);

  useEffect(() => {
    setPageTitle('Dasbor Utama');
    resetPageView();

    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token) {
      navigate('/login');
    } else if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser((prev) => ({
          ...prev,
          ...parsed,
          assignedOutletName: parsed.assignedOutletName || prev.assignedOutletName || 'Waschen Head Office'
        }));

        if (!parsed.assignedRole) {
          fetchAssignedRole(token).then((role) => {
            if (role) setCurrentUser((prev) => ({ ...prev, assignedRole: role }));
          });
        }
        fetchProgressGate(token);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }
  }, [navigate, fetchProgressGate]);

  // Upload/hapus foto kebersihan terjadi di halaman Absensi; tanpa ini gate di
  // dasbor baru ikut berubah setelah reload manual.
  useRealtimeRefresh('attendance', () => {
    fetchProgressGate(localStorage.getItem('token'));
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (locked) setForceOtModal(true);
  }, [locked]);

  const getInitials = (name) => {
    if (!name) return 'WS';
    const parts = String(name).trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name).slice(0, 2).toUpperCase() || 'WS';
  };

  const formatTime = (date) =>
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDate = (date) =>
    date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 4) return 'Selamat Malam';
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const handleMenuClick = (path) => {
    if (locked && !['/overtime', '/history', '/profile', '/informations'].includes(path)) {
      setForceOtModal(true);
      return;
    }
    // /delivery ikut dikunci: semua aksinya bermuara ke POST /api/progress/qc yang kena gate.
    if (['/produksi', '/delivery'].includes(path) && !progressGate.unlocked) {
      return;
    }
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
            onInfoClick={() => handleMenuClick('/informations')}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            getInitials={getInitials}
            formatTime={formatTime}
            formatDate={formatDate}
            getGreeting={getGreeting}
          />

          {isActive && (
            <AlertOvertime
              active={active}
              locked={locked}
              forceModal={locked && forceOtModal}
              onDismissModal={() => setForceOtModal(false)}
              onGoOvertime={() => navigate('/overtime')}
            />
          )}

          <MenuSection
            onMenuClick={handleMenuClick}
            menusLocked={locked}
            progressLocked={!progressGate.unlocked}
            progressLockMessage={progressGate.message}
            currentUser={currentUser}
          />
        </div>

        <Navbar />
        <DataUpdatedModal isOpen={showUpdated} onClose={() => setShowUpdated(false)} />
      </div>
    </div>
  );
}
