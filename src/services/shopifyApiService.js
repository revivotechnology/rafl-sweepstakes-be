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
      },
      timeout: 30000 // 30 second timeout
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
const verifyWebhookHmac = (body, hmacHeader, secret) => {
  const crypto = require('crypto');
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  
  return hash === hmacHeader;
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
  verifyWebhookHmac
};

