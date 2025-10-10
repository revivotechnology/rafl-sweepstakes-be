const express = require('express');
const router = express.Router();
const { 
  initiateShopifyAuth, 
  handleShopifyCallback, 
  testShopifyConnection,
  registerWebhooks,
  listWebhooks,
  deleteWebhook,
  syncHistoricalOrders
} = require('../controllers/shopifyController');
const { authenticateToken } = require('../middleware/auth');

// Initiate Shopify OAuth flow
router.get('/shopify', initiateShopifyAuth);

// Handle Shopify OAuth callback
router.get('/shopify/callback', handleShopifyCallback);

// Test Shopify API connection (requires authentication)
router.get('/shopify/test-connection', authenticateToken, testShopifyConnection);

// Register webhooks with Shopify (requires authentication)
router.post('/shopify/webhooks/register', authenticateToken, registerWebhooks);

// List registered webhooks (requires authentication)
router.get('/shopify/webhooks', authenticateToken, listWebhooks);

// Delete a specific webhook (requires authentication)
router.delete('/shopify/webhooks/:webhookId', authenticateToken, deleteWebhook);

// Sync historical orders from Shopify (requires authentication)
router.post('/shopify/sync-historical', authenticateToken, syncHistoricalOrders);

module.exports = router;
