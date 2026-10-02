import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listMyPayslips, viewMyPayslip } from '../../controllers/payslip/payslip.controller.js';

const router = express.Router();
router.use(requireAuth);
router.get('/', listMyPayslips);
router.get('/:id/file', viewMyPayslip);

export default router;
