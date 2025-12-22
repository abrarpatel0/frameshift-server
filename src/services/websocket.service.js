import logger from '../utils/logger.js';

// Store WebSocket clients: userId -> WebSocket connection
const clients = new Map();

/**
 * Register WebSocket client
 * @param {string} userId - User ID
 * @param {WebSocket} ws - WebSocket connection
 */
export const registerClient = (userId, ws) => {
  clients.set(userId, ws);
  logger.info(`WebSocket client registered: ${userId}`);
};

/**
 * Unregister WebSocket client
 * @param {string} userId - User ID
 */
export const unregisterClient = (userId) => {
  clients.delete(userId);
  logger.info(`WebSocket client unregistered: ${userId}`);
};

/**
 * Broadcast message to specific user
 * @param {string} userId - User ID
 * @param {Object} message - Message to send
 */
export const broadcastToUser = (userId, message) => {
  const client = clients.get(userId);

  if (client && client.readyState === 1) { // WebSocket.OPEN
    try {
      client.send(JSON.stringify(message));
      logger.debug(`Message sent to user ${userId}: ${message.type}`);
    } catch (error) {
      logger.error(`Failed to send message to user ${userId}:`, error);
    }
  } else {
    logger.warn(`Client not connected or not ready: ${userId}`);
  }
};

/**
 * Broadcast conversion progress to user
 * @param {string} jobId - Conversion job ID
 * @param {Object} progressData - Progress data from Python
 */
export const broadcastProgress = async (jobId, progressData) => {
  try {
    // Get conversion job to find user ID
    const ConversionJobModel = (await import('../models/conversionJob.model.js')).default;
    const job = await ConversionJobModel.findById(jobId);

    if (!job) {
      logger.warn(`Job not found for progress broadcast: ${jobId}`);
      return;
    }

    const userId = job.user_id;

    const message = {
      type: 'conversion:progress',
      jobId,
      progress: progressData.progress,
      step: progressData.step,
      message: progressData.message,
      timestamp: Date.now()
    };

    broadcastToUser(userId, message);
  } catch (error) {
    logger.error(`Failed to broadcast progress for job ${jobId}:`, error);
  }
};

/**
 * Broadcast conversion completion to user
 * @param {string} userId - User ID
 * @param {string} jobId - Conversion job ID
 * @param {Object} result - Conversion result
 */
export const broadcastConversionComplete = (userId, jobId, result) => {
  const message = {
    type: 'conversion:completed',
    jobId,
    result,
    timestamp: Date.now()
  };

  broadcastToUser(userId, message);
};

/**
 * Broadcast conversion failure to user
 * @param {string} userId - User ID
 * @param {string} jobId - Conversion job ID
 * @param {string} error - Error message
 */
export const broadcastConversionFailed = (userId, jobId, error) => {
  const message = {
    type: 'conversion:failed',
    jobId,
    error,
    timestamp: Date.now()
  };

  broadcastToUser(userId, message);
};

/**
 * Get connected clients count
 * @returns {number} Number of connected clients
 */
export const getConnectedClientsCount = () => {
  return clients.size;
};

export default {
  registerClient,
  unregisterClient,
  broadcastToUser,
  broadcastProgress,
  broadcastConversionComplete,
  broadcastConversionFailed,
  getConnectedClientsCount
};
