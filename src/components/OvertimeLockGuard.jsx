import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useActiveOvertime from '../hooks/useActiveOvertime.js';

const ALLOWED_WHEN_LOCKED = new Set([
  '/',
  '/overtime',
  '/lembur',
  '/history',
  '/riwayat',
  '/profile',
  '/edit-profile',
  '/login'
]);

/** Blok navigasi ke menu lain jika lembur belum close setelah ganti hari. */
export default function OvertimeLockGuard({ children }) {
  const location = useLocation();
  const { locked, loading } = useActiveOvertime(true);

  if (loading) return children;

  if (locked && !ALLOWED_WHEN_LOCKED.has(location.pathname)) {
    return <Navigate to="/overtime" replace state={{ lockReason: 'past_midnight' }} />;
  }

  return children;
}
