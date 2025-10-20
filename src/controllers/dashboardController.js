const { supabase } = require('../config/supabase');

// @route   GET /api/dashboard
// @desc    Get dashboard data for authenticated user
// @access  Private
const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if store is already attached from OAuth (Shopify login)
    let store = req.user.store || null;
    
    // If no store attached, query by user_id (regular auth)
    if (!store) {
      // Get user's store - prefer Shopify-connected store if available
      let { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', userId)
        .not('shopify_domain', 'is', null)
        .not('shopify_access_token', 'is', null)
        .single();
      
      // If no Shopify-connected store, get any store
      if (storeError || !storeData) {
        const { data: anyStore, error: anyStoreError } = await supabase
          .from('stores')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (anyStoreError || !anyStore) {
          return res.status(404).json({
            success: false,
            message: 'Store not found'
          });
        }
        store = anyStore;
      } else {
        store = storeData;
      }
    }
    
    console.log(`📊 Loading dashboard for store: ${store.store_name} (ID: ${store.id})`);

    // Get promos for this store
    const { data: promos, error: promosError } = await supabase
      .from('promos')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false });

    if (promosError) {
      console.error('Error fetching promos:', promosError);
    }
    
    console.log(`📋 Found ${promos?.length || 0} promos for store ${store.id}`);

    // Get entries - try both by promo_id and store_id
    let entries = [];
    
    // First, try getting entries by store_id (direct approach)
    const { data: entriesByStore, error: entriesByStoreError } = await supabase
      .from('entries')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false });
    
    if (entriesByStoreError) {
      console.error('❌ Error fetching entries by store_id:', entriesByStoreError);
    }
    
    if (!entriesByStoreError && entriesByStore && entriesByStore.length > 0) {
      entries = entriesByStore;
      console.log(`📝 Found ${entries.length} entries by store_id`);
    } else {
      // Fallback: get entries by promo_id if store_id query failed
      const promoIds = promos?.map(p => p.id) || [];
      if (promoIds.length > 0) {
        const { data: entriesData, error: entriesError } = await supabase
          .from('entries')
          .select('*')
          .in('promo_id', promoIds)
          .order('created_at', { ascending: false });
        
        if (entriesError) {
          console.error('Error fetching entries:', entriesError);
        } else {
          entries = entriesData || [];
          console.log(`📝 Found ${entries.length} entries by promo_id`);
        }
      } else {
        console.log('⚠️ No promos found, and no entries found by store_id');
      }
    }

    // Get winners
    const { data: winners, error: winnersError } = await supabase
      .from('winners')
      .select('*')
      .eq('store_id', store.id)
      .order('drawn_at', { ascending: false });

    if (winnersError) {
      console.error('Error fetching winners:', winnersError);
    }

    // Calculate date ranges for current and previous month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Filter entries by month
    const currentMonthEntries = entries.filter(e => new Date(e.created_at) >= currentMonthStart);
    const previousMonthEntries = entries.filter(e => 
      new Date(e.created_at) >= previousMonthStart && new Date(e.created_at) <= previousMonthEnd
    );

    // Calculate current month stats
    const totalEntries = entries.length;
    const currentMonthTotalEntries = currentMonthEntries.length;
    const previousMonthTotalEntries = previousMonthEntries.length;
    
    const uniqueEmails = new Set(entries.map(e => e.customer_email)).size;
    const currentMonthUniqueEmails = new Set(currentMonthEntries.map(e => e.customer_email)).size;
    const previousMonthUniqueEmails = new Set(previousMonthEntries.map(e => e.customer_email)).size;
    
    const activePromos = promos?.filter(p => p.status === 'active').length || 0;
    
    // Calculate purchase-related metrics for all time
    const purchaseEntries = entries.filter(e => e.source === 'purchase' && e.order_total);
    const purchaseVolume = purchaseEntries.reduce((sum, e) => sum + (parseFloat(e.order_total) || 0), 0);
    const avgOrderValue = purchaseEntries.length > 0 ? purchaseVolume / purchaseEntries.length : 0;
    const totalOrders = purchaseEntries.length;

    // Calculate purchase-related metrics for current month
    const currentMonthPurchaseEntries = currentMonthEntries.filter(e => e.source === 'purchase' && e.order_total);
    const currentMonthPurchaseVolume = currentMonthPurchaseEntries.reduce((sum, e) => sum + (parseFloat(e.order_total) || 0), 0);
    const currentMonthAvgOrderValue = currentMonthPurchaseEntries.length > 0 
      ? currentMonthPurchaseVolume / currentMonthPurchaseEntries.length 
      : 0;
    const currentMonthTotalOrders = currentMonthPurchaseEntries.length;

    // Calculate purchase-related metrics for previous month
    const previousMonthPurchaseEntries = previousMonthEntries.filter(e => e.source === 'purchase' && e.order_total);
    const previousMonthPurchaseVolume = previousMonthPurchaseEntries.reduce((sum, e) => sum + (parseFloat(e.order_total) || 0), 0);
    const previousMonthAvgOrderValue = previousMonthPurchaseEntries.length > 0 
      ? previousMonthPurchaseVolume / previousMonthPurchaseEntries.length 
      : 0;
    const previousMonthTotalOrders = previousMonthPurchaseEntries.length;

    // Calculate lift percentages
    const calculateLift = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const entriesLift = calculateLift(currentMonthTotalEntries, previousMonthTotalEntries);
    const uniqueEmailsLift = calculateLift(currentMonthUniqueEmails, previousMonthUniqueEmails);
    const purchaseVolumeLift = calculateLift(currentMonthPurchaseVolume, previousMonthPurchaseVolume);
    const avgOrderValueLift = calculateLift(currentMonthAvgOrderValue, previousMonthAvgOrderValue);
    const totalOrdersLift = calculateLift(currentMonthTotalOrders, previousMonthTotalOrders);
    
    // Calculate entries per promo
    const entriesByPromo = entries.reduce((acc, entry) => {
      acc[entry.promo_id] = (acc[entry.promo_id] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate dynamic prize pool from active promos
    const activePrizePool = promos
      ?.filter(p => p.status === 'active')
      .reduce((sum, p) => sum + (parseFloat(p.prize_amount) || 0), 0) || 0;

    console.log('📊 Calculated Stats:');
    console.log(`  Total Entries: ${totalEntries} (Current Month: ${currentMonthTotalEntries}, Lift: ${entriesLift.toFixed(2)}%)`);
    console.log(`  Unique Emails: ${uniqueEmails} (Current Month: ${currentMonthUniqueEmails}, Lift: ${uniqueEmailsLift.toFixed(2)}%)`);
    console.log(`  Active Promos: ${activePromos}`);
    console.log(`  Active Prize Pool: $${activePrizePool.toFixed(2)}`);
    console.log(`  Purchase Volume: $${purchaseVolume.toFixed(2)} (Current Month: $${currentMonthPurchaseVolume.toFixed(2)}, Lift: ${purchaseVolumeLift.toFixed(2)}%)`);
    console.log(`  Avg Order Value: $${avgOrderValue.toFixed(2)} (Current Month: $${currentMonthAvgOrderValue.toFixed(2)}, Lift: ${avgOrderValueLift.toFixed(2)}%)`);
    console.log(`  Total Orders: ${totalOrders} (Current Month: ${currentMonthTotalOrders}, Lift: ${totalOrdersLift.toFixed(2)}%)`);

    res.status(200).json({
      success: true,
      data: {
        store: {
          id: store.id,
          storeName: store.store_name,
          storeUrl: store.store_url,
          subscriptionTier: store.subscription_tier,
          status: store.status
        },
        promos: (promos || []).map(p => ({
          id: p.id,
          title: p.title,
          prizeAmount: p.prize_amount,
          status: p.status,
          totalEntries: entriesByPromo[p.id] || 0,
          startDate: p.start_date,
          endDate: p.end_date,
          createdAt: p.created_at
        })),
        entries: entries.map(e => ({
          id: e.id,
          email: e.customer_email,
          entryCount: e.entry_count,
          source: e.source,
          createdAt: e.created_at
        })),
        winners: (winners || []).map(w => ({
          id: w.id,
          customerEmail: w.customer_email,
          customerName: w.customer_name,
          prizeDescription: w.prize_description,
          drawnAt: w.drawn_at
        })),
        stats: {
          totalEntries,
          uniqueEmails,
          activePromos,
          prizePool: Math.round(activePrizePool * 100) / 100, // Dynamic total from active promos
          purchaseVolume: Math.round(purchaseVolume * 100) / 100, // Round to 2 decimal places
          avgOrderValue: Math.round(avgOrderValue * 100) / 100, // Round to 2 decimal places
          totalOrders,
          // Current month metrics
          currentMonth: {
            totalEntries: currentMonthTotalEntries,
            uniqueEmails: currentMonthUniqueEmails,
            purchaseVolume: Math.round(currentMonthPurchaseVolume * 100) / 100,
            avgOrderValue: Math.round(currentMonthAvgOrderValue * 100) / 100,
            totalOrders: currentMonthTotalOrders
          },
          // Previous month metrics
          previousMonth: {
            totalEntries: previousMonthTotalEntries,
            uniqueEmails: previousMonthUniqueEmails,
            purchaseVolume: Math.round(previousMonthPurchaseVolume * 100) / 100,
            avgOrderValue: Math.round(previousMonthAvgOrderValue * 100) / 100,
            totalOrders: previousMonthTotalOrders
          },
          // Lift percentages (current vs previous month)
          lift: {
            entriesLift: Math.round(entriesLift * 100) / 100,
            uniqueEmailsLift: Math.round(uniqueEmailsLift * 100) / 100,
            purchaseVolumeLift: Math.round(purchaseVolumeLift * 100) / 100,
            avgOrderValueLift: Math.round(avgOrderValueLift * 100) / 100,
            totalOrdersLift: Math.round(totalOrdersLift * 100) / 100
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
};

// @route   POST /api/dashboard/promos
// @desc    Create a new promo
// @access  Private
const createPromo = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if store is already attached from OAuth (Shopify login)
    let store = req.user.store || null;
    
    // If no store attached, query by user_id (regular auth)
    if (!store) {
      // Get user's store - prefer Shopify-connected store if available
      let { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', userId)
        .not('shopify_domain', 'is', null)
        .not('shopify_access_token', 'is', null)
        .single();
      
      // If no Shopify-connected store, get any store
      if (storeError || !storeData) {
        const { data: anyStore, error: anyStoreError } = await supabase
          .from('stores')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (anyStoreError || !anyStore) {
          return res.status(404).json({
            success: false,
            message: 'Store not found'
          });
        }
        store = anyStore;
      } else {
        store = storeData;
      }
    }
    
    const {
      name,
      description,
      status = 'active',
      enablePurchaseEntries = true,
      entriesPerDollar = 1,
      prizeAmount = 1000,
      prizeDescription = 'Cash prize',
      startDate,
      endDate
    } = req.body;
    
    // Create new promo
    const { data: promo, error: promoError } = await supabase
      .from('promos')
      .insert({
        store_id: store.id,
        title: name,
        prize_description: description || prizeDescription,
        status,
        enable_purchase_entries: enablePurchaseEntries,
        entries_per_dollar: entriesPerDollar,
        prize_amount: prizeAmount,
        start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();
    
    if (promoError) {
      return res.status(500).json({
        success: false,
        message: 'Error creating promo',
        error: promoError.message
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Promo created successfully',
      data: {
        id: promo.id,
        title: promo.title,
        status: promo.status,
        enablePurchaseEntries: promo.enable_purchase_entries,
        entriesPerDollar: promo.entries_per_dollar,
        startDate: promo.start_date,
        endDate: promo.end_date,
        createdAt: promo.created_at
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating promo',
      error: error.message
    });
  }
};

// @route   GET /api/dashboard/promos/:id
// @desc    Get specific promo details
// @access  Private
const getPromo = async (req, res) => {
  try {
    const userId = req.user.id;
    const promoId = req.params.id;

    // Get promo with store verification
    const { data: promo, error: promoError } = await supabase
      .from('promos')
      .select(`
        *,
        stores!inner(user_id)
      `)
      .eq('id', promoId)
      .eq('stores.user_id', userId)
      .single();

    if (promoError || !promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    // Get entries for this promo
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('*')
      .eq('promo_id', promoId)
      .order('created_at', { ascending: false });

    res.status(200).json({
      success: true,
      data: {
        promo: {
          id: promo.id,
          title: promo.title,
          prizeDescription: promo.prize_description,
          prizeAmount: promo.prize_amount,
          status: promo.status,
          startDate: promo.start_date,
          endDate: promo.end_date,
          enablePurchaseEntries: promo.enable_purchase_entries,
          entriesPerDollar: promo.entries_per_dollar,
          createdAt: promo.created_at
        },
        entries: (entries || []).map(e => ({
          id: e.id,
          email: e.customer_email,
          entryCount: e.entry_count,
          source: e.source,
          createdAt: e.created_at
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching promo',
      error: error.message
    });
  }
};

// @route   PUT /api/dashboard/promos/:id
// @desc    Update a promo
// @access  Private
const updatePromo = async (req, res) => {
  try {
    const userId = req.user.id;
    const promoId = req.params.id;
    const updates = req.body;

    // Verify promo belongs to user
    const { data: existingPromo, error: verifyError } = await supabase
      .from('promos')
      .select(`
        *,
        stores!inner(user_id)
      `)
      .eq('id', promoId)
      .eq('stores.user_id', userId)
      .single();

    if (verifyError || !existingPromo) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    // Update promo
    const { data: updatedPromo, error: updateError } = await supabase
      .from('promos')
      .update({
        title: updates.name || existingPromo.title,
        prize_description: updates.description || existingPromo.prize_description,
        status: updates.status || existingPromo.status,
        enable_purchase_entries: updates.enablePurchaseEntries !== undefined ? updates.enablePurchaseEntries : existingPromo.enable_purchase_entries,
        entries_per_dollar: updates.entriesPerDollar || existingPromo.entries_per_dollar,
        prize_amount: updates.prizeAmount || existingPromo.prize_amount,
        start_date: updates.startDate ? new Date(updates.startDate).toISOString() : existingPromo.start_date,
        end_date: updates.endDate ? new Date(updates.endDate).toISOString() : existingPromo.end_date
      })
      .eq('id', promoId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({
        success: false,
        message: 'Error updating promo',
        error: updateError.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Promo updated successfully',
      data: {
        id: updatedPromo.id,
        title: updatedPromo.title,
        status: updatedPromo.status,
        enablePurchaseEntries: updatedPromo.enable_purchase_entries,
        entriesPerDollar: updatedPromo.entries_per_dollar,
        startDate: updatedPromo.start_date,
        endDate: updatedPromo.end_date,
        updatedAt: updatedPromo.updated_at
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating promo',
      error: error.message
    });
  }
};

// @route   DELETE /api/dashboard/promos/:id
// @desc    Delete a promo
// @access  Private
const deletePromo = async (req, res) => {
  try {
    const userId = req.user.id;
    const promoId = req.params.id;

    // Check if store is already attached from OAuth (Shopify login)
    let store = req.user.store || null;
    
    // If no store attached, query by user_id (regular auth)
    if (!store) {
      // Verify promo belongs to user's store
      const { data: promo, error: verifyError } = await supabase
        .from('promos')
        .select(`
          *,
          stores!inner(user_id)
        `)
        .eq('id', promoId)
        .eq('stores.user_id', userId)
        .single();

      if (verifyError || !promo) {
        return res.status(404).json({
          success: false,
          message: 'Promo not found or you do not have permission to delete it'
        });
      }
    } else {
      // For OAuth users, verify promo belongs to their store
      const { data: promo, error: verifyError } = await supabase
        .from('promos')
        .select('*')
        .eq('id', promoId)
        .eq('store_id', store.id)
        .single();

      if (verifyError || !promo) {
        return res.status(404).json({
          success: false,
          message: 'Promo not found or you do not have permission to delete it'
        });
      }
    }

    // Delete the promo (entries will be cascade deleted by database)
    const { error: deleteError } = await supabase
      .from('promos')
      .delete()
      .eq('id', promoId);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        message: 'Error deleting promo',
        error: deleteError.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Promo deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting promo',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardData,
  createPromo,
  getPromo,
  updatePromo,
  deletePromo
};