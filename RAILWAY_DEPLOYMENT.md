# Railway Deployment Guide for Sparqit

This guide will walk you through deploying your Sparqit application on Railway.

## Prerequisites

1. **GitHub Repository**: Your code should be in a GitHub repository
2. **Railway Account**: Sign up at [railway.app](https://railway.app)
3. **Environment Variables**: Gather your API keys and configuration

## Step 1: Prepare Environment Variables

You'll need these environment variables for your deployment:

### Backend Environment Variables:
```
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-frontend-url.railway.app
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-s3-bucket-name
OPENAI_API_KEY=your-openai-api-key
NODE_ENV=production
PORT=5002
```

### Frontend Environment Variables:
```
VITE_API_URL=https://your-backend-url.railway.app
PORT=8080
```

## Step 2: Deploy Backend

1. **Go to Railway Dashboard**
   - Visit [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"

2. **Connect Your Repository**
   - Select your GitHub repository
   - Railway will detect your project structure

3. **Configure Backend Service**
   - Railway will automatically detect the backend folder
   - Set the following configuration:
     - **Root Directory**: `backend`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`

4. **Add PostgreSQL Database**
   - In your Railway project, click "New"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically create a PostgreSQL database

5. **Configure Environment Variables**
   - Go to your backend service settings
   - Add all the backend environment variables listed above
   - For `DATABASE_URL`, use the one provided by Railway's PostgreSQL service

6. **Deploy Backend**
   - Railway will automatically build and deploy your backend
   - Note the generated URL (e.g., `https://your-backend.railway.app`)

## Step 3: Deploy Frontend

1. **Add Frontend Service**
   - In your Railway project, click "New"
   - Select "GitHub Repo" again
   - Select the same repository

2. **Configure Frontend Service**
   - Set the following configuration:
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install && npm run build:prod`
     - **Start Command**: `npm start`

3. **Configure Environment Variables**
   - Add the frontend environment variables
   - Set `VITE_API_URL` to your backend URL from Step 2

4. **Deploy Frontend**
   - Railway will build and deploy your frontend
   - Note the generated URL (e.g., `https://your-frontend.railway.app`)

## Step 4: Update CORS Settings

1. **Update Backend CORS**
   - Go to your backend service in Railway
   - Add your frontend URL to the `CORS_ORIGIN` environment variable
   - Redeploy the backend service

## Step 5: Database Setup

1. **Run Database Migrations**
   - Go to your backend service in Railway
   - Go to "Deployments" tab
   - Click on the latest deployment
   - Go to "Logs" and run:
   ```bash
   npm run setup-db
   ```

## Step 6: Test Your Deployment

1. **Test Backend Health**
   - Visit: `https://your-backend.railway.app/api/health`
   - Should return: `{"status":"OK","message":"Sparqit Backend is running"}`

2. **Test Frontend**
   - Visit your frontend URL
   - Try logging in and using the application

## Troubleshooting

### Common Issues:

1. **Build Failures**
   - Check the build logs in Railway
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is correct
   - Check if PostgreSQL service is running
   - Ensure database migrations have run

3. **CORS Errors**
   - Verify `CORS_ORIGIN` includes your frontend URL
   - Check browser console for CORS errors
   - Redeploy backend after updating CORS settings

4. **Environment Variables**
   - Double-check all environment variables are set
   - Ensure no typos in variable names
   - Verify API keys are valid

### Useful Railway Commands:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# View logs
railway logs

# Deploy manually
railway up
```

## Cost Estimation

- **Railway Free Tier**: $5 credit/month
- **PostgreSQL**: ~$5-10/month
- **Compute**: ~$5-20/month depending on usage
- **Total Estimated Cost**: $10-30/month

## Next Steps

1. **Set up custom domains** (optional)
2. **Configure monitoring** and alerts
3. **Set up automatic deployments** from GitHub
4. **Configure SSL certificates** (automatic with Railway)

## Support

- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- GitHub Issues: For code-specific issues 