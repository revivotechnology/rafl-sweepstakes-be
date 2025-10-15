const { supabase } = require('../config/supabase');

// Middleware to verify Supabase JWT token or custom OAuth token
const authenticateToken = async (req, res, next) => {
  try {
    console.log(`🔐 Authentication middleware called for ${req.method} ${req.path}`);
    
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log(`❌ No token provided`);
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    console.log(`🔑 Token received: ${token.substring(0, 20)}...`);

    // Try to decode as custom OAuth token first
    try {
      const decodedToken = JSON.parse(Buffer.from(token, 'base64').toString());
      console.log(`🔍 Decoded OAuth token:`, decodedToken);
      
      // Check if it's our custom OAuth token format
      if (decodedToken.storeId && decodedToken.shopDomain && decodedToken.timestamp) {
        console.log(`✅ Valid OAuth token format detected`);
        // Validate token timestamp (expires after 24 hours)
        const tokenAge = Date.now() - decodedToken.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (tokenAge > maxAge) {
          return res.status(401).json({
            success: false,
            message: 'OAuth token has expired. Please re-authenticate.'
          });
        }

        // Verify store exists in database
        console.log(`🔍 Looking up store with ID: ${decodedToken.storeId}`);
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('*')
          .eq('id', decodedToken.storeId)
          .single();

        if (storeError) {
          console.error('Store lookup error:', storeError);
          return res.status(401).json({
            success: false,
            message: 'Store not found or invalid token.',
            error: storeError.message
          });
        }

        if (!store) {
          console.error('Store not found in database');
          return res.status(401).json({
            success: false,
            message: 'Store not found or invalid token.'
          });
        }

        // Attach user/store to request
        req.user = {
          id: store.user_id, // Use the user_id from the store, not the store ID
          email: decodedToken.email,
          role: 'merchant',
          name: decodedToken.storeName,
          emailVerified: true,
          lastLogin: new Date().toISOString(),
          isActive: true,
          store: store
        };

        console.log(`✅ OAuth token authenticated for store: ${decodedToken.storeName}`);
        return next();
      }
    } catch (decodeError) {
      // Not a custom OAuth token, try Supabase JWT
      console.log('Token is not custom OAuth format, trying Supabase JWT...');
    }

    // Verify token with Supabase (original logic)
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found.'
      });
    }

    // Check if user is active (you can add this check based on your user metadata)
    if (user.user_metadata?.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Account is suspended. Please contact support.'
      });
    }

    // Get user's role from user_roles table
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    // Determine user role (prioritize database role over metadata)
    const userRoleFromDB = userRole?.role || user.user_metadata?.role || 'merchant';

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: userRoleFromDB,
      name: user.user_metadata?.name || user.email,
      emailVerified: user.email_confirmed_at ? true : false,
      lastLogin: user.last_sign_in_at,
      isActive: user.user_metadata?.isActive !== false
    };

    console.log(`✅ Supabase JWT authenticated for user: ${user.email} with role: ${userRoleFromDB}`);
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
      error: error.message
    });
  }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};

module.exports = {
  authenticateToken,
  isAdmin
};

