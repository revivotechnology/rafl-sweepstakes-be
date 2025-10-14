require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { testConnection } = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());

// Session middleware for OAuth state management
app.use(session({
  secret: process.env.JWT_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Test Supabase connection
testConnection();

// Import routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const shopifyRoutes = require('./routes/shopifyRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// Routes
app.get('/', (req, res) => {
  res.send('<h1>Rafl Sweepstakes Backend</h1>');
});

// Health check endpoint (keep for monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: 'supabase'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', shopifyRoutes);
app.use('/api/webhooks', webhookRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

