import { invalidateAuthOnSuccessfulMutation } from '../services/authCache';
import { Router } from 'express';
import { login, me, changePassword } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', loginRateLimiter, login);
router.post('/change-password', authenticateToken, invalidateAuthOnSuccessfulMutation, changePassword);
router.get('/me', authenticateToken, me);

export default router;
