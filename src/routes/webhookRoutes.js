const express = require('express');
const router = express.Router();
const { 
  handleOrderCreate, 
  handleOrderUpdate, 
  verifyWebhookSignature 
} = require('../controllers/webhookController');

// Parse JSON for webhook payloads
router.use(express.json());

// Order webhook endpoints
router.post('/orders/create', verifyWebhookSignature, handleOrderCreate);
router.post('/orders/updated', verifyWebhookSignature, handleOrderUpdate);

module.exports = router;
