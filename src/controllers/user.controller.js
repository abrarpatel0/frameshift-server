import UserModel from '../models/user.model.js';
import ProjectModel from '../models/project.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

/**
 * Get current user profile
 * GET /api/users/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  const user = await UserModel.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        message: 'User not found'
      }
    });
  }

  res.json({
    success: true,
    data: {
      user
    }
  });
});

/**
 * Update user profile
 * PATCH /api/users/me
 */
export const updateUserProfile = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { full_name, email } = req.body;

  const updateData = {};
  if (full_name !== undefined) updateData.full_name = full_name;
  if (email) {
    // Check if email is already taken by another user
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Email already in use'
        }
      });
    }
    updateData.email = email;
    updateData.email_verified = false; // Reset verification if email changes
  }

  const user = await UserModel.update(userId, updateData);

  logger.info(`User profile updated: ${userId}`);

  res.json({
    success: true,
    data: {
      user
    }
  });
});

/**
 * Delete user account
 * DELETE /api/users/me
 */
export const deleteUserAccount = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  // Delete user (cascades to projects and conversion jobs)
  await UserModel.delete(userId);

  logger.info(`User account deleted: ${userId}`);

  res.json({
    success: true,
    message: 'User account deleted successfully'
  });
});

/**
 * Get user's projects
 * GET /api/users/me/projects
 */
export const getUserProjects = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;

  const result = await ProjectModel.getPaginated(userId, page, pageSize);

  res.json({
    success: true,
    data: result
  });
});

/**
 * Get user's conversion history
 * GET /api/users/me/conversions
 */
export const getUserConversions = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  // TODO: Implement when conversion job model is created
  // For now, return empty array

  res.json({
    success: true,
    data: {
      conversions: [],
      message: 'Conversion history will be available when conversion feature is implemented'
    }
  });
});

/**
 * Get user statistics
 * GET /api/users/me/stats
 */
export const getUserStats = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  const totalProjects = await ProjectModel.countByUserId(userId);

  // TODO: Add conversion statistics when conversion feature is implemented

  res.json({
    success: true,
    data: {
      stats: {
        totalProjects,
        totalConversions: 0,
        completedConversions: 0,
        failedConversions: 0
      }
    }
  });
});
