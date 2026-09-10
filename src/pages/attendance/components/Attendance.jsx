import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import formatName from '../../../utils/FormatName.js';
import getDisplayRole from '../../../utils/getDisplayRole.js';
import fetchAssignedRole from '../../../utils/fetchAssignedRole.js';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js';
import { useRealtimeRefresh } from '../../../context/SocketContext.jsx';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Camera,
  AlertCircle,
  RefreshCw,
  X,
  Building2,
  Loader2,
  Eye,
  Trash2,
  LogIn,
  LogOut
} from 'lucide-react';

const MAX_DIST_M = 1000;
const api = axios.create({ baseURL: '/api', timeout: 45000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(v) {
  if (!v) return null;
  const d = new Date(v);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDateFull(v) {
  if (!v) return '';
  const d = new Date(v);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getPhotoUrl(record, type) {
  if (!record) return null;
  if (type === 'in') {
    return record.check_in_photo_url
      || (record.check_in_photo_name ? `/uploads/assets/attendance/${encodeURIComponent(record.check_in_photo_name)}` : null);
  }
  return record.check_out_photo_url
    || (record.check_out_photo_name ? `/uploads/assets/attendance/${encodeURIComponent(record.check_out_photo_name)}` : null);
}

const formatStamp = (d) => {
  const dateId = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${dateId} ${get('hour')}:${get('minute')}:${get('second')} WIB`;
};

export default function Attendance() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentUser, setCurrentUser] = useState({ fullName: 'Karyawan Waschen', position: 'Staff Waschen' });

  const [todayData, setTodayData] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState(null);
  const [showOutletModal, setShowOutletModal] = useState(false);
  const [alternateOutlet, setAlternateOutlet] = useState(false);

  const [gpsCoord, setGpsCoord] = useState(null);
  const [gpsDist, setGpsDist] = useState(null);
  const [gpsState, setGpsState] = useState('loading');
  const [gpsRefreshKey, setGpsRefreshKey] = useState(0);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraErr, setCameraErr] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [cameraStreamTick, setCameraStreamTick] = useState(0);
  const [pendingPunch, setPendingPunch] = useState(null);

  const [openingCamera, setOpeningCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msgIn, setMsgIn] = useState(null);
  const [msgOut, setMsgOut] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingPunch, setDeletingPunch] = useState(null);

  const canUseCamera = useMemo(
    () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    []
  );

  const timeStatus = todayData?.timeStatus;
  const record = todayData?.record;
  const assignedOutlet = todayData?.assignedOutlet;
  const activeOutletId = selectedOutletId || todayData?.assignedOutletId;
  const activeOutlet = useMemo(() => {
    if (!activeOutletId) return assignedOutlet || null;
    return outlets.find((o) => String(o.id) === String(activeOutletId)) || assignedOutlet;
  }, [activeOutletId, outlets, assignedOutlet]);

  const inZone = gpsDist != null && gpsDist <= MAX_DIST_M;
  const canPunch = timeStatus?.isOpen && inZone && gpsState === 'ok';

  const fetchToday = useCallback(async () => {
    const res = await api.get('/attendance/today');
    const data = res.data?.data;
    setTodayData(data);
    setPageError(null);
    setSelectedOutletId((prev) => prev || data?.assignedOutletId || null);
    return data;
  }, []);

  const handleAuthError = useCallback((error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      return true;
    }
    return false;
  }, [navigate]);

  useEffect(() => {
    document.title = 'Presensi Absensi - Waschen Mobile';
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser((prev) => ({
          ...prev,
          ...parsed,
          fullName: parsed.fullName || parsed.full_name || prev.fullName,
          position: parsed.position || parsed.position_name || prev.position
        }));
        if (parsed.assignedOutletId) {
          setSelectedOutletId((prev) => prev || parsed.assignedOutletId);
        }
        if (!parsed.assignedRole) {
          fetchAssignedRole(token).then((role) => {
            if (role) setCurrentUser((prev) => ({ ...prev, assignedRole: role }));
          });
        }
      } catch (_) { /* ignore */ }
    }

    const loadPage = async () => {
      const [outletResult, todayResult] = await Promise.allSettled([
        api.get('/attendance/outlets'),
        fetchToday()
      ]);

      if (outletResult.status === 'fulfilled') {
        setOutlets(outletResult.value.data?.data || []);
      } else if (handleAuthError(outletResult.reason)) {
        return;
      }

      if (todayResult.status === 'rejected') {
        if (handleAuthError(todayResult.reason)) return;
        setPageError(todayResult.reason?.response?.data?.message || 'Gagal memuat data absensi');
      }

      setPageLoading(false);
    };

    loadPage();
  }, [navigate, fetchToday, handleAuthError]);

  useRealtimeRefresh(['attendance', 'leave'], () => {
    fetchToday();
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeOutlet?.lat || !activeOutlet?.lon) {
      setGpsState('idle');
      setGpsDist(null);
      return;
    }

    if (!navigator.geolocation) {
      setGpsState('denied');
      return;
    }

    setGpsState('loading');

    const onSuccess = (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setGpsCoord({ lat, lng });

      const dist = haversineMeters(
        lat,
        lng,
        parseFloat(activeOutlet.lat),
        parseFloat(activeOutlet.lon)
      );
      setGpsDist(dist);
      setGpsState(dist <= MAX_DIST_M ? 'ok' : 'out');
    };

    const onError = (err) => {
      setGpsState(err.code === 1 ? 'denied' : 'error');
    };

    navigator.geolocation.getCurrentPosition(onSuccess, () => {}, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 30000
    });

    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: gpsRefreshKey === 0 ? 15000 : 0
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeOutlet, gpsRefreshKey]);

  const stopCamera = useCallback(() => {
    const v = videoRef.current;
    const stream = cameraStreamRef.current || v?.srcObject;
    if (stream?.getTracks) stream.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    cameraStreamRef.current = null;
    setVideoReady(false);
  }, []);

  const openCamera = useCallback(async (mode = 'user') => {
    setCameraErr(null);
    setVideoReady(false);
    if (!canUseCamera) {
      setCameraErr('Browser tidak mendukung kamera.');
      return false;
    }
    const getStream = (c) => navigator.mediaDevices.getUserMedia({ video: c, audio: false });
    try {
      setCameraOpen(true);
      let stream;
      try { stream = await getStream({ facingMode: mode }); }
      catch {
        try { stream = await getStream({ facingMode: { ideal: mode } }); }
        catch { stream = await getStream(true); }
      }
      cameraStreamRef.current = stream;
      setCameraStreamTick((v) => v + 1);
      return true;
    } catch (e) {
      const n = e?.name || '';
      if (n === 'NotAllowedError') setCameraErr('Izin kamera ditolak.');
      else setCameraErr('Kamera tidak tersedia.');
      setCameraOpen(false);
      return false;
    }
  }, [canUseCamera]);

  const switchCamera = useCallback(async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    stopCamera();
    setCameraErr(null);
    setVideoReady(false);
    const getStream = (c) => navigator.mediaDevices.getUserMedia({ video: c, audio: false });
    try {
      let stream;
      try { stream = await getStream({ facingMode: { exact: next } }); }
      catch { stream = await getStream(true); }
      cameraStreamRef.current = stream;
      setCameraStreamTick((v) => v + 1);
    } catch {
      setCameraErr('Gagal beralih kamera.');
    }
  }, [facingMode, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useLockBodyScroll(cameraOpen || showOutletModal || !!confirmDelete || !!photoPreview);

  useEffect(() => {
    const v = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!cameraOpen || !v || !stream) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play().catch(() => {});
  }, [cameraOpen, cameraStreamTick]);

  const captureSelfie = useCallback(async () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return null;

    const srcW = v.videoWidth;
    const srcH = v.videoHeight;
    const maxW = 1280;
    const scale = srcW > maxW ? maxW / srcW : 1;
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const stamp = formatStamp(new Date());
    const locationLine = `Lokasi: ${activeOutlet?.full_name || activeOutlet?.name || 'Outlet Waschen'}`;
    const pad = Math.max(14, Math.floor(Math.min(w, h) * 0.02));
    const primarySize = Math.max(14, Math.floor(Math.min(w, h) * 0.035));
    const secondarySize = Math.max(12, Math.floor(primarySize * 0.78));
    const lineGap = Math.max(4, Math.floor(primarySize * 0.35));

    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${primarySize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const stampW = ctx.measureText(stamp).width;
    ctx.font = `600 ${secondarySize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    const locW = ctx.measureText(locationLine).width;
    const textW = Math.max(stampW, locW);
    const boxW = textW + pad * 2;
    const boxH = pad * 2 + primarySize + lineGap + secondarySize;
    const x = pad;
    const y = h - boxH - pad;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${primarySize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.fillText(stamp, x + pad, y + pad + primarySize);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `600 ${secondarySize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.fillText(locationLine, x + pad, y + pad + primarySize + lineGap + secondarySize);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  }, [activeOutlet]);

  const getFreshCoord = (fallback) =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(fallback || gpsCoord);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(fallback || gpsCoord),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 15000 }
      );
    });

  const handlePunch = async (punchType) => {
    const setMsg = punchType === 'in' ? setMsgIn : setMsgOut;
    setMsg(null);

    if (!timeStatus?.isOpen) {
      setMsg({ text: timeStatus?.lockReason || 'Absensi sedang terkunci.', type: 'error' });
      return;
    }

    if (!activeOutletId) {
      setMsg({ text: 'Outlet absensi belum ditetapkan. Pilih outlet terlebih dahulu.', type: 'error' });
      return;
    }

    const coord = gpsCoord;
    if (!coord) {
      setMsg({ text: 'GPS belum siap. Tunggu sebentar atau refresh lokasi.', type: 'error' });
      return;
    }

    const dist = haversineMeters(
      coord.lat,
      coord.lng,
      parseFloat(activeOutlet.lat),
      parseFloat(activeOutlet.lon)
    );
    if (dist > MAX_DIST_M) {
      setMsg({
        text: `Anda ${Math.round(dist)}m dari outlet. Maksimal ${MAX_DIST_M / 1000} km.`,
        type: 'error'
      });
      return;
    }

    setOpeningCamera(true);
    setPendingPunch({ punchType, coord });
    const ok = await openCamera(facingMode);
    setOpeningCamera(false);
    if (!ok) {
      setMsg({ text: 'Kamera tidak bisa dibuka.', type: 'error' });
      setPendingPunch(null);
    }
  };

  const confirmSelfie = async () => {
    if (!pendingPunch || isSubmitting) return;
    const { punchType, coord: cachedCoord } = pendingPunch;
    const setMsg = punchType === 'in' ? setMsgIn : setMsgOut;

    try {
      if (!videoReady) {
        setCameraErr('Kamera belum siap. Tunggu sebentar.');
        return;
      }

      setIsSubmitting(true);
      setCameraErr(null);

      const blob = await captureSelfie();
      if (!blob) {
        setCameraErr('Gagal mengambil foto.');
        return;
      }

      const coord = (await getFreshCoord(cachedCoord)) || cachedCoord;
      if (!coord) {
        setCameraErr('GPS tidak tersedia. Aktifkan lokasi lalu coba lagi.');
        return;
      }

      const form = new FormData();
      form.append('punch_type', punchType);
      form.append('lat', String(coord.lat));
      form.append('lng', String(coord.lng));
      form.append('outlet_id', String(activeOutletId));
      form.append('selfie', blob, 'selfie.jpg');

      const res = await api.post('/attendance/punch-selfie', form);
      setMsg({ text: res.data.message, type: 'success' });
      await fetchToday();
      stopCamera();
      setCameraOpen(false);
      setPendingPunch(null);
    } catch (e) {
      if (handleAuthError(e)) return;
      const errMsg = e.code === 'ECONNABORTED'
        ? 'Koneksi timeout. Periksa jaringan lalu coba lagi.'
        : (e.response?.data?.message || e.message || 'Gagal menyimpan absensi');
      setMsg({ text: errMsg, type: 'error' });
      setCameraErr(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setPendingPunch(null);
    setIsSubmitting(false);
    setOpeningCamera(false);
    setCameraErr(null);
  };

  const selectAlternateOutlet = (outlet) => {
    setSelectedOutletId(outlet.id);
    setAlternateOutlet(true);
    setShowOutletModal(false);
    setGpsRefreshKey((k) => k + 1);
    setMsgIn(null);
    setMsgOut(null);
  };

  const resetToAssignedOutlet = () => {
    setSelectedOutletId(todayData?.assignedOutletId || null);
    setAlternateOutlet(false);
    setGpsRefreshKey((k) => k + 1);
  };

  const handleDeletePunch = async () => {
    if (!confirmDelete || deletingPunch) return;
    const { punchType } = confirmDelete;
    const setMsg = punchType === 'in' ? setMsgIn : setMsgOut;

    setDeletingPunch(punchType);
    try {
      const res = await api.post('/attendance/delete-punch', { punch_type: punchType });
      setMsg({ text: res.data.message, type: 'success' });
      setConfirmDelete(null);
      await fetchToday();
    } catch (e) {
      if (handleAuthError(e)) return;
      setMsg({
        text: e.response?.data?.message || 'Gagal menghapus absensi',
        type: 'error'
      });
      setConfirmDelete(null);
    } finally {
      setDeletingPunch(null);
    }
  };

  const clockInTime = record?.check_in_time ? formatTime(record.check_in_time) : null;
  const clockOutTime = record?.check_out_time ? formatTime(record.check_out_time) : null;
  const hasIn = !!record?.check_in_time;
  const hasOut = !!record?.check_out_time;
  const checkInPhotoUrl = getPhotoUrl(record, 'in');
  const checkOutPhotoUrl = getPhotoUrl(record, 'out');

  const gpsBadge = () => {
    if (!activeOutlet?.lat || !activeOutlet?.lon) {
      return { label: 'Pilih outlet untuk cek GPS', cls: 'bg-slate-50 text-slate-500 border-slate-200' };
    }
    if (gpsState === 'loading') return { label: 'Mencari GPS...', cls: 'bg-slate-50 text-slate-500 border-slate-200' };
    if (gpsState === 'idle') return { label: 'Menunggu outlet dipilih', cls: 'bg-slate-50 text-slate-500 border-slate-200' };
    if (gpsState === 'denied') return { label: 'GPS ditolak — izinkan lokasi', cls: 'bg-rose-50 text-rose-600 border-rose-200' };
    if (gpsState === 'error') return { label: 'GPS error — coba refresh', cls: 'bg-rose-50 text-rose-600 border-rose-200' };
    if (inZone) return { label: `Zona Outlet · ${Math.round(gpsDist)}m`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    return { label: `Diluar Outlet · ${Math.round(gpsDist)}m`, cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  };
  const badge = gpsBadge();

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[max(16px,env(safe-area-inset-bottom))]">

        {/* Hero */}
        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-safe-header pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            <Calendar className="absolute -top-2 left-2 w-20 h-20 text-white -rotate-12" />
            <Clock className="absolute top-3 right-10 w-16 h-16 text-white rotate-12" />
          </div>
          <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />

          <div className="flex items-center gap-3 relative z-10 mb-5 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-white leading-snug truncate tracking-tight">
                {formatName(currentUser.fullName || currentUser.full_name)}
              </h2>
              <span className="text-[11px] text-pink-200/80 font-medium truncate block">
                {[getDisplayRole(currentUser), currentUser.employeeCode].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>

          <div className="relative z-10 text-center py-2">
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider block">Waktu Saat Ini</span>
            <span className="text-[34px] font-black text-white font-mono tracking-tight leading-tight block">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[12px] text-pink-100/90 font-bold block mt-0.5">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="w-full relative z-10 px-4 -mt-6 pb-2">
          {pageLoading ? (
            <div className="bg-white rounded-[24px] shadow border border-slate-100 p-8 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#5f1340] animate-spin" />
              <span className="text-[12px] text-slate-400 font-bold">Memuat data absensi...</span>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-5 flex flex-col items-center gap-4 text-center">
                {pageError && (
                  <div className="w-full bg-rose-50 border border-rose-200 rounded-[14px] p-3 flex items-start gap-2 text-left">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-[11.5px] text-rose-700 font-bold block">{pageError}</span>
                      <button
                        onClick={() => { setPageLoading(true); fetchToday().finally(() => setPageLoading(false)); }}
                        className="text-[10.5px] text-rose-600 font-extrabold mt-1 underline"
                      >
                        Coba muat ulang
                      </button>
                    </div>
                  </div>
                )}

                {!timeStatus?.isOpen && timeStatus?.lockReason && (
                  <div className="w-full bg-amber-50 border border-amber-200 rounded-[14px] p-3 flex items-start gap-2 text-left">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-[11.5px] text-amber-800 font-medium">{timeStatus.lockReason}</span>
                  </div>
                )}

                {!activeOutletId && outlets.length > 0 && (
                  <div className="w-full bg-blue-50 border border-blue-200 rounded-[14px] p-3 flex items-start gap-2 text-left">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-[11.5px] text-blue-800 font-medium">
                      Outlet penugasan belum ditetapkan di master data. Silakan pilih outlet tugas Anda hari ini.
                    </span>
                  </div>
                )}

                {/* Outlet & GPS */}
                <div className="w-full flex flex-col gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold justify-center ${badge.cls}`}>
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{badge.label}</span>
                    <button onClick={() => setGpsRefreshKey((k) => k + 1)} className="ml-1 opacity-70 hover:opacity-100">
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-2.5 text-left">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#5f1340] flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                          {alternateOutlet ? 'Tugas di Outlet Lain' : 'Outlet Penugasan'}
                        </span>
                        <span className="text-[12.5px] font-extrabold text-slate-800 truncate block">
                          {activeOutlet?.full_name || activeOutlet?.name || 'Belum ditetapkan'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowOutletModal(true)}
                      className="flex-1 py-2 rounded-xl border border-[#5f1340]/25 bg-[#5f1340]/5 text-[#5f1340] text-[11px] font-extrabold hover:bg-[#5f1340]/10 transition-all"
                    >
                      Tugas Di Outlet Lain?
                    </button>
                    {alternateOutlet && (
                      <button
                        onClick={resetToAssignedOutlet}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-bold"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Punch cards */}
                <div className="grid grid-cols-2 gap-2.5 w-full mt-1">
                  {/* MASUK */}
                  <div className={`bg-white rounded-[20px] overflow-hidden border-[1.5px] shadow-[0_1px_4px_rgba(0,0,0,.04)] ${hasIn ? 'border-blue-200' : 'border-transparent'}`}>
                    <div className="px-3 pt-3 pb-2 flex items-center gap-2">
                      <div className="w-9 h-9 rounded-[12px] grid place-items-center flex-shrink-0 bg-blue-50">
                        <LogIn className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-[12px] font-extrabold text-blue-700">Masuk</div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${hasIn ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-300'}`}>
                          {hasIn ? '✓ Tercatat' : 'Belum'}
                        </span>
                      </div>
                    </div>

                    <div className="px-3 pb-3">
                      <div className={`rounded-[14px] p-3 border-[1.5px] ${hasIn ? 'border-blue-100 bg-[#F0F7FF]' : 'border-slate-100 bg-[#FAFBFC]'}`}>
                        <div className={`font-mono text-[22px] font-bold leading-none tabular-nums ${!hasIn ? 'text-slate-200 font-light' : 'text-slate-900'}`}>
                          {hasIn ? clockInTime : '--:--'}
                        </div>
                        {hasIn && (
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5 text-left">
                            {formatDateFull(record.check_in_time)}
                          </div>
                        )}
                        {msgIn && (
                          <div className={`mt-1.5 text-[10px] font-semibold leading-snug px-2 py-1 rounded-lg text-left ${msgIn.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-900'}`}>
                            {msgIn.text}
                          </div>
                        )}
                        <div className="mt-2">
                          {hasIn ? (
                            <button
                              type="button"
                              className="w-full h-[34px] rounded-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1.5"
                              disabled
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Tercatat
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePunch('in')}
                              disabled={openingCamera || cameraOpen || !canPunch}
                              className="w-full h-[34px] rounded-[10px] text-[11px] font-bold text-white flex items-center justify-center gap-1.5 transition active:scale-[.96] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700"
                            >
                              {openingCamera ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Absen Masuk'}
                            </button>
                          )}
                        </div>
                        {hasIn && checkInPhotoUrl && (
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPhotoPreview({ url: checkInPhotoUrl, title: 'Foto Absen Masuk' })}
                              className="h-[30px] rounded-[9px] border border-blue-200 bg-blue-50 text-blue-700 text-[10.5px] font-bold flex items-center justify-center gap-1 transition hover:bg-blue-100 active:scale-[.98]"
                            >
                              <Eye className="w-3 h-3" /> Foto
                            </button>
                            {!hasOut && (
                              <button
                                type="button"
                                onClick={() => setConfirmDelete({ punchType: 'in', label: 'Masuk' })}
                                className="h-[30px] rounded-[9px] border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-bold flex items-center justify-center gap-1 transition hover:bg-red-100 active:scale-[.98]"
                              >
                                <Trash2 className="w-3 h-3" /> Ulang
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PULANG */}
                  <div className={`bg-white rounded-[20px] overflow-hidden border-[1.5px] shadow-[0_1px_4px_rgba(0,0,0,.04)] ${hasOut ? 'border-rose-200' : 'border-transparent'}`}>
                    <div className="px-3 pt-3 pb-2 flex items-center gap-2">
                      <div className="w-9 h-9 rounded-[12px] grid place-items-center flex-shrink-0 bg-rose-50">
                        <LogOut className="w-4 h-4 text-rose-600" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-[12px] font-extrabold text-rose-700">Pulang</div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${hasOut ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-300'}`}>
                          {hasOut ? '✓ Tercatat' : 'Belum'}
                        </span>
                      </div>
                    </div>

                    <div className="px-3 pb-3">
                      <div className={`rounded-[14px] p-3 border-[1.5px] ${hasOut ? 'border-rose-100 bg-rose-50/40' : 'border-slate-100 bg-[#FAFBFC]'}`}>
                        <div className={`font-mono text-[22px] font-bold leading-none tabular-nums ${!hasOut ? 'text-slate-200 font-light' : 'text-slate-900'}`}>
                          {hasOut ? clockOutTime : '--:--'}
                        </div>
                        {hasOut && (
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5 text-left">
                            {formatDateFull(record.check_out_time)}
                          </div>
                        )}
                        {msgOut && (
                          <div className={`mt-1.5 text-[10px] font-semibold leading-snug px-2 py-1 rounded-lg text-left ${msgOut.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-900'}`}>
                            {msgOut.text}
                          </div>
                        )}
                        <div className="mt-2">
                          {hasOut ? (
                            <button
                              type="button"
                              className="w-full h-[34px] rounded-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1.5"
                              disabled
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Tercatat
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePunch('out')}
                              disabled={!hasIn || openingCamera || cameraOpen || !canPunch}
                              className={`w-full h-[34px] rounded-[10px] text-[11px] font-bold text-white flex items-center justify-center gap-1.5 transition active:scale-[.96] disabled:opacity-40 disabled:cursor-not-allowed ${hasIn ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-300'}`}
                            >
                              {openingCamera ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : !hasIn ? 'Belum Masuk' : 'Absen Pulang'}
                            </button>
                          )}
                        </div>
                        {hasOut && checkOutPhotoUrl && (
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPhotoPreview({ url: checkOutPhotoUrl, title: 'Foto Absen Pulang' })}
                              className="h-[30px] rounded-[9px] border border-blue-200 bg-blue-50 text-blue-700 text-[10.5px] font-bold flex items-center justify-center gap-1 transition hover:bg-blue-100 active:scale-[.98]"
                            >
                              <Eye className="w-3 h-3" /> Foto
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete({ punchType: 'out', label: 'Pulang' })}
                              className="h-[30px] rounded-[9px] border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-bold flex items-center justify-center gap-1 transition hover:bg-red-100 active:scale-[.98]"
                            >
                              <Trash2 className="w-3 h-3" /> Ulang
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Camera className="w-3 h-3" /> Absen Masuk & Pulang wajib foto selfie
                </p>
              </div>

              <div className="mt-5 bg-white border border-slate-100 rounded-[22px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-4">
                <h4 className="text-[13px] font-black text-slate-800 mb-1">Catatan Presensi</h4>
                <p className="text-[11.5px] text-slate-400 font-medium leading-relaxed">
                  Absensi dibuka pukul <strong className="text-slate-600">05:00–24:00 WIB</strong>.
                  Pastikan Anda berada dalam radius <strong className="text-slate-600">500 Meter</strong> dari outlet yang ditetapkan.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Outlet picker modal */}
      {showOutletModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-safe-modal" onClick={() => setShowOutletModal(false)}>
          <div
            className="w-full max-w-[400px] bg-white rounded-[28px] shadow-2xl p-5 max-h-[70vh] overflow-y-auto hide-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-black text-slate-800">Pilih Outlet Tugas</h3>
              <button onClick={() => setShowOutletModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mb-3">
              Pilih outlet tempat Anda bertugas hari ini. Validasi GPS akan menyesuaikan dengan outlet yang dipilih.
            </p>
            <div className="flex flex-col gap-2">
              {outlets.map((o) => (
                <button
                  key={o.id}
                  onClick={() => selectAlternateOutlet(o)}
                  className={`text-left p-3.5 rounded-2xl border transition-all ${
                    String(o.id) === String(activeOutletId)
                      ? 'border-[#5f1340] bg-[#5f1340]/5'
                      : 'border-slate-100 hover:border-[#5f1340]/30 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[13px] font-extrabold text-slate-800 block">{o.full_name || o.name}</span>
                  {o.address && <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5 line-clamp-2">{o.address}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-safe-modal">
          <div className="w-full max-w-[340px] bg-white rounded-[20px] overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,.3)]">
            <div className="px-5 pt-5 pb-3 text-center">
              <div className="w-14 h-14 rounded-[16px] bg-red-50 border-2 border-red-200 grid place-items-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-[15px] font-extrabold text-slate-900 mb-1.5">Hapus & Ulang Absen?</div>
              <div className="text-[12.5px] text-slate-500 leading-[1.6] font-medium">
                Data absen <span className="font-bold text-slate-700">{confirmDelete.label}</span> dan foto di server akan dihapus.
                Anda perlu foto selfie ulang. Lanjutkan?
              </div>
            </div>
            <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="h-[42px] rounded-[12px] border border-slate-200 bg-white text-slate-700 text-[12.5px] font-extrabold transition hover:bg-slate-50"
                onClick={() => setConfirmDelete(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="h-[42px] rounded-[12px] bg-red-500 text-white text-[12.5px] font-extrabold transition hover:bg-red-600 disabled:opacity-50"
                onClick={handleDeletePunch}
                disabled={!!deletingPunch}
              >
                {deletingPunch ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo preview modal */}
      {photoPreview && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 px-3 py-safe-fullscreen"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[18px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-[13px] font-extrabold text-slate-900 truncate pr-3">
                {photoPreview.title || 'Foto Absensi'}
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto hide-scrollbar">
              <img
                src={photoPreview.url}
                alt={photoPreview.title || 'Foto absensi'}
                className="w-full h-auto max-h-[72dvh] object-contain rounded-[12px] bg-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      {/* Camera modal — bottom sheet mobile */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-safe-overlay">
          <div className="w-full max-w-[430px] max-h-safe-sheet bg-white rounded-[18px] overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,.35)] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="text-[13px] font-extrabold text-slate-900">
                Selfie — Absen {pendingPunch?.punchType === 'in' ? 'Masuk' : 'Pulang'}
              </div>
              <button
                type="button"
                onClick={cancelCamera}
                className="w-9 h-9 rounded-[12px] grid place-items-center border border-slate-200 bg-white text-slate-600"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto hide-scrollbar">
              {cameraErr && (
                <div className="mb-3 text-[11.5px] font-semibold px-3 py-2 rounded-xl bg-red-50 text-red-900 border border-red-100">
                  {cameraErr}
                </div>
              )}

              <div className="rounded-[16px] overflow-hidden bg-black relative aspect-[3/4]">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  onLoadedMetadata={() => {
                    setVideoReady(true);
                    videoRef.current?.play?.().catch(() => {});
                  }}
                  onCanPlay={() => setVideoReady(true)}
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                <button
                  type="button"
                  onClick={switchCamera}
                  className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/50 grid place-items-center text-white"
                  aria-label="Ganti kamera"
                >
                  <Camera className="w-4.5 h-4.5" />
                </button>

                <div
                  className="absolute left-3 bottom-3 text-white px-2.5 py-1.5 rounded-xl"
                  style={{ background: 'rgba(0,0,0,0.55)' }}
                >
                  <div className="text-[11px] font-extrabold">{formatStamp(currentTime)}</div>
                  <div className="text-[10px] font-semibold text-white/90 mt-0.5">
                    Lokasi: {activeOutlet?.full_name || activeOutlet?.name || 'Outlet Waschen'}
                  </div>
                </div>

                {!videoReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>

              {!videoReady && (
                <div className="mt-2 text-[11px] font-semibold text-slate-500">Menyiapkan kamera…</div>
              )}

              <div className="mt-3 text-[11px] text-slate-500 font-medium leading-relaxed">
                Foto diambil langsung dari kamera dan akan otomatis diberi timestamp.
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={cancelCamera}
                  className="h-[42px] rounded-[12px] border border-slate-200 bg-white text-slate-700 text-[12px] font-extrabold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmSelfie}
                  disabled={!pendingPunch || !videoReady || isSubmitting}
                  className="h-[42px] rounded-[12px] bg-[#5f1340] text-white text-[12px] font-extrabold disabled:opacity-50"
                >
                  {isSubmitting ? 'Mengirim…' : videoReady ? 'Ambil & Kirim' : 'Menyiapkan...'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
