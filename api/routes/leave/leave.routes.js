import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { uploadDoctorNote } from '../../middleware/upload.js';
import {
  getTodayLeave,
  getLeaveYears,
  getLeaveStats,
  getLeaveList,
  submitLeave,
  updateLeave,
  cancelLeave
} from '../../controllers/leave/leave.controller.js';

const router = express.Router();

router.use(requireAuth);

const uploadDoctorNoteWithErrorHandling = (req, res, next) => {
  uploadDoctorNote.single('doctor_note')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran foto terlalu besar (maks 6MB).'
        : (err.message || 'Gagal mengunggah foto surat dokter.');
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

router.get('/today', getTodayLeave);
router.get('/years', getLeaveYears);
router.get('/stats', getLeaveStats);
router.get('/list', getLeaveList);
router.post('/', uploadDoctorNoteWithErrorHandling, submitLeave);
router.put('/:id', uploadDoctorNoteWithErrorHandling, updateLeave);
router.delete('/:id', cancelLeave);

export default router;
