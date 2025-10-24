const { supabase } = require('../config/supabase');
const shopifyApi = require('../services/shopifyApiService');
const { calculateEntriesToAdd, getMaxEntriesPerCustomer } = require('../utils/entryUtils');

/**
 * Handle order create webhook
 * POST /api/webhooks/orders/create
 */
const handleOrderCreate = async (req, res) => {
  try {
    console.log('📦 Order create webhook received');
    console.log('📦 Webhook headers:', req.headers);
    console.log('📦 Webhook body:', JSON.stringify(req.body, null, 2));
    
    // Verify webhook signature for security
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    
    if (webhookSecret && hmacHeader) {
      // Use raw body captured by middleware for accurate HMAC verification
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const isValid = shopifyApi.verifyWebhookHmac(rawBody, hmacHeader, webhookSecret);
      if (!isValid) {
        console.log('❌ Invalid webhook signature');
        console.log('Received HMAC:', hmacHeader);
        console.log('Raw body available:', !!req.rawBody);
        
        // In production, reject invalid signatures
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).json({
            success: false,
            message: 'Invalid webhook signature'
          });
        } else {
          // Only continue in development mode
          console.log('⚠️ Continuing in development mode despite invalid signature');
        }
      } else {
        console.log('✅ Webhook signature verified');
      }
    } else {
      console.log('⚠️ Skipping HMAC verification (no secret or HMAC header)');
      
      // In production, require webhook secret
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          success: false,
          message: 'Webhook secret required in production'
        });
      }
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
      console.error('Store error:', storeError);
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }
    
    // Extract customer email, with phone number fallback
    let customerEmail = order.email || order.contact_email || order.customer?.email;
    
    // If no email but phone exists, create a phone-based identifier
    if (!customerEmail || customerEmail === '') {
      const phone = order.phone || order.customer?.phone;
      if (phone) {
        // Remove special characters and create a unique identifier
        const cleanPhone = phone.replace(/[^\d]/g, ''); // Keep only digits
        customerEmail = `phone_${cleanPhone}@phone.customer`;
        console.log(`📱 No email found, using phone-based identifier: ${customerEmail}`);
      } else {
        // Last resort: use order ID as identifier
        customerEmail = `order_${order.id}@noemail.customer`;
        console.log(`⚠️ No email or phone found, using order-based identifier: ${customerEmail}`);
      }
    }
    
    // Extract order details
    const orderData = {
      storeId: store.id,
      shopifyOrderId: order.id.toString(),
      shopifyOrderNumber: order.order_number,
      customerEmail: customerEmail,
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
    console.log(`💾 Saving purchase record for shopify_shop_id: ${shopifyShop?.id}, order: ${orderData.shopifyOrderId}`);
    
    if (!shopifyShop || !shopifyShop.id) {
      console.error('❌ Cannot save purchase: shopify_shop record is missing');
    } else {
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
        .select();

      if (purchaseError) {
        console.error('❌ Error saving purchase:', purchaseError);
        console.error('Purchase data attempted:', {
          shopify_shop_id: shopifyShop.id,
          shopify_order_id: orderData.shopifyOrderId,
          customer_email: orderData.customerEmail
        });
      } else {
        console.log('✅ Purchase record saved/updated:', purchase);
      }
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
          // Get all existing entries for this customer and promo
          const { data: existingEntries, error: entryError } = await supabase
            .from('entries')
            .select('*')
            .eq('promo_id', promo.id)
            .eq('customer_email', orderData.customerEmail);
          
          if (entryError) {
            console.error('Error checking existing entries:', entryError);
            continue;
          }
          
          // Calculate how many entries to add (considering max limit)
          // Use promo's max_entries_per_email if set, otherwise fall back to env variable
          const maxEntriesLimit = promo.max_entries_per_email || getMaxEntriesPerCustomer();
          const entriesToAdd = calculateEntriesToAdd(
            orderData.totalPrice, 
            existingEntries || [], 
            promo.entries_per_dollar, 
            maxEntriesLimit
          );
          
          if (entriesToAdd === 0) {
            console.log(`⏭️ Customer ${orderData.customerEmail} has reached max entries (${maxEntriesLimit}) for promo ${promo.id}`);
            continue;
          }
          
          // Create new entry for this purchase
          const crypto = require('crypto');
          const hashedEmail = crypto.createHash('sha256').update(orderData.customerEmail).digest('hex');
          
          const { data: newEntry, error: createEntryError } = await supabase
            .from('entries')
            .insert({
              promo_id: promo.id,
              store_id: store.id,
              customer_email: orderData.customerEmail,
              hashed_email: hashedEmail,
              customer_name: orderData.customerName,
              entry_count: entriesToAdd,
              source: 'purchase',
              order_id: orderData.shopifyOrderId,
              order_total: orderData.totalPrice,
              metadata: {
                orderNumber: orderData.shopifyOrderNumber,
                currency: orderData.currency,
                orderDate: orderData.orderDate,
                lineItems: orderData.lineItems,
                maxEntriesReached: entriesToAdd < Math.floor(orderData.totalPrice * promo.entries_per_dollar)
              }
            })
            .select()
            .single();
          
          if (createEntryError) {
            console.error('Error creating entry:', createEntryError);
          } else {
            const totalEntries = (existingEntries || []).reduce((sum, entry) => sum + entry.entry_count, 0) + entriesToAdd;
            console.log(`✅ Added ${entriesToAdd} entries for ${orderData.customerEmail} (Total: ${totalEntries}/${maxEntriesLimit})`);
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
    
    // Verify webhook signature for security
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    
    if (webhookSecret && hmacHeader) {
      // Use raw body captured by middleware for accurate HMAC verification
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const isValid = shopifyApi.verifyWebhookHmac(rawBody, hmacHeader, webhookSecret);
      if (!isValid) {
        console.log('❌ Invalid webhook signature');
        
        // In production, reject invalid signatures
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).json({
            success: false,
            message: 'Invalid webhook signature'
          });
        } else {
          // Only continue in development mode
          console.log('⚠️ Continuing in development mode despite invalid signature');
        }
      } else {
        console.log('✅ Webhook signature verified');
      }
    } else {
      console.log('⚠️ Skipping HMAC verification (no secret or HMAC header)');
      
      // In production, require webhook secret
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          success: false,
          message: 'Webhook secret required in production'
        });
      }
    }
    
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
    
    // Extract customer email with phone fallback
    let updateEmail = order.email || order.contact_email || order.customer?.email;
    
    // If no email but phone exists, create a phone-based identifier
    if (!updateEmail || updateEmail === '') {
      const phone = order.phone || order.customer?.phone;
      if (phone) {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        updateEmail = `phone_${cleanPhone}@phone.customer`;
        console.log(`📱 No email found in update, using phone-based identifier: ${updateEmail}`);
      } else {
        updateEmail = `order_${order.id}@noemail.customer`;
        console.log(`⚠️ No email or phone found in update, using order-based identifier: ${updateEmail}`);
      }
    }
    
    // Update purchase record
    const { data: updatedPurchase, error: updateError } = await supabase
      .from('purchases')
      .update({
        customer_email: updateEmail,
        total_amount_usd: parseFloat(order.total_price || 0),
        currency: order.currency || 'USD',
        order_date: new Date(order.created_at).toISOString()
      })
      .eq('shopify_shop_id', store.id)
      .eq('shopify_order_id', order.id.toString())
      .select();
    
    if (updateError) {
      console.error('Error updating purchase:', updateError);
    } else {
      console.log('✅ Purchase record updated:', updatedPurchase);
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
    
    // Verify webhook signature for security
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    
    if (webhookSecret && hmacHeader) {
      // Use raw body captured by middleware for accurate HMAC verification
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const isValid = shopifyApi.verifyWebhookHmac(rawBody, hmacHeader, webhookSecret);
      if (!isValid) {
        console.log('❌ Invalid webhook signature');
        
        // In production, reject invalid signatures
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).json({
            success: false,
            message: 'Invalid webhook signature'
          });
        } else {
          // Only continue in development mode
          console.log('⚠️ Continuing in development mode despite invalid signature');
        }
      } else {
        console.log('✅ Webhook signature verified');
      }
    } else {
      console.log('⚠️ Skipping HMAC verification (no secret or HMAC header)');
      
      // In production, require webhook secret
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          success: false,
          message: 'Webhook secret required in production'
        });
      }
    }
    
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

const handleSubscriptionUpdate = async (req, res) => {
  try {
    console.log('💳 Subscription update webhook received');
    console.log('💳 Webhook body:', JSON.stringify(req.body, null, 2));
    
    // Verify webhook signature
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    
    if (webhookSecret && hmacHeader) {
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const isValid = shopifyApi.verifyWebhookHmac(rawBody, hmacHeader, webhookSecret);
      
      if (!isValid) {
        console.log('❌ Invalid webhook signature for subscription update');
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).json({
            success: false,
            message: 'Invalid webhook signature'
          });
        }
        console.log('⚠️ Continuing in development mode despite invalid signature');
      } else {
        console.log('✅ Subscription webhook signature verified');
      }
    }
    
    const subscription = req.body;
    
    // Extract subscription details
    const {
      id: chargeId,
      status,
      name: planName,
      price,
      billing_on,
      activated_on,
      cancelled_on
    } = subscription;
    
    console.log(`💳 Subscription ${chargeId} status: ${status}`);
    console.log(`💳 Plan: ${planName}, Price: $${price}`);
    
    // Find store by charge ID
    const { data: stores, error: findError } = await supabase
      .from('stores')
      .select('*')
      .eq('shopify_charge_id', chargeId.toString());
    
    if (findError || !stores || stores.length === 0) {
      console.log(`⚠️ No store found with charge ID: ${chargeId}`);
      // Still return 200 to acknowledge webhook
      return res.status(200).json({
        success: true,
        message: 'Webhook received but no matching store found'
      });
    }
    
    const store = stores[0];
    console.log(`💳 Updating subscription for store: ${store.id} (${store.shop_domain})`);
    
    // Map Shopify status to our billing status and subscription tier
    let billingStatus = 'pending';
    let subscriptionTier = store.subscription_tier || 'free';
    
    switch (status) {
      case 'active':
        billingStatus = 'active';
        subscriptionTier = 'premium';
        console.log('✅ Subscription is ACTIVE - upgrading to premium');
        break;
        
      case 'cancelled':
      case 'expired':
      case 'declined':
        billingStatus = 'cancelled';
        subscriptionTier = 'free';
        console.log('❌ Subscription is CANCELLED/EXPIRED - downgrading to free');
        break;
        
      case 'frozen':
        billingStatus = 'frozen';
        console.log('❄️ Subscription is FROZEN');
        break;
        
      case 'pending':
        billingStatus = 'pending';
        console.log('⏳ Subscription is PENDING');
        break;
        
      default:
        console.log(`⚠️ Unknown subscription status: ${status}`);
        billingStatus = status;
    }
    
    // Update store in database
    const updateData = {
      subscription_tier: subscriptionTier,
      billing_status: billingStatus,
      shopify_charge_id: chargeId.toString(),
      plan_name: subscriptionTier === 'premium' ? 'premium' : 'free',
      updated_at: new Date().toISOString()
    };
    
    // Add additional fields if available
    if (billing_on) updateData.billing_on = billing_on;
    if (activated_on) updateData.last_charge_at = activated_on;
    if (cancelled_on) updateData.cancelled_at = cancelled_on;
    
    const { error: updateError } = await supabase
      .from('stores')
      .update(updateData)
      .eq('id', store.id);
    
    if (updateError) {
      console.error('❌ Error updating store subscription:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update store subscription',
        error: updateError.message
      });
    }
    
    console.log(`✅ Store ${store.id} subscription updated successfully`);
    console.log(`   Status: ${billingStatus}`);
    console.log(`   Tier: ${subscriptionTier}`);
    
    // Return 200 to acknowledge webhook
    return res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      store_id: store.id,
      subscription_tier: subscriptionTier,
      billing_status: billingStatus
    });
    
  } catch (error) {
    console.error('❌ Error handling subscription update webhook:', error);
    // Still return 200 to prevent Shopify from retrying
    return res.status(200).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
};

module.exports = {
  handleOrderCreate,
  handleOrderUpdate,
  handleAppUninstall,
  handleSubscriptionUpdate
};