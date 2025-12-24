import express from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  getCurrentUser,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  initiateGithubAuth,
  githubCallback
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes (with rate limiting)
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Email verification routes (public)
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

// GitHub OAuth routes
router.get('/github', initiateGithubAuth);
router.get('/github/callback', githubCallback);

// Protected routes (require authentication)
router.post('/logout', authenticateToken, logout);
router.post('/refresh', authenticateToken, refreshToken);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/resend-verification', authenticateToken, resendVerification);
router.post('/change-password', authenticateToken, changePassword);

export default router;
