const { supabase } = require('../config/supabase');
const { createClient } = require('@supabase/supabase-js');
const { getAMOEEntries, calculateEntriesToAdd, getMaxEntriesPerCustomer } = require('../utils/entryUtils');
const emailService = require('../services/emailService');
const crypto = require('crypto');

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

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard data (all stores, entries, winners)
// @access  Private (Admin only)
const getAdminDashboard = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    // Get all stores using admin client (bypasses RLS)
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });

    if (storesError) {
      console.error('Error fetching stores:', storesError);
    }

    // Get all promos using admin client (bypasses RLS)
    const { data: promos, error: promosError } = await supabaseAdmin
      .from('promos')
      .select('*')
      .order('created_at', { ascending: false });

    if (promosError) {
      console.error('Error fetching promos:', promosError);
    }

    // Get all entries using admin client (bypasses RLS)
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
    }

    // Get all winners using admin client (bypasses RLS)
    const { data: winners, error: winnersError } = await supabaseAdmin
      .from('winners')
      .select('*')
      .order('drawn_at', { ascending: false });

    if (winnersError) {
      console.error('Error fetching winners:', winnersError);
    }

    // Calculate admin stats
    const totalStores = stores?.length || 0;
    const totalPromos = promos?.length || 0;
    const totalEntries = entries?.length || 0;
    const totalWinners = winners?.length || 0;
    const activePromos = promos?.filter(p => p.status === 'active').length || 0;
    const uniqueEmails = new Set(entries?.map(e => e.customer_email) || []).size;

    res.status(200).json({
      success: true,
      data: {
        stores: stores || [],
        promos: promos || [],
        entries: entries || [],
        winners: winners || [],
        stats: {
          totalStores,
          totalPromos,
          totalEntries,
          totalWinners,
          activePromos,
          uniqueEmails
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching admin dashboard data',
      error: error.message
    });
  }
};

// @route   POST /api/admin/entries/manual
// @desc    Admin can manually add entries for any promo
// @access  Private (Admin only)
const createAdminManualEntry = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const { email, promoId, source = 'direct' } = req.body;
    const entryCount = 1; // Manual entries are always 1 entry

    if (!email || !promoId) {
      return res.status(400).json({
        success: false,
        message: 'Email and promoId are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if promo exists using admin client
    const { data: promo, error: promoError } = await supabaseAdmin
      .from('promos')
      .select('*')
      .eq('id', promoId)
      .single();

    if (promoError || !promo) {
      console.error('Promo not found:', promoError);
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }


    // Check if promo is active
    const now = new Date();
    const startDate = new Date(promo.start_date);
    const endDate = new Date(promo.end_date);

    if (now < startDate || now > endDate) {
      return res.status(400).json({
        success: false,
        message: 'Promo is not currently active'
      });
    }

    // Hash email for privacy
    const hashedEmail = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');

    // Check for existing entries for this email in this promo using admin client
    const { data: existingEntries, error: existingError } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('promo_id', promoId)
      .eq('hashed_email', hashedEmail);

    if (existingError) {
      console.error('Error checking existing entries:', existingError);
    }

    // Check if customer already has a manual entry for this promo
    if (existingEntries && existingEntries.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Entry already exists for ${email} in this promo. Please use a different email address.`
      });
    }

    // Create entry using admin client
    const entryData = {
      promo_id: promoId,
      store_id: promo.store_id,
      customer_email: email.toLowerCase().trim(),
      hashed_email: hashedEmail,
      entry_count: entryCount,
      source: source,
      order_id: null,
      order_total: 0,
      consent_brand: false,
      consent_rafl: true,
      is_manual: true,
        metadata: {
          created_by: 'admin',
          admin_user_id: req.user.id,
          entry_type: 'admin_manual',
          source: 'admin_manual'
        }
    };

    const { data: entry, error: entryError } = await supabaseAdmin
      .from('entries')
      .insert(entryData)
      .select()
      .single();

    if (entryError) {
      return res.status(500).json({
        success: false,
        message: 'Error creating entry',
        error: entryError.message
      });
    }

    // Send welcome email (don't fail the request if email fails)
    try {
      const promoName = promo.title || promo.name || 'Rafl Sweepstakes';
      await emailService.sendWelcomeEmail(entry.customer_email, promoName, entry.id);
      console.log('Welcome email sent successfully for admin entry:', entry.id);
    } catch (emailError) {
      console.error('Failed to send welcome email for admin entry:', emailError);
      // Don't fail the request for email errors
    }

    res.status(201).json({
      success: true,
      message: 'Manual entry created successfully',
      data: {
        id: entry.id,
        email: entry.customer_email,
        promoId: entry.promo_id,
        entryCount: entry.entry_count,
        source: entry.source,
        createdAt: entry.created_at
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating manual entry',
      error: error.message
    });
  }
};

// @route   GET /api/admin/export/entries/:promoId
// @desc    Export entries for a specific promo as CSV
// @access  Private (Admin only)
const exportEntriesCSV = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const { promoId } = req.params;

    // Get promo details using admin client
    const { data: promo, error: promoError } = await supabaseAdmin
      .from('promos')
      .select('*')
      .eq('id', promoId)
      .single();

    if (promoError || !promo) {
      return res.status(404).json({
        success: false,
        message: 'Promo not found'
      });
    }

    // Get entries for this promo using admin client
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('promo_id', promoId)
      .order('created_at', { ascending: false });

    if (entriesError) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching entries',
        error: entriesError.message
      });
    }

    // Create CSV content
    const csvHeader = 'Email,Entry Count,Source,Order ID,Order Total,Is Manual,Created At\n';
    const csvRows = entries.map(entry => {
      // Format date to be more human-readable without commas to avoid CSV splitting
      const createdDate = new Date(entry.created_at);
      const formattedDate = createdDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).replace(',', '') + ' at ' + createdDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return [
        entry.customer_email,
        entry.entry_count,
        entry.source,
        entry.order_id || '',
        entry.order_total || 0,
        entry.is_manual ? 'Yes' : 'No',
        formattedDate
      ].join(',');
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="entries_${promo.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv"`);

    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting entries',
      error: error.message
    });
  }
};

// @route   GET /api/admin/export/winners
// @desc    Export all winners as CSV
// @access  Private (Admin only)
const exportWinnersCSV = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    // Get all winners with promo and store details using admin client
    const { data: winners, error: winnersError } = await supabaseAdmin
      .from('winners')
      .select(`
        *,
        promos(title, prize_amount),
        stores(store_name, store_url)
      `)
      .order('drawn_at', { ascending: false });

    if (winnersError) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching winners',
        error: winnersError.message
      });
    }

    // Create CSV content
    const csvHeader = 'Winner Email,Winner Name,Store Name,Store URL,Promo Title,Prize Amount,Prize Description,Drawn At\n';
    const csvRows = winners.map(winner => {
      // Format date to be more human-readable without commas to avoid CSV splitting
      const drawnDate = new Date(winner.drawn_at);
      const formattedDate = drawnDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).replace(',', '') + ' at ' + drawnDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return [
        winner.customer_email,
        winner.customer_name || '',
        winner.stores?.store_name || '',
        winner.stores?.store_url || '',
        winner.promos?.title || '',
        `$${winner.promos?.prize_amount || 0}`,
        winner.prize_description || '',
        formattedDate
      ].join(',');
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="winners_${new Date().toISOString().split('T')[0]}.csv"`);

    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting winners',
      error: error.message
    });
  }
};

// @route   POST /api/admin/promos
// @desc    Admin can create promos for any store
// @access  Private (Admin only)
const createAdminPromo = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const {
      store_id,
      title,
      prize_description,
      prize_amount,
      status = 'active',
      start_date,
      end_date,
      max_entries_per_email = 1,
      max_entries_per_ip = 5,
      enable_purchase_entries = true,
      entries_per_dollar = 1,
      rules_text,
      amoe_instructions,
      eligibility_text
    } = req.body;

    // Validate required fields
    if (!store_id || !title || !prize_description || !prize_amount) {
      return res.status(400).json({
        success: false,
        message: 'store_id, title, prize_description, and prize_amount are required'
      });
    }

    // Verify store exists
    const { data: store, error: storeError } = await supabaseAdmin
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

    // Create promo
    const { data: promo, error: promoError } = await supabaseAdmin
      .from('promos')
      .insert({
        store_id,
        title,
        prize_description,
        prize_amount: parseFloat(prize_amount),
        status,
        start_date: start_date || null,
        end_date: end_date || null,
        max_entries_per_email: parseInt(max_entries_per_email),
        max_entries_per_ip: parseInt(max_entries_per_ip),
        enable_purchase_entries,
        entries_per_dollar: parseInt(entries_per_dollar),
        rules_text: rules_text || null,
        amoe_instructions: amoe_instructions || null,
        eligibility_text: eligibility_text || null
      })
      .select()
      .single();

    if (promoError) {
      console.error('Error creating promo:', promoError);
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
        store_id: promo.store_id,
        store_name: store.store_name,
        prize_amount: promo.prize_amount,
        status: promo.status,
        created_at: promo.created_at
      }
    });

  } catch (error) {
    console.error('Create admin promo error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating promo',
      error: error.message
    });
  }
};

module.exports = {
  getAdminDashboard,
  createAdminManualEntry,
  createAdminPromo,
  exportEntriesCSV,
  exportWinnersCSV
};
