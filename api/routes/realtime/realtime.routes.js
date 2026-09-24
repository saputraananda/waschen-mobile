import express from 'express';
import path from 'path';
import { emitDataChange, getIO } from '../../socket/io.js';
import { myWaschenPool } from '../../db/pool.js';
import { uploadProduksiPhotos } from '../../middleware/upload.js';
import { requireCleanlinessForProgress } from '../../middleware/cleanlinessGate.js';
import { submitQC, resolveHold } from '../../controllers/produksi/produksi.controller.js';
import {
  deleteAttendancePhotoFile,
  deleteLeaveDocFile,
  deleteKasbonProofFile,
  deleteProduksiPhotoFile,
  deleteGroomingPhotoFile,
  deleteCleanlinessPhotoFile,
  uploadKasbonPaymentProof,
  KASBON_UPLOAD_PUBLIC_PATH
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
 * POST /api/realtime/upload-kasbon-payment (multipart, field "proof")
 * Alsa menitipkan bukti pembayaran kasbon ke disk Waschen Mobile.
 * Header: X-Realtime-Secret
 * Response: { success, path: '/uploads/assets/kasbon/bayar_....jpg' }
 */
router.post('/upload-kasbon-payment', (req, res) => {
  if (!assertRealtimeSecret(req, res)) return;

  uploadKasbonPaymentProof.single('proof')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran bukti terlalu besar (maks 6MB).'
        : (err.message || 'Gagal mengunggah bukti.');
      return res.status(400).json({ success: false, message });
    }
    if (!req.file) {
      return res.status(422).json({ success: false, message: 'File bukti wajib dikirim' });
    }
    return res.json({ success: true, path: `${KASBON_UPLOAD_PUBLIC_PATH}/${req.file.filename}` });
  });
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

async function bindPosEmployee(req, res) {
  const employeeId = Number(req.body?.employee_id);
  if (!employeeId) {
    res.status(422).json({ success: false, message: 'Karyawan wajib' });
    return false;
  }
  const [rows] = await myWaschenPool.query(
    'SELECT outlet_id FROM mst_role WHERE employee_id = ? LIMIT 1',
    [employeeId]
  );
  const outletId = Number(rows[0]?.outlet_id) || null;
  if (!outletId) {
    res.status(403).json({ success: false, message: 'Outlet karyawan belum ditetapkan' });
    return false;
  }
  req.user = {
    employee_id: employeeId,
    employeeId,
    email: null,
    assignedOutletId: outletId
  };
  return true;
}

const uploadQcPhotos = (req, res, next) => {
  uploadProduksiPhotos.array('photos', 5)(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran foto terlalu besar (maks 6MB per foto).'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Maksimal 5 foto per pengiriman.'
          : (err.message || 'Gagal mengunggah foto.');
      return res.status(400).json({ success: false, message });
    }
    return next();
  });
};

/**
 * POST /api/realtime/progress-qc
 * My Waschen POS meneruskan QC frontliner / delivery. Secret hanya di server POS.
 * employee_id dipakai untuk jejak dan outlet; role_used tetap dari mst_role di submitQC.
 */
router.post('/progress-qc', (req, res) => {
  if (!assertRealtimeSecret(req, res)) return;
  uploadQcPhotos(req, res, async () => {
    if (res.headersSent) return;
    if (!(await bindPosEmployee(req, res))) return;
    return requireCleanlinessForProgress(req, res, () => submitQC(req, res));
  });
});

/**
 * POST /api/realtime/progress-hold-resolve
 * Body JSON: { employee_id, detailId, decision, note }
 */
router.post('/progress-hold-resolve', async (req, res) => {
  if (!assertRealtimeSecret(req, res)) return;
  if (!(await bindPosEmployee(req, res))) return;
  req.params.detailId = req.body.detailId;
  return requireCleanlinessForProgress(req, res, () => resolveHold(req, res));
});

export default router;
