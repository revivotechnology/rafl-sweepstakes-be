# 🧪 Migration Testing Guide

This guide will help you thoroughly test your MongoDB to Supabase migration to ensure everything is working perfectly.

## 🎯 Testing Overview

We'll test the migration in the following order:
1. **Environment Setup** - Verify configuration
2. **Database Connection** - Test Supabase connectivity
3. **Authentication** - Test user signup/signin
4. **API Endpoints** - Test all backend functionality
5. **Shopify Integration** - Test webhook processing
6. **Data Integrity** - Verify data consistency

## 📋 Pre-Testing Checklist

Before starting tests, ensure:

- [ ] Supabase project is created and active
- [ ] Database migrations are applied (`npx supabase db push`)
- [ ] Environment variables are set correctly
- [ ] Backend dependencies are installed (`npm install`)
- [ ] Frontend is running (for full integration tests)

## 🚀 Step 1: Environment & Connection Testing

### 1.1 Test Backend Startup

```bash
cd rafl-sweepstakes-be
npm run dev
```

**Expected Output:**
```
✅ Supabase connected successfully
Server running on http://localhost:4000
```

**❌ If you see errors:**
- Check your `.env` file has correct `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Verify Supabase project is active
- Check network connectivity

### 1.2 Test Health Endpoint

```bash
curl http://localhost:4000/api/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-01-20T...",
  "database": "supabase"
}
```

### 1.3 Test Root Endpoint

```bash
curl http://localhost:4000/
```

**Expected Response:**
```html
<h1>Rafl Sweepstakes Backend</h1>
```

## 🔐 Step 2: Authentication Testing

### 2.1 Test User Signup

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "name": "Test User",
    "storeName": "Test Store",
    "storeUrl": "https://teststore.com"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Account created successfully. Please check your email to verify your account.",
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "role": "merchant",
    "emailVerified": false
  },
  "store": {
    "id": "uuid-here",
    "storeName": "Test Store",
    "storeUrl": "https://teststore.com",
    "subscriptionTier": "free",
    "status": "active"
  },
  "session": {
    "access_token": "...",
    "refresh_token": "..."
  }
}
```

### 2.2 Test User Signin

```bash
curl -X POST http://localhost:4000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "role": "merchant",
    "emailVerified": false
  },
  "store": {
    "id": "uuid-here",
    "storeName": "Test Store",
    "storeUrl": "https://teststore.com",
    "subscriptionTier": "free",
    "status": "active"
  },
  "session": {
    "access_token": "...",
    "refresh_token": "..."
  }
}
```

### 2.3 Test Protected Endpoint

Save the `access_token` from the signin response and test a protected endpoint:

```bash
# Replace YOUR_ACCESS_TOKEN with the actual token
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "role": "merchant",
    "emailVerified": false,
    "lastLogin": "2025-01-20T..."
  },
  "store": {
    "id": "uuid-here",
    "storeName": "Test Store",
    "storeUrl": "https://teststore.com",
    "subscriptionTier": "free",
    "status": "active"
  }
}
```

## 📊 Step 3: Dashboard API Testing

### 3.1 Test Dashboard Data Retrieval

```bash
curl -X GET http://localhost:4000/api/dashboard \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "store": {
      "id": "uuid-here",
      "storeName": "Test Store",
      "storeUrl": "https://teststore.com",
      "subscriptionTier": "free",
      "status": "active"
    },
    "promos": [],
    "entries": [],
    "winners": [],
    "stats": {
      "totalEntries": 0,
      "uniqueEmails": 0,
      "activePromos": 0,
      "prizePool": 1000
    }
  }
}
```

### 3.2 Test Promo Creation

```bash
curl -X POST http://localhost:4000/api/dashboard/promos \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Giveaway",
    "description": "Test giveaway description",
    "status": "active",
    "enablePurchaseEntries": true,
    "entriesPerDollar": 1,
    "prizeAmount": 100,
    "prizeDescription": "Test prize",
    "startDate": "2025-01-20T00:00:00Z",
    "endDate": "2025-02-20T00:00:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Promo created successfully",
  "data": {
    "id": "uuid-here",
    "title": "Test Giveaway",
    "status": "active",
    "enablePurchaseEntries": true,
    "entriesPerDollar": 1,
    "startDate": "2025-01-20T00:00:00Z",
    "endDate": "2025-02-20T00:00:00Z",
    "createdAt": "2025-01-20T..."
  }
}
```

### 3.3 Test Promo Retrieval

```bash
# Replace PROMO_ID with the actual promo ID from creation
curl -X GET http://localhost:4000/api/dashboard/promos/PROMO_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "promo": {
      "id": "uuid-here",
      "title": "Test Giveaway",
      "prizeDescription": "Test prize",
      "prizeAmount": 100,
      "status": "active",
      "startDate": "2025-01-20T00:00:00Z",
      "endDate": "2025-02-20T00:00:00Z",
      "enablePurchaseEntries": true,
      "entriesPerDollar": 1,
      "createdAt": "2025-01-20T..."
    },
    "entries": []
  }
}
```

## 🛒 Step 4: Shopify Webhook Testing

### 4.1 Test Order Create Webhook

```bash
curl -X POST http://localhost:4000/api/webhooks/orders/create \
  -H "Content-Type: application/json" \
  -H "x-shopify-shop-domain: teststore.myshopify.com" \
  -d '{
    "id": 12345,
    "order_number": "1001",
    "email": "customer@example.com",
    "customer": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "customer@example.com"
    },
    "total_price": "25.00",
    "currency": "USD",
    "created_at": "2025-01-20T10:00:00Z",
    "financial_status": "paid",
    "fulfillment_status": null,
    "line_items": [
      {
        "id": 1,
        "title": "Test Product",
        "quantity": 1,
        "price": "25.00",
        "sku": "TEST-001"
      }
    ],
    "tags": "test, webhook"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Order processed successfully",
  "orderId": "12345",
  "customerEmail": "customer@example.com",
  "entriesCreated": "Yes"
}
```

### 4.2 Test Order Update Webhook

```bash
curl -X POST http://localhost:4000/api/webhooks/orders/updated \
  -H "Content-Type: application/json" \
  -H "x-shopify-shop-domain: teststore.myshopify.com" \
  -d '{
    "id": 12345,
    "order_number": "1001",
    "email": "customer@example.com",
    "total_price": "30.00",
    "currency": "USD",
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T11:00:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Order updated successfully",
  "orderId": "12345"
}
```

## 🗄️ Step 5: Database Verification

### 5.1 Check Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor**
3. Verify the following tables exist and have data:
   - `stores` - Should have your test store
   - `promos` - Should have your test promo
   - `entries` - Should have entries from webhook tests
   - `purchases` - Should have purchase records
   - `winners` - Should be empty initially
   - `api_keys` - Should be empty initially

### 5.2 Verify Data Relationships

Check that:
- Store is linked to the correct user
- Promos are linked to the correct store
- Entries are linked to the correct promo and store
- Purchase records are properly linked

## 🔍 Step 6: Error Handling Testing

### 6.1 Test Invalid Authentication

```bash
curl -X GET http://localhost:4000/api/dashboard \
  -H "Authorization: Bearer invalid-token"
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Invalid token or user not found."
}
```

### 6.2 Test Missing Required Fields

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Please provide all required fields: email, password, name, storeName"
}
```

### 6.3 Test Duplicate User

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "name": "Test User 2",
    "storeName": "Test Store 2"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "User with this email already exists"
}
```

## 🎯 Step 7: Performance Testing

### 7.1 Test Multiple Requests

```bash
# Test concurrent requests
for i in {1..10}; do
  curl -X GET http://localhost:4000/api/health &
done
wait
```

All requests should complete successfully.

### 7.2 Test Large Data Sets

Create multiple promos and entries to test performance:

```bash
# Create 10 promos
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/dashboard/promos \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Test Giveaway $i\",
      \"description\": \"Test giveaway $i description\",
      \"status\": \"active\",
      \"prizeAmount\": $((100 + i))
    }"
done
```

## ✅ Step 8: Integration Testing

### 8.1 Test Frontend Integration

1. Start your frontend application
2. Try to sign up/sign in through the UI
3. Create a promo through the dashboard
4. Verify data appears correctly in the UI

### 8.2 Test End-to-End Flow

1. Create a user account
2. Create a store
3. Create a promo
4. Simulate a Shopify order (webhook)
5. Verify entry is created
6. Check dashboard shows updated data

## 🚨 Troubleshooting Common Issues

### Issue: "Supabase connection error"
**Solution:**
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Verify Supabase project is active
- Check network connectivity

### Issue: "Invalid token or user not found"
**Solution:**
- Ensure you're using the correct access token
- Check if token has expired
- Verify user exists in Supabase Auth

### Issue: "Store not found"
**Solution:**
- Ensure store was created during signup
- Check store exists in Supabase dashboard
- Verify user-store relationship

### Issue: "Webhook processing failed"
**Solution:**
- Check shop domain matches store's shopify_domain
- Verify webhook payload format
- Check Supabase connection

## 📊 Success Criteria

Your migration is successful if:

- [ ] ✅ Backend starts without errors
- [ ] ✅ Health endpoint returns "supabase" database
- [ ] ✅ User signup/signin works
- [ ] ✅ Protected endpoints require authentication
- [ ] ✅ Dashboard data retrieval works
- [ ] ✅ Promo creation/retrieval works
- [ ] ✅ Webhook processing works
- [ ] ✅ Data appears correctly in Supabase dashboard
- [ ] ✅ Error handling works properly
- [ ] ✅ Frontend integration works
- [ ] ✅ Performance is acceptable

## 🎉 Migration Complete!

If all tests pass, your MongoDB to Supabase migration is successful! Your application now has:

- ✅ Unified database in Supabase
- ✅ Built-in authentication
- ✅ Better performance and security
- ✅ Real-time capabilities
- ✅ Simplified architecture

## 📝 Test Results Template

```
Migration Test Results - [DATE]

Environment Setup: ✅/❌
Database Connection: ✅/❌
Authentication: ✅/❌
API Endpoints: ✅/❌
Shopify Integration: ✅/❌
Data Integrity: ✅/❌
Error Handling: ✅/❌
Performance: ✅/❌
Frontend Integration: ✅/❌

Overall Status: ✅ SUCCESS / ❌ NEEDS ATTENTION

Notes:
- [Any issues found]
- [Any recommendations]
```

---

**🎊 Congratulations on completing your migration!** Your application is now running on Supabase with improved performance, security, and maintainability.
