const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getAdminDashboard,
  createAdminManualEntry,
  createAdminPromo,
  exportEntriesCSV,
  exportWinnersCSV,
  exportAdminData
} = require('../controllers/adminController');

// All admin routes require authentication
router.use(authenticateToken);

// Admin dashboard
router.get('/dashboard', getAdminDashboard);

// Manual entry management
router.post('/entries/manual', createAdminManualEntry);

// Promo management
router.post('/promos', createAdminPromo);

// CSV exports (legacy - for specific promos)
router.get('/export/entries/:promoId', exportEntriesCSV);
router.get('/export/winners-csv', exportWinnersCSV);

router.get('/export/:type', exportAdminData);

module.exports = router;
