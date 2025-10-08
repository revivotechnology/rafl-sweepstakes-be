# 📘 MongoDB Shell Commands Quick Reference

## 🚀 Starting MongoDB Shell

```bash
# Start MongoDB shell
mongosh

# Connect to specific database directly
mongosh rafl-sweepstakes

# Connect with quiet mode (less output)
mongosh --quiet
```

## 📊 Database Commands

### View All Databases
```javascript
show dbs
// or
show databases
```

### Switch to/Use a Specific Database
```javascript
use rafl-sweepstakes
// Output: switched to db rafl-sweepstakes
```

**Note:** The database doesn't need to exist! MongoDB will create it when you insert data.

### Check Current Database
```javascript
db
// Output: rafl-sweepstakes
```

### Delete Current Database
```javascript
db.dropDatabase()
// ⚠️ Be careful with this!
```

## 📦 Collection Commands

### Show All Collections in Current Database
```javascript
show collections
// or
show tables
```

### Create a Collection
```javascript
db.createCollection("stores")
db.createCollection("entries")
db.createCollection("winners")
```

### Drop a Collection
```javascript
db.collectionName.drop()
// Example:
db.test.drop()
```

## 📝 CRUD Operations

### Insert Document
```javascript
// Insert one document
db.stores.insertOne({
  shopDomain: "example.myshopify.com",
  plan: "free",
  installedAt: new Date()
})

// Insert multiple documents
db.entries.insertMany([
  { customerEmail: "user1@example.com", entryCount: 5 },
  { customerEmail: "user2@example.com", entryCount: 10 }
])
```

### Find Documents
```javascript
// Find all documents
db.stores.find()

// Find with pretty formatting
db.stores.find().pretty()

// Find one document
db.stores.findOne()

// Find with filter
db.stores.find({ plan: "free" })

// Find with filter and projection
db.stores.find(
  { plan: "free" },           // filter
  { shopDomain: 1, plan: 1 }  // show only these fields
)
```

### Update Documents
```javascript
// Update one document
db.stores.updateOne(
  { shopDomain: "example.myshopify.com" },  // filter
  { $set: { plan: "pro" } }                 // update
)

// Update many documents
db.stores.updateMany(
  { plan: "free" },
  { $set: { billingStatus: "active" } }
)
```

### Delete Documents
```javascript
// Delete one document
db.stores.deleteOne({ shopDomain: "example.myshopify.com" })

// Delete many documents
db.entries.deleteMany({ createdAt: { $lt: new Date("2025-01-01") } })
```

### Count Documents
```javascript
// Count all documents
db.stores.countDocuments()

// Count with filter
db.entries.countDocuments({ entryType: "purchase" })
```

## 🔍 Useful Query Examples for Our App

### Find all entries for a specific store
```javascript
db.entries.find({ storeId: ObjectId("...") })
```

### Find entries created today
```javascript
db.entries.find({
  createdAt: {
    $gte: new Date(new Date().setHours(0,0,0,0))
  }
})
```

### Get total entry count for a store
```javascript
db.entries.aggregate([
  { $match: { storeId: ObjectId("...") } },
  { $group: { _id: null, total: { $sum: "$entryCount" } } }
])
```

### Find all winners
```javascript
db.winners.find().sort({ drawnAt: -1 })
```

## 🎯 Indexes

### Create Index
```javascript
// Single field index
db.stores.createIndex({ shopDomain: 1 })

// Compound index
db.entries.createIndex({ storeId: 1, createdAt: -1 })

// Unique index
db.stores.createIndex({ shopDomain: 1 }, { unique: true })
```

### View Indexes
```javascript
db.stores.getIndexes()
```

### Drop Index
```javascript
db.stores.dropIndex("indexName")
```

## 🔧 Utility Commands

### Get Database Stats
```javascript
db.stats()
```

### Get Collection Stats
```javascript
db.stores.stats()
```

### Clear Console
```javascript
cls
// or press Ctrl+L
```

### Exit MongoDB Shell
```javascript
exit
// or press Ctrl+D
// or type: quit()
```

## 💡 Practical Workflow Example

```javascript
// 1. Start shell
mongosh

// 2. Switch to your database
use rafl-sweepstakes

// 3. Check what's in it
show collections

// 4. Query data
db.entries.find().limit(10)

// 5. Count documents
db.entries.countDocuments()

// 6. Exit
exit
```

## 🎨 Tips

1. **Tab Completion**: Use TAB key to autocomplete database names, collection names, and commands
2. **Arrow Keys**: Use UP/DOWN arrows to navigate command history
3. **Help**: Type `help` for more commands
4. **Collection Help**: Type `db.collectionName.help()` for collection methods
5. **Pretty Print**: Add `.pretty()` to make output more readable

## 📚 Common Patterns for Our Shopify App

```javascript
// Check if database exists and has data
use rafl-sweepstakes
show collections

// View sample store
db.stores.findOne()

// Count total entries
db.entries.countDocuments()

// Find recent winners
db.winners.find().sort({ drawnAt: -1 }).limit(5)

// Check entries for specific email
db.entries.find({ customerEmail: "test@example.com" })
```

---

**Quick Reference Card:**
```
show dbs              → List all databases
use dbname            → Switch to database
db                    → Show current database
show collections      → List collections
db.coll.find()       → Query collection
exit                  → Quit shell
```

