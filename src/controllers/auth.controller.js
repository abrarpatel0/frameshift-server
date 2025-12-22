import AuthService from '../services/auth.service.js';
import asyncHandler from '../utils/asyncHandler.js';

// Import GitHub OAuth functions
export { initiateGithubAuth, githubCallback } from './github.controller.js';

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, full_name } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Email and password are required',
      },
    });
  }

  // Register user
  const result = await AuthService.register({ email, password, full_name });

  res.status(201).json({
    success: true,
    data: {
      user: result.user,
      token: result.token,
    },
  });
});

/**
 * Login user
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Email and password are required',
      },
    });
  }

  // Login user
  const result = await AuthService.login(email, password);

  res.json({
    success: true,
    data: {
      user: result.user,
      token: result.token,
    },
  });
});

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  // With JWT, logout is handled on client-side by removing the token
  // This endpoint is here for consistency and can be used for additional cleanup

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * Refresh token
 * POST /api/auth/refresh
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { userId, email } = req.user;

  // Generate new token
  const token = AuthService.generateToken({ userId, email });

  res.json({
    success: true,
    data: {
      token,
    },
  });
});

/**
 * Get current user
 * GET /api/auth/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const UserModel = (await import('../models/user.model.js')).default;
  const user = await UserModel.findById(req.user.userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        message: 'User not found',
      },
    });
  }

  res.json({
    success: true,
    data: {
      user,
    },
  });
});
