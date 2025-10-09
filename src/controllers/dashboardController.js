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

    // Get user's store
    const store = await Store.findOne({ userId });

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

module.exports = {
  getDashboardData
};

