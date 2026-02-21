import express from 'express';
import { cancelRequest } from '../controllers/requestController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Create Cancel Endpoint: PUT /api/requests/:requestId/cancel
router.put('/:requestId/cancel', protect, cancelRequest);

export default router;