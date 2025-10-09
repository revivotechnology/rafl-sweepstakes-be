require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const connectDB = require('./config/database');

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

// Connect to MongoDB
connectDB();

// Import models
const User = require('./models/User');
const Store = require('./models/Store');
const Promo = require('./models/Promo');
const Entry = require('./models/Entry');
const Winner = require('./models/Winner');
const ApiKey = require('./models/ApiKey');

// Import routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const shopifyRoutes = require('./routes/shopifyRoutes');

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
    database: 'connected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', shopifyRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

