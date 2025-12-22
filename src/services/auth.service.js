import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import UserModel from '../models/user.model.js';
import logger from '../utils/logger.js';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Authentication service
 */
export class AuthService {
  /**
   * Hash password
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} Match result
   */
  static async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   * @param {Object} payload - Token payload
   * @returns {string} JWT token
   */
  static generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Register new user with email/password
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} User and token
   */
  static async register(userData) {
    const { email, password, full_name } = userData;

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      const error = new Error('User with this email already exists');
      error.statusCode = 400;
      throw error;
    }

    // Hash password
    const password_hash = await this.hashPassword(password);

    // Create user
    const user = await UserModel.create({
      email,
      password_hash,
      full_name,
    });

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
    });

    logger.info(`New user registered: ${email}`);

    return {
      user,
      token,
    };
  }

  /**
   * Login user with email/password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User and token
   */
  static async login(email, password) {
    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Check if user has password (not OAuth-only user)
    if (!user.password_hash) {
      const error = new Error('Please login using GitHub OAuth');
      error.statusCode = 401;
      throw error;
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Update last login
    await UserModel.updateLastLogin(user.id);

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
    });

    // Remove password_hash from response
    delete user.password_hash;

    logger.info(`User logged in: ${email}`);

    return {
      user,
      token,
    };
  }

  /**
   * Login or create user with GitHub OAuth
   * @param {Object} githubProfile - GitHub profile data
   * @returns {Promise<Object>} User and token
   */
  static async githubAuth(githubProfile) {
    const { id: github_id, username: github_username, email, name, avatar_url, accessToken } = githubProfile;

    // Check if user exists
    let user = await UserModel.findByGithubId(github_id);

    if (user) {
      // Update GitHub access token
      user = await UserModel.update(user.id, {
        github_access_token: accessToken,
        avatar_url,
      });
      await UserModel.updateLastLogin(user.id);
    } else {
      // Create new user
      user = await UserModel.create({
        email: email || `${github_username}@github.com`,
        full_name: name || github_username,
        github_id,
        github_username,
        github_access_token: accessToken,
        avatar_url,
        email_verified: true, // GitHub emails are verified
      });
    }

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
    });

    logger.info(`GitHub OAuth login: ${github_username}`);

    return {
      user,
      token,
    };
  }
}

export default AuthService;
