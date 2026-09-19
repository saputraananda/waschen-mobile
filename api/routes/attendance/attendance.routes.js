import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  uploadAttendanceSelfie,
  uploadGroomingPhoto,
  uploadCleanlinessPhotos
} from '../../middleware/upload.js';
import {
  getTodayAttendance,
  getOutlets,
  checkLocation,
  punchSelfie,
  deletePunch
} from '../../controllers/attendance/attendance.controller.js';
import {
  getGroomingCleanliness,
  getProgressGate,
  uploadGroomingStep,
  deleteGroomingPhoto,
  submitGroomingReason,
  uploadCleanliness,
  deleteCleanlinessPhoto
} from '../../controllers/attendance/groomingCleanliness.controller.js';

const router = express.Router();

router.use(requireAuth);

const multerErr = (err, res) => {
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? 'Ukuran foto terlalu besar (maks 6MB).'
    : (err.message || 'Gagal mengunggah foto.');
  return res.status(400).json({ success: false, message });
};

router.get('/today', getTodayAttendance);
router.get('/outlets', getOutlets);
router.get('/grooming-cleanliness', getGroomingCleanliness);
router.get('/progress-gate', getProgressGate);
router.post('/check-location', checkLocation);
router.post('/punch-selfie', (req, res, next) => {
  uploadAttendanceSelfie.single('selfie')(req, res, (err) => {
    if (err) return multerErr(err, res);
    next();
  });
}, punchSelfie);
router.post('/delete-punch', deletePunch);

router.post('/grooming-photo', (req, res, next) => {
  uploadGroomingPhoto.single('selfie')(req, res, (err) => {
    if (err) return multerErr(err, res);
    next();
  });
}, uploadGroomingStep);

router.post('/grooming-photo/delete', deleteGroomingPhoto);
router.post('/grooming-reason', submitGroomingReason);

router.post('/cleanliness-photos', (req, res, next) => {
  uploadCleanlinessPhotos.array('photos', 8)(req, res, (err) => {
    if (err) return multerErr(err, res);
    next();
  });
}, uploadCleanliness);

router.post('/cleanliness-photos/delete', deleteCleanlinessPhoto);

export default router;
