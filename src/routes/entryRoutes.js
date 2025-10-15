const express = require('express');
const router = express.Router();
const { createManualEntry, getEntriesForPromo, getActivePromos } = require('../controllers/entryController');
const { authenticateToken } = require('../middleware/auth');

// Public routes (no authentication required)
router.post('/manual', createManualEntry);
router.get('/active-promos', getActivePromos);

// Protected routes (authentication required)
router.get('/:promoId', authenticateToken, getEntriesForPromo);

module.exports = router;
