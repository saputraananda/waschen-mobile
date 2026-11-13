import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  listMyTrainings,
  getMyTraining,
  getMyAnswers,
  getTest,
  submitTest,
  getFeedbackForm,
  submitFeedback,
  listMySkills,
} from '../../controllers/academy/academy.controller.js';
import {
  listMentoring,
  listMentoringParticipants,
  getMentoringForm,
  saveMentoring,
  listObserving,
  getObservingDetail,
  saveObservingDay,
  addObservingPhotos,
  deleteObservingPhoto,
  getMyOjt,
} from '../../controllers/academy/penilaian.controller.js';
import { uploadOjtPhotos } from '../../middleware/upload.js';

const router = express.Router();
router.use(requireAuth);

const uploadOjtPhotosWithErrorHandling = (req, res, next) => {
  uploadOjtPhotos.array('photos', 5)(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto terlalu besar (maks 6MB).'
      : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Maksimal 5 foto per penilaian.'
      : err.message || 'Gagal mengunggah foto.';
    res.status(400).json({ success: false, message });
  });
};
router.get('/trainings', listMyTrainings);
router.get('/trainings/:id', getMyTraining);
router.get('/trainings/:id/answers', getMyAnswers);
router.get('/trainings/:id/test/:phase', getTest);
router.post('/trainings/:id/test/:phase', submitTest);
router.get('/trainings/:id/feedback', getFeedbackForm);
router.post('/trainings/:id/feedback', submitFeedback);
router.get('/skills', listMySkills);
router.get('/penilaian/mentor', listMentoring);
router.get('/penilaian/mentor/batch/:batchId', listMentoringParticipants);
router.get('/penilaian/mentor/:participantId', getMentoringForm);
router.put('/penilaian/mentor/:participantId', saveMentoring);
router.get('/penilaian/ojt', listObserving);
router.get('/penilaian/ojt-saya', getMyOjt);
router.get('/penilaian/ojt/:id', getObservingDetail);
router.put('/penilaian/ojt/:id/criteria/:criterionId/days/:date', saveObservingDay);
router.post('/penilaian/ojt/:id/criteria/:criterionId/days/:date/photos', uploadOjtPhotosWithErrorHandling, addObservingPhotos);
router.delete('/penilaian/ojt/:id/criteria/:criterionId/days/:date/photos/:photoId', deleteObservingPhoto);

export default router;
