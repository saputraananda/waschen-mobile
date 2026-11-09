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

export default router;
