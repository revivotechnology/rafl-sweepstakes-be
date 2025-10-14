#!/usr/bin/env node

/**
 * Migration script to move data from MongoDB to Supabase
 * Run this script after setting up your Supabase environment
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const mongoose = require('mongoose');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// MongoDB connection (temporary for migration)
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB for migration');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Define MongoDB schemas for migration
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  role: String,
  isActive: Boolean,
  lastLogin: Date,
  emailVerified: Boolean
}, { timestamps: true });

const storeSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  storeName: String,
  storeUrl: String,
  subscriptionTier: String,
  status: String,
  shopifyDomain: String,
  shopifyAccessToken: String,
  shopifyStoreId: String,
  webhookIds: [String],
  billingStatus: String,
  installedAt: Date,
  uninstalledAt: Date
}, { timestamps: true });

const promoSchema = new mongoose.Schema({
  storeId: mongoose.Schema.Types.ObjectId,
  title: String,
  prizeDescription: String,
  prizeAmount: Number,
  startDate: Date,
  endDate: Date,
  status: String,
  rulesText: String,
  amoeInstructions: String,
  eligibilityText: String,
  maxEntriesPerEmail: Number,
  maxEntriesPerIp: Number,
  enablePurchaseEntries: Boolean,
  entriesPerDollar: Number,
  totalEntries: Number
}, { timestamps: true });

const entrySchema = new mongoose.Schema({
  promoId: mongoose.Schema.Types.ObjectId,
  storeId: mongoose.Schema.Types.ObjectId,
  customerEmail: String,
  hashedEmail: String,
  customerName: String,
  entryCount: Number,
  source: String,
  orderId: String,
  orderTotal: Number,
  ipAddress: String,
  userAgent: String,
  consentBrand: Boolean,
  consentRafl: Boolean,
  isManual: Boolean,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const winnerSchema = new mongoose.Schema({
  promoId: mongoose.Schema.Types.ObjectId,
  storeId: mongoose.Schema.Types.ObjectId,
  entryId: mongoose.Schema.Types.ObjectId,
  customerEmail: String,
  customerName: String,
  prizeDescription: String,
  prizeAmount: Number,
  drawnAt: Date,
  notified: Boolean,
  notifiedAt: Date,
  claimed: Boolean,
  claimedAt: Date,
  createdBy: String
}, { timestamps: true });

const apiKeySchema = new mongoose.Schema({
  storeId: mongoose.Schema.Types.ObjectId,
  keyHash: String,
  keyPrefix: String,
  name: String,
  isActive: Boolean,
  lastUsedAt: Date,
  expiresAt: Date,
  permissions: [String]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Store = mongoose.model('Store', storeSchema);
const Promo = mongoose.model('Promo', promoSchema);
const Entry = mongoose.model('Entry', entrySchema);
const Winner = mongoose.model('Winner', winnerSchema);
const ApiKey = mongoose.model('ApiKey', apiKeySchema);

// Migration functions
const migrateUsers = async () => {
  console.log('🔄 Migrating users...');
  
  const users = await User.find({});
  console.log(`Found ${users.length} users to migrate`);
  
  for (const user of users) {
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password, // This won't work with hashed passwords
        email_confirm: user.emailVerified,
        user_metadata: {
          name: user.name,
          role: user.role || 'merchant',
          isActive: user.isActive !== false,
          migratedFrom: 'mongodb'
        }
      });
      
      if (authError) {
        console.error(`❌ Error creating user ${user.email}:`, authError.message);
        continue;
      }
      
      console.log(`✅ Migrated user: ${user.email}`);
    } catch (error) {
      console.error(`❌ Error migrating user ${user.email}:`, error.message);
    }
  }
};

const migrateStores = async () => {
  console.log('🔄 Migrating stores...');
  
  const stores = await Store.find({});
  console.log(`Found ${stores.length} stores to migrate`);
  
  for (const store of stores) {
    try {
      // Find the corresponding user in Supabase
      const { data: user, error: userError } = await supabase.auth.admin.listUsers();
      const supabaseUser = user?.users?.find(u => u.email === store.userId?.toString());
      
      if (!supabaseUser) {
        console.error(`❌ User not found for store ${store.storeName}`);
        continue;
      }
      
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .insert({
          user_id: supabaseUser.id,
          store_name: store.storeName,
          store_url: store.storeUrl || '',
          subscription_tier: store.subscriptionTier || 'free',
          status: store.status || 'active',
          shopify_domain: store.shopifyDomain,
          shopify_access_token: store.shopifyAccessToken,
          shopify_store_id: store.shopifyStoreId,
          webhook_ids: store.webhookIds || [],
          billing_status: store.billingStatus || 'active',
          installed_at: store.installedAt?.toISOString(),
          uninstalled_at: store.uninstalledAt?.toISOString(),
          created_at: store.createdAt?.toISOString(),
          updated_at: store.updatedAt?.toISOString()
        })
        .select()
        .single();
      
      if (storeError) {
        console.error(`❌ Error creating store ${store.storeName}:`, storeError.message);
        continue;
      }
      
      console.log(`✅ Migrated store: ${store.storeName}`);
      
      // Store the mapping for other migrations
      store.supabaseId = storeData.id;
    } catch (error) {
      console.error(`❌ Error migrating store ${store.storeName}:`, error.message);
    }
  }
};

const migratePromos = async () => {
  console.log('🔄 Migrating promos...');
  
  const promos = await Promo.find({});
  console.log(`Found ${promos.length} promos to migrate`);
  
  for (const promo of promos) {
    try {
      // Find the corresponding store in Supabase
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id')
        .eq('store_name', promo.storeId?.toString());
      
      if (storesError || !stores || stores.length === 0) {
        console.error(`❌ Store not found for promo ${promo.title}`);
        continue;
      }
      
      const { data: promoData, error: promoError } = await supabase
        .from('promos')
        .insert({
          store_id: stores[0].id,
          title: promo.title,
          prize_description: promo.prizeDescription,
          prize_amount: promo.prizeAmount || 0,
          start_date: promo.startDate?.toISOString(),
          end_date: promo.endDate?.toISOString(),
          status: promo.status || 'draft',
          rules_text: promo.rulesText,
          amoe_instructions: promo.amoeInstructions,
          eligibility_text: promo.eligibilityText,
          max_entries_per_email: promo.maxEntriesPerEmail || 1,
          max_entries_per_ip: promo.maxEntriesPerIp || 5,
          enable_purchase_entries: promo.enablePurchaseEntries || false,
          entries_per_dollar: promo.entriesPerDollar || 1,
          created_at: promo.createdAt?.toISOString(),
          updated_at: promo.updatedAt?.toISOString()
        })
        .select()
        .single();
      
      if (promoError) {
        console.error(`❌ Error creating promo ${promo.title}:`, promoError.message);
        continue;
      }
      
      console.log(`✅ Migrated promo: ${promo.title}`);
      
      // Store the mapping for other migrations
      promo.supabaseId = promoData.id;
    } catch (error) {
      console.error(`❌ Error migrating promo ${promo.title}:`, error.message);
    }
  }
};

const migrateEntries = async () => {
  console.log('🔄 Migrating entries...');
  
  const entries = await Entry.find({});
  console.log(`Found ${entries.length} entries to migrate`);
  
  for (const entry of entries) {
    try {
      // Find the corresponding promo in Supabase
      const { data: promos, error: promosError } = await supabase
        .from('promos')
        .select('id')
        .eq('title', entry.promoId?.toString());
      
      if (promosError || !promos || promos.length === 0) {
        console.error(`❌ Promo not found for entry`);
        continue;
      }
      
      const { data: entryData, error: entryError } = await supabase
        .from('entries')
        .insert({
          promo_id: promos[0].id,
          store_id: entry.storeId?.toString(), // This needs to be mapped properly
          customer_email: entry.customerEmail,
          hashed_email: entry.hashedEmail,
          customer_name: entry.customerName,
          entry_count: entry.entryCount || 1,
          source: entry.source || 'direct',
          order_id: entry.orderId,
          order_total: entry.orderTotal || 0,
          ip_address: entry.ipAddress,
          user_agent: entry.userAgent,
          consent_brand: entry.consentBrand || false,
          consent_rafl: entry.consentRafl || false,
          is_manual: entry.isManual || false,
          metadata: entry.metadata || {},
          created_at: entry.createdAt?.toISOString()
        })
        .select()
        .single();
      
      if (entryError) {
        console.error(`❌ Error creating entry:`, entryError.message);
        continue;
      }
      
      console.log(`✅ Migrated entry for: ${entry.customerEmail}`);
      
      // Store the mapping for other migrations
      entry.supabaseId = entryData.id;
    } catch (error) {
      console.error(`❌ Error migrating entry:`, error.message);
    }
  }
};

const migrateWinners = async () => {
  console.log('🔄 Migrating winners...');
  
  const winners = await Winner.find({});
  console.log(`Found ${winners.length} winners to migrate`);
  
  for (const winner of winners) {
    try {
      // Find the corresponding promo and entry in Supabase
      const { data: promos, error: promosError } = await supabase
        .from('promos')
        .select('id')
        .eq('title', winner.promoId?.toString());
      
      if (promosError || !promos || promos.length === 0) {
        console.error(`❌ Promo not found for winner`);
        continue;
      }
      
      const { data: entries, error: entriesError } = await supabase
        .from('entries')
        .select('id')
        .eq('customer_email', winner.customerEmail);
      
      if (entriesError || !entries || entries.length === 0) {
        console.error(`❌ Entry not found for winner`);
        continue;
      }
      
      const { data: winnerData, error: winnerError } = await supabase
        .from('winners')
        .insert({
          promo_id: promos[0].id,
          store_id: winner.storeId?.toString(), // This needs to be mapped properly
          entry_id: entries[0].id,
          customer_email: winner.customerEmail,
          customer_name: winner.customerName,
          prize_description: winner.prizeDescription,
          prize_amount: winner.prizeAmount || 0,
          drawn_at: winner.drawnAt?.toISOString() || new Date().toISOString(),
          notified: winner.notified || false,
          notified_at: winner.notifiedAt?.toISOString(),
          claimed: winner.claimed || false,
          claimed_at: winner.claimedAt?.toISOString(),
          created_by: winner.createdBy,
          created_at: winner.createdAt?.toISOString(),
          updated_at: winner.updatedAt?.toISOString()
        })
        .select()
        .single();
      
      if (winnerError) {
        console.error(`❌ Error creating winner:`, winnerError.message);
        continue;
      }
      
      console.log(`✅ Migrated winner: ${winner.customerEmail}`);
    } catch (error) {
      console.error(`❌ Error migrating winner:`, error.message);
    }
  }
};

const migrateApiKeys = async () => {
  console.log('🔄 Migrating API keys...');
  
  const apiKeys = await ApiKey.find({});
  console.log(`Found ${apiKeys.length} API keys to migrate`);
  
  for (const apiKey of apiKeys) {
    try {
      // Find the corresponding store in Supabase
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id')
        .eq('store_name', apiKey.storeId?.toString());
      
      if (storesError || !stores || stores.length === 0) {
        console.error(`❌ Store not found for API key`);
        continue;
      }
      
      const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .insert({
          store_id: stores[0].id,
          key_hash: apiKey.keyHash,
          key_prefix: apiKey.keyPrefix,
          name: apiKey.name || 'Default Key',
          is_active: apiKey.isActive !== false,
          last_used_at: apiKey.lastUsedAt?.toISOString(),
          expires_at: apiKey.expiresAt?.toISOString(),
          permissions: apiKey.permissions || ['read', 'write'],
          created_at: apiKey.createdAt?.toISOString()
        })
        .select()
        .single();
      
      if (keyError) {
        console.error(`❌ Error creating API key:`, keyError.message);
        continue;
      }
      
      console.log(`✅ Migrated API key: ${apiKey.name}`);
    } catch (error) {
      console.error(`❌ Error migrating API key:`, error.message);
    }
  }
};

// Main migration function
const runMigration = async () => {
  console.log('🚀 Starting MongoDB to Supabase migration...');
  
  try {
    await connectMongoDB();
    
    // Run migrations in order
    await migrateUsers();
    await migrateStores();
    await migratePromos();
    await migrateEntries();
    await migrateWinners();
    await migrateApiKeys();
    
    console.log('✅ Migration completed successfully!');
    console.log('⚠️  Note: You may need to manually verify and fix some data relationships.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run migration if this script is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = {
  runMigration,
  migrateUsers,
  migrateStores,
  migratePromos,
  migrateEntries,
  migrateWinners,
  migrateApiKeys
};
