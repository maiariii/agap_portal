import { Router } from 'express';
import {
  getApplications,
  reviewApplication,
  postIer,
  updatePipeline,
  confirmAppointment
} from './apps.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, getApplications);
router.post('/:id/review', authenticateToken, reviewApplication);
router.post('/post-ier', authenticateToken, postIer);
router.put('/:id/pipeline', authenticateToken, updatePipeline);
router.post('/:id/appointment', authenticateToken, confirmAppointment);

export default router;
