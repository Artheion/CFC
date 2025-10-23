# Deployment Checklist

## After Deploying Frontend/Backend Changes

### 1. Clear Browser Cache (CRITICAL)

The browser may serve **stale cached JavaScript** even after deployment. You MUST force a hard refresh:

**Windows/Linux:**
- Chrome/Edge/Firefox: `Ctrl + Shift + R` or `Ctrl + F5`
- Alternative: Open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

**Mac:**
- Chrome/Edge/Firefox: `Cmd + Shift + R`
- Safari: `Cmd + Option + R`

**If still seeing old code:**
1. Open DevTools (F12)
2. Go to Application/Storage tab
3. Click "Clear site data" or "Clear storage"
4. Refresh page

### 2. Verify Deployment

**Frontend (Render Static Site):**
- Check Render dashboard: "Latest Deploy" timestamp should be recent
- View deploy logs for "Build succeeded" message
- Check for build errors in logs

**Backend (Render Web Service):**
- Check Render dashboard: "Latest Deploy" timestamp should be recent
- Verify backend is running (not sleeping)
- Check logs for startup messages

### 3. Verify Changes Took Effect

**Check Rate Limits (Backend):**
```bash
curl https://cfc-4j69.onrender.com/api/health
```
Should return 200 OK without 429 errors

**Check Frontend Version:**
1. Open DevTools → Console
2. Look for log messages with new format (e.g., "[Navbar] 🚀 Authenticating")
3. Check Network tab → JS files should have recent timestamps

### 4. Test Critical Flows

- [ ] Connect wallet (should not require double signature)
- [ ] Navigate: Profile → Leaderboard → Profile (no 429 errors)
- [ ] Check referral earnings display in Profile
- [ ] Verify no "No authentication token available" errors

### 5. If Problems Persist

**429 Rate Limit Errors:**
- Wait 1 minute for rate limit window to reset
- Check if backend has new rate limits (500/min instead of 200/min)
- Verify `app.module.ts` has updated ThrottlerModule config

**Auth Token Issues:**
- Clear localStorage: DevTools → Application → Local Storage → Clear All
- Disconnect wallet completely
- Reconnect and sign message again

**Still Broken:**
- Check Render logs for errors
- Verify environment variables are set correctly
- Check database connection (Redis eviction policy = "noeviction")

## Common Deployment Mistakes

1. **Forgot to redeploy backend** after frontend changes
2. **Browser serving cached JS** (most common - always do hard refresh!)
3. **Redis still has wrong eviction policy** (should be "noeviction")
4. **Environment variables not updated** in Render dashboard
5. **Build succeeded but old version still deployed** (check deploy timestamp)

## Troubleshooting Commands

```bash
# Check if backend is accessible
curl https://cfc-4j69.onrender.com/api/health

# Check rate limit status (will return 429 if you hit limit)
for i in {1..10}; do curl https://cfc-4j69.onrender.com/api/health; done

# Verify backend environment
curl https://cfc-4j69.onrender.com/api/health | jq
```