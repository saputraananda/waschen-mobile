import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listMyStock, saveOpname } from '../../controllers/inventory/inventory.controller.js';

const router = express.Router();
router.use(requireAuth);
router.get('/mine', listMyStock);
router.post('/opname', saveOpname);

export default router;
