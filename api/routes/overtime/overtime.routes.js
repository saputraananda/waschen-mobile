import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getMeMeta,
  getMyList,
  getApprovals,
  createOvertime,
  updateOvertime,
  cancelOvertime,
  approveOvertime,
  rejectOvertime
} from '../../controllers/overtime/overtime.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/me-meta', getMeMeta);
router.get('/list', getMyList);
router.get('/approvals', getApprovals);
router.post('/', createOvertime);
router.put('/:id', updateOvertime);
router.delete('/:id', cancelOvertime);
router.patch('/:id/approve', approveOvertime);
router.patch('/:id/reject', rejectOvertime);

export default router;
