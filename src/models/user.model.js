import { query } from '../config/database.js';

/**
 * User model for database operations
 */
export class UserModel {
  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  static async create(userData) {
    const { email, password_hash, full_name, github_id, github_username, github_access_token, avatar_url } = userData;

    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, github_id, github_username, github_access_token, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, full_name, github_id, github_username, avatar_url, email_verified, created_at`,
      [email, password_hash, full_name, github_id, github_username, github_access_token, avatar_url]
    );

    return result.rows[0];
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} User object or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT id, email, full_name, github_id, github_username, avatar_url, email_verified, created_at, updated_at, last_login FROM users WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by GitHub ID
   * @param {string} githubId - GitHub user ID
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByGithubId(githubId) {
    const result = await query(
      'SELECT * FROM users WHERE github_id = $1',
      [githubId]
    );

    return result.rows[0] || null;
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user
   */
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    values.push(id);

    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, full_name, github_id, github_username, avatar_url, email_verified, created_at, updated_at`,
      values
    );

    return result.rows[0];
  }

  /**
   * Update last login timestamp
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  static async updateLastLogin(id) {
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  /**
   * Delete user
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const result = await query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  }
}

export default UserModel;
