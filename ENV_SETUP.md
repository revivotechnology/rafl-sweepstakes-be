# Environment Variables Setup

Create a `.env` file in the root of the backend directory with the following variables:

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/rafl-sweepstakes

# JWT Secret (for future authentication)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

