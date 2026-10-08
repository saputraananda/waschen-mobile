import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getCalendar,
  getDayOffs,
  getOutletDayOffs,
  requestDayOff,
  cancelDayOff,
  listLeaderDayOffs,
  leaderApproveDayOff,
  leaderRejectDayOff,
  getMyBackups
} from '../../controllers/history/history.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/calendar', getCalendar);
router.get('/day-offs', getDayOffs);
router.get('/day-offs/outlet', getOutletDayOffs);
router.get('/day-off/approvals', listLeaderDayOffs);
router.get('/day-off/backups', getMyBackups);
router.post('/day-off', requestDayOff);
router.patch('/day-off/:id/leader-approve', leaderApproveDayOff);
router.patch('/day-off/:id/leader-reject', leaderRejectDayOff);
router.delete('/day-off/:id', cancelDayOff);

export default router;
