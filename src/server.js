require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// Connect to MongoDB
connectDB();

// Import models
const Store = require('./models/Store');
const Entry = require('./models/Entry');
const Winner = require('./models/Winner');

// Routes
app.get('/', (req, res) => {
  res.send('<h1>Rafl Sweepstakes Backend</h1>');
});

// Test models route
app.get('/test-models', (req, res) => {
  res.json({
    message: 'Models loaded successfully',
    models: ['Store', 'Entry', 'Winner']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

