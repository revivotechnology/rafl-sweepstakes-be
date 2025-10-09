const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Store = require('../models/Store');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};

// @route   POST /api/auth/signup
// @desc    Register a new merchant user
// @access  Public
const signup = async (req, res) => {
  try {
    const { email, password, name, storeName, storeUrl } = req.body;

    // Validate input
    if (!email || !password || !name || !storeName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: email, password, name, storeName'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'merchant',
      emailVerified: false
    });

    // Create store for the user
    const store = await Store.create({
      userId: user._id,
      storeName,
      storeUrl: storeUrl || '',
      subscriptionTier: 'free',
      status: 'active'
    });

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Return response (don't send password)
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified
      },
      store: {
        id: store._id,
        storeName: store.storeName,
        storeUrl: store.storeUrl,
        subscriptionTier: store.subscriptionTier,
        status: store.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating account',
      error: error.message
    });
  }
};

// @route   POST /api/auth/signin
// @desc    Login user
// @access  Public
const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is suspended. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Get user's store
    const store = await Store.findOne({ userId: user._id });

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Return response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified
      },
      store: store ? {
        id: store._id,
        storeName: store.storeName,
        storeUrl: store.storeUrl,
        subscriptionTier: store.subscriptionTier,
        status: store.status
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
const logout = async (req, res) => {
  try {
    // Since we're using JWT, logout is handled client-side by removing the token
    // But we can log the logout event here if needed
    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message
    });
  }
};

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
const getCurrentUser = async (req, res) => {
  try {
    // req.user is set by authenticateToken middleware
    const user = req.user;

    // Get user's store
    const store = await Store.findOne({ userId: user._id });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin
      },
      store: store ? {
        id: store._id,
        storeName: store.storeName,
        storeUrl: store.storeUrl,
        subscriptionTier: store.subscriptionTier,
        status: store.status
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
};

module.exports = {
  signup,
  signin,
  logout,
  getCurrentUser
};

