import { Router } from 'express';
import { login, register, verifyPasscode, getRegionsDivisions } from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/verify-passcode', authenticateToken, verifyPasscode);
router.get('/regions-divisions', getRegionsDivisions);

export default router;
