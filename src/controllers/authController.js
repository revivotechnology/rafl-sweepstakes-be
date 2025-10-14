const { supabase } = require('../config/supabase');

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

    // Create user with Supabase Auth (with retry logic)
    let authData, authError;
    let retries = 3;
    
    while (retries > 0) {
      try {
        const result = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password,
          options: {
            data: {
              name,
              role: 'merchant',
              isActive: true
            }
          }
        });
        authData = result.data;
        authError = result.error;
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          authError = error;
        } else {
          console.log(`Auth signup retry ${3 - retries + 1}/3...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (authError) {
      if (authError.message.includes('already registered')) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Error creating account',
        error: authError.message
      });
    }

    if (!authData.user) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create user account'
      });
    }

    // Create store for the user
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .insert({
        user_id: authData.user.id,
        store_name: storeName,
        store_url: storeUrl || '',
        subscription_tier: 'free',
        status: 'active'
      })
      .select()
      .single();

    if (storeError) {
      // If store creation fails, we should clean up the user
      console.error('Store creation failed:', storeError);
      return res.status(500).json({
        success: false,
        message: 'Error creating store',
        error: storeError.message
      });
    }

    // Return response
    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: name,
        role: 'merchant',
        emailVerified: false
      },
      store: {
        id: storeData.id,
        storeName: storeData.store_name,
        storeUrl: storeData.store_url,
        subscriptionTier: storeData.subscription_tier,
        status: storeData.status
      },
      session: authData.session
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

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    if (authError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!authData.user) {
      return res.status(401).json({
        success: false,
        message: 'Login failed'
      });
    }

    // Check if user is active
    if (authData.user.user_metadata?.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Account is suspended. Please contact support.'
      });
    }

    // Get user's store
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    // Return response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || authData.user.email,
        role: authData.user.user_metadata?.role || 'merchant',
        emailVerified: !!authData.user.email_confirmed_at
      },
      store: storeData ? {
        id: storeData.id,
        storeName: storeData.store_name,
        storeUrl: storeData.store_url,
        subscriptionTier: storeData.subscription_tier,
        status: storeData.status
      } : null,
      session: authData.session
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
// @desc    Logout user
// @access  Private
const logout = async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Sign out with Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
    }
    
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
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', user.id)
      .single();

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin
      },
      store: storeData ? {
        id: storeData.id,
        storeName: storeData.store_name,
        storeUrl: storeData.store_url,
        subscriptionTier: storeData.subscription_tier,
        status: storeData.status
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

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    res.status(200).json({
      success: true,
      session: data.session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error refreshing token',
      error: error.message
    });
  }
};

module.exports = {
  signup,
  signin,
  logout,
  getCurrentUser,
  refreshToken
};