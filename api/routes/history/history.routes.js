import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getCalendar,
  getDayOffs,
  getOutletDayOffs,
  requestDayOff,
  cancelDayOff
} from '../../controllers/history/history.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/calendar', getCalendar);
router.get('/day-offs', getDayOffs);
router.get('/day-offs/outlet', getOutletDayOffs);
router.post('/day-off', requestDayOff);
router.delete('/day-off/:id', cancelDayOff);

export default router;
