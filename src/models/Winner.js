const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
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
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry',
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    default: null
  },
  prizeDescription: {
    type: String,
    required: true
  },
  prizeAmount: {
    type: Number,
    default: 0
  },
  drawnAt: {
    type: Date,
    default: Date.now
  },
  notified: {
    type: Boolean,
    default: false
  },
  notifiedAt: {
    type: Date,
    default: null
  },
  claimed: {
    type: Boolean,
    default: false
  },
  claimedAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Indexes
winnerSchema.index({ promoId: 1 });
winnerSchema.index({ storeId: 1 });
winnerSchema.index({ customerEmail: 1 });
winnerSchema.index({ drawnAt: -1 });

module.exports = mongoose.model('Winner', winnerSchema);
