import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireLeader } from '../../middleware/leader.js';
import { listEmployees, getEmployeeDetail } from '../../controllers/leader/employee.controller.js';

const router = express.Router();
router.use(requireAuth, requireLeader);

router.get('/', listEmployees);
router.get('/:id', getEmployeeDetail);

export default router;