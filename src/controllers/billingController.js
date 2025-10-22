const { supabase } = require('../config/supabase');
const shopifyApi = require('../services/shopifyApiService');

/**
 * Billing Controller
 * Handles Shopify Billing API integration for Free vs Premium plans
 */

/**
 * @route   POST /api/billing/create-subscription
 * @desc    Create a Shopify recurring charge for premium subscription
 * @access  Private (Authenticated store owners)
 */
const createSubscription = async (req, res) => {
  try {
    const { storeId, planType = 'premium' } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Get store details
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*, shopify_domain, shopify_access_token')
      .eq('id', storeId)
      .eq('user_id', userId)
      .single();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied'
      });
    }

    // Check if already on premium
    if (store.subscription_tier === 'premium' && store.billing_status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Store is already on premium plan'
      });
    }

    // Check if Shopify is connected
    if (!store.shopify_domain || !store.shopify_access_token) {
      return res.status(400).json({
        success: false,
        message: 'Shopify store not connected. Please connect your Shopify store first.'
      });
    }

    // Define plan details
    const planConfig = {
      name: process.env.SHOPIFY_BILLING_PLAN_NAME || 'Premium Plan',
      price: parseFloat(process.env.SHOPIFY_BILLING_AMOUNT || '149.0'),
      return_url: `${process.env.FRONTEND_URL}/dashboard?billing=success&store_id=${storeId}`,
      test: process.env.SHOPIFY_TEST_MODE === 'true',
      trial_days: parseInt(process.env.SHOPIFY_TRIAL_DAYS || '0'),
      terms: 'Access to premium features including unlimited prize amounts, advanced analytics, and priority support'
    };

    console.log(`Creating subscription for store ${storeId} (${store.shopify_domain})`);
    console.log('Plan config:', planConfig);
    console.log('Store has Shopify domain:', store.shopify_domain);
    console.log('Store has access token:', !!store.shopify_access_token);

    // Create recurring charge via Shopify API
    const chargeResult = await shopifyApi.createRecurringCharge(
      store.shopify_domain,
      store.shopify_access_token,
      planConfig
    );

    console.log('Charge result:', JSON.stringify(chargeResult, null, 2));

    if (!chargeResult.success || !chargeResult.charge) {
      console.error('Failed to create Shopify charge:', chargeResult.error);
      console.error('Full charge result:', chargeResult);
      return res.status(500).json({
        success: false,
        message: 'Failed to create subscription charge',
        error: chargeResult.error,
        details: chargeResult
      });
    }

    const charge = chargeResult.charge;

    // Save charge ID to database (pending activation)
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        shopify_charge_id: charge.id.toString(),
        plan_name: planType,
        billing_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId);

    if (updateError) {
      console.error('Error updating store with charge ID:', updateError);
    }

    console.log(`Subscription charge created: ${charge.id}`);
    console.log(`Confirmation URL: ${charge.confirmation_url}`);

    // Return confirmation URL for merchant to approve
    return res.json({
      success: true,
      confirmationUrl: charge.confirmation_url,
      chargeId: charge.id,
      planName: planConfig.name,
      price: planConfig.price,
      message: 'Please approve the charge in Shopify to activate your premium subscription'
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/billing/confirm
 * @desc    Handle callback after merchant approves subscription
 * @access  Public (called by Shopify after approval)
 */
const confirmSubscription = async (req, res) => {
  try {
    const { charge_id, store_id } = req.query;

    if (!charge_id || !store_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }

    console.log(`Confirming subscription - Charge ID: ${charge_id}, Store ID: ${store_id}`);

    // Get store details
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', store_id)
      .single();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Get charge details from Shopify
    const chargeResult = await shopifyApi.getRecurringCharge(
      store.shopify_domain,
      store.shopify_access_token,
      charge_id
    );

    if (!chargeResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve charge details',
        error: chargeResult.error
      });
    }

    const charge = chargeResult.charge;

    // Check if charge was accepted
    if (charge.status === 'declined') {
      // Update store to reflect declined charge
      await supabase
        .from('stores')
        .update({
          billing_status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', store_id);

      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?billing=declined`);
    }

    // Activate the charge
    const activationResult = await shopifyApi.activateRecurringCharge(
      store.shopify_domain,
      store.shopify_access_token,
      charge_id
    );

    if (!activationResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to activate subscription',
        error: activationResult.error
      });
    }

    const activatedCharge = activationResult.charge;

    // Update store to premium tier
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        subscription_tier: 'premium',
        plan_name: 'premium',
        billing_status: 'active',
        shopify_charge_id: charge_id,
        billing_on: activatedCharge.billing_on,
        last_charge_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', store_id);

    if (updateError) {
      console.error('Error updating store to premium:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update store subscription',
        error: updateError.message
      });
    }

    console.log(`✅ Subscription activated for store ${store_id}`);

    // Redirect to dashboard with success message
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?billing=success&plan=premium`);

  } catch (error) {
    console.error('Error confirming subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/billing/cancel
 * @desc    Cancel premium subscription
 * @access  Private (Authenticated store owners)
 */
const cancelSubscription = async (req, res) => {
  try {
    const { storeId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Get store details
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .eq('user_id', userId)
      .single();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied'
      });
    }

    if (!store.shopify_charge_id) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription to cancel'
      });
    }

    // Cancel charge via Shopify API
    const cancelResult = await shopifyApi.cancelRecurringCharge(
      store.shopify_domain,
      store.shopify_access_token,
      store.shopify_charge_id
    );

    if (!cancelResult.success) {
      console.error('Failed to cancel Shopify charge:', cancelResult.error);
      // Continue anyway to update our database
    }

    // Downgrade store to free tier
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        subscription_tier: 'free',
        plan_name: 'free',
        billing_status: 'cancelled',
        shopify_charge_id: null,
        billing_on: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId);

    if (updateError) {
      console.error('Error downgrading store:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel subscription',
        error: updateError.message
      });
    }

    console.log(`✅ Subscription cancelled for store ${storeId}`);

    return res.json({
      success: true,
      message: 'Subscription cancelled successfully. You have been downgraded to the free tier.',
      subscription_tier: 'free'
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/billing/status/:storeId
 * @desc    Get current subscription status and plan details
 * @access  Private (Authenticated store owners)
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get store details
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('subscription_tier, plan_name, billing_status, billing_on, last_charge_at, shopify_charge_id')
      .eq('id', storeId)
      .eq('user_id', userId)
      .single();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied'
      });
    }

    // Calculate usage/limits based on tier
    const limits = {
      free: {
        maxPrizeAmount: 1000,
        analytics: false,
        dataExport: false,
        customBranding: false
      },
      premium: {
        maxPrizeAmount: null, // unlimited
        analytics: true,
        dataExport: true,
        customBranding: true
      }
    };

    const planLimits = limits[store.subscription_tier] || limits.free;

    return res.json({
      success: true,
      subscription: {
        tier: store.subscription_tier,
        planName: store.plan_name,
        status: store.billing_status,
        nextBillingDate: store.billing_on,
        lastChargeDate: store.last_charge_at,
        hasActiveCharge: !!store.shopify_charge_id
      },
      limits: planLimits
    });

  } catch (error) {
    console.error('Error getting subscription status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/billing/check-limits
 * @desc    Check if an action is allowed based on plan limits
 * @access  Private (Authenticated store owners)
 */
const checkPlanLimits = async (req, res) => {
  try {
    const { storeId, action, data } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get store subscription tier
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('subscription_tier, billing_status')
      .eq('id', storeId)
      .eq('user_id', userId)
      .single();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied'
      });
    }

    let allowed = true;
    let reason = '';

    // Check specific action limits
    if (action === 'create_promo') {
      const prizeAmount = data?.prize_amount || 0;
      
      if (store.subscription_tier === 'free' && prizeAmount > 1000) {
        allowed = false;
        reason = 'Free tier is limited to $1,000 maximum prize amount. Upgrade to Premium for unlimited prizes.';
      }
    } else if (action === 'export_data') {
      if (store.subscription_tier === 'free') {
        allowed = false;
        reason = 'Data export is a Premium feature. Upgrade to access advanced analytics and exports.';
      }
    } else if (action === 'advanced_analytics') {
      if (store.subscription_tier === 'free') {
        allowed = false;
        reason = 'Advanced analytics are only available on the Premium plan.';
      }
    }

    return res.json({
      success: true,
      allowed,
      reason,
      currentTier: store.subscription_tier,
      upgradeRequired: !allowed
    });

  } catch (error) {
    console.error('Error checking plan limits:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createSubscription,
  confirmSubscription,
  cancelSubscription,
  getSubscriptionStatus,
  checkPlanLimits
};

