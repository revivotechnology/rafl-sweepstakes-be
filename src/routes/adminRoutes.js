const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getAdminDashboard,
  createAdminManualEntry,
  exportEntriesCSV,
  exportWinnersCSV
} = require('../controllers/adminController');

// All admin routes require authentication
router.use(authenticateToken);

// Admin dashboard
router.get('/dashboard', getAdminDashboard);

// Manual entry management
router.post('/entries/manual', createAdminManualEntry);

// CSV exports
router.get('/export/entries/:promoId', exportEntriesCSV);
router.get('/export/winners', exportWinnersCSV);

module.exports = router;
