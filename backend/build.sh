#!/bin/bash

echo "Installing dependencies..."
npm install

echo "Installing Playwright browsers..."
npx playwright install chromium

echo "Build completed successfully!" 