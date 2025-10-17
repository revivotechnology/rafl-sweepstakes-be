const { supabase } = require('../config/supabase');
const crypto = require('crypto');
const emailService = require('../services/emailService');

/**
 * Create manual entry (No Purchase Necessary)
 * POST /api/entries/manual
 */
const createManualEntry = async (req, res) => {
  try {
    const { email, promoId, source = 'direct', consentBrand = false, consentRafl = true } = req.body;

    // Validate required fields
    if (!email || !promoId) {
      return res.status(400).json({
        success: false,
        message: 'Email and promo ID are required'
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

    // Get promo details and verify it's active
    const { data: promo, error: promoError } = await supabase
      .from('promos')
      .select('*')
      .eq('id', promoId)
      .eq('status', 'active')
      .single();

    if (promoError || !promo) {
      return res.status(404).json({
        success: false,
        message: 'Active promo not found'
      });
    }

    // Check if promo is within date range
    const now = new Date();
    const startDate = promo.start_date ? new Date(promo.start_date) : null;
    const endDate = promo.end_date ? new Date(promo.end_date) : null;

    if (startDate && now < startDate) {
      return res.status(400).json({
        success: false,
        message: 'Promo has not started yet'
      });
    }

    if (endDate && now > endDate) {
      return res.status(400).json({
        success: false,
        message: 'Promo has ended'
      });
    }

    // Hash email for privacy
    const hashedEmail = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');

    // Check for existing entries from this email
    const { data: existingEntries, error: entriesError } = await supabase
      .from('entries')
      .select('id, entry_count, source, created_at')
      .eq('promo_id', promoId)
      .eq('hashed_email', hashedEmail);

    if (entriesError) {
      console.error('Error checking existing entries:', entriesError);
      return res.status(500).json({
        success: false,
        message: 'Error checking existing entries'
      });
    }

    // Check entry limits
    const currentEntryCount = existingEntries?.length || 0;
    const maxEntriesPerEmail = promo.max_entries_per_email || 1;

    if (currentEntryCount >= maxEntriesPerEmail) {
      return res.status(400).json({
        success: false,
        message: `Maximum entries per email reached (${maxEntriesPerEmail})`,
        currentEntries: currentEntryCount,
        maxEntries: maxEntriesPerEmail,
        lastEntryDate: existingEntries?.[0]?.created_at
      });
    }

    // Get client IP and user agent
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Check IP-based entry limits (if provided)
    const maxEntriesPerIp = promo.max_entries_per_ip || 5;
    if (ipAddress && ipAddress !== 'unknown') {
      const { data: ipEntries, error: ipError } = await supabase
        .from('entries')
        .select('id')
        .eq('promo_id', promoId)
        .contains('metadata', { ip_address: ipAddress });

      if (ipError) {
        console.error('Error checking IP entries:', ipError);
      } else if (ipEntries && ipEntries.length >= maxEntriesPerIp) {
        return res.status(400).json({
          success: false,
          message: `Maximum entries per IP address reached (${maxEntriesPerIp})`,
          currentIpEntries: ipEntries.length,
          maxIpEntries: maxEntriesPerIp
        });
      }
    }

    // Create entry
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        promo_id: promoId,
        store_id: promo.store_id,
        customer_email: email.toLowerCase().trim(),
        hashed_email: hashedEmail,
        entry_count: 1, // Manual entries are always 1 entry
        source: source,
        order_id: null,
        order_total: 0,
        consent_brand: consentBrand,
        consent_rafl: consentRafl,
        is_manual: true,
        metadata: {
          ip_address: ipAddress,
          user_agent: userAgent,
          entry_type: 'manual',
          created_via: 'waitlist_form'
        }
      })
      .select()
      .single();

    if (entryError) {
      console.error('Error creating entry:', entryError);
      return res.status(500).json({
        success: false,
        message: 'Error creating entry',
        error: entryError.message
      });
    }

    // Create consent log
    const { error: consentError } = await supabase
      .from('consent_logs')
      .insert({
        entry_id: entry.id,
        consent_brand: consentBrand,
        consent_rafl: consentRafl,
        consent_text: `Manual entry via ${source}`,
        ip_address: ipAddress,
        user_agent: userAgent
      });

    if (consentError) {
      console.error('Error creating consent log:', consentError);
      // Don't fail the request for consent log errors
    }

    // Also add to waitlist if not already there
    const { error: waitlistError } = await supabase
      .from('waitlist')
      .insert({
        email: email.toLowerCase().trim(),
        source: source,
        utm_source: 'organic',
        utm_campaign: 'manual_entry'
      })
      .select()
      .single();

    if (waitlistError && waitlistError.code !== '23505') {
      // 23505 is unique constraint violation (already in waitlist)
      console.error('Error adding to waitlist:', waitlistError);
      // Don't fail the request for waitlist errors
    }

    // Send welcome email (don't fail the request if email fails)
    try {
      const promoName = promo.title || promo.name || 'Rafl Sweepstakes';
      await emailService.sendWelcomeEmail(email.toLowerCase().trim(), promoName, entry.id);
      console.log('Welcome email sent successfully for entry:', entry.id);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the request for email errors
    }

    res.status(201).json({
      success: true,
      message: 'Entry created successfully',
      data: {
        entryId: entry.id,
        promoId: promoId,
        email: email.toLowerCase().trim(),
        entryCount: 1,
        source: source,
        createdAt: entry.created_at
      }
    });

  } catch (error) {
    console.error('Manual entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get entries for a specific promo
 * GET /api/entries/:promoId
 */
const getEntriesForPromo = async (req, res) => {
  try {
    const { promoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify user has access to this promo
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
        message: 'Promo not found or access denied'
      });
    }

    // Get entries for this promo
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('*')
      .eq('promo_id', promoId)
      .order('created_at', { ascending: false });

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return res.status(500).json({
        success: false,
        message: 'Error fetching entries'
      });
    }

    // Calculate stats
    const totalEntries = entries?.length || 0;
    const uniqueEmails = new Set(entries?.map(e => e.customer_email)).size;
    const manualEntries = entries?.filter(e => e.is_manual).length || 0;
    const purchaseEntries = entries?.filter(e => e.source === 'purchase').length || 0;

    res.status(200).json({
      success: true,
      data: {
        promo: {
          id: promo.id,
          title: promo.title,
          status: promo.status,
          startDate: promo.start_date,
          endDate: promo.end_date
        },
        entries: entries?.map(e => ({
          id: e.id,
          email: e.customer_email,
          entryCount: e.entry_count,
          source: e.source,
          isManual: e.is_manual,
          createdAt: e.created_at
        })) || [],
        stats: {
          totalEntries,
          uniqueEmails,
          manualEntries,
          purchaseEntries
        }
      }
    });

  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get all active promos for manual entry
 * GET /api/entries/active-promos
 */
const getActivePromos = async (req, res) => {
  try {
    const { data: promos, error: promosError } = await supabase
      .from('promos')
      .select(`
        id,
        title,
        prize_description,
        prize_amount,
        start_date,
        end_date,
        max_entries_per_email,
        stores!inner(store_name)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (promosError) {
      console.error('Error fetching active promos:', promosError);
      return res.status(500).json({
        success: false,
        message: 'Error fetching active promos'
      });
    }

    // Filter promos that are within date range
    const now = new Date();
    const activePromos = promos?.filter(promo => {
      const startDate = promo.start_date ? new Date(promo.start_date) : null;
      const endDate = promo.end_date ? new Date(promo.end_date) : null;
      
      return (!startDate || now >= startDate) && (!endDate || now <= endDate);
    }) || [];

    res.status(200).json({
      success: true,
      data: {
        promos: activePromos.map(promo => ({
          id: promo.id,
          title: promo.title,
          prizeDescription: promo.prize_description,
          prizeAmount: promo.prize_amount,
          storeName: promo.stores.store_name,
          maxEntriesPerEmail: promo.max_entries_per_email,
          startDate: promo.start_date,
          endDate: promo.end_date
        }))
      }
    });

  } catch (error) {
    console.error('Get active promos error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Create waitlist entry and send welcome email
 * POST /api/entries/waitlist
 */
const createWaitlistEntry = async (req, res) => {
  try {
    const { email, source = 'website', utm_source = 'organic', utm_campaign = 'october_2025_beta' } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
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

    // Add to waitlist (this will handle duplicates gracefully)
    const { error: waitlistError } = await supabase
      .from('waitlist')
      .insert([
        {
          email: email.toLowerCase().trim(),
          source: source,
          utm_source: utm_source,
          utm_campaign: utm_campaign
        }
      ]);

    if (waitlistError && waitlistError.code !== '23505') {
      // 23505 is unique constraint violation (already in waitlist)
      console.error('Error adding to waitlist:', waitlistError);
      return res.status(500).json({
        success: false,
        message: 'Error adding to waitlist',
        error: waitlistError.message
      });
    }

    // Send waitlist welcome email (don't fail the request if email fails)
    try {
      await emailService.sendWaitlistWelcomeEmail(email.toLowerCase().trim());
      console.log('Waitlist welcome email sent successfully for:', email);
    } catch (emailError) {
      console.error('Failed to send waitlist welcome email:', emailError);
      // Don't fail the request for email errors
    }

    res.status(201).json({
      success: true,
      message: 'Successfully added to waitlist',
      data: {
        email: email.toLowerCase().trim(),
        source: source,
        utm_source: utm_source,
        utm_campaign: utm_campaign
      }
    });

  } catch (error) {
    console.error('Waitlist entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createManualEntry,
  createWaitlistEntry,
  getEntriesForPromo,
  getActivePromos
};
