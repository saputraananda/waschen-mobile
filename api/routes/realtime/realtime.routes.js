import express from 'express';
import { emitDataChange, getIO } from '../../socket/io.js';

const router = express.Router();

/**
 * POST /api/realtime/notify
 * Dipakai Alsa (atau service lain) setelah ACC/reject agar mobile ikut update.
 * Header: X-Realtime-Secret: <REALTIME_SECRET | SESSION_SECRET>
 * Body: { domain, outletId?, employeeId?, action?, meta? }
 */
router.post('/notify', (req, res) => {
  const secret = req.headers['x-realtime-secret'] || req.headers['x-api-key'];
  const expected = process.env.REALTIME_SECRET || process.env.SESSION_SECRET || 'waschensecret';
  if (!secret || secret !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const domain = String(req.body?.domain || '').trim();
  if (!domain) {
    return res.status(422).json({ success: false, message: 'domain wajib' });
  }

  if (!getIO()) {
    return res.status(503).json({ success: false, message: 'Socket belum siap' });
  }

  emitDataChange({
    domain,
    outletId: req.body.outletId ?? null,
    employeeId: req.body.employeeId ?? null,
    action: req.body.action || 'notify',
    meta: req.body.meta || null
  });

  return res.json({ success: true, message: 'Broadcast terkirim' });
});

export default router;
