import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

/**
 * MEMORY — Realtime Waschen Mobile (Socket.IO)
 * - Setelah mutasi DB (create/update/approve/reject/QC/absen), emit 'data:changed'
 * - Client di halaman terkait listen domain-nya lalu refetch tanpa refresh manual
 * - Domain: leave | kasbon | overtime | attendance | progress | history | profile
 * - Alsa bisa push via POST /api/realtime/notify (shared secret)
 */

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    },
    path: '/socket.io'
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'waschensecret');
      const employeeId = decoded.employee_id || decoded.employeeId || null;
      const outletId = decoded.assignedOutletId ?? null;

      socket.data.user = {
        userId: decoded.userId || decoded.user_id || null,
        employeeId,
        outletId,
        email: decoded.email || null
      };
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { employeeId, outletId } = socket.data.user || {};
    if (employeeId) socket.join(`employee:${employeeId}`);
    if (outletId) socket.join(`outlet:${outletId}`);
    // Semua domain yang dipakai halaman mobile
    ['leave', 'kasbon', 'overtime', 'attendance', 'progress', 'history', 'profile'].forEach((d) => {
      socket.join(`domain:${d}`);
    });

    socket.on('join:outlet', (id) => {
      const oid = Number(id);
      if (oid) socket.join(`outlet:${oid}`);
    });
  });

  console.log('[socket.io] realtime ready');
  return io;
}

export function getIO() {
  return io;
}

/**
 * Emit perubahan data ke client yang relevan.
 * @param {{ domain: string, outletId?: number|null, employeeId?: number|null, action?: string, meta?: object }} opts
 */
export function emitDataChange(opts = {}) {
  const { domain, outletId = null, employeeId = null, action = null, meta = null } = opts;
  if (!domain || !io) return;

  const payload = {
    domain,
    outletId: outletId != null ? Number(outletId) : null,
    employeeId: employeeId != null ? Number(employeeId) : null,
    action: action || null,
    meta: meta || null,
    at: Date.now()
  };

  // Domain room — halaman yang subscribe domain ini akan refetch
  io.to(`domain:${domain}`).emit('data:changed', payload);

  // Outlet-scoped (progress / overtime approval cabang)
  if (payload.outletId) {
    io.to(`outlet:${payload.outletId}`).emit('data:changed', payload);
  }

  // Employee-scoped (pengajuan milik sendiri di-ACC dari Alsa/leader)
  if (payload.employeeId) {
    io.to(`employee:${payload.employeeId}`).emit('data:changed', payload);
  }
}
