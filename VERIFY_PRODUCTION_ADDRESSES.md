# Verify Production Contract Addresses

## The Transaction Error Shows:

```
Approval being sent TO: 0x7e5805db03da2c847e9fd057251115943ae5fae3
From wallet: 0x9998c45aeb5f2f9c62f0d576192ef552ded01afa
```

## What This Means:

When you approve tokens for escrow, the transaction flow is:
1. Call `tokenContract.approve(ESCROW_ADDRESS, amount)`
2. The `to` field in the transaction is the **TOKEN contract**, not escrow
3. The data field contains the escrow address you're approving

So `0x7e5805db...` should be your **CFC TOKEN address**, not escrow!

---

## CRITICAL: Check Your Render Environment Variables

### Go to Render Dashboard → cfc-frontend → Environment

**What you SHOULD have:**
```bash
# Token Contract (the one you approve)
VITE_CFC_TOKEN_ADDRESS=0x07b023ee3094F2a661f1018160d75895Ee35F183

# Escrow Contract (the one that holds funds)
VITE_ESCROW_CONTRACT_ADDRESS=0xE6927AF055204f9b4b545e0752cE9DBf26A989CA
```

**What it looks like you ACTUALLY have (WRONG):**
```bash
VITE_CFC_TOKEN_ADDRESS=0x7e5805dB03da2C847E9FD057251115943Ae5fae3  ← OLD/WRONG
VITE_ESCROW_CONTRACT_ADDRESS=??? 
```

---

## How to Fix:

### Step 1: Verify on BSCScan Mainnet

Check what each address actually is:

**Address: `0x07b023ee3094F2a661f1018160d75895Ee35F183`**
- Visit: https://bscscan.com/address/0x07b023ee3094F2a661f1018160d75895Ee35F183
- Should show: **CFC Token** (ERC20 with name, symbol, totalSupply)

**Address: `0xE6927AF055204f9b4b545e0752cE9DBf26A989CA`**
- Visit: https://bscscan.com/address/0xE6927AF055204f9b4b545e0752cE9DBf26A989CA
- Should show: **Escrow Contract** (has createMatch, joinMatch functions)

**Address: `0x7e5805dB03da2C847E9FD057251115943Ae5fae3`**
- Visit: https://bscscan.com/address/0x7e5805dB03da2C847E9FD057251115943Ae5fae3
- What is this? (Old testnet contract?)

### Step 2: Fix Render Frontend Environment

1. **Render Dashboard** → **cfc-frontend** → **Environment**
2. Update these variables:

```bash
VITE_CFC_TOKEN_ADDRESS=0x07b023ee3094F2a661f1018160d75895Ee35F183
VITE_ESCROW_CONTRACT_ADDRESS=0xE6927AF055204f9b4b545e0752cE9DBf26A989CA
```

3. **Save Changes**
4. **Manual Deploy** (REQUIRED - env vars need rebuild!)

### Step 3: Verify Backend Matches

**Render Dashboard** → **cfc-backend** → **Environment**

Should have:
```bash
CFC_TOKEN_ADDRESS="0x07b023ee3094F2a661f1018160d75895Ee35F183"
ESCROW_CONTRACT_ADDRESS="0xE6927AF055204f9b4b545e0752cE9DBf26A989CA"
```

---

## Why This Error Happens:

If `VITE_CFC_TOKEN_ADDRESS` is set to the wrong address:
1. Frontend tries to approve tokens
2. Calls `wrongContract.approve(escrowAddress, amount)`
3. The wrong contract doesn't exist or isn't your token
4. Transaction fails with weird errors

---

## Test After Fix:

After updating and rebuilding, the transaction should show:
```
Approval sent TO: 0x07b023ee3094F2a661f1018160d75895Ee35F183  ← Correct token
Data contains: 0xE6927AF055204f9b4b545e0752cE9DBf26A989CA  ← Correct escrow
```

And it should succeed!

---

## Quick Verification Command:

Open browser console on your production site:
```javascript
console.log('Token:', import.meta.env.VITE_CFC_TOKEN_ADDRESS);
console.log('Escrow:', import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS);
```

These MUST match your mainnet contracts!
