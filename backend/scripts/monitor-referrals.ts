/**
 * Monitor referral system for anomalies
 * Run this daily to check for suspicious activity
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 REFERRAL SYSTEM HEALTH CHECK\n');
  console.log('=' .repeat(60));
  console.log('\n');

  // 1. Check for large balances
  console.log('1️⃣  Checking for Large Balances (> 1 BNB)\n');
  const largeBalances = await prisma.referralCode.findMany({
    where: {
      totalEarnedBnb: { gt: 1 }
    },
    include: {
      owner: { select: { username: true, walletAddress: true } }
    }
  });

  if (largeBalances.length === 0) {
    console.log('   ✅ No large balances found\n');
  } else {
    console.log(`   ⚠️  Found ${largeBalances.length} account(s) with > 1 BNB:\n`);
    for (const code of largeBalances) {
      const earned = Number(code.totalEarnedBnb);
      const withdrawn = Number(code.totalWithdrawnBnb);
      console.log(`   Code: ${code.code}`);
      console.log(`   Owner: ${code.owner?.username || code.ownerWallet}`);
      console.log(`   Earned: ${earned} BNB | Withdrawn: ${withdrawn} BNB`);
      console.log('');
    }
  }

  // 2. Check for large individual referral payouts
  console.log('2️⃣  Checking for Large Referral Payouts (> 0.5 BNB)\n');
  const largePayouts = await prisma.transaction.findMany({
    where: {
      type: 'REFERRAL',
      amount: { gt: 0.5 }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  if (largePayouts.length === 0) {
    console.log('   ✅ No large payouts found\n');
  } else {
    console.log(`   ⚠️  Found ${largePayouts.length} large payout(s):\n`);
    for (const tx of largePayouts) {
      const metadata = tx.metadata as any;
      console.log(`   Amount: ${Number(tx.amount)} BNB`);
      console.log(`   To: ${tx.toWallet}`);
      console.log(`   Date: ${tx.createdAt.toISOString()}`);
      console.log(`   Source TX: ${metadata?.sourceTransactionId || '❌ MISSING'}`);
      console.log('');
    }
  }

  // 3. Check for referral payouts without source
  console.log('3️⃣  Checking for Referral Payouts Without Source Transaction\n');
  const noSourcePayouts = await prisma.transaction.findMany({
    where: {
      type: 'REFERRAL',
      metadata: {
        equals: {} // Empty metadata or missing sourceTransactionId
      }
    }
  });

  if (noSourcePayouts.length === 0) {
    console.log('   ✅ All referral payouts have source transactions\n');
  } else {
    console.log(`   ❌ Found ${noSourcePayouts.length} payout(s) without source:\n`);
    for (const tx of noSourcePayouts) {
      console.log(`   ID: ${tx.id}`);
      console.log(`   Amount: ${Number(tx.amount)} BNB`);
      console.log(`   To: ${tx.toWallet}`);
      console.log(`   Date: ${tx.createdAt.toISOString()}`);
      console.log('   ⚠️  THIS SHOULD BE INVESTIGATED\n');
    }
  }

  // 4. Daily statistics
  console.log('4️⃣  Daily Statistics (Last 24 Hours)\n');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const dailyReferrals = await prisma.transaction.findMany({
    where: {
      type: 'REFERRAL',
      createdAt: { gte: yesterday }
    }
  });

  const totalPaidOut = dailyReferrals.reduce((sum, tx) => sum + Number(tx.amount), 0);
  
  console.log(`   Total Referral Payouts: ${dailyReferrals.length}`);
  console.log(`   Total Amount Paid: ${totalPaidOut.toFixed(6)} BNB`);
  
  if (totalPaidOut > 10) {
    console.log(`   ⚠️  High daily payout volume - review transactions`);
  } else {
    console.log(`   ✅ Normal daily volume`);
  }
  console.log('');

  // 5. Withdrawal statistics
  console.log('5️⃣  Withdrawal Statistics (Last 24 Hours)\n');
  const dailyWithdrawals = await prisma.transaction.findMany({
    where: {
      type: 'WITHDRAWAL',
      createdAt: { gte: yesterday }
    }
  });

  const totalWithdrawn = dailyWithdrawals.reduce((sum, tx) => sum + Number(tx.amount), 0);
  
  console.log(`   Total Withdrawals: ${dailyWithdrawals.length}`);
  console.log(`   Total Amount: ${totalWithdrawn.toFixed(6)} BNB`);
  
  if (totalWithdrawn > 20) {
    console.log(`   ⚠️  High withdrawal volume - ensure treasury has sufficient balance`);
  } else {
    console.log(`   ✅ Normal withdrawal volume`);
  }
  console.log('');

  // 6. System totals
  console.log('6️⃣  System Totals\n');
  const allCodes = await prisma.referralCode.findMany();
  
  const totalEarnedAcrossAllCodes = allCodes.reduce(
    (sum, code) => sum + Number(code.totalEarnedBnb), 
    0
  );
  const totalWithdrawnAcrossAllCodes = allCodes.reduce(
    (sum, code) => sum + Number(code.totalWithdrawnBnb), 
    0
  );
  const totalAvailable = totalEarnedAcrossAllCodes - totalWithdrawnAcrossAllCodes;

  console.log(`   Total Codes: ${allCodes.length}`);
  console.log(`   Total Earned: ${totalEarnedAcrossAllCodes.toFixed(6)} BNB`);
  console.log(`   Total Withdrawn: ${totalWithdrawnAcrossAllCodes.toFixed(6)} BNB`);
  console.log(`   Total Available: ${totalAvailable.toFixed(6)} BNB`);
  console.log('');

  console.log('=' .repeat(60));
  console.log('\n✅ Health check complete\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
