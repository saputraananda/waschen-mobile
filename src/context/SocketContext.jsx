import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * MEMORY — SocketProvider
 * Connect ke server Socket.IO dengan JWT. Auto reconnect.
 * DEV: :9001 (API). Production: same origin / VITE_SOCKET_URL.
 */

const SocketContext = createContext({
  socket: null,
  connected: false
});

function resolveSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.DEV) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:9001`;
  }
  return window.location.origin;
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [tokenTick, setTokenTick] = useState(0);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'token') setTokenTick((t) => t + 1);
    };
    const onAuth = () => setTokenTick((t) => t + 1);
    window.addEventListener('storage', onStorage);
    window.addEventListener('waschen:auth-changed', onAuth);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('waschen:auth-changed', onAuth);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      setConnected(false);
      return undefined;
    }

    const s = io(resolveSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity
    });

    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.assignedOutletId) s.emit('join:outlet', user.assignedOutletId);
      } catch (_) { /* ignore */ }
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));

    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [tokenTick]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

/**
 * Listen 'data:changed' untuk domain tertentu → panggil onChange (refetch).
 * Debounce 300ms.
 */
export function useRealtimeRefresh(domains, onChange, opts = {}) {
  const { socket } = useSocket();
  const { outletId = null, enabled = true } = opts;
  const cbRef = useRef(onChange);
  cbRef.current = onChange;
  const timerRef = useRef(null);

  const domainKey = Array.isArray(domains) ? domains.join('|') : String(domains || '');

  useEffect(() => {
    if (!enabled || !socket) return undefined;
    const domainSet = new Set(
      (Array.isArray(domains) ? domains : [domains]).filter(Boolean)
    );

    const handler = (payload) => {
      if (!payload?.domain || !domainSet.has(payload.domain)) return;
      if (
        outletId != null &&
        payload.outletId != null &&
        Number(payload.outletId) !== Number(outletId)
      ) {
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try { cbRef.current?.(); } catch (_) { /* ignore */ }
      }, 300);
    };

    socket.on('data:changed', handler);
    return () => {
      socket.off('data:changed', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [socket, domainKey, outletId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function notifyAuthChanged() {
  window.dispatchEvent(new Event('waschen:auth-changed'));
}
