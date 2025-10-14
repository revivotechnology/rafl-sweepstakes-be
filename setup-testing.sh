#!/bin/bash

# Migration Testing Setup Script
# This script helps you set up and run tests for your MongoDB to Supabase migration

echo "🚀 Setting up Migration Testing Environment"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the rafl-sweepstakes-be directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Please create a .env file with the following variables:"
    echo ""
    echo "NODE_ENV=development"
    echo "PORT=4000"
    echo "SUPABASE_URL=your-supabase-project-url"
    echo "SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key"
    echo "JWT_SECRET=your-super-secret-jwt-key"
    echo ""
    echo "See ENV_SETUP.md for more details"
    echo ""
    read -p "Press Enter to continue after creating .env file..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if axios is installed (needed for testing)
if ! npm list axios > /dev/null 2>&1; then
    echo "📦 Installing axios for testing..."
    npm install axios
fi

# Check if server is already running
if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
    echo "✅ Server is already running on port 4000"
else
    echo "🚀 Starting the server..."
    echo "Please run the following command in a separate terminal:"
    echo "npm run dev"
    echo ""
    echo "Then come back and run the tests."
    echo ""
    read -p "Press Enter when the server is running..."
fi

# Run the automated tests
echo "🧪 Running automated migration tests..."
echo "======================================"
node test-migration.js

echo ""
echo "📋 Manual Testing Checklist:"
echo "============================"
echo "1. ✅ Automated tests completed above"
echo "2. 🔍 Check Supabase dashboard for data"
echo "3. 🌐 Test frontend integration"
echo "4. 🛒 Test real Shopify webhooks"
echo "5. 📊 Monitor performance"
echo ""
echo "📖 For detailed testing instructions, see:"
echo "   - TESTING_GUIDE.md (comprehensive testing guide)"
echo "   - MIGRATION_GUIDE.md (migration documentation)"
echo ""
echo "🎉 Happy testing!"
