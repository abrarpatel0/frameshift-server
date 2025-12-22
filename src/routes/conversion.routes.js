import express from 'express';
import {
  startConversion,
  getConversionStatus,
  getUserConversions,
  downloadConversion,
  cancelConversion,
  getConversionReport
} from '../controllers/conversion.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { conversionLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Start new conversion (with rate limiting)
router.post('/', conversionLimiter, startConversion);

// Get all user's conversions
router.get('/', getUserConversions);

// Get specific conversion status
router.get('/:id', getConversionStatus);

// Get conversion report
router.get('/:id/report', getConversionReport);

// Download converted project
router.get('/:id/download', downloadConversion);

// Cancel conversion
router.delete('/:id', cancelConversion);

export default router;
