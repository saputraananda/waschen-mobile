import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireCleanlinessForProgress } from '../../middleware/cleanlinessGate.js';
import { uploadProduksiPhotos } from '../../middleware/upload.js';
import {
  getSummary,
  getList,
  getTransactionDetail,
  getItemBagHistory,
  getItemKgMaster,
  submitQC,
  getHolds,
  resolveHold
} from '../../controllers/produksi/produksi.controller.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireCleanlinessForProgress);

const uploadProduksiPhotosWithErrorHandling = (req, res, next) => {
  uploadProduksiPhotos.array('photos', 5)(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran foto terlalu besar (maks 6MB per foto).'
          : err.code === 'LIMIT_FILE_COUNT'
            ? 'Maksimal 5 foto per pengiriman.'
            : err.message || 'Gagal mengunggah foto.';
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

router.get('/summary', getSummary);
router.get('/list', getList);
router.get('/holds', getHolds);
router.get('/transaction/:id', getTransactionDetail);
router.get('/item/:detailId/bag-history', getItemBagHistory);
router.get('/item-kg', getItemKgMaster);
router.post('/qc', uploadProduksiPhotosWithErrorHandling, submitQC);
router.post('/hold/:detailId/resolve', resolveHold);

export default router;
