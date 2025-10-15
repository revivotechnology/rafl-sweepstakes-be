const express = require('express');
const router = express.Router();
const { 
  selectWinner, 
  getWinnersForPromo, 
  getWinnersForStore, 
  updateWinnerNotification 
} = require('../controllers/winnerController');
const { authenticateToken } = require('../middleware/auth');

// All winner routes require authentication
router.use(authenticateToken);

// Winner selection and management
router.post('/select', selectWinner);
router.get('/promo/:promoId', getWinnersForPromo);
router.get('/store/:storeId', getWinnersForStore);
router.put('/:winnerId/notify', updateWinnerNotification);

module.exports = router;
