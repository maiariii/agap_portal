import { Router } from 'express';
import {
  getApplications,
  reviewApplication,
  postIer,
  updatePipeline,
  confirmAppointment,
  flagAppointment,
  rollbackAppointment,
  getApplicationDocuments,
  downloadApplicationDocument,
  exportCar,
  exportIer,
  downloadNoticeOfAppointment,
  downloadCarTemplate,
  uploadCarCsvBackground,
  getCarJobStatus,
  getCarBatchReview,
  confirmCarBatch,
  getTeacherItems,
  appointTeacherItem
} from './apps.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

// Base Application Endpoints
router.get('/', authenticateToken, getApplications);
router.get('/export-car', authenticateToken, exportCar);
router.get('/export-ier', authenticateToken, exportIer);

// Teacher Hiring: CAR Template, Upload Job, Review, Confirm, and Item Appointments
router.get('/teacher-hiring/template', authenticateToken, downloadCarTemplate);
router.post('/teacher-hiring/upload-car', authenticateToken, uploadCarCsvBackground);
router.get('/teacher-hiring/jobs/:jobId', authenticateToken, getCarJobStatus);
router.get('/teacher-hiring/batches/:batchId/review', authenticateToken, getCarBatchReview);
router.post('/teacher-hiring/batches/:batchId/confirm', authenticateToken, confirmCarBatch);
router.get('/teacher-hiring/items', authenticateToken, getTeacherItems);
router.post('/teacher-hiring/appointments', authenticateToken, appointTeacherItem);

// Individual Application Parameterized Endpoints
router.get('/:id/notice', authenticateToken, downloadNoticeOfAppointment);
router.get('/:id/documents', authenticateToken, getApplicationDocuments);
router.get('/:id/documents/:key/download', authenticateToken, downloadApplicationDocument);
router.post('/:id/review', authenticateToken, reviewApplication);
router.post('/post-ier', authenticateToken, postIer);
router.put('/:id/pipeline', authenticateToken, updatePipeline);
router.post('/:id/appointment', authenticateToken, confirmAppointment);
router.post('/:id/flag-appointment', authenticateToken, flagAppointment);
router.post('/:id/rollback-appointment', authenticateToken, rollbackAppointment);

export default router;
