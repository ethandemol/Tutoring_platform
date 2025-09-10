# Frontend Railway Setup Guide

This guide will help you configure your frontend to communicate with your Railway backend instead of localhost.

## Current Configuration

Your frontend is already set up to use environment variables for API communication. The configuration is in `frontend/src/api/config.ts`:

```typescript
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) {
    return 'http://localhost:5002'; // Default fallback
  }
  
  // Ensure the URL has a protocol
  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
    return envUrl;
  }
  
  // Add https:// if no protocol is provided
  return `https://${envUrl}`;
};
```

## Step 1: Get Your Railway Backend URL

1. Go to your Railway dashboard
2. Find your backend service
3. Copy the generated URL (e.g., `https://sparqit-backend-production.up.railway.app`)

## Step 2: Configure Frontend Environment

### Option A: Using the Setup Script (Recommended)

```bash
# Run the setup script with your Railway backend URL
./setup-railway-frontend.sh https://your-backend-url.railway.app
```

### Option B: Manual Configuration

1. Create a `.env` file in the `frontend/` directory:

```bash
cd frontend
touch .env
```

2. Add your Railway backend URL to the `.env` file:

```env
# Railway Backend URL
VITE_API_URL=https://your-backend-url.railway.app

# Frontend Port (Railway will set this automatically)
PORT=8080
```

## Step 3: Test Local Configuration

1. Start your frontend locally:
```bash
cd frontend
npm run dev
```

2. Open your browser and check the console logs. You should see:
```
🔧 API Configuration:
  - VITE_API_URL: https://your-backend-url.railway.app
  - API_BASE_URL: https://your-backend-url.railway.app
```

3. Test that your frontend can communicate with the Railway backend by trying to log in or access any API endpoint.

## Step 4: Deploy to Railway

### Railway Dashboard Method

1. Go to [railway.app](https://railway.app)
2. Create a new project or add a service to existing project
3. Connect your GitHub repository
4. Configure the service:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Environment Variables in Railway

In your Railway frontend service, add these environment variables:

```
VITE_API_URL=https://your-backend-url.railway.app
PORT=8080
```

### Railway CLI Method

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and link your project:
```bash
railway login
railway link
```

3. Deploy:
```bash
railway up
```

## Step 5: Update Backend CORS

Make sure your Railway backend's `CORS_ORIGIN` environment variable includes your frontend URL:

```
CORS_ORIGIN=https://your-frontend-url.railway.app
```

## Step 6: Verify Deployment

1. **Test Backend Health**: Visit `https://your-backend-url.railway.app/api/health`
2. **Test Frontend**: Visit your frontend URL and try logging in
3. **Check Console**: Open browser dev tools and verify API calls are going to Railway

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure backend `CORS_ORIGIN` includes frontend URL
   - Check that URLs are exactly correct (no trailing slashes)

2. **Environment Variables Not Loading**
   - Verify `VITE_API_URL` is set in Railway dashboard
   - Check that variable name is exactly correct
   - Redeploy after changing environment variables

3. **Build Failures**
   - Check Railway build logs
   - Ensure all dependencies are in `package.json`
   - Verify Node.js version compatibility

4. **API Communication Issues**
   - Check browser network tab for failed requests
   - Verify backend is running and accessible
   - Check Railway logs for backend errors

### Debugging Commands

```bash
# Check Railway logs
railway logs

# View environment variables
railway variables

# Redeploy
railway up
```

## Configuration Files

### `frontend/src/api/config.ts`
This file handles API URL configuration and endpoint definitions.

### `frontend/railway.json`
Railway-specific configuration for the frontend service.

### `frontend/env.example`
Example environment variables for local development.

## Next Steps

1. **Set up custom domains** (optional)
2. **Configure monitoring** and alerts
3. **Set up automatic deployments** from GitHub
4. **Configure SSL certificates** (automatic with Railway)

## Support

- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Check the main `RAILWAY_DEPLOYMENT.md` for backend setup 