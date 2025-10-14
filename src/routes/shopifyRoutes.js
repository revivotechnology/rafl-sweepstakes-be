const express = require('express');
const router = express.Router();
const {
  generateInstallUrl,
  handleShopifyCallback,
  getStoreInfo,
  handleAppUninstall,
  setupWebhooksForStore
} = require('../controllers/shopifyController');
const { authenticateToken } = require('../middleware/auth');

// Generate Shopify install URL (both routes for compatibility)
router.get('/shopify', generateInstallUrl);
router.get('/shopify/install', generateInstallUrl);

// Handle Shopify OAuth callback
router.get('/shopify/callback', handleShopifyCallback);

// Get store information
router.get('/shopify/store/:shop', getStoreInfo);

// Handle app uninstall webhook
router.post('/webhooks/app/uninstalled', handleAppUninstall);

// Setup webhooks for existing store
router.post('/shopify/setup-webhooks', setupWebhooksForStore);

module.exports = router;
