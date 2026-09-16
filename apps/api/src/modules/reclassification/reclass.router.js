import { Router } from 'express';
import {
  getReclassApplications,
  createReclassApplication,
  reevaluateCSC,
  updateCredentials,
  exportDbmReport
} from './reclass.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

// Reclassification Endpoints
router.get('/', authenticateToken, getReclassApplications);
router.post('/', authenticateToken, createReclassApplication);
router.get('/export-dbm', authenticateToken, exportDbmReport);
router.put('/:id/reevaluate', authenticateToken, reevaluateCSC);
router.post('/:id/documents', authenticateToken, updateCredentials);

export default router;
