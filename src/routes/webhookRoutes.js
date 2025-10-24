const express = require('express');
const router = express.Router();
const { 
  handleOrderCreate, 
  handleOrderUpdate,
  handleAppUninstall,
  handleSubscriptionUpdate
} = require('../controllers/webhookController');

// Parse JSON for webhook payloads
router.use(express.json());

// Order webhook endpoints
router.post('/orders/create', handleOrderCreate);
router.post('/orders/updated', handleOrderUpdate);

// App lifecycle webhooks
router.post('/app/uninstalled', handleAppUninstall);

// Billing webhooks
router.post('/billing/subscription-update', handleSubscriptionUpdate);
router.post('/app_subscriptions/update', handleSubscriptionUpdate); // Alternative path

module.exports = router;
