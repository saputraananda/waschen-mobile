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
  getMyOjt,
} from '../../controllers/academy/penilaian.controller.js';

const router = express.Router();
router.use(requireAuth);
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
router.put('/penilaian/ojt/:id/days/:date', saveObservingDay);

export default router;
