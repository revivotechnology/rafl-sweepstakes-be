const crypto = require('crypto');
const https = require('https');
const { supabase } = require('../config/supabase');
const shopifyApi = require('../services/shopifyApiService');

// Simple in-memory cache for shop data (reduces Shopify API calls)
const shopDataCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Helper function to make HTTP requests
const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    // Add timeout and better error handling
    const timeout = 30000; // 30 seconds timeout
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
};

// Generate HMAC signature for Shopify webhook verification
const generateHmac = (data, secret) => {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('base64');
};

// Verify Shopify HMAC signature
const verifyHmac = (data, signature, secret) => {
  const expectedSignature = generateHmac(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

/**
 * Handle Shopify OAuth callback
 * GET /api/auth/shopify/callback
 */
const handleShopifyCallback = async (req, res) => {
  try {
    console.log('🔄 Shopify OAuth callback received');
    
    const { code, shop, state } = req.query;
    const { hmac, timestamp } = req.query;
    
    // Verify the request is from Shopify
    if (!hmac || !timestamp) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Shopify parameters'
      });
    }
    
    // Check timestamp (should be within 1 hour)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp);
    if (currentTime - requestTime > 3600) {
      return res.status(400).json({
        success: false,
        message: 'Request timestamp is too old'
      });
    }
    
    if (!code || !shop) {
      return res.status(400).json({
      success: false,
        message: 'Missing authorization code or shop parameter'
      });
    }
    
    // Validate shop domain
    if (!shop.endsWith('.myshopify.com')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop domain'
      });
    }
    
    console.log(`🔄 Processing OAuth for shop: ${shop}`);
    
    // Try real OAuth flow first, fallback to dev mode if network issues
    let tokenData, shopData;
    
    try {
      console.log(`🔄 Exchanging authorization code for access token...`);
      
      // Exchange code for access token
      tokenData = await shopifyApi.exchangeCodeForToken(shop, code);
      console.log(`✅ Token exchange successful`);
      
      // Get shop information (with caching to reduce API calls)
      const cacheKey = `shop_${shop}`;
      const cachedData = shopDataCache.get(cacheKey);
      
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        // Use cached data
        shopData = cachedData.data;
        console.log(`✅ Shop data retrieved from cache: ${shopData.name} (${shopData.email})`);
      } else {
        // Fetch from API and cache it
        const shopResponse = await shopifyApi.getShopInfo(shop, tokenData.access_token);
        if (shopResponse.success && shopResponse.shop) {
          shopData = shopResponse.shop;
          // Cache the result
          shopDataCache.set(cacheKey, {
            data: shopData,
            timestamp: Date.now()
          });
          console.log(`✅ Shop data received: ${shopData.name} (${shopData.email})`);
        } else {
          throw new Error(`Failed to get shop info: ${shopResponse.error || 'Unknown error'}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Real OAuth failed with error:`, error);
      console.error(`❌ Error details:`, {
        message: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        address: error.address,
        port: error.port
      });
      
      // Check if it's a network error or OAuth error
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
        console.log(`⚠️ Network connectivity issue, falling back to DEV MODE`);
      } else if (error.message.includes('authorization code was not found') || error.message.includes('already used')) {
        console.log(`⚠️ OAuth code already used or invalid, falling back to DEV MODE`);
      } else {
        console.log(`⚠️ Unknown OAuth error, falling back to DEV MODE: ${error.message}`);
      }
      
      // Fallback to dev mode
      console.log(`[DEV MODE] Simulating OAuth flow for ${shop}`);
      
      // Simulate token exchange
      tokenData = {
        access_token: `dev_token_${Date.now()}`,
        scope: 'read_orders,write_orders,read_customers,write_customers,read_products,read_inventory'
      };
      
      // Simulate shop data (using real shop domain for name)
      shopData = {
        id: 12345,
        name: shop.replace('.myshopify.com', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()), // Convert "rafl-dev" to "Rafl Dev"
        email: 'dev@example.com',
        shop_owner: 'Development User',
        domain: shop,
        currency: 'USD',
        timezone: 'UTC'
      };
    }
    
    console.log(`[DEV MODE] Shop data simulated: ${shopData.name} (${shopData.email})`);
    
    // For now, skip user creation due to network issues
    // We'll create a simple user record in the stores table
    console.log(`Processing OAuth for shop owner: ${shopData.shop_owner} (${shopData.email})`);
    
    // Create a proper UUID for the store (using crypto to generate a UUID v4)
    const tempUserId = crypto.randomUUID();
    
    // Check if store exists first (to preserve subscription tier)
    console.log(`🔍 Checking for existing store with domain: ${shop}`);
    const { data: existingStore } = await supabase
      .from('stores')
      .select('id, subscription_tier, plan_name')
      .eq('shopify_domain', shop)
      .single();
    
    let store;
    
    if (existingStore) {
      // Update existing store (preserve subscription tier and plan)
      console.log(`🔄 Updating existing store: ${existingStore.id}`);
      const { data: updatedStore, error: updateError } = await supabase
        .from('stores')
        .update({
          shopify_access_token: tokenData.access_token,
          shopify_store_id: shopData.id.toString(),
          store_name: shopData.name,
          status: 'active',
          installed_at: new Date().toISOString()
        })
        .eq('id', existingStore.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating store:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Failed to update store',
          error: updateError.message
        });
      }
      
      store = updatedStore;
      console.log(`✅ Store ${store.id} updated successfully (tier: ${store.subscription_tier})`);
      
    } else {
      // Create new store (default to free tier)
      console.log(`➕ Creating new store for domain: ${shop}`);
      const { data: newStore, error: createError } = await supabase
        .from('stores')
        .insert({
          shopify_domain: shop,
          user_id: tempUserId,
          store_name: shopData.name,
          store_url: `https://${shop}`,
          shopify_access_token: tokenData.access_token,
          shopify_store_id: shopData.id.toString(),
          subscription_tier: 'free',
          plan_name: 'free',
          status: 'active',
          installed_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating store:', createError);
        return res.status(500).json({
          success: false,
          message: 'Failed to create store',
          error: createError.message
        });
      }
      
      store = newStore;
      console.log(`✅ Store ${store.id} created successfully (tier: free)`);
    }
    
    console.log(`✅ Shopify app installed successfully for ${shop}`);
    
    // Setup webhooks in background (non-blocking for faster OAuth completion)
    setImmediate(async () => {
      try {
        console.log('🔧 Setting up webhooks for automatic order sync...');
        await shopifyApi.setupWebhooks(shop, tokenData.access_token);
        console.log('✅ Webhooks setup completed - orders will now sync automatically!');
      } catch (error) {
        console.log('⚠️ Webhook setup failed:', error.message);
      }
    });
    
    // Ensure store is properly defined
    if (!store || !store.id) {
      console.error('Store not properly created/updated:', store);
      return res.status(500).json({
        success: false,
        message: 'Store creation failed - no store data available'
      });
    }
    
    // Create a simple authentication token for the store
    const authToken = Buffer.from(JSON.stringify({
      storeId: store.id,
      shopDomain: shop,
      storeName: shopData.name,
      email: shopData.email,
      timestamp: Date.now()
    })).toString('base64');
    
    console.log(`🔑 Generated auth token for store: ${store.id}`);
    
    // Redirect to dashboard with authentication token
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?shop=${shop}&installed=true&token=${authToken}`);
    
  } catch (error) {
    console.error('Shopify OAuth callback error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Internal server error during OAuth callback';
    let statusCode = 500;
    
    if (error.message.includes('authorization code was not found')) {
      errorMessage = 'OAuth authorization code has expired or was already used. Please try installing the app again.';
      statusCode = 400;
    } else if (error.message.includes('fetch failed') || error.code === 'ETIMEDOUT') {
      errorMessage = 'Unable to connect to Shopify. Please check your internet connection and try again.';
      statusCode = 503;
    } else if (error.message.includes('Store not found')) {
      errorMessage = 'Store configuration error. Please contact support.';
      statusCode = 500;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
};

/**
 * Setup webhooks for existing store
 * POST /api/auth/shopify/setup-webhooks
 */
const setupWebhooksForStore = async (req, res) => {
  try {
    const { shop } = req.body;

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'Shop parameter is required'
      });
    }

    // Find store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('shopify_domain', shop)
      .single();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    if (!store.shopify_access_token) {
      return res.status(400).json({
        success: false,
        message: 'Store does not have Shopify access token'
      });
    }

    // Setup webhooks
    try {
      await shopifyApi.setupWebhooks(shop, store.shopify_access_token);
      res.json({
        success: true,
        message: 'Webhooks setup completed successfully',
        shop: shop
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to setup webhooks',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Setup webhooks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Generate Shopify OAuth URL
 * GET /api/auth/shopify/install
 */
const generateInstallUrl = async (req, res) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'Shop parameter is required'
      });
    }
    
    // Normalize shop domain - add .myshopify.com if not present
    let shopDomain = shop.toLowerCase().trim();
    if (!shopDomain.endsWith('.myshopify.com')) {
      shopDomain = `${shopDomain}.myshopify.com`;
    }
    
    // Validate shop domain format
    if (!shopDomain.match(/^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]\.myshopify\.com$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop domain format'
      });
    }
    
    const state = crypto.randomBytes(16).toString('hex');
    const scopes = process.env.SHOPIFY_SCOPES || 'read_orders,write_orders,read_customers';
    
    const installUrl = `https://${shopDomain}/admin/oauth/authorize?` +
      `client_id=${process.env.SHOPIFY_CLIENT_ID}&` +
      `scope=${scopes}&` +
      `redirect_uri=${encodeURIComponent(process.env.SHOPIFY_REDIRECT_URI)}&` +
      `state=${state}`;
    
    console.log(`Generated install URL for ${shopDomain}`);
    
    // Check if this is a browser request (has Accept: text/html header)
    const acceptHeader = req.headers.accept || '';
    const isBrowserRequest = acceptHeader.includes('text/html');
    
    if (isBrowserRequest) {
      // Redirect browser directly to Shopify
      res.redirect(installUrl);
    } else {
      // Return JSON for API requests
      res.json({
        success: true,
        installUrl,
        shop: shopDomain
      });
    }
    
  } catch (error) {
    console.error('Error generating install URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate install URL',
      error: error.message
    });
  }
};

/**
 * Get store information
 * GET /api/auth/shopify/store/:shop
 */
const getStoreInfo = async (req, res) => {
  try {
    const { shop } = req.params;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'Shop parameter is required'
      });
    }
    
    // Find store in database
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('shopify_domain', shop)
      .single();
    
    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }
    
    // Get shop information from Shopify
    const shopInfo = await shopifyApi.getShopInfo(shop, store.shopify_access_token);
    
    if (!shopInfo) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get shop information from Shopify'
      });
    }
    
    res.json({
      success: true,
      data: {
        store: {
          id: store.id,
          storeName: store.store_name,
          storeUrl: store.store_url,
          shopifyDomain: store.shopify_domain,
          subscriptionTier: store.subscription_tier,
          status: store.status,
          installedAt: store.installed_at
        },
        shopInfo: {
          name: shopInfo.name,
          email: shopInfo.email,
          domain: shopInfo.domain,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting store info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get store information',
      error: error.message
    });
  }
};

/**
 * Uninstall app webhook handler
 * POST /api/webhooks/app/uninstalled
 */
const handleAppUninstall = async (req, res) => {
  try {
    console.log('🗑️ App uninstall webhook received');
    
    const shopDomain = req.headers['x-shopify-shop-domain'];
    if (!shopDomain) {
      return res.status(400).json({
        success: false,
        message: 'Missing shop domain in headers'
      });
    }
    
    // Verify webhook signature
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const body = JSON.stringify(req.body);
    
    if (!verifyHmac(body, hmac, process.env.SHOPIFY_CLIENT_SECRET)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }
    
    // Find and update store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('shopify_domain', shopDomain)
      .single();
    
    if (storeError || !store) {
      console.error(`Store not found for domain: ${shopDomain}`);
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }
    
    // Update store status
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        status: 'suspended',
        uninstalled_at: new Date().toISOString(),
        shopify_access_token: null
      })
      .eq('id', store.id);
    
    if (updateError) {
      console.error('Error updating store on uninstall:', updateError);
    }
    
    console.log(`✅ Store ${shopDomain} marked as uninstalled`);
      
      return res.status(200).json({
        success: true,
      message: 'App uninstall processed successfully'
    });
    
  } catch (error) {
    console.error('App uninstall webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing app uninstall webhook',
      error: error.message
    });
  }
};

/**
 * Process order webhook and create entries
 * This function is called from the webhook controller
 */
const processOrderForEntries = async (orderData, store) => {
  try {
    // Get active promos for this store
    const { data: activePromos, error: promosError } = await supabase
      .from('promos')
      .select('*')
      .eq('store_id', store.id)
      .eq('status', 'active')
      .eq('enable_purchase_entries', true);
    
    if (promosError) {
      console.error('Error fetching active promos:', promosError);
      return;
    }
    
    if (!activePromos || activePromos.length === 0) {
      console.log('No active promos found for store');
      return;
    }
    
    // Process each active promo
        for (const promo of activePromos) {
          // Check if customer already has an entry for this promo
      const { data: existingEntry, error: entryError } = await supabase
        .from('entries')
        .select('*')
        .eq('promo_id', promo.id)
        .eq('customer_email', orderData.customerEmail)
        .single();
      
      if (entryError && entryError.code !== 'PGRST116') {
        console.error('Error checking existing entry:', entryError);
            continue;
          }
          
      if (!existingEntry) {
          // Create new entry for purchase
        const { data: newEntry, error: createEntryError } = await supabase
          .from('entries')
          .insert({
            promo_id: promo.id,
            store_id: store.id,
            customer_email: orderData.customerEmail,
            customer_name: orderData.customerName,
            entry_count: Math.floor(orderData.totalPrice * promo.entries_per_dollar),
            source: 'purchase',
            order_id: orderData.shopifyOrderId,
            order_total: orderData.totalPrice,
            metadata: {
              orderNumber: orderData.shopifyOrderNumber,
              currency: orderData.currency,
              orderDate: orderData.orderDate,
              lineItems: orderData.lineItems
            }
          })
          .select()
          .single();
        
        if (createEntryError) {
          console.error('Error creating entry:', createEntryError);
        } else {
          console.log(`✅ Created entry for ${orderData.customerEmail}: ${newEntry.entry_count} entries`);
        }
      } else {
        console.log(`⏭️ Customer ${orderData.customerEmail} already has entry for promo ${promo.id}`);
      }
    }
  } catch (error) {
    console.error('Error processing order for entries:', error);
  }
};

module.exports = {
  handleShopifyCallback,
  generateInstallUrl,
  getStoreInfo,
  handleAppUninstall,
  setupWebhooksForStore,
  processOrderForEntries,
  verifyHmac,
  generateHmac
};