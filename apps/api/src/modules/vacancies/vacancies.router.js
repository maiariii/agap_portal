import { Router } from 'express';
import {
  getVacancies,
  createVacancy,
  toggleVacancyStatus,
  scanNosca,
  importNosca
} from './vacancies.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, getVacancies);
router.post('/', authenticateToken, createVacancy);
router.put('/:id', authenticateToken, toggleVacancyStatus);
router.post('/scan-nosca', authenticateToken, scanNosca);
router.post('/import-nosca', authenticateToken, importNosca);

export default router;
