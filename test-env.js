#!/usr/bin/env node

/**
 * Environment Test Script
 * Tests your environment variables and network connectivity
 */

require('dotenv').config();
const shopifyApi = require('./src/services/shopifyApiService');

async function testEnvironment() {
  console.log('🧪 Testing Environment Setup...\n');

  // Test 1: Environment Variables
  console.log('1️⃣ Testing Environment Variables:');
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'SHOPIFY_CLIENT_ID',
    'SHOPIFY_CLIENT_SECRET',
    'SHOPIFY_REDIRECT_URI'
  ];

  let envVarsOk = true;
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar] && !process.env[envVar].includes('your-')) {
      console.log(`   ✅ ${envVar}: Set`);
    } else {
      console.log(`   ❌ ${envVar}: Missing or not configured`);
      envVarsOk = false;
    }
  }

  if (!envVarsOk) {
    console.log('\n⚠️  Please configure your environment variables in .env file');
    console.log('   Get your Shopify credentials from: https://partners.shopify.com/');
    console.log('   Get your Supabase credentials from: https://supabase.com/dashboard');
    return;
  }

  // Test 2: Network Connectivity
  console.log('\n2️⃣ Testing Network Connectivity:');
  const testShop = 'rafl-dev.myshopify.com';
  const connectivityTest = await shopifyApi.testConnectivity(testShop);
  
  if (connectivityTest.success) {
    console.log(`   ✅ Network connectivity to ${testShop}: Working`);
  } else {
    console.log(`   ❌ Network connectivity to ${testShop}: Failed`);
    console.log(`   Error: ${connectivityTest.error}`);
    console.log('\n   Possible solutions:');
    console.log('   - Check your internet connection');
    console.log('   - Check if your firewall is blocking HTTPS connections');
    console.log('   - Try using a different network (mobile hotspot)');
    console.log('   - Check if your ISP is blocking Shopify domains');
  }

  // Test 3: Supabase Connection
  console.log('\n3️⃣ Testing Supabase Connection:');
  try {
    const { supabase } = require('./src/config/supabase');
    const { data, error } = await supabase
      .from('stores')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(`   ❌ Supabase connection failed: ${error.message}`);
    } else {
      console.log('   ✅ Supabase connection: Working');
    }
  } catch (error) {
    console.log(`   ❌ Supabase connection failed: ${error.message}`);
  }

  console.log('\n🎯 Summary:');
  if (envVarsOk && connectivityTest.success) {
    console.log('   ✅ Your environment is properly configured!');
    console.log('   You can now test the Shopify OAuth flow.');
  } else {
    console.log('   ⚠️  Please fix the issues above before testing OAuth.');
  }
}

// Run the test
testEnvironment().catch(console.error);
