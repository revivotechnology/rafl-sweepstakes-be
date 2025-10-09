const express = require('express');
const router = express.Router();
const { initiateShopifyAuth, handleShopifyCallback } = require('../controllers/shopifyController');

// Initiate Shopify OAuth flow
router.get('/shopify', initiateShopifyAuth);

// Handle Shopify OAuth callback
router.get('/shopify/callback', handleShopifyCallback);

module.exports = router;
