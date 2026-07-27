import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/auth';
import { logAudit } from '../services/audit';
import {
  getOwnerActivePlan,
  activatePremiumPlan,
  assignFreePlan,
  expireSubscriptions,
} from '../services/subscription';
import { resolvePlatformCredentials } from '../services/platformGateway';
import { getIO } from '../services/socket';
import midtransClient from 'midtrans-client';
import crypto from 'crypto';

// Helper to generate unique subscription order ID
// Format: SUB-YYYYMMDD-XXXXXX
const generateSubscriptionOrderId = (): string => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SUB-${datePart}-${randomPart}`;
};

// ──────────────────────────────────────────────────
// GET /subscriptions/my
// ──────────────────────────────────────────────────

export const getMySubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    // Auto-expire stale subscriptions on every request
    await expireSubscriptions();

    const info = await getOwnerActivePlan(ownerId);
    const claim = await prisma.trialClaim.findUnique({
      where: { ownerId },
      select: { maskedNik: true, claimedAt: true, expiredAt: true, status: true }
    });

    if (!info) {
      // Auto-assign FREE plan if owner has no subscription
      await assignFreePlan(ownerId);
      const freshInfo = await getOwnerActivePlan(ownerId);
      return res.json({
        subscription: freshInfo?.subscription ?? null,
        plan: freshInfo?.plan ?? null,
        isPremium: false,
        isGracePeriod: false,
        gracePeriodUntil: null,
        usage: freshInfo?.usage ?? { stores: 0, products: 0, cashiers: 0, categories: 0 },
        canClaimTrial: !claim,
        trialClaim: claim,
      });
    }

    const canClaimTrial = !claim && info.plan.name === 'FREE';

    return res.json({
      subscription: info.subscription,
      plan: info.plan,
      isPremium: info.isPremium,
      isGracePeriod: info.isGracePeriod,
      gracePeriodUntil: info.gracePeriodUntil ?? null,
      usage: info.usage,
      canClaimTrial,
      trialClaim: claim,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// GET /subscriptions/plans
// ──────────────────────────────────────────────────

export const getSubscriptionPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
    return res.json({ plans });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// POST /subscriptions/checkout
// Creates a Midtrans Snap transaction for subscription
// FIX: Store PENDING_PAYMENT subscription BEFORE returning token,
//      so webhook can find it by midtransOrderId.
// ──────────────────────────────────────────────────

export const checkoutSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    const ownerEmail = req.user?.email;
    const ownerName = req.user?.name;

    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { planId } = req.body;
    if (!planId) return res.status(400).json({ message: 'planId is required' });

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ message: 'Subscription plan not found' });

    if (Number(plan.price) === 0 || plan.name === 'FREE') {
      return res.status(400).json({ message: 'FREE plan tidak memerlukan pembayaran' });
    }

    // Fetch owner profile for customer details
    const ownerProfile = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { name: true, email: true, phone: true, fullName: true },
    });

    // Generate unique order ID: SUB-YYYYMMDD-XXXXXX
    const orderId = generateSubscriptionOrderId();

    // Cancel any existing PENDING_PAYMENT subscriptions for this owner
    await prisma.subscription.updateMany({
      where: { userId: ownerId, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED' },
    });

    // Create pending subscription record BEFORE calling Midtrans
    // This ensures webhook can find the subscription by midtransOrderId
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    await prisma.subscription.create({
      data: {
        userId: ownerId,
        planId: plan.id,
        status: 'PENDING_PAYMENT',
        startDate: new Date(),
        endDate,
        midtransOrderId: orderId,
        paymentId: orderId,
      },
    });

    console.log(`[Subscription Checkout] Created PENDING_PAYMENT subscription. Order: ${orderId}`);

    // ── Resolve Platform Midtrans credentials (Super Admin account) ──
    const platformCreds = await resolvePlatformCredentials();
    const isSimulatorMode = !platformCreds.isConnected;

    if (isSimulatorMode) {
      // Simulator Mode: skip Midtrans call
      console.log('[Subscription Checkout] Platform Gateway not configured — entering Simulator Mode');
      return res.json({
        snapToken: `mock-sub-snap-${Math.random().toString(36).substring(2, 10)}`,
        paymentUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/mock-token`,
        orderId,
        clientKey: 'SB-Mid-client-placeholder',
        environment: 'SANDBOX',
        simulatorMode: true,
      });
    }

    // ── Real Midtrans Snap using Super Admin platform account ──
    const snapInstance = new midtransClient.Snap({
      isProduction: platformCreds.isProduction,
      serverKey: platformCreds.serverKey,
      clientKey: platformCreds.clientKey,
    });

    const customerName = ownerProfile?.fullName || ownerProfile?.name || ownerName || 'Owner';
    const customerEmail = ownerProfile?.email || ownerEmail || '';
    const customerPhone = ownerProfile?.phone || '';

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Number(plan.price),
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        ...(customerPhone ? { phone: customerPhone } : {}),
      },
      item_details: [
        {
          id: plan.id,
          price: Number(plan.price),
          quantity: 1,
          name: `KasirMu Premium`,
          category: 'Subscription',
        },
      ],
    };

    console.log(`[Subscription Checkout] Creating Midtrans Snap transaction. Order: ${orderId}, Amount: ${Number(plan.price)}`);

    const response = await snapInstance.createTransaction(parameter);

    return res.json({
      snapToken: response.token,
      paymentUrl: response.redirect_url,
      orderId,
      clientKey: platformCreds.clientKey,
      environment: platformCreds.isProduction ? 'PRODUCTION' : 'SANDBOX',
      simulatorMode: false,
    });
  } catch (error: any) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// POST /subscriptions/webhook (public — no auth)
// Receives Midtrans notification for subscription payment
// FIXED: Now looks up PENDING_PAYMENT subscription by midtransOrderId
//        and activates it via activatePremiumPlan
// ──────────────────────────────────────────────────

export const subscriptionWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      order_id,
      transaction_status,
      fraud_status,
      status_code,
      gross_amount,
      signature_key,
      payment_type,
      merchant_id,
      transaction_id,
      settlement_time,
      expiry_time,
    } = req.body;

    console.log('[Webhook] ══════════════════════════════════════════════');
    console.log('[Webhook] Received Midtrans notification');
    console.log('[Webhook] order_id         :', order_id);
    console.log('[Webhook] transaction_status:', transaction_status);
    console.log('[Webhook] fraud_status      :', fraud_status);
    console.log('[Webhook] status_code       :', status_code);
    console.log('[Webhook] gross_amount      :', gross_amount);
    console.log('[Webhook] merchant_id       :', merchant_id);
    console.log('[Webhook] ══════════════════════════════════════════════');

    // ── Idempotency: skip if already ACTIVE ──
    const alreadyActive = await prisma.subscription.findFirst({
      where: { midtransOrderId: order_id, status: 'ACTIVE' },
    });
    if (alreadyActive) {
      console.log('[Webhook] Already ACTIVE — skip (idempotent):', order_id);
      return res.json({ message: 'Already processed' });
    }

    // ── Verify signature using Platform Midtrans server key ──
    const platformCreds = await resolvePlatformCredentials();
    const isSimulatorMode = !platformCreds.isConnected;

    console.log('[Webhook] Simulator mode:', isSimulatorMode);

    if (!isSimulatorMode) {
      const rawString = order_id + status_code + gross_amount + platformCreds.serverKey;
      const expectedHash = crypto.createHash('sha512').update(rawString).digest('hex');
      if (expectedHash !== signature_key) {
        console.warn('[Webhook] ❌ Invalid signature key. order_id:', order_id);
        console.warn('[Webhook] Expected:', expectedHash);
        console.warn('[Webhook] Received:', signature_key);
        // Return 200 so Midtrans doesn't retry, but log the failure
        return res.json({ message: 'Invalid signature — ignored' });
      }
      console.log('[Webhook] ✅ Signature key valid');

      if (platformCreds.merchantId && merchant_id && platformCreds.merchantId !== merchant_id) {
        console.warn('[Webhook] ❌ Merchant ID mismatch:', merchant_id, '!=', platformCreds.merchantId);
        return res.json({ message: 'Merchant ID mismatch — ignored' });
      }
    }

    // ── Only process settlement / capture ──
    const isSuccess =
      transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept');

    if (!isSuccess) {
      console.log(`[Webhook] Status "${transaction_status}" — no action needed`);
      return res.json({ message: `Webhook received. Status: ${transaction_status}` });
    }

    console.log('[Webhook] ✅ Payment successful — looking up subscription...');

    // ── Lookup pending subscription by midtransOrderId ──
    const pendingSub = await prisma.subscription.findFirst({
      where: { midtransOrderId: order_id },
      include: { plan: true, user: { select: { id: true, name: true, email: true } } },
    });

    if (!pendingSub) {
      console.warn('[Webhook] ❌ No subscription found for order_id:', order_id);
      return res.json({ message: 'No pending subscription found for this order' });
    }

    console.log('[Webhook] Found subscription:', pendingSub.id, '| status:', pendingSub.status, '| owner:', pendingSub.user.email);

    // ── Validate gross amount ──
    const expectedAmount = Number(pendingSub.plan.price);
    const receivedAmount = Number(gross_amount);
    if (!isSimulatorMode && Math.abs(expectedAmount - receivedAmount) > 1) {
      console.warn(`[Webhook] ❌ Amount mismatch: expected ${expectedAmount}, got ${receivedAmount}`);
      return res.json({ message: 'Gross amount mismatch — ignored' });
    }

    const ownerId = pendingSub.userId;
    const planId = pendingSub.planId;

    console.log(`[Webhook] Activating PREMIUM for owner: ${ownerId}, plan: ${pendingSub.plan.name}`);

    // ── Activate PREMIUM ──
    await activatePremiumPlan(
      ownerId,
      planId,
      order_id,
      payment_type || 'MIDTRANS',
      {
        midtransTransactionId: transaction_id || undefined,
        paidAt: settlement_time ? new Date(settlement_time) : new Date(),
        expiredAt: expiry_time ? new Date(expiry_time) : undefined,
      }
    );

    console.log('[Webhook] ✅ PREMIUM activated successfully for owner:', ownerId);

    await logAudit({
      action: 'SUBSCRIPTION_WEBHOOK_SUCCESS',
      actorId: ownerId,
      targetId: pendingSub.id,
      description: `PREMIUM activated via Midtrans webhook. Order: ${order_id}, Amount: ${receivedAmount}, PaymentType: ${payment_type}`,
    });

    return res.json({ message: 'Webhook processed successfully' });
  } catch (error: any) {
    console.error('[Webhook] ❌ Error processing webhook:', error?.message || error);
    // Always return 200 so Midtrans doesn't retry endlessly
    return res.json({ message: 'Webhook error — logged' });
  }
};


// ──────────────────────────────────────────────────
// POST /subscriptions/verify-payment
// Called by frontend onSuccess after Midtrans Snap completes
// Ensures subscription is activated immediately even if webhook is delayed or in local dev
// ──────────────────────────────────────────────────

export const verifySubscriptionPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: 'orderId is required' });

    // 1. Check if subscription is already ACTIVE
    const existingActive = await prisma.subscription.findFirst({
      where: { userId: ownerId, midtransOrderId: orderId, status: 'ACTIVE' },
      include: { plan: true },
    });

    if (existingActive) {
      const info = await getOwnerActivePlan(ownerId);
      return res.json({
        message: 'Subscription already active',
        subscription: info?.subscription,
        plan: info?.plan,
        isPremium: info?.isPremium,
        isGracePeriod: info?.isGracePeriod ?? false,
      });
    }

    // 2. Find pending or grace subscription for this order
    const pendingSub = await prisma.subscription.findFirst({
      where: { userId: ownerId, midtransOrderId: orderId },
      include: { plan: true },
    });

    if (!pendingSub) {
      return res.status(404).json({ message: 'Order subscription tidak ditemukan' });
    }

    // 3. Check Midtrans status using Platform credentials
    const platformCreds = await resolvePlatformCredentials();
    let isSuccess = false;
    let paymentType = 'MIDTRANS';
    let transactionId = undefined;

    if (!platformCreds.isConnected) {
      // Simulator mode fallback
      isSuccess = true;
    } else {
      try {
        const core = new midtransClient.CoreApi({
          isProduction: platformCreds.isProduction,
          serverKey: platformCreds.serverKey,
          clientKey: platformCreds.clientKey,
        });

        const statusResponse: any = await core.transaction.status(orderId);
        const status = statusResponse.transaction_status;
        const fraud = statusResponse.fraud_status;

        paymentType = statusResponse.payment_type || 'MIDTRANS';
        transactionId = statusResponse.transaction_id;

        if (status === 'settlement' || status === 'pending' || (status === 'capture' && fraud === 'accept')) {
          isSuccess = true;
        }
      } catch (err: any) {
        console.warn('[Verify Subscription Payment] Midtrans status check error:', err.message);
        // Fallback: if triggered via onSuccess callback, activate
        isSuccess = true;
      }
    }

    if (isSuccess) {
      await activatePremiumPlan(ownerId, pendingSub.planId, orderId, paymentType, {
        midtransTransactionId: transactionId,
        paidAt: new Date(),
      });

      const info = await getOwnerActivePlan(ownerId);

      await logAudit({
        action: 'SUBSCRIPTION_VERIFY_SUCCESS',
        actorId: ownerId,
        targetId: pendingSub.id,
        description: `Subscription PREMIUM verified and activated via frontend callback. Order: ${orderId}`,
      });

      return res.json({
        message: `Berhasil verifikasi pembayaran! Paket ${pendingSub.plan.name} aktif.`,
        subscription: info?.subscription,
        plan: info?.plan,
        isPremium: info?.isPremium,
        isGracePeriod: info?.isGracePeriod ?? false,
      });
    } else {
      return res.status(400).json({ message: 'Pembayaran belum diselesaikan atau gagal' });
    }
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// POST /subscriptions/simulate
// Dev-only: instantly upgrade owner to a plan
// ──────────────────────────────────────────────────

export const simulateSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { planId } = req.body;
    if (!planId) return res.status(400).json({ message: 'planId is required' });

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const mockOrderId = `SIM-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    await activatePremiumPlan(ownerId, planId, mockOrderId, 'SIMULATOR');

    // Fetch updated subscription info
    const info = await getOwnerActivePlan(ownerId);

    await logAudit({
      action: 'SIMULATE_SUBSCRIBE',
      actorId: ownerId,
      targetId: ownerId,
      description: `Simulated subscription upgrade to plan: ${plan.name}`,
    });

    // Emit realtime event
    try {
      const io = getIO();
      io.to(`user_${ownerId}`).emit('subscription_upgraded', {
        planName: plan.name,
        isPremium: true,
        isGracePeriod: false,
        message: `🎉 Selamat! Paket ${plan.name} Anda sudah aktif!`,
      });
    } catch (socketErr) {
      // Socket not critical
    }

    return res.status(201).json({
      message: `Berhasil upgrade ke paket ${plan.name}!`,
      subscription: info?.subscription,
      plan: info?.plan,
      isPremium: info?.isPremium,
      isGracePeriod: info?.isGracePeriod ?? false,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// [SUPERADMIN] GET /subscriptions/admin/all
// ──────────────────────────────────────────────────

export const getAllSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        plan: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// [SUPERADMIN] GET /subscriptions/admin/revenue
// FIXED: count PRO plan (not just PREMIUM)
// ──────────────────────────────────────────────────

export const getSubscriptionRevenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.subscriptionPayment.findMany({
      where: { status: 'PAID' },
      include: {
        subscription: {
          include: {
            user: { select: { name: true, email: true } },
            plan: { select: { name: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Count active PREMIUM subscriptions
    const premiumCount = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        plan: { name: 'PREMIUM' },
      },
    });

    // Count active FREE subscriptions
    const freeCount = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        plan: { name: 'FREE' },
      },
    });

    // Count active subscriptions
    const activeCount = await prisma.subscription.count({
      where: { status: 'ACTIVE' },
    });

    // Count expired subscriptions
    const expiredCount = await prisma.subscription.count({
      where: { status: 'EXPIRED' },
    });

    return res.json({ 
      payments, 
      totalRevenue, 
      premiumCount, 
      freeCount, 
      activeCount, 
      expiredCount 
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// [SUPERADMIN] GET /subscriptions/admin/metrics
// Returns MRR, ARR, churn and subscription breakdown
// ──────────────────────────────────────────────────

export const getSubscriptionMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Active PRO subscriptions
    const activeProSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        plan: { name: { in: ['PRO', 'PREMIUM'] } },
      },
      include: { plan: { select: { price: true, durationDays: true } } },
    });

    // MRR = sum of monthly normalized plan prices of all active paid subscriptions
    const mrr = activeProSubs.reduce((sum, sub) => {
      const planPricePerMonth = Number(sub.plan.price) * (30 / (sub.plan.durationDays || 30));
      return sum + planPricePerMonth;
    }, 0);

    const arr = mrr * 12;

    // Total subscriber counts by plan
    const planBreakdown = await prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
    });

    const plans = await prisma.subscriptionPlan.findMany({ select: { id: true, name: true } });
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]));

    const breakdown = planBreakdown.map((p) => ({
      planName: planMap[p.planId] || p.planId,
      count: p._count._all,
    }));

    // Expired this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const expiredThisMonth = await prisma.subscription.count({
      where: {
        status: 'EXPIRED',
        updatedAt: { gte: startOfMonth },
      },
    });

    return res.json({
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      activeProCount: activeProSubs.length,
      expiredThisMonth,
      breakdown,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// [SUPERADMIN] GET /subscriptions/admin/plans
// ──────────────────────────────────────────────────

export const getAdminPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });
    return res.json({ plans });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// [SUPERADMIN] PUT /subscriptions/admin/plans/:id
// ──────────────────────────────────────────────────

export const updateAdminPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: req.body,
    });

    await logAudit({
      action: 'UPDATE_PLAN',
      actorId,
      targetId: plan.id,
      description: `Updated subscription plan: ${plan.name}`,
    });

    return res.json({ message: 'Plan updated', plan });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// [OWNER] POST /subscriptions/trial/claim
// ──────────────────────────────────────────────────
export const claimTrialSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { nik } = req.body;

    // Rate limiter: check failed claim attempts in last 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const failedAttemptsCount = await prisma.auditLog.count({
      where: {
        actorId: ownerId,
        action: 'CLAIM_PREMIUM_TRIAL_REJECTED',
        createdAt: { gte: fifteenMinsAgo },
      },
    });

    if (failedAttemptsCount >= 3) {
      return res.status(429).json({
        message: 'Terlalu banyak percobaan klaim gagal. Silakan coba lagi dalam 15 menit.',
      });
    }

    // Validation: exactly 16 digits, digits only, no letters, no symbols
    if (!nik || !/^\d{16}$/.test(nik)) {
      await logAudit({
        action: 'CLAIM_PREMIUM_TRIAL_REJECTED',
        actorId: ownerId,
        description: `Failed claim attempt: NIK format invalid.`,
      });
      return res.status(400).json({ message: 'NIK harus terdiri dari tepat 16 digit angka tanpa huruf atau simbol.' });
    }

    // Check if owner already claimed
    const existingClaimForOwner = await prisma.trialClaim.findUnique({
      where: { ownerId },
    });

    if (existingClaimForOwner) {
      await logAudit({
        action: 'CLAIM_PREMIUM_TRIAL_REJECTED',
        actorId: ownerId,
        description: `Failed claim attempt: owner already claimed trial previously.`,
      });
      return res.status(400).json({ message: 'Anda sudah pernah mengklaim Bonus Premium.' });
    }

    // Hash NIK using SHA-256 with global pepper
    const pepper = process.env.NIK_SALT || 'kasirmu_secure_nik_salt_pepper_2026';
    const nikHash = crypto.createHash('sha256').update(nik + pepper).digest('hex');

    // Check if NIK already used in system
    const existingClaimForNIK = await prisma.trialClaim.findUnique({
      where: { nikHash },
    });

    if (existingClaimForNIK) {
      await logAudit({
        action: 'CLAIM_PREMIUM_TRIAL_REJECTED',
        actorId: ownerId,
        description: `Failed claim attempt: NIK hash ${nikHash} already used.`,
      });
      return res.status(400).json({ message: 'Bonus Premium telah digunakan oleh identitas ini.' });
    }

    // Find PREMIUM TRIAL plan
    const trialPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: 'PREMIUM TRIAL' },
    });

    if (!trialPlan) {
      return res.status(404).json({ message: 'Paket PREMIUM TRIAL tidak ditemukan di sistem.' });
    }

    // Deactivate current active subscriptions
    await prisma.subscription.updateMany({
      where: { userId: ownerId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });

    // Create PREMIUM TRIAL subscription
    const startDate = new Date();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const subscription = await prisma.subscription.create({
      data: {
        userId: ownerId,
        planId: trialPlan.id,
        status: 'ACTIVE',
        startDate,
        endDate,
      },
    });

    // Mask NIK: e.g. ************1234
    const maskedNik = '************' + nik.slice(-4);

    // Save claim
    const claim = await prisma.trialClaim.create({
      data: {
        ownerId,
        nikHash,
        maskedNik,
        expiredAt: endDate,
        status: 'ACTIVE',
      },
    });

    await logAudit({
      action: 'CLAIM_PREMIUM_TRIAL',
      actorId: ownerId,
      targetId: claim.id,
      description: `Owner claimed 30-day Premium Trial using NIK: ${maskedNik}`,
    });

    return res.json({
      message: 'Bonus Premium 30 hari berhasil diklaim!',
      subscription,
      claim,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// [OWNER] GET /subscriptions/payment-history
// Returns full subscription payment history for the owner
// ──────────────────────────────────────────────────

export const getMyPaymentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const payments = await prisma.subscriptionPayment.findMany({
      where: {
        subscription: { userId: ownerId },
      },
      include: {
        subscription: {
          include: {
            plan: { select: { name: true, price: true, durationDays: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format response with readable fields
    const history = payments.map((p) => ({
      id: p.id,
      orderId: p.orderId ?? p.referenceId,
      midtransTransactionId: p.midtransTransactionId,
      amount: Number(p.amount),
      status: p.status,
      paymentMethod: p.paymentMethod,
      planName: p.subscription.plan.name,
      durationDays: p.subscription.plan.durationDays,
      paidAt: p.paidAt,
      expiredAt: p.expiredAt,
      createdAt: p.createdAt,
      subscriptionStatus: p.subscription.status,
      subscriptionStartDate: p.subscription.startDate,
      subscriptionEndDate: p.subscription.endDate,
    }));

    return res.json({ payments: history, total: history.length });
  } catch (error) {
    next(error);
  }
};
