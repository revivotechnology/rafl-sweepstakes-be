const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  orderTotal: {
    type: Number,
    required: true,
    min: 0
  },
  entryCount: {
    type: Number,
    required: true,
    min: 1
  },
  entryType: {
    type: String,
    enum: ['purchase', 'amoe'],
    default: 'purchase'
  },
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

module.exports = mongoose.model('Entry', entrySchema);
