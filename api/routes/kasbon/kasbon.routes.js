import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { uploadKasbonProof } from '../../middleware/upload.js';
import {
  getKasbonList,
  getKasbonById,
  submitKasbon,
  updateKasbon,
  deleteKasbon
} from '../../controllers/kasbon/kasbon.controller.js';

const router = express.Router();

router.use(requireAuth);

const uploadKasbonProofWithErrorHandling = (req, res, next) => {
  uploadKasbonProof.single('proof_doc')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran foto terlalu besar (maks 6MB).'
        : (err.message || 'Gagal mengunggah foto bukti.');
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

router.get('/list', getKasbonList);
router.get('/:id', getKasbonById);
router.post('/', uploadKasbonProofWithErrorHandling, submitKasbon);
router.put('/:id', uploadKasbonProofWithErrorHandling, updateKasbon);
router.delete('/:id', deleteKasbon);

export default router;
