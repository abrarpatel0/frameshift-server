import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { registerClient, unregisterClient } from '../services/websocket.service.js';

/**
 * Setup WebSocket server
 * @param {WebSocketServer} wss - WebSocket server instance
 */
export const setupWebSocket = (wss) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required for WebSocket authentication.');
  }

  wss.on('connection', (ws, req) => {
    try {
      // Extract token from query parameter
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided');
        ws.close(4001, 'Authentication required');
        return;
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (error) {
        logger.warn('WebSocket connection rejected: Invalid token');
        ws.close(4001, 'Invalid token');
        return;
      }

      const userId = decoded.userId;

      // Register client
      registerClient(userId, ws);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        userId,
        message: 'WebSocket connection established',
        timestamp: Date.now()
      }));

      logger.info(`WebSocket client connected: ${userId}`);

      // Handle messages from client (optional - for ping/pong)
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          logger.error(`Failed to parse WebSocket message:`, error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        unregisterClient(userId, ws);
        logger.info(`WebSocket client disconnected: ${userId}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for user ${userId}:`, error);
        // Do not unregister here; 'close' will always follow and handles cleanup idempotently.
      });

    } catch (error) {
      logger.error('WebSocket connection error:', error);
      ws.close(4000, 'Internal server error');
    }
  });

  logger.info('WebSocket server initialized');
};

export default setupWebSocket;
