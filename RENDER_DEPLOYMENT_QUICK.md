# ⚡ Super Quick: Deploy to Render (100% Free)

## 🎯 What You'll Get

- ✅ **Frontend + Backend + Database** - All free
- ✅ **90 days free** - Then $7/month for database
- ✅ **Setup time:** 1-2 hours
- ✅ **No credit card** required to start

---

## 📋 Quick Steps

### 1️⃣ Push to GitHub (5 minutes)

```bash
cd "C:\Users\abdul\Desktop\New folder\New folder\CFC"

# Create .gitignore
echo node_modules/ > .gitignore
echo .env >> .gitignore
echo backend/.env >> .gitignore
echo dist/ >> .gitignore

# Push
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/cfc-platform.git
git push -u origin main
```

---

### 2️⃣ Sign Up for Render (2 minutes)

1. Go to https://render.com
2. Click **"Get Started"**
3. Sign up with GitHub

---

### 3️⃣ Create Database (3 minutes)

1. Click **"New +"** → **"PostgreSQL"**
2. Name: `cfc-database`
3. Database: `cfc`
4. Region: Choose closest
5. Plan: **Free**
6. Click **"Create Database"**
7. **Copy "Internal Database URL"** (you'll need this)

---

### 4️⃣ Get Free Redis (5 minutes)

1. Go to https://redis.com/try-free/
2. Sign up (free)
3. Create subscription → **Free** plan
4. Create database
5. **Copy connection URL**

---

### 5️⃣ Deploy Backend (15 minutes)

1. Render → **"New +"** → **"Web Service"**
2. Connect GitHub repo: `cfc-platform`
3. **Settings:**
   - Name: `cfc-backend`
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build && npx prisma generate`
   - Start Command: `npm run start`
   - Plan: **Free**

4. **Environment Variables** (click "Advanced"):

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=<paste from step 3>
REDIS_URL=<paste from step 4>

# Generate these:
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
CSRF_SECRET=<run: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))">

CORS_ORIGIN=*

BNB_RPC_ENDPOINT=https://bsc-dataseed1.bnbchain.org
BSC_RPC_URL=https://bsc-dataseed1.bnbchain.org

TREASURY_ADDRESS=0xYourTreasuryAddress
TREASURY_PRIVATE_KEY=your_private_key_here

CFC_TOKEN_ADDRESS=0x07b023ee3094F2a661f1018160d75895Ee35F183
ADMIN_WALLET_ADDRESS=0x9998C45AeB5F2F9C62F0D576192EF552ded01afA
ESCROW_CONTRACT_ADDRESS=0xE6927AF055204f9b4b545e0752cE9DBf26A989CA

LOG_LEVEL=info
```

5. Click **"Create Web Service"**
6. Wait 5-10 minutes for build
7. **Your backend URL:** `https://cfc-backend.onrender.com`

---

### 6️⃣ Run Database Migration (2 minutes)

1. Backend service → **"Shell"** tab
2. Run:
```bash
npx prisma migrate deploy
npx prisma generate
```

---

### 7️⃣ Deploy Frontend (10 minutes)

1. Create `.env.production` in your local project:

```env
VITE_API_BASE_URL=https://cfc-backend.onrender.com/api
VITE_BNB_NETWORK=mainnet
VITE_RPC_ENDPOINT=https://bsc-dataseed1.bnbchain.org
VITE_ADMIN_WALLET=0x9998C45AeB5F2F9C62F0D576192EF552ded01afA
VITE_TREASURY_ADDRESS=0xd3B19F8B50979e9fe9465592664C81A46F507d5d
VITE_CFC_TOKEN_ADDRESS=0x07b023ee3094F2a661f1018160d75895Ee35F183
VITE_ESCROW_CONTRACT_ADDRESS=0xE6927AF055204f9b4b545e0752cE9DBf26A989CA
VITE_WALLETCONNECT_PROJECT_ID=e049eed4-d28c-497f-bc7f-f7eb42f8426e
```

2. Push to GitHub:
```bash
git add .env.production
git commit -m "Add production config"
git push origin main
```

3. Render → **"New +"** → **"Static Site"**
4. Connect GitHub repo
5. **Settings:**
   - Name: `cfc-frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

6. **Environment Variables** - Add all from `.env.production`

7. Click **"Create Static Site"**
8. Wait 3-5 minutes
9. **Your frontend URL:** `https://cfc-frontend.onrender.com`

---

### 8️⃣ Update CORS (2 minutes)

1. Backend service → **"Environment"** tab
2. Edit `CORS_ORIGIN`:
```env
CORS_ORIGIN=https://cfc-frontend.onrender.com
```
3. Save (auto-redeploys)

---

### 9️⃣ Test (5 minutes)

1. Open `https://cfc-frontend.onrender.com`
2. Connect MetaMask (BSC Mainnet)
3. Test features

---

## ✅ Done!

**Your URLs:**
- Frontend: `https://cfc-frontend.onrender.com`
- Backend: `https://cfc-backend.onrender.com`
- Total Cost: **$0/month** (for 90 days)

---

## 🔥 Keep Your Service Awake

Services sleep after 15 min. To prevent:

1. Go to https://cron-job.org (free)
2. Sign up
3. Create cron job:
   - URL: `https://cfc-backend.onrender.com/api/health`
   - Interval: Every 10 minutes

**Done! Your service stays awake 24/7 for free! 🎉**

---

## 🆘 Quick Fixes

**Backend not starting?**
```bash
# Check logs in Render dashboard
# Verify all environment variables are set
# Try manual deploy
```

**Frontend not loading?**
```bash
# Verify VITE_API_BASE_URL is correct
# Check all VITE_* variables are set
# Trigger manual deploy
```

**CORS error?**
```bash
# Update CORS_ORIGIN in backend to your frontend URL
# Save and wait for redeploy
```

---

**Total Setup Time:** ~1-2 hours  
**Total Cost:** $0 (90 days free, then $7/month)  
**Your app is LIVE! 🚀**
