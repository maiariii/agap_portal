import { Router } from 'express';
import {
  getVacancies,
  createVacancy,
  toggleVacancyStatus,
  scanNosca,
  importNosca,
  autocompleteSchools,
  deleteVacancy
} from './vacancies.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, getVacancies);
router.get('/schools/autocomplete', authenticateToken, autocompleteSchools);
router.post('/', authenticateToken, createVacancy);
router.put('/:id', authenticateToken, toggleVacancyStatus);
router.post('/scan-nosca', authenticateToken, scanNosca);
router.post('/import-nosca', authenticateToken, importNosca);
router.delete('/:id', authenticateToken, deleteVacancy);

export default router;
