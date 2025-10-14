# Environment Variables Setup

Create a `.env` file in the root of the backend directory with the following variables:

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# JWT Secret (for future authentication)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Shopify Configuration (if needed)
SHOPIFY_API_SECRET=your-shopify-api-secret
```

