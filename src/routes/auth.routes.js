import express from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  getCurrentUser,
  initiateGithubAuth,
  githubCallback
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes (with rate limiting)
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// GitHub OAuth routes
router.get('/github', initiateGithubAuth);
router.get('/github/callback', githubCallback);

// Protected routes
router.post('/logout', authenticateToken, logout);
router.post('/refresh', authenticateToken, refreshToken);
router.get('/me', authenticateToken, getCurrentUser);

export default router;
