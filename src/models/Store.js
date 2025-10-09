const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storeName: {
    type: String,
    required: true
  },
  storeUrl: {
    type: String,
    required: false,
    default: ''
  },
  subscriptionTier: {
    type: String,
    enum: ['free', 'premium'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  },
  // Shopify-specific fields (optional)
  shopifyDomain: {
    type: String,
    default: null
  },
  shopifyAccessToken: {
    type: String,
    default: null
  },
  shopifyStoreId: {
    type: String,
    default: null
  },
  webhookIds: {
    type: [String],
    default: []
  },
  // Billing
  billingStatus: {
    type: String,
    enum: ['active', 'cancelled', 'past_due'],
    default: 'active'
  },
  installedAt: {
    type: Date,
    default: null
  },
  uninstalledAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
storeSchema.index({ userId: 1 });
storeSchema.index({ shopifyDomain: 1 });

module.exports = mongoose.model('Store', storeSchema);
