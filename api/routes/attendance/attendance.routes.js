import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { uploadAttendanceSelfie } from '../../middleware/upload.js';
import {
  getTodayAttendance,
  getOutlets,
  checkLocation,
  punchSelfie,
  deletePunch
} from '../../controllers/attendance/attendance.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/today', getTodayAttendance);
router.get('/outlets', getOutlets);
router.post('/check-location', checkLocation);
router.post('/punch-selfie', (req, res, next) => {
  uploadAttendanceSelfie.single('selfie')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran foto terlalu besar (maks 6MB).'
        : (err.message || 'Gagal mengunggah foto.');
      return res.status(400).json({ success: false, message });
    }
    next();
  });
}, punchSelfie);
router.post('/delete-punch', deletePunch);

export default router;
