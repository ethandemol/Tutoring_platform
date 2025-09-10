#!/bin/bash

# Railway Frontend Setup Script
# This script helps configure the frontend to communicate with Railway backend

echo "🚀 Setting up frontend for Railway deployment..."

# Check if backend URL is provided as argument
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your Railway backend URL"
    echo "Usage: ./setup-railway-frontend.sh https://your-backend-url.railway.app"
    echo ""
    echo "Example:"
    echo "  ./setup-railway-frontend.sh https://sparqit-backend-production.up.railway.app"
    exit 1
fi

BACKEND_URL=$1

# Create .env file in frontend directory
echo "📝 Creating frontend .env file..."
cat > frontend/.env << EOF
# Railway Backend URL
VITE_API_URL=$BACKEND_URL

# Frontend Port (Railway will set this automatically)
PORT=8080
EOF

echo "✅ Frontend environment configured!"
echo ""
echo "🔧 Configuration details:"
echo "  - Backend URL: $BACKEND_URL"
echo "  - Environment file: frontend/.env"
echo ""
echo "📋 Next steps:"
echo "  1. Deploy your frontend to Railway"
echo "  2. Set the VITE_API_URL environment variable in Railway dashboard"
echo "  3. Ensure your backend CORS_ORIGIN includes your frontend URL"
echo ""
echo "🚀 To deploy to Railway:"
echo "  1. Go to railway.app"
echo "  2. Create new project from GitHub"
echo "  3. Set root directory to 'frontend'"
echo "  4. Set build command: npm install && npm run build"
echo "  5. Set start command: npm start"
echo "  6. Add VITE_API_URL environment variable in Railway dashboard" 