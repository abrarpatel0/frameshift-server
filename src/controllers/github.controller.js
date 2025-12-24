import GitHubService from '../services/github.service.js';
import UserModel from '../models/user.model.js';
import ProjectModel from '../models/project.model.js';
import storageService from '../services/storage.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import path from 'path';

/**
 * Initiate GitHub OAuth flow
 * GET /api/auth/github
 */
export const initiateGithubAuth = asyncHandler(async (req, res) => {
  const githubConfig = (await import('../config/github.js')).default;

  const authUrl = `${githubConfig.authorizationURL}?client_id=${githubConfig.clientId}&scope=${githubConfig.scope.join(' ')}&redirect_uri=${encodeURIComponent(githubConfig.callbackURL)}`;

  res.json({
    success: true,
    data: {
      authUrl
    }
  });
});

/**
 * GitHub OAuth callback
 * GET /api/auth/github/callback
 */
export const githubCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Authorization code is required'
      }
    });
  }

  try {
    // Exchange code for access token
    const accessToken = await GitHubService.exchangeCodeForToken(code);

    // Get user profile
    const githubService = new GitHubService(accessToken);
    const profile = await githubService.getUserProfile();
    const primaryEmail = await githubService.getPrimaryEmail();

    // Login or create user
    const AuthService = (await import('../services/auth.service.js')).default;
    const result = await AuthService.githubAuth({
      id: profile.id.toString(),
      username: profile.login,
      email: primaryEmail || profile.email,
      name: profile.name,
      avatar_url: profile.avatar_url,
      accessToken
    });

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
  } catch (error) {
    logger.error('GitHub OAuth callback failed:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
});

/**
 * List user's GitHub repositories
 * GET /api/github/repos
 */
export const listUserRepos = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.perPage) || 30;

  // Get user's GitHub access token
  const user = await UserModel.findById(userId);

  if (!user || !user.github_access_token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'GitHub account not connected. Please authenticate with GitHub first.'
      }
    });
  }

  const githubService = new GitHubService(user.github_access_token);
  const repos = await githubService.listUserRepos({ page, perPage });

  res.json({
    success: true,
    data: {
      repos: repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        clone_url: repo.clone_url,
        private: repo.private,
        language: repo.language,
        updated_at: repo.updated_at
      }))
    }
  });
});

/**
 * Clone repository and create project
 * POST /api/github/clone
 */
export const cloneRepository = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { repoUrl, name, description } = req.body;

  if (!repoUrl) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Repository URL is required'
      }
    });
  }

  // Get user's GitHub access token
  const user = await UserModel.findById(userId);

  if (!user || !user.github_access_token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'GitHub account not connected. Please authenticate with GitHub first.'
      }
    });
  }

  const githubService = new GitHubService(user.github_access_token);

  // Create project directory
  const projectPath = await storageService.createProjectDirectory(userId);

  try {
    // Clone repository
    await githubService.cloneRepo(repoUrl, projectPath);

    // Get directory size
    const size_bytes = await storageService.getDirectorySize(projectPath);

    // Create project record
    const project = await ProjectModel.create({
      user_id: userId,
      name: name || path.basename(repoUrl, '.git'),
      description,
      source_type: 'github',
      source_url: repoUrl,
      file_path: projectPath,
      size_bytes
    });

    logger.info(`Repository cloned: ${repoUrl} for user ${userId}`);

    res.status(201).json({
      success: true,
      data: {
        project
      }
    });
  } catch (error) {
    // Cleanup on error
    await storageService.deleteDirectory(projectPath);
    logger.error('Failed to clone repository:', error);
    throw error;
  }
});

/**
 * Create new GitHub repository
 * POST /api/github/create-repo
 */
export const createRepository = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { name, description, isPrivate } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Repository name is required'
      }
    });
  }

  // Get user's GitHub access token
  const user = await UserModel.findById(userId);

  if (!user || !user.github_access_token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'GitHub account not connected. Please authenticate with GitHub first.'
      }
    });
  }

  const githubService = new GitHubService(user.github_access_token);

  const repo = await githubService.createRepo({
    name,
    description,
    isPrivate: isPrivate !== false // Default to private
  });

  logger.info(`Repository created: ${repo.full_name} by user ${userId}`);

  res.status(201).json({
    success: true,
    data: {
      repo: {
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        clone_url: repo.clone_url,
        private: repo.private
      }
    }
  });
});

/**
 * Push converted project to GitHub
 * POST /api/github/push/:conversionId
 */
export const pushConvertedProject = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { conversionId } = req.params;
  const { repoName, description, isPrivate, repoUrl } = req.body;

  // Get user's GitHub access token
  const user = await UserModel.findById(userId);

  if (!user || !user.github_access_token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'GitHub account not connected. Please authenticate with GitHub first.'
      }
    });
  }

  const githubService = new GitHubService(user.github_access_token);

  // TODO: Get conversion job and verify ownership
  // For now, this is a placeholder that will be completed in Phase 5

  res.json({
    success: true,
    message: 'Push to GitHub will be implemented when conversion feature is ready',
    data: {
      conversionId,
      note: 'This endpoint requires conversion job implementation (Phase 5)'
    }
  });
});

/**
 * Link GitHub account to existing user account
 * POST /api/github/link
 */
export const linkGithubAccount = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Authorization code is required'
      }
    });
  }

  // Exchange code for access token and get user profile
  const githubService = new GitHubService();
  const accessToken = await githubService.getAccessToken(code);
  const profile = await githubService.getUserProfile(accessToken);

  // Prepare GitHub profile data
  const githubProfile = {
    id: profile.id.toString(),
    username: profile.login,
    accessToken: accessToken,
    avatarUrl: profile.avatar_url
  };

  // Link GitHub account to user
  const user = await UserModel.linkGithubAccount(userId, githubProfile);

  res.json({
    success: true,
    data: {
      user
    },
    message: 'GitHub account linked successfully'
  });
});

/**
 * Unlink GitHub account from user
 * DELETE /api/github/unlink
 */
export const unlinkGithubAccount = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  const user = await UserModel.unlinkGithubAccount(userId);

  res.json({
    success: true,
    data: {
      user
    },
    message: 'GitHub account unlinked successfully'
  });
});

/**
 * Get GitHub connection status
 * GET /api/github/status
 */
export const getGithubStatus = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  const isLinked = await UserModel.hasGithubLinked(userId);
  const user = await UserModel.findById(userId);

  res.json({
    success: true,
    data: {
      isLinked,
      github_username: user.github_username || null,
      avatar_url: user.avatar_url || null,
      canPushToGithub: isLinked
    }
  });
});
