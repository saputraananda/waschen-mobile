import express from 'express';
import {
  getProfileDetail,
  updateProfile,
  getBanks,
  getEducationLevels,
  uploadDoc
} from '../controllers/profile.controller.js';

const router = express.Router();

// Profile detail endpoints
router.get('/profile-detail', getProfileDetail);
router.get('/detail', getProfileDetail);

// Profile update endpoints
router.put('/update-profile', updateProfile);
router.put('/update', updateProfile);

// Reference data endpoints
router.get('/banks', getBanks);
router.get('/education-levels', getEducationLevels);

// Document upload endpoint
router.post('/upload-doc/:docKey', uploadDoc);

export default router;
