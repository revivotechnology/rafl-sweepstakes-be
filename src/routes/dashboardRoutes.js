const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.get('/', authenticateToken, dashboardController.getDashboardData);

// Promo routes
router.post('/promos', authenticateToken, dashboardController.createPromo);
router.get('/promos/:id', authenticateToken, dashboardController.getPromo);
router.put('/promos/:id', authenticateToken, dashboardController.updatePromo);
router.delete('/promos/:id', authenticateToken, dashboardController.deletePromo);

// Export routes
router.get('/export/:type', authenticateToken, dashboardController.exportData);

module.exports = router;

