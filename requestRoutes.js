const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

// Create Cancel Endpoint: PUT /api/requests/:requestId/cancel
router.put('/:requestId/cancel', requestController.cancelRequest);

module.exports = router;