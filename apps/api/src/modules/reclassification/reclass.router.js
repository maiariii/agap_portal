import { Router } from 'express';
import {
  getReclassApplications,
  createReclassApplication,
  reevaluateCSC,
  updateCredentials,
  exportDbmReport,
  getIncumbents,
  updateIncumbentStage,
  updateIncumbentPosition,
  getIncumbentDocuments
} from './reclass.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

// Incumbent Guidance Counselors Endpoints
router.get('/incumbents', authenticateToken, getIncumbents);
router.put('/incumbents/:id/stage', authenticateToken, updateIncumbentStage);
router.put('/incumbents/:id/position', authenticateToken, updateIncumbentPosition);
router.get('/incumbents/:id/documents', authenticateToken, getIncumbentDocuments);

// Reclassification Endpoints
router.get('/', authenticateToken, getReclassApplications);
router.post('/', authenticateToken, createReclassApplication);
router.get('/export-dbm', authenticateToken, exportDbmReport);
router.put('/:id/reevaluate', authenticateToken, reevaluateCSC);
router.post('/:id/documents', authenticateToken, updateCredentials);

export default router;
