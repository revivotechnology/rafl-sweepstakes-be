const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  promoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promo',
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  // Customer information (can be hashed for privacy)
  customerEmail: {
    type: String,
    required: true
  },
  hashedEmail: {
    type: String,
    default: null
  },
  customerName: {
    type: String,
    default: null
  },
  // Entry details
  entryCount: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  source: {
    type: String,
    enum: ['klaviyo', 'mailchimp', 'aweber', 'sendgrid', 'amoe', 'purchase', 'direct'],
    default: 'direct'
  },
  // Purchase-related (if applicable)
  orderId: {
    type: String,
    default: null
  },
  orderTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  // Tracking
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  // Consent flags
  consentBrand: {
    type: Boolean,
    default: false
  },
  consentRafl: {
    type: Boolean,
    default: false
  },
  // Additional data
  isManual: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for fast lookups
entrySchema.index({ promoId: 1 });
entrySchema.index({ storeId: 1 });
entrySchema.index({ customerEmail: 1 });
entrySchema.index({ hashedEmail: 1 });
entrySchema.index({ source: 1 });
entrySchema.index({ createdAt: -1 });

// Compound index for preventing duplicate entries
entrySchema.index({ promoId: 1, customerEmail: 1 }, { unique: false });

module.exports = mongoose.model('Entry', entrySchema);
