const express = require('express');
const router = express.Router();
const { 
  handleOrderCreate, 
  handleOrderUpdate
} = require('../controllers/webhookController');

// Parse JSON for webhook payloads
router.use(express.json());

// Order webhook endpoints
router.post('/orders/create', handleOrderCreate);
router.post('/orders/updated', handleOrderUpdate);

module.exports = router;
