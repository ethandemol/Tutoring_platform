#!/bin/bash

echo "🚀 Starting Sparqit Local Development Environment"
echo "================================================"

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Stopping all services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo "📦 Starting Backend (Port 5002)..."
cd backend
npm run dev &
BACKEND_PID=$!

echo "⏳ Waiting for backend to start..."
sleep 5

echo "🌐 Starting Frontend (Port 3000)..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "✅ Services started!"
echo "   Backend: http://localhost:5002"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for both processes
wait 