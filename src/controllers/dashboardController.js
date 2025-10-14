const { supabase } = require('../config/supabase');

// @route   GET /api/dashboard
// @desc    Get dashboard data for authenticated user
// @access  Private
const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get user's store - prefer Shopify-connected store if available
    let { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .not('shopify_domain', 'is', null)
      .not('shopify_access_token', 'is', null)
      .single();
    
    // If no Shopify-connected store, get any store
    if (storeError || !store) {
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
    }

    // Get promos for this store
    const { data: promos, error: promosError } = await supabase
      .from('promos')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false });

    if (promosError) {
      console.error('Error fetching promos:', promosError);
    }

    // Get entries for all promos
    const promoIds = promos?.map(p => p.id) || [];
    let entries = [];
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

    // Calculate stats
    const totalEntries = entries.length;
    const uniqueEmails = new Set(entries.map(e => e.customer_email)).size;
    const activePromos = promos?.filter(p => p.status === 'active').length || 0;

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
          totalEntries: 0, // This would need to be calculated from entries
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
          prizePool: store.subscription_tier === 'premium' ? 8500 : 1000
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
    
    // Get user's store - prefer Shopify-connected store if available
    let { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .not('shopify_domain', 'is', null)
      .not('shopify_access_token', 'is', null)
      .single();
    
    // If no Shopify-connected store, get any store
    if (storeError || !store) {
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

module.exports = {
  getDashboardData,
  createPromo,
  getPromo,
  updatePromo
};