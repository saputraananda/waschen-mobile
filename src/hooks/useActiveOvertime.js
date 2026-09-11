import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useRealtimeRefresh } from '../context/SocketContext.jsx';

const api = axios.create({ baseURL: '/api', timeout: 30000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Sesi lembur aktif karyawan (status berlangsung).
 * past_midnight = lupa close & sudah ganti hari → lock menu.
 */
export default function useActiveOvertime(enabled = true) {
  const [active, setActive] = useState(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setActive(null);
      setLocked(false);
      setLoading(false);
      return null;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setActive(null);
      setLocked(false);
      setLoading(false);
      return null;
    }
    try {
      const res = await api.get('/overtime/active');
      const data = res.data?.data || null;
      const isLocked = Boolean(res.data?.locked || data?.past_midnight);
      setActive(data);
      setLocked(isLocked);
      return data;
    } catch {
      setActive(null);
      setLocked(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtimeRefresh('overtime', refresh);

  return {
    active,
    locked,
    loading,
    isActive: Boolean(active),
    refresh
  };
}
