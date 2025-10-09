const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  keyHash: {
    type: String,
    required: true,
    unique: true
  },
  keyPrefix: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    default: 'Default Key'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  permissions: {
    type: [String],
    default: ['read', 'write']
  }
}, {
  timestamps: true
});

// Indexes
apiKeySchema.index({ storeId: 1 });
apiKeySchema.index({ keyHash: 1 });
apiKeySchema.index({ keyPrefix: 1 });
apiKeySchema.index({ isActive: 1 });

module.exports = mongoose.model('ApiKey', apiKeySchema);

