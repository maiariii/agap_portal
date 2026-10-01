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
  getNoscaItems,
  searchSchools,
  saveIncumbentQsEvaluation,
  uploadNoscaAndMatch,
  getNoscaDocuments,
  updateIncumbentNoscaItem,
  updateIncumbentDocumentStatus
} from './reclass.controller.js';
import { 
  authenticateToken, 
  requireNoscaUploadAccess, 
  requireHrmoItemAssignAccess 
} from '../../middleware/auth.middleware.js';

const router = Router();

// Regional Office NOSCA Scanner & Import Endpoints (Regional Office & Admin)
router.post('/scan-nosca', authenticateToken, requireNoscaUploadAccess, scanReclassNosca);
router.post('/import-nosca-items', authenticateToken, requireNoscaUploadAccess, importNoscaItems);
router.get('/nosca-items', authenticateToken, getNoscaItems);
router.get('/schools/autocomplete', authenticateToken, searchSchools);
router.post('/upload-nosca-and-match', authenticateToken, requireNoscaUploadAccess, uploadNoscaAndMatch);
router.get('/nosca-documents', authenticateToken, getNoscaDocuments);

// CSV Ingestion & Template Endpoints
router.post('/upload-csv', authenticateToken, uploadReclassCsv);
router.get('/template-csv', downloadReclassTemplate);

// Incumbent Guidance Counselors Endpoints
router.get('/incumbents', authenticateToken, getIncumbents);
router.put('/incumbents/:id/stage', authenticateToken, updateIncumbentStage);
router.put('/incumbents/:id/position', authenticateToken, updateIncumbentPosition);
router.put('/incumbents/:id/dbm-status', authenticateToken, updateIncumbentDbmStatus);
router.get('/incumbents/:id/documents', authenticateToken, getIncumbentDocuments);
router.put('/incumbents/:id/documents/status', authenticateToken, updateIncumbentDocumentStatus);
router.put('/incumbents/:id/qs-evaluation', authenticateToken, saveIncumbentQsEvaluation);
router.put('/incumbents/:id/nosca-item', authenticateToken, requireHrmoItemAssignAccess, updateIncumbentNoscaItem);

// Reclassification Endpoints
router.get('/', authenticateToken, getReclassApplications);
router.post('/', authenticateToken, createReclassApplication);
router.get('/export-dbm', authenticateToken, exportDbmReport);
router.put('/:id/reevaluate', authenticateToken, reevaluateCSC);
router.post('/:id/documents', authenticateToken, updateCredentials);

export default router;
