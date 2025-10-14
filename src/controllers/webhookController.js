const { supabase } = require('../config/supabase');
const shopifyApi = require('../services/shopifyApiService');

/**
 * Handle order create webhook
 * POST /api/webhooks/orders/create
 */
const handleOrderCreate = async (req, res) => {
  try {
    console.log('📦 Order create webhook received');
    
    // Verify webhook signature for security
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    
    if (webhookSecret && hmacHeader) {
      const isValid = shopifyApi.verifyWebhookHmac(JSON.stringify(req.body), hmacHeader, webhookSecret);
      if (!isValid) {
        console.log('❌ Invalid webhook signature');
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }
      console.log('✅ Webhook signature verified');
    } else {
      console.log('⚠️ Skipping HMAC verification (development mode)');
    }
    
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
    
    // Find store by shopify domain
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
    
    // Extract order details
    const orderData = {
      storeId: store.id,
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
    
    // Find or create shopify_shop record
    let { data: shopifyShop, error: shopifyShopError } = await supabase
      .from('shopify_shops')
      .select('*')
      .eq('store_id', store.id)
      .eq('shop_domain', shopDomain)
      .single();

    if (shopifyShopError && shopifyShopError.code !== 'PGRST116') {
      console.error('Error finding shopify_shop:', shopifyShopError);
    }

    if (!shopifyShop) {
      // Create shopify_shop record
      const { data: newShopifyShop, error: createShopifyShopError } = await supabase
        .from('shopify_shops')
        .insert({
          store_id: store.id,
          shop_domain: shopDomain,
          access_token: store.shopify_access_token || 'dev_token',
          webhook_verified: true
        })
        .select()
        .single();

      if (createShopifyShopError) {
        console.error('Error creating shopify_shop:', createShopifyShopError);
        return res.status(500).json({
          success: false,
          message: 'Failed to create shopify shop record',
          error: createShopifyShopError.message
        });
      }
      shopifyShop = newShopifyShop;
    }

    // Save order data to purchases table
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .upsert({
        shopify_shop_id: shopifyShop.id,
        shopify_order_id: orderData.shopifyOrderId,
        customer_email: orderData.customerEmail,
        total_amount_usd: orderData.totalPrice,
        currency: orderData.currency,
        order_date: orderData.orderDate.toISOString()
      }, {
        onConflict: 'shopify_shop_id,shopify_order_id'
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Error saving purchase:', purchaseError);
    }
    
    // Check if customer email exists and matches any active promos
    if (orderData.customerEmail) {
      const { data: activePromos, error: promosError } = await supabase
        .from('promos')
        .select('*')
        .eq('store_id', store.id)
        .eq('status', 'active')
        .eq('enable_purchase_entries', true);
      
      if (promosError) {
        console.error('Error fetching active promos:', promosError);
      } else if (activePromos && activePromos.length > 0) {
        for (const promo of activePromos) {
          // Check if customer already has an entry for this promo
          const { data: existingEntry, error: entryError } = await supabase
            .from('entries')
            .select('*')
            .eq('promo_id', promo.id)
            .eq('customer_email', orderData.customerEmail)
            .single();
          
          if (entryError && entryError.code !== 'PGRST116') { // PGRST116 = no rows returned
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
      }
    }
    
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
    
    // Find store by shop domain
    const shopDomain = req.headers['x-shopify-shop-domain'];
    if (!shopDomain) {
      return res.status(400).json({
        success: false,
        message: 'Missing shop domain in headers'
      });
    }
    
    // Find store by shopify domain
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
    
    // Update purchase record
    const { data: updatedPurchase, error: updateError } = await supabase
      .from('purchases')
      .update({
        customer_email: order.email || order.customer?.email,
        total_amount_usd: parseFloat(order.total_price || 0),
        currency: order.currency || 'USD',
        order_date: new Date(order.created_at).toISOString()
      })
      .eq('shopify_shop_id', store.id)
      .eq('shopify_order_id', order.id.toString())
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating purchase:', updateError);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Order updated successfully',
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
 * Handle app uninstall webhook
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

module.exports = {
  handleOrderCreate,
  handleOrderUpdate,
  handleAppUninstall
};