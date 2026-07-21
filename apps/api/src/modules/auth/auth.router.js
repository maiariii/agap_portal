import { Router } from 'express';
import {
  getRegionsDivisions,
  hqSsoLogin,
  login,
  register,
  verifyPasscode,
} from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.post('/hq-sso', hqSsoLogin);
router.post('/register', register);
router.post('/verify-passcode', authenticateToken, verifyPasscode);
router.get('/regions-divisions', getRegionsDivisions);

export default router;
