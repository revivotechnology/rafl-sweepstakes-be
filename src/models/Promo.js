const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  prizeDescription: {
    type: String,
    required: true
  },
  prizeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'ended'],
    default: 'draft'
  },
  rulesText: {
    type: String,
    default: ''
  },
  amoeInstructions: {
    type: String,
    default: ''
  },
  eligibilityText: {
    type: String,
    default: ''
  },
  maxEntriesPerEmail: {
    type: Number,
    default: 1,
    min: 1
  },
  maxEntriesPerIp: {
    type: Number,
    default: 5,
    min: 1
  },
  enablePurchaseEntries: {
    type: Boolean,
    default: false
  },
  entriesPerDollar: {
    type: Number,
    default: 1,
    min: 1
  },
  totalEntries: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
promoSchema.index({ storeId: 1 });
promoSchema.index({ status: 1 });
promoSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Promo', promoSchema);

