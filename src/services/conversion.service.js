import { spawn } from 'child_process';
import path from 'path';
import ConversionJobModel from '../models/conversionJob.model.js';
import ReportModel from '../models/report.model.js';
import storageService from './storage.service.js';
import logger from '../utils/logger.js';

/**
 * Conversion service - Node-Python bridge
 * Manages Python child processes for Django-to-Flask conversion
 */
export class ConversionService {
  /**
   * Start conversion process
   * @param {string} jobId - Conversion job ID
   * @param {string} projectPath - Path to Django project
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Conversion result
   */
  static async startConversion(jobId, projectPath, userId) {
    logger.info(`Starting conversion job ${jobId}`);

    try {
      // Create output directory
      const outputPath = await storageService.createConvertedDirectory(userId, jobId);

      // Mark job as started
      await ConversionJobModel.markAsStarted(jobId);

      // Spawn Python process
      const result = await this.runPythonConversion(jobId, projectPath, outputPath);

      // Mark job as completed
      await ConversionJobModel.markAsCompleted(jobId, outputPath);

      // Save report to database
      await this.saveReport(jobId, result.report);

      logger.info(`Conversion job ${jobId} completed successfully`);

      return {
        success: true,
        jobId,
        outputPath,
        report: result.report
      };
    } catch (error) {
      logger.error(`Conversion job ${jobId} failed:`, error);

      // Mark job as failed
      await ConversionJobModel.markAsFailed(jobId, error.message);

      throw error;
    }
  }

  /**
   * Detect Python executable on the system
   * @returns {string} Python executable path
   */
  static detectPython() {
    // If explicitly set in env, use it
    if (process.env.PYTHON_PATH) {
      return process.env.PYTHON_PATH;
    }

    // On Windows, prefer 'python' over 'python3' (python3 is often the MS Store stub)
    if (process.platform === 'win32') {
      return 'python';
    }

    // On Unix-like systems, prefer python3
    return 'python3';
  }

  /**
   * Run Python conversion process
   * @param {string} jobId - Conversion job ID
   * @param {string} projectPath - Input Django project path
   * @param {string} outputPath - Output Flask project path
   * @returns {Promise<Object>} Conversion result from Python
   */
  static runPythonConversion(jobId, projectPath, outputPath) {
    return new Promise((resolve, reject) => {
      const pythonPath = this.detectPython();
      const scriptPath = path.join(process.cwd(), 'python', 'main.py');

      const args = [
        scriptPath,
        '--job-id', jobId,
        '--project-path', projectPath,
        '--output-path', outputPath
      ];

      // Add Gemini API key if available
      if (process.env.GEMINI_API_KEY) {
        args.push('--gemini-api-key', process.env.GEMINI_API_KEY);
      }

      logger.info(`Spawning Python process: ${pythonPath} ${args.join(' ')}`);

      const pythonProcess = spawn(pythonPath, args, {
        cwd: process.cwd()
      });

      let result = null;
      let errorOutput = '';
      let isResolved = false;

      // Handle stdout (progress updates and result)
      pythonProcess.stdout.on('data', async (data) => {
        const lines = data.toString().split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const message = JSON.parse(line);

            if (message.type === 'progress') {
              // Update database with progress
              await this.handleProgressUpdate(jobId, message);
            } else if (message.type === 'result') {
              // Store final result
              result = message.data;
              logger.info(`Conversion result received for job ${jobId}`);
            } else if (message.type === 'error') {
              errorOutput = message.error;
              logger.error(`Python error for job ${jobId}: ${message.error}`);
            }
          } catch (parseError) {
            // Not JSON, could be regular log output
            logger.debug(`Python output: ${line}`);
          }
        }
      });

      // Handle stderr
      pythonProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        errorOutput += errorText;
        logger.error(`Python stderr: ${errorText}`);
      });

      // Handle process exit
      pythonProcess.on('close', (code) => {
        // Prevent multiple resolve/reject calls
        if (isResolved) return;

        // Give a small delay to ensure all stdout has been processed
        setTimeout(() => {
          if (isResolved) return;
          isResolved = true;

          if (code === 0) {
            if (result) {
              logger.info(`Python process exited successfully for job ${jobId}`);
              resolve(result);
            } else {
              const error = new Error('Python process completed but no result was received');
              logger.error(`Python process failed for job ${jobId}: ${error.message}`);
              reject(error);
            }
          } else {
            const error = new Error(errorOutput || `Python process exited with code ${code}`);
            logger.error(`Python process failed for job ${jobId}: ${error.message}`);
            reject(error);
          }
        }, 100);
      });

      // Handle process error
      pythonProcess.on('error', (error) => {
        if (isResolved) return;
        isResolved = true;
        logger.error(`Failed to spawn Python process for job ${jobId}:`, error);
        reject(new Error(`Failed to start Python conversion: ${error.message}`));
      });
    });
  }

  /**
   * Handle progress update from Python
   * @param {string} jobId - Conversion job ID
   * @param {Object} message - Progress message
   */
  static async handleProgressUpdate(jobId, message) {
    try {
      // Update database
      await ConversionJobModel.updateProgress(
        jobId,
        message.progress,
        message.step
      );

      // Broadcast via WebSocket (imported dynamically to avoid circular dependency)
      const { broadcastProgress } = await import('./websocket.service.js');
      broadcastProgress(jobId, message);

      logger.debug(`Progress updated for job ${jobId}: ${message.progress}% - ${message.step}`);
    } catch (error) {
      logger.error(`Failed to handle progress update for job ${jobId}:`, error);
    }
  }

  /**
   * Save conversion report to database
   * @param {string} jobId - Conversion job ID
   * @param {Object} report - Report data from Python
   * @returns {Promise<Object>} Saved report
   */
  static async saveReport(jobId, report) {
    try {
      const reportData = {
        conversion_job_id: jobId,
        accuracy_score: report.accuracy_score || 0,
        total_files_converted: report.total_files_converted || 0,
        models_converted: report.models_converted || 0,
        views_converted: report.views_converted || 0,
        urls_converted: report.urls_converted || 0,
        forms_converted: report.forms_converted || 0,
        templates_converted: report.templates_converted || 0,
        issues: report.issues || [],
        warnings: report.warnings || [],
        suggestions: report.suggestions || [],
        gemini_verification: report.gemini_verification || null,
        summary: report.summary || ''
      };

      const savedReport = await ReportModel.create(reportData);
      logger.info(`Report saved for job ${jobId}`);

      return savedReport;
    } catch (error) {
      logger.error(`Failed to save report for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get conversion status
   * @param {string} jobId - Conversion job ID
   * @returns {Promise<Object>} Job status
   */
  static async getStatus(jobId) {
    const job = await ConversionJobModel.findById(jobId);

    if (!job) {
      throw new Error('Conversion job not found');
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress_percentage,
      currentStep: job.current_step,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      error: job.error_message
    };
  }

  /**
   * Cancel conversion job
   * @param {string} jobId - Conversion job ID
   * @returns {Promise<boolean>} Success status
   */
  static async cancelConversion(jobId) {
    // TODO: Implement process cancellation
    // For now, just mark as failed
    await ConversionJobModel.markAsFailed(jobId, 'Cancelled by user');
    logger.info(`Conversion job ${jobId} cancelled`);
    return true;
  }
}

export default ConversionService;
