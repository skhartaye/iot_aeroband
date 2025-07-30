# Deployment Guide - Aeroband IoT App

## Option 1: Vercel Deployment (Recommended)

### Prerequisites
1. **GitHub Account** - Your code should be on GitHub
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
3. **Neon Database** - Already set up

### Step 1: Prepare Your Code

1. **Update your `.env` file** (create if it doesn't exist):
   ```env
   DATABASE_URL="your-neon-database-url"
   ```

2. **Install Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   ```

### Step 2: Deploy to Vercel

#### Method A: Via Vercel Dashboard (Easiest)
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure environment variables:
   - `DATABASE_URL`: Your Neon database URL
5. Deploy!

#### Method B: Via CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts:
# - Link to existing project? No
# - Set up and deploy? Yes
# - Which scope? [Your account]
# - Link to existing project? No
# - What's your project's name? aeroband-iot-app
# - In which directory is your code located? ./
# - Want to override the settings? No
```

### Step 3: Configure Environment Variables

In your Vercel dashboard:
1. Go to your project settings
2. Add environment variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Your Neon database URL
3. Redeploy

### Step 4: Update Your ESP32 Code

Update your ESP32 code to use the new API URL:

```cpp
// In your ESP32 code, if you want to send HTTP requests directly
const char* serverUrl = "https://your-app-name.vercel.app/api/sensor-data";
```

## Option 2: Railway Deployment

### Step 1: Prepare for Railway
1. Create account at [railway.app](https://railway.app)
2. Connect your GitHub repository

### Step 2: Deploy
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Add environment variable: `DATABASE_URL`
5. Deploy!

## Option 3: Render Deployment

### Step 1: Prepare for Render
1. Create account at [render.com](https://render.com)
2. Connect your GitHub repository

### Step 2: Deploy
1. Click "New Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add environment variable: `DATABASE_URL`
5. Deploy!

## Environment Variables Needed

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
NODE_ENV="production"
```

## Testing Your Deployed API

Once deployed, test your API:

```bash
# Test POST endpoint
curl -X POST https://your-app-name.vercel.app/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{"temperature":24.97,"humidity":55.09,"pressure":1005.15,"gas_resistance":31.19,"ammonia":0.17,"pm1_0":19,"pm2_5":27,"pm10":27,"deviceId":"AerobandSensor","location":"lab","status":"ok"}'

# Test GET endpoint
curl https://your-app-name.vercel.app/api/sensor-data
```

## Troubleshooting

### Common Issues:

1. **Database Connection Error**
   - Check your `DATABASE_URL` environment variable
   - Ensure Neon database is accessible

2. **Build Errors**
   - Check that all dependencies are in `package.json`
   - Ensure `vercel.json` is properly configured

3. **API Not Found**
   - Verify the API routes in `vercel.json`
   - Check that server.js exports the app correctly

### Getting Your App URL

After deployment, you'll get a URL like:
- `https://aeroband-iot-app.vercel.app`
- `https://your-app-name.vercel.app`

Update your frontend code to use this URL instead of localhost.

## Next Steps

1. **Deploy your app** using one of the methods above
2. **Update your ESP32 code** to use the new API URL
3. **Test the full flow**: ESP32 → BLE → Web App → Deployed API → Neon Database
4. **Share your app** with the world! 🌍 