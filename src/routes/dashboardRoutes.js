const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.get('/', authenticateToken, dashboardController.getDashboardData);

module.exports = router;

