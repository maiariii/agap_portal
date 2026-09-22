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
  updateIncumbentDbmStatus,
  getIncumbentDocuments,
  uploadReclassCsv,
  downloadReclassTemplate,
  scanReclassNosca,
  importNoscaItems,
  getNoscaItems
} from './reclass.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

// Regional Office NOSCA Scanner & Import Endpoints
router.post('/scan-nosca', authenticateToken, scanReclassNosca);
router.post('/import-nosca-items', authenticateToken, importNoscaItems);
router.get('/nosca-items', authenticateToken, getNoscaItems);

// CSV Ingestion & Template Endpoints
router.post('/upload-csv', authenticateToken, uploadReclassCsv);
router.get('/template-csv', downloadReclassTemplate);

// Incumbent Guidance Counselors Endpoints
router.get('/incumbents', authenticateToken, getIncumbents);
router.put('/incumbents/:id/stage', authenticateToken, updateIncumbentStage);
router.put('/incumbents/:id/position', authenticateToken, updateIncumbentPosition);
router.put('/incumbents/:id/dbm-status', authenticateToken, updateIncumbentDbmStatus);
router.get('/incumbents/:id/documents', authenticateToken, getIncumbentDocuments);

// Reclassification Endpoints
router.get('/', authenticateToken, getReclassApplications);
router.post('/', authenticateToken, createReclassApplication);
router.get('/export-dbm', authenticateToken, exportDbmReport);
router.put('/:id/reevaluate', authenticateToken, reevaluateCSC);
router.post('/:id/documents', authenticateToken, updateCredentials);

export default router;
