import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireLeader } from '../../middleware/leader.js';
import { getReceivable } from '../../controllers/leader/receivable.controller.js';

const router = express.Router();
router.use(requireAuth, requireLeader);

router.get('/', getReceivable);

export default router;