import express from 'express';
import path from 'path';
import { emitDataChange, getIO } from '../../socket/io.js';
import {
  deleteAttendancePhotoFile,
  deleteLeaveDocFile,
  deleteKasbonProofFile,
  deleteProduksiPhotoFile,
  deleteGroomingPhotoFile,
  deleteCleanlinessPhotoFile
} from '../../middleware/upload.js';

const router = express.Router();

function assertRealtimeSecret(req, res) {
  const secret = req.headers['x-realtime-secret'] || req.headers['x-api-key'];
  const expected = process.env.REALTIME_SECRET || process.env.SESSION_SECRET || 'waschensecret';
  if (!secret || secret !== expected) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return false;
  }
  return true;
}

/**
 * POST /api/realtime/notify
 * Dipakai Alsa (atau service lain) setelah ACC/reject agar mobile ikut update.
 * Header: X-Realtime-Secret: <REALTIME_SECRET | SESSION_SECRET>
 * Body: { domain, outletId?, employeeId?, action?, meta? }
 */
router.post('/notify', (req, res) => {
  if (!assertRealtimeSecret(req, res)) return;

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

/**
 * POST /api/realtime/delete-upload
 * Alsa minta hapus file di server Waschen Mobile (prod HTTP mode).
 * Body: { type: 'attendance'|'leave'|'kasbon'|'produksi', fileName?, filePath?, stage? }
 */
router.post('/delete-upload', async (req, res) => {
  if (!assertRealtimeSecret(req, res)) return;

  try {
    const type = String(req.body?.type || '').trim().toLowerCase();
    const fileName = path.basename(String(req.body?.fileName || req.body?.filename || '').trim());
    const filePath = String(req.body?.filePath || req.body?.path || '').trim();
    const stage = String(req.body?.stage || '').trim();

    if (!type) {
      return res.status(422).json({ success: false, message: 'type wajib' });
    }

    if (type === 'attendance') {
      if (!fileName) return res.status(422).json({ success: false, message: 'fileName wajib' });
      await deleteAttendancePhotoFile(fileName);
    } else if (type === 'grooming') {
      if (!fileName) return res.status(422).json({ success: false, message: 'fileName wajib' });
      await deleteGroomingPhotoFile(fileName);
    } else if (type === 'cleanliness') {
      if (!fileName) return res.status(422).json({ success: false, message: 'fileName wajib' });
      await deleteCleanlinessPhotoFile(fileName);
    } else if (type === 'leave') {
      if (!fileName) return res.status(422).json({ success: false, message: 'fileName wajib' });
      await deleteLeaveDocFile(fileName);
    } else if (type === 'kasbon') {
      const target = filePath || fileName;
      if (!target) return res.status(422).json({ success: false, message: 'filePath/fileName wajib' });
      await deleteKasbonProofFile(target);
    } else if (type === 'produksi') {
      if (filePath) {
        await deleteProduksiPhotoFile(filePath);
      } else if (stage && fileName) {
        await deleteProduksiPhotoFile(stage, fileName);
      } else {
        return res.status(422).json({ success: false, message: 'filePath atau stage+fileName wajib' });
      }
    } else {
      return res.status(422).json({ success: false, message: 'type tidak dikenal' });
    }

    return res.json({ success: true, message: 'File dihapus' });
  } catch (err) {
    console.error('[realtime delete-upload]', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus file' });
  }
});

export default router;
