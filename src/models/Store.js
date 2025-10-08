const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  shopDomain: {
    type: String,
    required: true,
    unique: true
  },
  accessToken: {
    type: String,
    required: true
  },
  shopifyStoreId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  plan: {
    type: String,
    enum: ['free', 'paid'],
    default: 'free'
  },
  billingStatus: {
    type: String,
    enum: ['active', 'cancelled', 'past_due'],
    default: 'active'
  },
  webhookIds: [String],
  installedAt: {
    type: Date,
    default: Date.now
  },
  uninstalledAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Store', storeSchema);
