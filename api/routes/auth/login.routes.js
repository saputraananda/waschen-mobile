import express from 'express';
import { loginUser } from '../../controllers/auth/login.controller.js';
import { getProfileDetail } from '../../controllers/profile.controller.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', loginUser);

// GET /api/auth/profile -> handled by profile.controller.js
router.get('/profile', getProfileDetail);

export default router;
