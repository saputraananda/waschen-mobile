import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { uploadEmployeeAsset } from '../../middleware/upload.js';
import {
  getProfileDetail,
  updateProfile,
  getBanks,
  getEducationLevels,
  uploadDoc,
  deleteDoc
} from '../../controllers/profile/profile.controller.js';

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

// Document upload endpoint — wajib login, 1 file, format dibatasi di middleware
const uploadEmployeeAssetSafe = (req, res, next) => {
  uploadEmployeeAsset.single('doc')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran file terlalu besar (maks 6MB).'
        : (err.message || 'Gagal mengunggah file.');
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

router.post('/upload-doc/:docKey', requireAuth, uploadEmployeeAssetSafe, uploadDoc);
router.delete('/upload-doc/:docKey', requireAuth, deleteDoc);

export default router;
