#!/bin/bash

echo "🚂 Railway Deployment Helper for Sparqit"
echo "========================================"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
else
    echo "✅ Railway CLI found"
fi

echo ""
echo "📋 Prerequisites Checklist:"
echo "1. ✅ GitHub repository with your code"
echo "2. ✅ Railway account (sign up at railway.app)"
echo "3. ✅ Environment variables ready"
echo ""
echo "🔧 Next Steps:"
echo "1. Run: railway login"
echo "2. Run: railway init"
echo "3. Follow the deployment guide in RAILWAY_DEPLOYMENT.md"
echo ""
echo "📖 Full deployment guide: RAILWAY_DEPLOYMENT.md"
echo ""
echo "🚀 Ready to deploy!" 