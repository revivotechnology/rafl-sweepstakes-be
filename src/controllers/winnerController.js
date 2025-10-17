const { supabase } = require('../config/supabase');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const emailService = require('../services/emailService');

// Create admin client with service role key that bypasses RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Select a random winner for a promo
 * POST /api/winners/select
 */
const selectWinner = async (req, res) => {
  try {
    const { promoId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!promoId) {
      return res.status(400).json({
        success: false,
        message: 'Promo ID is required'
      });
    }

    // Check if user is admin or has access to this promo
    const userRole = req.user?.role;
    const clientToUse = userRole === 'admin' ? supabaseAdmin : supabase;
    let promo, promoError;

    if (userRole === 'admin') {
      // Admin can access any promo
      console.log('Admin user - querying promo with ID:', promoId);
      const { data, error } = await supabaseAdmin
        .from('promos')
        .select('*')
        .eq('id', promoId)
        .single();
      console.log('Admin promo query result:', { data, error });
      promo = data;
      promoError = error;
    } else {
      // Regular users can only access their own promos
      const { data, error } = await supabase
        .from('promos')
        .select(`
          *,
          stores!inner(user_id)
        `)
        .eq('id', promoId)
        .eq('stores.user_id', userId)
        .single();
      promo = data;
      promoError = error;
    }

    if (promoError || !promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found or access denied'
      });
    }

    // Check if promo is active
    if (promo.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Can only select winners for active promos'
      });
    }

    // Check if there's already a winner for this promo (use admin client for admin users)
    const { data: existingWinner, error: winnerError } = await clientToUse
      .from('winners')
      .select('id')
      .eq('promo_id', promoId)
      .single();

    if (winnerError && winnerError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing winner:', winnerError);
      return res.status(500).json({
        success: false,
        message: 'Error checking existing winner'
      });
    }

    if (existingWinner) {
      return res.status(400).json({
        success: false,
        message: 'Winner has already been selected for this promo'
      });
    }

    // Get all entries for this promo (use admin client for admin users)
    const { data: entries, error: entriesError } = await clientToUse
      .from('entries')
      .select('*')
      .eq('promo_id', promoId);

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return res.status(500).json({
        success: false,
        message: 'Error fetching entries'
      });
    }

    if (!entries || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No entries found for this promo'
      });
    }

    // Create weighted entries array based on entry_count
    const weightedEntries = [];
    entries.forEach(entry => {
      for (let i = 0; i < entry.entry_count; i++) {
        weightedEntries.push(entry);
      }
    });

    if (weightedEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid entries found for this promo'
      });
    }

    // Use cryptographically secure random number generation
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0);
    const randomIndex = randomValue % weightedEntries.length;
    
    const winningEntry = weightedEntries[randomIndex];

    // Create winner record (use admin client for admin users)
    const { data: winner, error: createWinnerError } = await clientToUse
      .from('winners')
      .insert({
        promo_id: promoId,
        store_id: promo.store_id,
        entry_id: winningEntry.id,
        customer_email: winningEntry.customer_email,
        customer_name: winningEntry.customer_name || null,
        prize_description: promo.prize_description,
        prize_amount: promo.prize_amount,
        drawn_at: new Date().toISOString(),
        notified: false,
        claimed: false,
        created_by: userId
      })
      .select()
      .single();

    if (createWinnerError) {
      console.error('Error creating winner:', createWinnerError);
      return res.status(500).json({
        success: false,
        message: 'Error creating winner record'
      });
    }

    // Update promo status to 'ended' (use admin client for admin users)
    const { error: updatePromoError } = await clientToUse
      .from('promos')
      .update({ 
        status: 'ended',
        updated_at: new Date().toISOString()
      })
      .eq('id', promoId);

    if (updatePromoError) {
      console.error('Error updating promo status:', updatePromoError);
      // Don't fail the request for this
    }

    // Send winner notification email (don't fail the request if email fails)
    try {
      await emailService.sendWinnerEmail(
        winner.customer_email, 
        promo.title, 
        winner.prize_description, 
        winner.entry_id
      );
      console.log('Winner email sent successfully for winner:', winner.id);
    } catch (emailError) {
      console.error('Failed to send winner email:', emailError);
      // Don't fail the request for email errors
    }

    // Send admin notification about winner selection
    try {
      await emailService.sendAdminNotification(
        'Winner Selected',
        `A winner has been selected for promo: ${promo.title}`,
        {
          winnerEmail: winner.customer_email,
          winnerName: winner.customer_name,
          prizeDescription: winner.prize_description,
          prizeAmount: winner.prize_amount,
          promoTitle: promo.title,
          totalEntries: entries.length,
          drawnAt: winner.drawn_at
        }
      );
      console.log('Admin notification sent for winner selection');
    } catch (adminEmailError) {
      console.error('Failed to send admin notification:', adminEmailError);
      // Don't fail the request for email errors
    }

    res.status(201).json({
      success: true,
      message: 'Winner selected successfully',
      data: {
        winner: {
          id: winner.id,
          customerEmail: winner.customer_email,
          customerName: winner.customer_name,
          prizeDescription: winner.prize_description,
          prizeAmount: winner.prize_amount,
          drawnAt: winner.drawn_at
        },
        stats: {
          totalEntries: entries.length,
          totalWeightedEntries: weightedEntries.length,
          winningEntryCount: winningEntry.entry_count,
          randomIndex: randomIndex
        }
      }
    });

  } catch (error) {
    console.error('Select winner error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get winners for a specific promo
 * GET /api/winners/:promoId
 */
const getWinnersForPromo = async (req, res) => {
  try {
    const { promoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user is admin or has access to this promo
    const userRole = req.user?.role;
    let promo, promoError;

    if (userRole === 'admin') {
      // Admin can access any promo
      const { data, error } = await supabase
        .from('promos')
        .select('*')
        .eq('id', promoId)
        .single();
      promo = data;
      promoError = error;
    } else {
      // Regular users can only access their own promos
      const { data, error } = await supabase
        .from('promos')
        .select(`
          *,
          stores!inner(user_id)
        `)
        .eq('id', promoId)
        .eq('stores.user_id', userId)
        .single();
      promo = data;
      promoError = error;
    }

    if (promoError || !promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found or access denied'
      });
    }

    // Get winners for this promo
    const { data: winners, error: winnersError } = await supabase
      .from('winners')
      .select('*')
      .eq('promo_id', promoId)
      .order('drawn_at', { ascending: false });

    if (winnersError) {
      console.error('Error fetching winners:', winnersError);
      return res.status(500).json({
        success: false,
        message: 'Error fetching winners'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        promo: {
          id: promo.id,
          title: promo.title,
          status: promo.status
        },
        winners: winners?.map(w => ({
          id: w.id,
          customerEmail: w.customer_email,
          customerName: w.customer_name,
          prizeDescription: w.prize_description,
          prizeAmount: w.prize_amount,
          drawnAt: w.drawn_at,
          notified: w.notified,
          claimed: w.claimed
        })) || []
      }
    });

  } catch (error) {
    console.error('Get winners error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get all winners for a store (admin view)
 * GET /api/winners/store/:storeId
 */
const getWinnersForStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify user has access to this store
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

    // Get all winners for this store
    const { data: winners, error: winnersError } = await supabase
      .from('winners')
      .select(`
        *,
        promos!inner(title, status)
      `)
      .eq('store_id', storeId)
      .order('drawn_at', { ascending: false });

    if (winnersError) {
      console.error('Error fetching winners:', winnersError);
      return res.status(500).json({
        success: false,
        message: 'Error fetching winners'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        store: {
          id: store.id,
          storeName: store.store_name
        },
        winners: winners?.map(w => ({
          id: w.id,
          promoTitle: w.promos.title,
          customerEmail: w.customer_email,
          customerName: w.customer_name,
          prizeDescription: w.prize_description,
          prizeAmount: w.prize_amount,
          drawnAt: w.drawn_at,
          notified: w.notified,
          claimed: w.claimed
        })) || []
      }
    });

  } catch (error) {
    console.error('Get store winners error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update winner notification status
 * PUT /api/winners/:winnerId/notify
 */
const updateWinnerNotification = async (req, res) => {
  try {
    const { winnerId } = req.params;
    const { notified } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify user has access to this winner
    const { data: winner, error: winnerError } = await supabase
      .from('winners')
      .select(`
        *,
        stores!inner(user_id)
      `)
      .eq('id', winnerId)
      .eq('stores.user_id', userId)
      .single();

    if (winnerError || !winner) {
      return res.status(404).json({
        success: false,
        message: 'Winner not found or access denied'
      });
    }

    // Update notification status
    const { data: updatedWinner, error: updateError } = await supabase
      .from('winners')
      .update({
        notified: notified,
        notified_at: notified ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', winnerId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating winner notification:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Error updating winner notification'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Winner notification status updated',
      data: {
        id: updatedWinner.id,
        notified: updatedWinner.notified,
        notifiedAt: updatedWinner.notified_at
      }
    });

  } catch (error) {
    console.error('Update winner notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  selectWinner,
  getWinnersForPromo,
  getWinnersForStore,
  updateWinnerNotification
};
