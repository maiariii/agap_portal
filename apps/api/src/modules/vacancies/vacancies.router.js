import { Router } from 'express';
import {
  getVacancies,
  createVacancy,
  toggleVacancyStatus,
  fetchVacancyDocuments,
  scanNosca,
  importNosca,
  autocompleteSchools,
  autocompleteApplicantEmails,
  verifyApplicantEmail,
  saveAgapInvited,
  deleteVacancy
} from './vacancies.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, getVacancies);
router.get('/schools/autocomplete', authenticateToken, autocompleteSchools);
router.get('/applicants/autocomplete', authenticateToken, autocompleteApplicantEmails);
router.get('/applicants/verify', authenticateToken, verifyApplicantEmail);
router.post('/', authenticateToken, createVacancy);
router.put('/:id', authenticateToken, toggleVacancyStatus);
router.post('/:id/fetch-documents', authenticateToken, fetchVacancyDocuments);
router.post('/scan-nosca', authenticateToken, scanNosca);
router.post('/import-nosca', authenticateToken, importNosca);
router.delete('/:id', authenticateToken, deleteVacancy);
router.post('/invited', authenticateToken, saveAgapInvited);

export default router;

