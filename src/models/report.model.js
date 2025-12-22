import { query } from '../config/database.js';

/**
 * Report model for database operations
 */
export class ReportModel {
  /**
   * Create a new report
   * @param {Object} reportData - Report data
   * @returns {Promise<Object>} Created report
   */
  static async create(reportData) {
    const {
      conversion_job_id,
      accuracy_score = null,
      total_files_converted = 0,
      models_converted = 0,
      views_converted = 0,
      urls_converted = 0,
      forms_converted = 0,
      templates_converted = 0,
      issues = null,
      warnings = null,
      suggestions = null,
      gemini_verification = null,
      summary = null
    } = reportData;

    const result = await query(
      `INSERT INTO reports (
        conversion_job_id, accuracy_score, total_files_converted,
        models_converted, views_converted, urls_converted, forms_converted,
        templates_converted, issues, warnings, suggestions,
        gemini_verification, summary
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        conversion_job_id, accuracy_score, total_files_converted,
        models_converted, views_converted, urls_converted, forms_converted,
        templates_converted,
        issues ? JSON.stringify(issues) : null,
        warnings ? JSON.stringify(warnings) : null,
        suggestions ? JSON.stringify(suggestions) : null,
        gemini_verification ? JSON.stringify(gemini_verification) : null,
        summary
      ]
    );

    return result.rows[0];
  }

  /**
   * Find report by conversion job ID
   * @param {string} conversionJobId - Conversion job ID
   * @returns {Promise<Object|null>} Report or null
   */
  static async findByConversionJobId(conversionJobId) {
    const result = await query(
      'SELECT * FROM reports WHERE conversion_job_id = $1',
      [conversionJobId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find report by ID
   * @param {string} id - Report ID
   * @returns {Promise<Object|null>} Report or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM reports WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Update report
   * @param {string} id - Report ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated report
   */
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      // JSON fields need to be stringified
      if (['issues', 'warnings', 'suggestions', 'gemini_verification'].includes(key) && value !== null) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    });

    values.push(id);

    const result = await query(
      `UPDATE reports SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete report
   * @param {string} id - Report ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const result = await query(
      'DELETE FROM reports WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  }
}

export default ReportModel;
