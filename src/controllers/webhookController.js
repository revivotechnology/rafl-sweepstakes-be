const Store = require('../models/Store');
const Entry = require('../models/Entry');
const Promo = require('../models/Promo');
const shopifyApi = require('../services/shopifyApiService');

/**
 * Handle order create webhook
 * POST /api/webhooks/orders/create
 */
const handleOrderCreate = async (req, res) => {
  try {
    console.log('📦 Order create webhook received');
    
    // Extract order data from webhook payload
    const order = req.body;
    
    if (!order || !order.id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data received'
      });
    }
    
    console.log(`Processing order: ${order.id} (${order.order_number})`);
    
    // Find store by shop domain
    const shopDomain = req.headers['x-shopify-shop-domain'];
    if (!shopDomain) {
      return res.status(400).json({
        success: false,
        message: 'Missing shop domain in headers'
      });
    }
    
    const store = await Store.findOne({ shopifyDomain: shopDomain });
    if (!store) {
      console.error(`Store not found for domain: ${shopDomain}`);
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }
    
    // Extract order details
    const orderData = {
      storeId: store._id,
      shopifyOrderId: order.id.toString(),
      shopifyOrderNumber: order.order_number,
      customerEmail: order.email || order.customer?.email,
      customerName: order.customer?.first_name && order.customer?.last_name 
        ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
        : order.customer?.first_name || order.customer?.last_name || null,
      totalPrice: parseFloat(order.total_price || 0),
      currency: order.currency || 'USD',
      orderDate: new Date(order.created_at),
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      lineItems: order.line_items?.map(item => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price || 0),
        sku: item.sku
      })) || [],
      tags: order.tags ? order.tags.split(',').map(tag => tag.trim()) : []
    };
    
    console.log(`Order details: ${orderData.customerEmail} - $${orderData.totalPrice} ${orderData.currency}`);
    
    // Save order data to Entry model (for giveaway tracking)
    // Check if customer email exists and matches any active promos
    if (orderData.customerEmail) {
      const activePromos = await Promo.find({ 
        storeId: store._id, 
        status: 'active',
        enablePurchaseEntries: true 
      });
      
      if (activePromos.length > 0) {
        for (const promo of activePromos) {
          // Check if customer already has an entry for this promo
          const existingEntry = await Entry.findOne({
            promoId: promo._id,
            customerEmail: orderData.customerEmail
          });
          
          if (!existingEntry) {
            // Create new entry for purchase
            const entry = new Entry({
              promoId: promo._id,
              storeId: store._id,
              customerEmail: orderData.customerEmail,
              customerName: orderData.customerName,
              entryCount: Math.floor(orderData.totalPrice * promo.entriesPerDollar),
              source: 'purchase',
              orderId: orderData.shopifyOrderId,
              orderTotal: orderData.totalPrice,
              metadata: {
                orderNumber: orderData.shopifyOrderNumber,
                currency: orderData.currency,
                orderDate: orderData.orderDate,
                lineItems: orderData.lineItems
              }
            });
            
            await entry.save();
            console.log(`✅ Created entry for ${orderData.customerEmail}: ${entry.entryCount} entries`);
          } else {
            console.log(`⏭️ Customer ${orderData.customerEmail} already has entry for promo ${promo._id}`);
          }
        }
      }
    }
    
    // TODO: If you want to store full order data separately, create an Order model
    // For now, we're storing order info in the Entry metadata
    
    return res.status(200).json({
      success: true,
      message: 'Order processed successfully',
      orderId: orderData.shopifyOrderId,
      customerEmail: orderData.customerEmail,
      entriesCreated: orderData.customerEmail ? 'Yes' : 'No email'
    });
    
  } catch (error) {
    console.error('Order create webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing order webhook',
      error: error.message
    });
  }
};

/**
 * Handle order update webhook
 * POST /api/webhooks/orders/updated
 */
const handleOrderUpdate = async (req, res) => {
  try {
    console.log('📝 Order update webhook received');
    
    const order = req.body;
    
    if (!order || !order.id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data received'
      });
    }
    
    console.log(`Processing order update: ${order.id} (${order.order_number})`);
    
    // Find store
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const store = await Store.findOne({ shopifyDomain: shopDomain });
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }
    
    // Update existing entry if it exists
    if (order.email) {
      const entry = await Entry.findOne({
        storeId: store._id,
        orderId: order.id.toString()
      });
      
      if (entry) {
        // Update entry with new order details
        entry.orderTotal = parseFloat(order.total_price || 0);
        entry.metadata = {
          ...entry.metadata,
          orderNumber: order.order_number,
          currency: order.currency,
          orderDate: new Date(order.updated_at),
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status
        };
        
        await entry.save();
        console.log(`✅ Updated entry for order ${order.id}`);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Order update processed successfully',
      orderId: order.id
    });
    
  } catch (error) {
    console.error('Order update webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing order update webhook',
      error: error.message
    });
  }
};

/**
 * Verify webhook HMAC signature
 * @param {string} body - Raw request body
 * @param {string} hmacHeader - HMAC header from request
 * @param {string} secret - Shopify webhook secret
 * @returns {boolean} True if signature is valid
 */
const verifyWebhookSignature = (req, res, next) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const body = JSON.stringify(req.body);
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  
  if (!hmacHeader || !secret) {
    console.log('⚠️ Skipping HMAC verification (missing header or secret)');
    return next();
  }
  
  const isValid = shopifyApi.verifyWebhookHmac(body, hmacHeader, secret);
  
  if (!isValid) {
    console.error('❌ Invalid webhook signature');
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }
  
  console.log('✅ Webhook signature verified');
  next();
};

module.exports = {
  handleOrderCreate,
  handleOrderUpdate,
  verifyWebhookSignature
};
