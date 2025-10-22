const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticateToken } = require('../middleware/auth');

/**
 * Billing Routes
 * Handles Shopify Billing API integration for subscriptions
 */

// @route   POST /api/billing/create-subscription
// @desc    Create a new premium subscription charge
// @access  Private
router.post('/create-subscription', authenticateToken, billingController.createSubscription);

// @route   GET /api/billing/confirm
// @desc    Confirm subscription after merchant approval (Shopify callback)
// @access  Public (called by Shopify)
router.get('/confirm', billingController.confirmSubscription);

// @route   POST /api/billing/cancel
// @desc    Cancel an active subscription
// @access  Private
router.post('/cancel', authenticateToken, billingController.cancelSubscription);

// @route   GET /api/billing/status/:storeId
// @desc    Get subscription status and plan details
// @access  Private
router.get('/status/:storeId', authenticateToken, billingController.getSubscriptionStatus);

// @route   POST /api/billing/check-limits
// @desc    Check if an action is allowed based on plan limits
// @access  Private
router.post('/check-limits', authenticateToken, billingController.checkPlanLimits);

module.exports = router;

