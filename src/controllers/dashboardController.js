const Store = require('../models/Store');
const Promo = require('../models/Promo');
const Entry = require('../models/Entry');
const Winner = require('../models/Winner');

// @route   GET /api/dashboard
// @desc    Get dashboard data for authenticated user
// @access  Private
const getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Get user's store - prefer Shopify-connected store if available
    let store = await Store.findOne({ 
      userId,
      shopifyDomain: { $ne: null },
      shopifyAccessToken: { $ne: null }
    });
    
    // If no Shopify-connected store, get any store
    if (!store) {
      store = await Store.findOne({ userId });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Get promos for this store
    const promos = await Promo.find({ storeId: store._id })
      .sort({ createdAt: -1 });

    // Get entries for all promos
    const promoIds = promos.map(p => p._id);
    const entries = await Entry.find({ promoId: { $in: promoIds } })
      .sort({ createdAt: -1 });

    // Get winners
    const winners = await Winner.find({ storeId: store._id })
      .sort({ drawnAt: -1 });

    // Calculate stats
    const totalEntries = entries.length;
    const uniqueEmails = new Set(entries.map(e => e.customerEmail)).size;
    const activePromos = promos.filter(p => p.status === 'active').length;

    res.status(200).json({
      success: true,
      data: {
        store: {
          id: store._id,
          storeName: store.storeName,
          storeUrl: store.storeUrl,
          subscriptionTier: store.subscriptionTier,
          status: store.status
        },
        promos: promos.map(p => ({
          id: p._id,
          title: p.title,
          prizeAmount: p.prizeAmount,
          status: p.status,
          totalEntries: p.totalEntries || 0,
          startDate: p.startDate,
          endDate: p.endDate,
          createdAt: p.createdAt
        })),
        entries: entries.map(e => ({
          id: e._id,
          email: e.customerEmail,
          entryCount: e.entryCount,
          source: e.source,
          createdAt: e.createdAt
        })),
        winners: winners.map(w => ({
          id: w._id,
          customerEmail: w.customerEmail,
          customerName: w.customerName,
          prizeDescription: w.prizeDescription,
          drawnAt: w.drawnAt
        })),
        stats: {
          totalEntries,
          uniqueEmails,
          activePromos,
          prizePool: store.subscriptionTier === 'premium' ? 8500 : 1000
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
    const userId = req.user._id;
    
    // Get user's store - prefer Shopify-connected store if available
    let store = await Store.findOne({ 
      userId,
      shopifyDomain: { $ne: null },
      shopifyAccessToken: { $ne: null }
    });
    
    // If no Shopify-connected store, get any store
    if (!store) {
      store = await Store.findOne({ userId });
    }
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
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
    const promo = new Promo({
      storeId: store._id,
      title: name,
      description: description || '',
      status,
      enablePurchaseEntries,
      entriesPerDollar,
      prizeAmount,
      prizeDescription,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });
    
    await promo.save();
    
    res.status(201).json({
      success: true,
      message: 'Promo created successfully',
      data: {
        id: promo._id,
        title: promo.title,
        status: promo.status,
        enablePurchaseEntries: promo.enablePurchaseEntries,
        entriesPerDollar: promo.entriesPerDollar,
        startDate: promo.startDate,
        endDate: promo.endDate,
        createdAt: promo.createdAt
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

module.exports = {
  getDashboardData,
  createPromo
};

