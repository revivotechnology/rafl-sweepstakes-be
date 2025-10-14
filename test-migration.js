#!/usr/bin/env node

/**
 * Automated Migration Test Script
 * Tests basic functionality after MongoDB to Supabase migration
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:4000';
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'testpassword123';
const TEST_NAME = 'Test User';
const TEST_STORE = 'Test Store';

let accessToken = null;
let storeId = null;
let promoId = null;

// Test results tracking
const results = {
  environment: false,
  health: false,
  signup: false,
  signin: false,
  dashboard: false,
  promoCreation: false,
  webhook: false
};

// Helper function to make HTTP requests
const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
};

// Test 1: Environment and Health Check
const testHealth = async () => {
  console.log('🔍 Testing health endpoint...');
  
  const result = await makeRequest('GET', '/api/health');
  
  if (result.success && result.data.database === 'supabase') {
    console.log('✅ Health check passed - Supabase connected');
    results.health = true;
    return true;
  } else {
    console.log('❌ Health check failed:', result.error);
    return false;
  }
};

// Test 2: User Signup
const testSignup = async () => {
  console.log('🔍 Testing user signup...');
  
  const signupData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: TEST_NAME,
    storeName: TEST_STORE,
    storeUrl: 'https://teststore.com'
  };
  
  const result = await makeRequest('POST', '/api/auth/signup', signupData);
  
  if (result.success && result.data.user && result.data.store) {
    console.log('✅ User signup successful');
    console.log(`   User ID: ${result.data.user.id}`);
    console.log(`   Store ID: ${result.data.store.id}`);
    storeId = result.data.store.id;
    results.signup = true;
    return true;
  } else {
    console.log('❌ User signup failed:', result.error);
    return false;
  }
};

// Test 3: User Signin
const testSignin = async () => {
  console.log('🔍 Testing user signin...');
  
  const signinData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  };
  
  const result = await makeRequest('POST', '/api/auth/signin', signinData);
  
  if (result.success && result.data.session && result.data.session.access_token) {
    console.log('✅ User signin successful');
    accessToken = result.data.session.access_token;
    results.signin = true;
    return true;
  } else {
    console.log('❌ User signin failed:', result.error);
    return false;
  }
};

// Test 4: Protected Endpoint (Dashboard)
const testDashboard = async () => {
  console.log('🔍 Testing dashboard endpoint...');
  
  if (!accessToken) {
    console.log('❌ No access token available');
    return false;
  }
  
  const result = await makeRequest('GET', '/api/dashboard', null, {
    'Authorization': `Bearer ${accessToken}`
  });
  
  if (result.success && result.data.store) {
    console.log('✅ Dashboard access successful');
    console.log(`   Store: ${result.data.store.storeName}`);
    console.log(`   Promos: ${result.data.promos.length}`);
    results.dashboard = true;
    return true;
  } else {
    console.log('❌ Dashboard access failed:', result.error);
    return false;
  }
};

// Test 5: Promo Creation
const testPromoCreation = async () => {
  console.log('🔍 Testing promo creation...');
  
  if (!accessToken) {
    console.log('❌ No access token available');
    return false;
  }
  
  const promoData = {
    name: 'Test Giveaway',
    description: 'Test giveaway description',
    status: 'active',
    enablePurchaseEntries: true,
    entriesPerDollar: 1,
    prizeAmount: 100,
    prizeDescription: 'Test prize',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  const result = await makeRequest('POST', '/api/dashboard/promos', promoData, {
    'Authorization': `Bearer ${accessToken}`
  });
  
  if (result.success && result.data.id) {
    console.log('✅ Promo creation successful');
    console.log(`   Promo ID: ${result.data.id}`);
    promoId = result.data.id;
    results.promoCreation = true;
    return true;
  } else {
    console.log('❌ Promo creation failed:', result.error);
    return false;
  }
};

// Test 6: Webhook Processing
const testWebhook = async () => {
  console.log('🔍 Testing webhook processing...');
  
  const webhookData = {
    id: 12345,
    order_number: '1001',
    email: 'customer@example.com',
    customer: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'customer@example.com'
    },
    total_price: '25.00',
    currency: 'USD',
    created_at: new Date().toISOString(),
    financial_status: 'paid',
    fulfillment_status: null,
    line_items: [
      {
        id: 1,
        title: 'Test Product',
        quantity: 1,
        price: '25.00',
        sku: 'TEST-001'
      }
    ],
    tags: 'test, webhook'
  };
  
  const result = await makeRequest('POST', '/api/webhooks/orders/create', webhookData, {
    'x-shopify-shop-domain': 'teststore.myshopify.com'
  });
  
  if (result.success) {
    console.log('✅ Webhook processing successful');
    console.log(`   Order ID: ${result.data.orderId}`);
    results.webhook = true;
    return true;
  } else {
    console.log('❌ Webhook processing failed:', result.error);
    return false;
  }
};

// Test 7: Error Handling
const testErrorHandling = async () => {
  console.log('🔍 Testing error handling...');
  
  // Test invalid token
  const result = await makeRequest('GET', '/api/dashboard', null, {
    'Authorization': 'Bearer invalid-token'
  });
  
  if (!result.success && result.status === 401) {
    console.log('✅ Error handling working correctly');
    return true;
  } else {
    console.log('❌ Error handling failed');
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Migration Tests...\n');
  
  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Server is running\n');
  } catch (error) {
    console.log('❌ Server is not running. Please start the server with: npm run dev\n');
    process.exit(1);
  }
  
  // Run tests in sequence
  const tests = [
    { name: 'Health Check', fn: testHealth },
    { name: 'User Signup', fn: testSignup },
    { name: 'User Signin', fn: testSignin },
    { name: 'Dashboard Access', fn: testDashboard },
    { name: 'Promo Creation', fn: testPromoCreation },
    { name: 'Webhook Processing', fn: testWebhook },
    { name: 'Error Handling', fn: testErrorHandling }
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) passedTests++;
    } catch (error) {
      console.log(`❌ ${test.name} failed with error:`, error.message);
    }
    console.log(''); // Add spacing
  }
  
  // Print results summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${tests.length - passedTests}`);
  console.log('');
  
  // Detailed results
  console.log('Detailed Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
  });
  
  console.log('');
  
  if (passedTests === tests.length) {
    console.log('🎉 All tests passed! Migration is successful!');
    console.log('');
    console.log('✅ Your MongoDB to Supabase migration is working perfectly!');
    console.log('✅ Authentication system is functional');
    console.log('✅ Database operations are working');
    console.log('✅ API endpoints are responding correctly');
    console.log('✅ Webhook processing is operational');
    console.log('');
    console.log('🚀 You can now:');
    console.log('   - Use the application normally');
    console.log('   - Create users and stores');
    console.log('   - Manage giveaways and entries');
    console.log('   - Process Shopify webhooks');
    console.log('   - Access the dashboard');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.');
    console.log('');
    console.log('🔧 Troubleshooting tips:');
    console.log('   1. Check your .env file has correct Supabase credentials');
    console.log('   2. Ensure Supabase project is active');
    console.log('   3. Verify database migrations are applied');
    console.log('   4. Check server logs for detailed error messages');
    console.log('   5. Review the TESTING_GUIDE.md for manual testing steps');
  }
  
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Test the frontend integration');
  console.log('   2. Verify data in Supabase dashboard');
  console.log('   3. Test with real Shopify webhooks');
  console.log('   4. Monitor performance and error rates');
};

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testHealth,
  testSignup,
  testSignin,
  testDashboard,
  testPromoCreation,
  testWebhook,
  testErrorHandling
};
