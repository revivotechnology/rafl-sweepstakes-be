# 🎉 Rafl Sweepstakes Backend

Shopify Giveaway App - Express.js + Supabase

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+ recommended)
- Supabase project (see MIGRATION_GUIDE.md for setup)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Create environment file:**
Create a `.env` file in the root directory:
```bash
NODE_ENV=development
PORT=4000
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

3. **Set up Supabase database:**
```bash
# Navigate to frontend directory and run migrations
cd ../rafl-sweepstakes-fe
npx supabase db push
```

### Running the Application

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:4000`

## 📁 Project Structure

```
rafl-sweepstakes-be/
├── src/
│   ├── config/
│   │   └── supabase.js       # Supabase client configuration
│   ├── controllers/          # Route handlers
│   ├── routes/               # API routes
│   ├── services/             # Business logic
│   ├── middleware/           # Custom middleware
│   ├── utils/                # Helper functions
│   └── server.js             # Express app entry point
├── .env                      # Environment variables (create this)
├── .env.example              # Environment template
├── .gitignore
├── package.json
├── migrate-to-supabase.js    # Data migration script
├── MIGRATION_GUIDE.md        # Migration documentation
└── README.md
```

## 🧪 Test the Setup

After starting the server, test these endpoints:

**Root endpoint:**
```bash
curl http://localhost:4000/
```

**Health check:**
```bash
curl http://localhost:4000/health
```

## 📋 Features

- ✅ **Supabase Integration** - PostgreSQL database with real-time features
- ✅ **Supabase Auth** - Built-in authentication and user management
- ✅ **Shopify OAuth** - Complete Shopify app integration
- ✅ **Webhook Handlers** - Shopify webhook processing
- ✅ **Dashboard APIs** - Merchant dashboard data endpoints
- ✅ **JWT Authentication** - Secure API access
- ✅ **Winner Selection** - Automated winner selection logic

## 🛠️ Technologies

- **Express.js** - Web framework
- **Supabase** - PostgreSQL database with real-time features
- **Supabase Auth** - Authentication and user management
- **dotenv** - Environment configuration
- **nodemon** - Development auto-reload

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 4000 |
| `SUPABASE_URL` | Supabase project URL | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | - |
| `JWT_SECRET` | JWT secret for token signing | - |

## 🐛 Troubleshooting

**Supabase Connection Error:**
- Ensure Supabase project is active
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Verify network connectivity to Supabase

**Authentication Errors:**
- Verify Supabase Auth is properly configured
- Check if user exists in Supabase Auth dashboard
- Ensure JWT token is valid and not expired

**Port Already in Use:**
- Change `PORT` in `.env` to another port (e.g., 5000)
- Or kill the process using port 4000

## 📚 Resources

- [Express.js Docs](https://expressjs.com/)
- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Shopify API Docs](https://shopify.dev/docs/api)
- [Migration Guide](./MIGRATION_GUIDE.md) - Complete migration documentation

