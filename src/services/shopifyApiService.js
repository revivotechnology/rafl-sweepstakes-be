const https = require('https');

/**
 * Shopify Admin API Service
 * Handles all API calls to Shopify Admin API
 * Version: 2024-01 (latest stable)
 */

const SHOPIFY_API_VERSION = '2024-01';

/**
 * Generic function to make requests to Shopify Admin API
 * @param {string} shopDomain - e.g., 'rafl-dev.myshopify.com'
 * @param {string} accessToken - Shopify access token
 * @param {string} endpoint - API endpoint (e.g., '/admin/api/2024-01/shop.json')
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {object} data - Request body for POST/PUT requests
 * @returns {Promise<object>} API response
 */
const callShopifyAPI = (shopDomain, accessToken, endpoint, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    // Build full path
    const path = endpoint.startsWith('/admin') ? endpoint : `/admin/api/${SHOPIFY_API_VERSION}${endpoint}`;
    
    const options = {
      hostname: shopDomain,
      port: 443,
      path: path,
      method: method,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        'User-Agent': 'Raffle-Sweepstakes-App/1.0'
      },
      timeout: 30000, // Increased to 30 seconds
      // Disable agent for better compatibility
      agent: false,
      // Add IPv4 preference
      family: 4
    };

    // Add Content-Length for POST/PUT requests
    if (data && (method === 'POST' || method === 'PUT')) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    console.log(`[Shopify API] ${method} ${path}`);

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          // Check rate limit headers
          const rateLimitRemaining = res.headers['x-shopify-shop-api-call-limit'];
          if (rateLimitRemaining) {
            console.log(`[Shopify API] Rate limit: ${rateLimitRemaining}`);
          }

          // Parse response
          const parsedData = responseData ? JSON.parse(responseData) : {};

          // Check for errors
          if (res.statusCode >= 400) {
            console.error(`[Shopify API] Error ${res.statusCode}:`, parsedData);
            reject({
              statusCode: res.statusCode,
              error: parsedData.errors || parsedData.error || 'API request failed',
              response: parsedData
            });
          } else {
            resolve({
              statusCode: res.statusCode,
              data: parsedData,
              headers: res.headers
            });
          }
        } catch (error) {
          console.error('[Shopify API] Parse error:', error);
          reject({
            statusCode: res.statusCode,
            error: 'Failed to parse response',
            raw: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('[Shopify API] Request error:', error);
      reject({
        error: 'Network error',
        details: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        details: 'Request took longer than 30 seconds'
      });
    });

    // Send request body for POST/PUT
    if (data && (method === 'POST' || method === 'PUT')) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
};

/**
 * Get shop information
 * @param {string} shopDomain
 * @param {string} accessToken
 * @returns {Promise<object>} Shop details
 */
const getShopInfo = async (shopDomain, accessToken) => {
  try {
    const response = await callShopifyAPI(
      shopDomain,
      accessToken,
      '/shop.json',
      'GET'
    );
    return {
      success: true,
      shop: response.data.shop
    };
  } catch (error) {
    console.error('[Shopify API] getShopInfo error:', error);
    return {
      success: false,
      error: error.error || 'Failed to get shop info'
    };
  }
};

/**
 * Get orders from Shopify
 * @param {string} shopDomain
 * @param {string} accessToken
 * @param {object} params - Query parameters (limit, status, created_at_min, etc.)
 * @returns {Promise<object>} Orders list
 */
const getOrders = async (shopDomain, accessToken, params = {}) => {
  try {
    // Build query string
    const queryParams = new URLSearchParams({
      status: params.status || 'any',
      limit: params.limit || 50,
      ...(params.since_id && { since_id: params.since_id }),
      ...(params.created_at_min && { created_at_min: params.created_at_min }),
      ...(params.created_at_max && { created_at_max: params.created_at_max }),
    }).toString();

    const response = await callShopifyAPI(
      shopDomain,
      accessToken,
      `/orders.json?${queryParams}`,
      'GET'
    );

    return {
      success: true,
      orders: response.data.orders || [],
      count: response.data.orders?.length || 0
    };
  } catch (error) {
    console.error('[Shopify API] getOrders error:', error);
    return {
      success: false,
      error: error.error || 'Failed to get orders',
      orders: []
    };
  }
};

/**
 * Get single order by ID
 * @param {string} shopDomain
 * @param {string} accessToken
 * @param {string} orderId
 * @returns {Promise<object>} Order details
 */
const getOrder = async (shopDomain, accessToken, orderId) => {
  try {
    const response = await callShopifyAPI(
      shopDomain,
      accessToken,
      `/orders/${orderId}.json`,
      'GET'
    );

    return {
      success: true,
      order: response.data.order
    };
  } catch (error) {
    console.error('[Shopify API] getOrder error:', error);
    return {
      success: false,
      error: error.error || 'Failed to get order'
    };
  }
};

/**
 * Get customers from Shopify
 * @param {string} shopDomain
 * @param {string} accessToken
 * @param {object} params - Query parameters
 * @returns {Promise<object>} Customers list
 */
const getCustomers = async (shopDomain, accessToken, params = {}) => {
  try {
    const queryParams = new URLSearchParams({
      limit: params.limit || 50,
      ...(params.since_id && { since_id: params.since_id }),
    }).toString();

    const response = await callShopifyAPI(
      shopDomain,
      accessToken,
      `/customers.json?${queryParams}`,
      'GET'
    );

    return {
      success: true,
      customers: response.data.customers || [],
      count: response.data.customers?.length || 0
    };
  } catch (error) {
    console.error('[Shopify API] getCustomers error:', error);
    return {
      success: false,
      error: error.error || 'Failed to get customers',
      customers: []
    };
  }
};

/**
 * Register a webhook with Shopify
 * @param {string} shopDomain
 * @param {string} accessToken
 * @param {string} topic - Webhook topic (e.g., 'orders/create')
 * @param {string} address - Webhook callback URL
 * @param {string} format - Response format (default: 'json')
 * @returns {Promise<object>} Webhook registration result
 */
const registerWebhook = async (shopDomain, accessToken, topic, address, format = 'json') => {
  try {
    const webhookData = {
      webhook: {
        topic: topic,
        address: address,
        format: format
      }
    };

    const response = await callShopifyAPI(
      shopDomain,
      accessToken,
      '/webhooks.json',
      'POST',
      webhookData
    );

    return {
      success: true,
      webhook: response.data.webhook
    };
  } catch (error) {
    console.error('[Shopify API] registerWebhook error:', error);
    return {
      success: false,
      error: error.error || 'Failed to register webhook'
    };
  }
};

/**
 * Get all registered webhooks
 * @param {string} shopDomain
 * @param {string} accessToken
 * @returns {Promise<object>} List of webhooks
 */
const getWebhooks = async (shopDomain, accessToken) => {
  try {
    const response = await callShopifyAPI(
      shopDomain,
      accessToken,
      '/webhooks.json',
      'GET'
    );

    return {
      success: true,
      webhooks: response.data.webhooks || [],
      count: response.data.webhooks?.length || 0
    };
  } catch (error) {
    console.error('[Shopify API] getWebhooks error:', error);
    return {
      success: false,
      error: error.error || 'Failed to get webhooks',
      webhooks: []
    };
  }
};

/**
 * Delete a webhook
 * @param {string} shopDomain
 * @param {string} accessToken
 * @param {string} webhookId
 * @returns {Promise<object>} Deletion result
 */
const deleteWebhook = async (shopDomain, accessToken, webhookId) => {
  try {
    await callShopifyAPI(
      shopDomain,
      accessToken,
      `/webhooks/${webhookId}.json`,
      'DELETE'
    );

    return {
      success: true,
      message: 'Webhook deleted successfully'
    };
  } catch (error) {
    console.error('[Shopify API] deleteWebhook error:', error);
    return {
      success: false,
      error: error.error || 'Failed to delete webhook'
    };
  }
};

/**
 * Verify webhook HMAC signature
 * @param {string} body - Raw request body
 * @param {string} hmacHeader - HMAC header from request
 * @param {string} secret - Shopify API secret
 * @returns {boolean} True if signature is valid
 */
/**
 * Exchange authorization code for access token
 * @param {string} shopDomain - e.g., 'rafl-dev.myshopify.com'
 * @param {string} code - Authorization code from Shopify
 * @returns {Promise<object>} Token response
 */
const exchangeCodeForToken = async (shopDomain, code) => {
  return new Promise((resolve, reject) => {
    // Validate environment variables
    if (!process.env.SHOPIFY_CLIENT_ID || !process.env.SHOPIFY_CLIENT_SECRET) {
      reject(new Error('Missing Shopify API credentials. Please check your environment variables.'));
      return;
    }

    const postData = JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code: code
    });

    const options = {
      hostname: shopDomain,
      port: 443,
      path: '/admin/oauth/access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Raffle-Sweepstakes-App/1.0'
      },
      timeout: 30000, // Increased timeout
      // Disable agent for better compatibility
      agent: false,
      // Add IPv4 preference
      family: 4
    };

    console.log(`[Shopify OAuth] Exchanging code for token for ${shopDomain}`);

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const data = JSON.parse(responseData);
          if (res.statusCode === 200) {
            console.log(`[Shopify OAuth] Token exchange successful for ${shopDomain}`);
            resolve(data);
          } else {
            console.error(`[Shopify OAuth] Token exchange failed: ${res.statusCode}`, data);
            reject(new Error(`Token exchange failed: ${data.error || 'Unknown error'}`));
          }
        } catch (error) {
          console.error(`[Shopify OAuth] Invalid JSON response:`, responseData);
          reject(new Error('Invalid response from Shopify'));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`[Shopify OAuth] Request error:`, error);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
};

/**
 * Setup webhooks for a Shopify store
 * @param {string} shopDomain - e.g., 'rafl-dev.myshopify.com'
 * @param {string} accessToken - Shopify access token
 * @returns {Promise<void>}
 */
const setupWebhooks = async (shopDomain, accessToken) => {
  // Check if this is a dev token (starts with 'dev_token_')
  if (accessToken.startsWith('dev_token_')) {
    console.log(`[Shopify Webhooks] Skipping webhook setup for dev token on ${shopDomain}`);
    return;
  }

  // Use WEBHOOK_BASE_URL if set, otherwise fallback to localhost for development
  const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:4000/api/webhooks';
  
  const webhooks = [
    {
      topic: 'orders/create',
      address: `${webhookBaseUrl}/orders/create`,
      format: 'json'
    },
    {
      topic: 'orders/updated',
      address: `${webhookBaseUrl}/orders/updated`,
      format: 'json'
    },
    {
      topic: 'app/uninstalled',
      address: `${webhookBaseUrl}/app/uninstalled`,
      format: 'json'
    }
  ];

  console.log(`[Shopify Webhooks] Setting up webhooks for ${shopDomain}`);

  for (const webhook of webhooks) {
    try {
      const result = await registerWebhook(shopDomain, accessToken, webhook.topic, webhook.address, webhook.format);
      if (result.success) {
        console.log(`[Shopify Webhooks] Registered ${webhook.topic} webhook`);
      } else {
        console.error(`[Shopify Webhooks] Failed to register ${webhook.topic}:`, result.error);
      }
    } catch (error) {
      console.error(`[Shopify Webhooks] Failed to register ${webhook.topic}:`, error.message);
      // Don't throw - continue with other webhooks
    }
  }
};

const verifyWebhookHmac = (body, hmacHeader, secret) => {
  const crypto = require('crypto');
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  
  return hash === hmacHeader;
};

/**
 * Test network connectivity to Shopify
 * @param {string} shopDomain - e.g., 'rafl-dev.myshopify.com'
 * @returns {Promise<object>} Connectivity test result
 */
const testConnectivity = async (shopDomain) => {
  return new Promise((resolve) => {
    const options = {
      hostname: shopDomain,
      port: 443,
      path: '/admin/api/2024-01/shop.json',
      method: 'GET',
      headers: {
        'User-Agent': 'Raffle-Sweepstakes-App/1.0'
      },
      timeout: 10000,
      // Remove agent configuration for connectivity test
      agent: false
    };

    console.log(`[Network Test] Testing connectivity to ${shopDomain}...`);

    const req = https.request(options, (res) => {
      console.log(`[Network Test] ✅ Connection successful (Status: ${res.statusCode})`);
      resolve({
        success: true,
        statusCode: res.statusCode,
        message: 'Network connectivity is working'
      });
    });

    req.on('error', (error) => {
      console.error(`[Network Test] ❌ Connection failed:`, error.message);
      resolve({
        success: false,
        error: error.message,
        code: error.code,
        message: 'Network connectivity failed'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      console.error(`[Network Test] ❌ Connection timeout`);
      resolve({
        success: false,
        error: 'Connection timeout',
        message: 'Network request timed out'
      });
    });

    req.end();
  });
};

/**
 * Shopify Billing API Methods
 */

/**
 * Create a recurring application charge (subscription)
 * @param {string} shopDomain - Shop domain
 * @param {string} accessToken - Shopify access token
 * @param {object} chargeData - Charge details
 * @returns {Promise<object>} Created charge with confirmation_url
 */
const createRecurringCharge = async (shopDomain, accessToken, chargeData) => {
  const endpoint = '/recurring_application_charges.json';
  
  const charge = {
    recurring_application_charge: {
      name: chargeData.name || 'Premium Plan',
      price: chargeData.price || 149.0,
      return_url: chargeData.return_url,
      test: chargeData.test !== false, // Default to test mode
      trial_days: chargeData.trial_days || 0,
      ...(chargeData.capped_amount && { capped_amount: chargeData.capped_amount }),
      ...(chargeData.terms && { terms: chargeData.terms })
    }
  };

  console.log(`[Shopify Billing] Creating recurring charge for ${shopDomain}`);
  
  try {
    const response = await callShopifyAPI(shopDomain, accessToken, endpoint, 'POST', charge);
    return {
      success: true,
      charge: response.data.recurring_application_charge
    };
  } catch (error) {
    console.error('[Shopify Billing] Error creating charge:', error);
    return {
      success: false,
      error: error.error || error.message
    };
  }
};

/**
 * Get recurring application charge details
 * @param {string} shopDomain - Shop domain
 * @param {string} accessToken - Shopify access token
 * @param {string} chargeId - Charge ID
 * @returns {Promise<object>} Charge details
 */
const getRecurringCharge = async (shopDomain, accessToken, chargeId) => {
  const endpoint = `/recurring_application_charges/${chargeId}.json`;
  
  console.log(`[Shopify Billing] Getting charge ${chargeId} for ${shopDomain}`);
  
  try {
    const response = await callShopifyAPI(shopDomain, accessToken, endpoint, 'GET');
    return {
      success: true,
      charge: response.data.recurring_application_charge
    };
  } catch (error) {
    console.error('[Shopify Billing] Error getting charge:', error);
    return {
      success: false,
      error: error.error || error.message
    };
  }
};

/**
 * Activate a recurring charge after merchant approval
 * @param {string} shopDomain - Shop domain
 * @param {string} accessToken - Shopify access token
 * @param {string} chargeId - Charge ID to activate
 * @returns {Promise<object>} Activated charge
 */
const activateRecurringCharge = async (shopDomain, accessToken, chargeId) => {
  const endpoint = `/recurring_application_charges/${chargeId}/activate.json`;
  
  console.log(`[Shopify Billing] Activating charge ${chargeId} for ${shopDomain}`);
  
  try {
    const response = await callShopifyAPI(shopDomain, accessToken, endpoint, 'POST', {});
    return {
      success: true,
      charge: response.data.recurring_application_charge
    };
  } catch (error) {
    console.error('[Shopify Billing] Error activating charge:', error);
    return {
      success: false,
      error: error.error || error.message
    };
  }
};

/**
 * Cancel a recurring application charge
 * @param {string} shopDomain - Shop domain
 * @param {string} accessToken - Shopify access token
 * @param {string} chargeId - Charge ID to cancel
 * @returns {Promise<object>} Result
 */
const cancelRecurringCharge = async (shopDomain, accessToken, chargeId) => {
  const endpoint = `/recurring_application_charges/${chargeId}.json`;
  
  console.log(`[Shopify Billing] Canceling charge ${chargeId} for ${shopDomain}`);
  
  try {
    await callShopifyAPI(shopDomain, accessToken, endpoint, 'DELETE');
    return {
      success: true,
      message: 'Charge cancelled successfully'
    };
  } catch (error) {
    console.error('[Shopify Billing] Error canceling charge:', error);
    return {
      success: false,
      error: error.error || error.message
    };
  }
};

/**
 * Get all recurring charges for a shop
 * @param {string} shopDomain - Shop domain
 * @param {string} accessToken - Shopify access token
 * @returns {Promise<object>} List of charges
 */
const getRecurringCharges = async (shopDomain, accessToken) => {
  const endpoint = '/recurring_application_charges.json';
  
  console.log(`[Shopify Billing] Getting all charges for ${shopDomain}`);
  
  try {
    const response = await callShopifyAPI(shopDomain, accessToken, endpoint, 'GET');
    return {
      success: true,
      charges: response.data.recurring_application_charges || []
    };
  } catch (error) {
    console.error('[Shopify Billing] Error getting charges:', error);
    return {
      success: false,
      error: error.error || error.message
    };
  }
};

module.exports = {
  callShopifyAPI,
  getShopInfo,
  getOrders,
  getOrder,
  getCustomers,
  registerWebhook,
  getWebhooks,
  deleteWebhook,
  verifyWebhookHmac,
  exchangeCodeForToken,
  setupWebhooks,
  testConnectivity,
  // Billing API methods
  createRecurringCharge,
  getRecurringCharge,
  activateRecurringCharge,
  cancelRecurringCharge,
  getRecurringCharges
};

