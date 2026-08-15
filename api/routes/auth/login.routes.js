import express from 'express';
import { loginUser, getUserProfile } from '../../controllers/auth/login.controller.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', loginUser);

// GET /api/auth/profile
router.get('/profile', getUserProfile);

export default router;
