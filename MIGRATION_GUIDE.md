# MongoDB to Supabase Migration Guide

This guide will help you migrate your Rafl Sweepstakes backend from MongoDB to Supabase.

## 🎯 Migration Overview

The migration involves:
- ✅ **Schema Migration**: All MongoDB models have been mapped to Supabase tables
- ✅ **Authentication Migration**: Custom JWT auth replaced with Supabase Auth
- ✅ **Controller Migration**: All controllers updated to use Supabase client
- ✅ **Webhook Migration**: Shopify webhooks now use Supabase exclusively

## 📋 Prerequisites

1. **Supabase Project Setup**
   - Create a new Supabase project
   - Get your project URL and service role key
   - Run the database migrations in the frontend folder

2. **Environment Variables**
   - Update your `.env` file with Supabase credentials
   - Remove MongoDB connection string

## 🚀 Migration Steps

### Step 1: Update Dependencies

```bash
cd rafl-sweepstakes-be
npm install @supabase/supabase-js
npm uninstall mongoose
```

### Step 2: Run Database Migrations

```bash
cd ../rafl-sweepstakes-fe
npx supabase db push
```

This will create all the necessary tables in Supabase.

### Step 3: Update Environment Variables

Update your `.env` file:

```env
# Remove MongoDB
# MONGODB_URI=mongodb://localhost:27017/rafl-sweepstakes

# Add Supabase
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### Step 4: Migrate Existing Data (Optional)

If you have existing data in MongoDB, run the migration script:

```bash
node migrate-to-supabase.js
```

**⚠️ Important Notes:**
- This script requires both MongoDB and Supabase to be accessible
- Review the migration script before running
- Test with a small dataset first
- Some data relationships may need manual verification

### Step 5: Test the Migration

1. **Start the backend server:**
   ```bash
   npm run dev
   ```

2. **Test authentication:**
   - Try signing up a new user
   - Try signing in with existing credentials

3. **Test API endpoints:**
   - Dashboard data retrieval
   - Promo creation/updates
   - Webhook handling

## 🔄 What Changed

### Database Layer
- **Before**: MongoDB with Mongoose ODM
- **After**: Supabase (PostgreSQL) with direct client calls

### Authentication
- **Before**: Custom JWT with MongoDB user storage
- **After**: Supabase Auth with built-in user management

### Controllers
- **Before**: Mongoose model operations
- **After**: Supabase client queries with proper error handling

### Webhooks
- **Before**: MongoDB storage with forwarding to Supabase
- **After**: Direct Supabase storage (already implemented)

## 📊 Schema Mapping

| MongoDB Model | Supabase Table | Notes |
|---------------|----------------|-------|
| User | auth.users | Handled by Supabase Auth |
| Store | stores | Enhanced with Shopify fields |
| Promo | promos | Direct mapping |
| Entry | entries | Enhanced with additional fields |
| Winner | winners | New table created |
| ApiKey | api_keys | Direct mapping |

## 🛠️ Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify Supabase URL and service role key
   - Check if user exists in Supabase Auth
   - Ensure JWT token is valid

2. **Database Connection Issues**
   - Verify Supabase project is active
   - Check network connectivity
   - Verify service role key permissions

3. **Migration Script Issues**
   - Ensure MongoDB is still accessible
   - Check data types and constraints
   - Verify foreign key relationships

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

## 🔒 Security Considerations

1. **Service Role Key**
   - Keep your service role key secure
   - Never commit it to version control
   - Use environment variables

2. **Row Level Security (RLS)**
   - All tables have RLS enabled
   - Policies ensure users can only access their own data
   - Review and test RLS policies

3. **API Keys**
   - API keys are now stored in Supabase
   - Proper hashing and validation
   - Expiration and permission management

## 📈 Performance Benefits

- **Better Query Performance**: PostgreSQL with proper indexing
- **Real-time Features**: Supabase real-time subscriptions
- **Built-in Caching**: Supabase handles query optimization
- **Connection Pooling**: Automatic connection management

## 🎉 Post-Migration

After successful migration:

1. **Remove MongoDB Dependencies**
   ```bash
   npm uninstall mongoose
   rm -rf src/models
   rm src/config/database.js
   ```

2. **Update Documentation**
   - Update API documentation
   - Update deployment guides
   - Update environment setup guides

3. **Monitor Performance**
   - Check query performance
   - Monitor error rates
   - Verify webhook processing

## 🆘 Support

If you encounter issues during migration:

1. Check the Supabase dashboard for errors
2. Review the migration logs
3. Test individual components
4. Verify environment variables
5. Check network connectivity

## 📝 Migration Checklist

- [ ] Supabase project created and configured
- [ ] Database migrations applied
- [ ] Environment variables updated
- [ ] Dependencies updated
- [ ] Data migration completed (if needed)
- [ ] Authentication tested
- [ ] API endpoints tested
- [ ] Webhook functionality verified
- [ ] Performance monitoring setup
- [ ] Documentation updated

---

**🎊 Congratulations!** Your backend has been successfully migrated to Supabase!
