import prisma from '../config/db';
import { logAudit } from './audit';
import { sendEmail } from './email';
import { NotificationService } from './notification';
import { getIO } from './socket';

// ──────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────

const GRACE_PERIOD_DAYS = 7;

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────

export interface PlanFeatures {
  maxStore: number;
  maxProduct: number;
  maxCashier: number;
  maxCategory: number;
  canUseMidtrans: boolean;
  canUseQRIS: boolean;
  canUseExport: boolean;
  canUseAnalytics: boolean;
  canUseAPI: boolean;
  canUseAI: boolean;
  canUseMultiBranch: boolean;
  canUseLoyalty: boolean;
  canUsePromo: boolean;
}

export interface OwnerSubscriptionInfo {
  subscription: any;
  plan: any & PlanFeatures;
  isPremium: boolean;
  isGracePeriod: boolean;
  gracePeriodUntil: Date | null;
  usage: {
    stores: number;
    products: number;
    cashiers: number;
    categories: number;
  };
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  max: number;
  resource: string;
}

// ──────────────────────────────────────────────────
// Get owner active plan (with usage stats)
// ──────────────────────────────────────────────────

export const getOwnerActivePlan = async (ownerId: string): Promise<OwnerSubscriptionInfo | null> => {
  // Auto-expire subscriptions
  await expireSubscriptions();

  // Find the most recent ACTIVE or GRACE_PERIOD subscription
  let subscription = await prisma.subscription.findFirst({
    where: {
      userId: ownerId,
      status: { in: ['ACTIVE', 'GRACE_PERIOD'] },
    },
    include: {
      plan: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Auto-assign FREE plan if owner has no active/grace subscription
  if (!subscription) {
    await assignFreePlan(ownerId);
    subscription = await prisma.subscription.findFirst({
      where: {
        userId: ownerId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!subscription) return null;

  const isGracePeriod = subscription.status === 'GRACE_PERIOD';

  // Get current usage counts (across all stores of the owner)
  const ownerStores = await prisma.store.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const storeIds = ownerStores.map((s) => s.id);

  const [storeCount, productCount, cashierCount, categoryCount] = await Promise.all([
    prisma.store.count({ where: { ownerId } }),
    storeIds.length > 0
      ? prisma.product.count({ where: { storeId: { in: storeIds } } })
      : Promise.resolve(0),
    storeIds.length > 0
      ? prisma.user.count({ where: { role: 'CASHIER', storeId: { in: storeIds } } })
      : Promise.resolve(0),
    storeIds.length > 0
      ? prisma.category.count({ where: { storeId: { in: storeIds } } })
      : Promise.resolve(0),
  ]);

  // isPremium is true only when ACTIVE (not GRACE_PERIOD)
  const isPremium =
    (subscription.plan.name === 'PRO' ||
      subscription.plan.name === 'PREMIUM' ||
      subscription.plan.name === 'PREMIUM TRIAL') &&
    subscription.status === 'ACTIVE';

  return {
    subscription,
    plan: subscription.plan,
    isPremium,
    isGracePeriod,
    gracePeriodUntil: subscription.gracePeriodUntil ?? null,
    usage: {
      stores: storeCount,
      products: productCount,
      cashiers: cashierCount,
      categories: categoryCount,
    },
  };
};

// ──────────────────────────────────────────────────
// Check feature access
// ──────────────────────────────────────────────────

export const checkFeatureAccess = async (
  ownerId: string,
  feature: keyof PlanFeatures
): Promise<{ allowed: boolean; planName: string }> => {
  const info = await getOwnerActivePlan(ownerId);

  // No subscription → treat as most restricted (no access)
  if (!info) {
    return { allowed: false, planName: 'NONE' };
  }

  // During GRACE_PERIOD, premium features are NOT accessible
  if (info.isGracePeriod) {
    // Only allow non-premium features (canUseMidtrans etc. = false during grace)
    const gracePeriodPremiumFeatures: (keyof PlanFeatures)[] = [
      'canUseMidtrans',
      'canUseQRIS',
      'canUseExport',
      'canUseAnalytics',
      'canUseAPI',
      'canUseAI',
      'canUseMultiBranch',
      'canUseLoyalty',
      'canUsePromo',
    ];
    if (gracePeriodPremiumFeatures.includes(feature)) {
      return { allowed: false, planName: 'GRACE_PERIOD' };
    }
  }

  const allowed = info.plan[feature] as boolean;
  return { allowed, planName: info.plan.name };
};

// ──────────────────────────────────────────────────
// Check resource limit before create
// ──────────────────────────────────────────────────

export const checkResourceLimit = async (
  ownerId: string,
  resource: 'store' | 'product' | 'cashier' | 'category',
  storeId?: string // needed for product/cashier/category
): Promise<LimitCheckResult> => {
  const info = await getOwnerActivePlan(ownerId);

  if (!info) {
    return { allowed: false, current: 0, max: 0, resource };
  }

  // During GRACE_PERIOD, enforce FREE plan limits (can't add new resources)
  // Data stays, but adding new is blocked
  if (info.isGracePeriod) {
    // Use FREE plan limits during grace period
    const freePlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'FREE' } });
    if (!freePlan) return { allowed: false, current: 0, max: 0, resource };

    let current = 0;
    let max = 0;

    switch (resource) {
      case 'store':
        current = info.usage.stores;
        max = freePlan.maxStore;
        break;
      case 'product':
        if (storeId) current = await prisma.product.count({ where: { storeId } });
        else current = info.usage.products;
        max = freePlan.maxProduct;
        break;
      case 'cashier':
        if (storeId) current = await prisma.user.count({ where: { role: 'CASHIER', storeId } });
        else current = info.usage.cashiers;
        max = freePlan.maxCashier;
        break;
      case 'category':
        if (storeId) current = await prisma.category.count({ where: { storeId } });
        else current = info.usage.categories;
        max = freePlan.maxCategory;
        break;
    }
    return { allowed: current < max, current, max, resource };
  }

  const plan = info.plan;
  let current = 0;
  let max = 0;

  switch (resource) {
    case 'store':
      current = info.usage.stores;
      max = plan.maxStore;
      break;

    case 'product':
      if (storeId) {
        current = await prisma.product.count({ where: { storeId } });
      } else {
        current = info.usage.products;
      }
      max = plan.maxProduct;
      break;

    case 'cashier':
      if (storeId) {
        current = await prisma.user.count({ where: { role: 'CASHIER', storeId } });
      } else {
        current = info.usage.cashiers;
      }
      max = plan.maxCashier;
      break;

    case 'category':
      if (storeId) {
        current = await prisma.category.count({ where: { storeId } });
      } else {
        current = info.usage.categories;
      }
      max = plan.maxCategory;
      break;
  }

  // -1 = unlimited
  if (max === -1) {
    return { allowed: true, current, max, resource };
  }

  return { allowed: current < max, current, max, resource };
};

// ──────────────────────────────────────────────────
// Assign FREE plan to newly approved owner
// ──────────────────────────────────────────────────

export const assignFreePlan = async (ownerId: string): Promise<void> => {
  // Check if owner already has any subscription
  const existing = await prisma.subscription.findFirst({
    where: { userId: ownerId },
  });

  if (existing) return; // Already has a plan

  // Find FREE plan
  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { name: 'FREE' },
  });

  if (!freePlan) {
    console.error('[Subscription] FREE plan not found in database. Run seed first.');
    return;
  }

  // Create subscription with "unlimited" end date for FREE
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 100); // effectively unlimited

  await prisma.subscription.create({
    data: {
      userId: ownerId,
      planId: freePlan.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate,
    },
  });

  await logAudit({
    action: 'ASSIGN_FREE_PLAN',
    actorId: 'SYSTEM',
    targetId: ownerId,
    description: `Auto-assigned FREE plan to owner after approval`,
  });

  console.log(`[Subscription] Assigned FREE plan to owner: ${ownerId}`);
};

// ──────────────────────────────────────────────────
// Activate PREMIUM plan after successful payment
// ──────────────────────────────────────────────────

export const activatePremiumPlan = async (
  ownerId: string,
  planId: string,
  midtransOrderId: string,
  paymentMethod: string = 'MIDTRANS',
  extraPaymentData?: {
    midtransTransactionId?: string;
    paidAt?: Date;
    expiredAt?: Date;
  }
): Promise<void> => {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error('Plan not found');

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationDays);

  // ── Step 1: Find the existing PENDING_PAYMENT subscription for this order ──
  // We UPDATE it in-place to avoid @unique constraint violation on midtransOrderId
  const pendingSub = await prisma.subscription.findFirst({
    where: { userId: ownerId, midtransOrderId },
  });

  let newSubId: string;

  if (pendingSub) {
    // UPDATE the existing PENDING_PAYMENT record to ACTIVE
    // This is safe: midtransOrderId stays the same, no unique constraint issue
    await prisma.subscription.update({
      where: { id: pendingSub.id },
      data: {
        status: 'ACTIVE',
        planId,
        startDate,
        endDate,
        gracePeriodUntil: null,
      },
    });
    newSubId = pendingSub.id;

    // Cancel any OTHER active/grace subscriptions for this owner (not this one)
    await prisma.subscription.updateMany({
      where: {
        userId: ownerId,
        status: { in: ['ACTIVE', 'GRACE_PERIOD'] },
        id: { not: pendingSub.id },
      },
      data: { status: 'CANCELLED' },
    });
  } else {
    // No pending subscription found — cancel existing active ones and create fresh
    await prisma.subscription.updateMany({
      where: { userId: ownerId, status: { in: ['ACTIVE', 'GRACE_PERIOD', 'PENDING_PAYMENT'] } },
      data: { status: 'CANCELLED' },
    });

    const newSub = await prisma.subscription.create({
      data: {
        userId: ownerId,
        planId,
        status: 'ACTIVE',
        startDate,
        endDate,
        midtransOrderId,
        paymentId: midtransOrderId,
        gracePeriodUntil: null,
      },
    });
    newSubId = newSub.id;
  }

  // ── Step 2: Upsert payment record ──
  // Check if payment already recorded (idempotency guard)
  const existingPayment = await prisma.subscriptionPayment.findFirst({
    where: { orderId: midtransOrderId },
  });

  if (!existingPayment) {
    await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: newSubId,
        amount: plan.price,
        status: 'PAID',
        paymentMethod,
        referenceId: midtransOrderId,
        orderId: midtransOrderId,
        midtransTransactionId: extraPaymentData?.midtransTransactionId ?? null,
        paidAt: extraPaymentData?.paidAt ?? new Date(),
        expiredAt: extraPaymentData?.expiredAt ?? null,
      },
    });
  }

  await logAudit({
    action: 'ACTIVATE_PREMIUM',
    actorId: ownerId,
    targetId: newSubId,
    description: `PREMIUM plan activated via ${paymentMethod}. Order: ${midtransOrderId}. startDate: ${startDate.toISOString()}. endDate: ${endDate.toISOString()}`,
  });

  console.log(`[Subscription] PREMIUM activated for owner: ${ownerId}. Order: ${midtransOrderId}. Expires: ${endDate.toISOString()}`);

  // ── Step 3: Emit realtime socket event ──
  try {
    const io = getIO();
    io.to(`user_${ownerId}`).emit('subscription_upgraded', {
      planName: plan.name,
      endDate: endDate.toISOString(),
      isPremium: true,
      isGracePeriod: false,
      message: `🎉 Selamat! Paket ${plan.name} Anda sudah aktif hingga ${endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}!`,
    });
  } catch (_) {
    // Socket not critical
  }
};

// ──────────────────────────────────────────────────
// Expire subscriptions that are past their end date
// Transition: ACTIVE (expired) → GRACE_PERIOD
// Grace Period = 7 days after endDate
// ──────────────────────────────────────────────────

export const expireSubscriptions = async (): Promise<number> => {
  const now = new Date();

  // Find subscriptions that are ACTIVE and past their endDate (non-FREE, non-LIFETIME)
  const toExpire = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      isLifetime: false,
      endDate: { not: null, lt: now },
      plan: { name: { not: 'FREE' } },
    },
    include: { user: { select: { id: true, email: true, name: true } }, plan: true },
  });

  if (toExpire.length === 0) return 0;

  let transitioned = 0;

  for (const sub of toExpire) {
    const gracePeriodUntil = new Date(sub.endDate || now);
    gracePeriodUntil.setDate(gracePeriodUntil.getDate() + GRACE_PERIOD_DAYS);

    // Transition to GRACE_PERIOD
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'GRACE_PERIOD',
        gracePeriodUntil,
      },
    });

    transitioned++;

    await logAudit({
      action: 'SUBSCRIPTION_GRACE_PERIOD',
      actorId: 'SYSTEM',
      targetId: sub.userId,
      description: `Subscription ${sub.plan.name} entered Grace Period for owner: ${sub.user.email}. Grace period until: ${gracePeriodUntil.toISOString()}`,
    });

    console.log(`[Subscription] ${sub.plan.name} entered GRACE_PERIOD for owner: ${sub.userId}. Grace until: ${gracePeriodUntil.toISOString()}`);

    // Emit realtime grace period event
    try {
      const io = getIO();
      io.to(`user_${sub.userId}`).emit('subscription_grace_period', {
        planName: sub.plan.name,
        gracePeriodUntil: gracePeriodUntil.toISOString(),
        endDate: sub.endDate,
        isGracePeriod: true,
        isPremium: false,
        message: `⚠️ Langganan ${sub.plan.name} Anda telah berakhir. Anda masih berada dalam Masa Tenggang selama ${GRACE_PERIOD_DAYS} hari. Segera perpanjang!`,
      });
    } catch (_) {
      // Socket not critical
    }

    // Send email notification about grace period
    try {
      await sendEmail(
        sub.user.email,
        'Langganan Premium KasirMu — Masa Tenggang Aktif',
        `
          <h2>Halo ${sub.user.name},</h2>
          <p>Paket <strong>${sub.plan.name}</strong> Anda telah berakhir pada <strong>${new Date(sub.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</p>
          <p>Anda masih berada dalam <strong>Masa Tenggang selama ${GRACE_PERIOD_DAYS} hari</strong> hingga <strong>${gracePeriodUntil.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</p>
          <p>Selama masa tenggang, Anda masih dapat melihat data toko, produk, transaksi, dan laporan. Namun fitur Premium telah dinonaktifkan sementara.</p>
          <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/subscription" style="background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Perpanjang Sekarang</a></p>
        `
      );
    } catch (_) {
      // Email not critical
    }
  }

  return transitioned;
};

// ──────────────────────────────────────────────────
// Process Grace Period Expirations
// Transition: GRACE_PERIOD (past gracePeriodUntil) → FREE
// ──────────────────────────────────────────────────

export const processGracePeriodExpirations = async (): Promise<number> => {
  const now = new Date();

  // Find subscriptions in GRACE_PERIOD that have passed their gracePeriodUntil
  const toDowngrade = await prisma.subscription.findMany({
    where: {
      status: 'GRACE_PERIOD',
      gracePeriodUntil: { lt: now },
    },
    include: { user: { select: { id: true, email: true, name: true } }, plan: true },
  });

  if (toDowngrade.length === 0) return 0;

  let downgraded = 0;

  for (const sub of toDowngrade) {
    // Mark grace period subscription as EXPIRED
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'EXPIRED' },
    });

    // Assign fresh FREE plan to owner
    await downgradeToFreePlan(sub.userId);

    downgraded++;

    await logAudit({
      action: 'SUBSCRIPTION_DOWNGRADED_TO_FREE',
      actorId: 'SYSTEM',
      targetId: sub.userId,
      description: `Subscription ${sub.plan.name} grace period expired. Owner ${sub.user.email} downgraded to FREE plan.`,
    });

    console.log(`[Subscription] Grace period expired for owner: ${sub.userId}. Downgraded to FREE.`);

    // Emit realtime downgrade event
    try {
      const io = getIO();
      io.to(`user_${sub.userId}`).emit('subscription_expired', {
        planName: sub.plan.name,
        endDate: sub.endDate,
        isGracePeriod: false,
        isPremium: false,
        message: `❌ Masa Tenggang Premium Anda telah berakhir. Akun Anda sekarang menggunakan paket FREE. Perpanjang untuk mengakses kembali semua fitur Premium.`,
      });
    } catch (_) {
      // Socket not critical
    }

    // Send email notification about downgrade
    try {
      await sendEmail(
        sub.user.email,
        'Akun KasirMu Anda Telah Diturunkan ke Paket FREE',
        `
          <h2>Halo ${sub.user.name},</h2>
          <p>Masa Tenggang paket <strong>${sub.plan.name}</strong> Anda telah berakhir.</p>
          <p>Akun Anda sekarang menggunakan <strong>Paket FREE</strong>.</p>
          <p>Semua data Anda tetap aman. Namun Anda dibatasi pada:</p>
          <ul>
            <li>1 Store</li>
            <li>5 Produk</li>
            <li>3 Kasir</li>
          </ul>
          <p>Data yang sebelumnya melebihi batas tetap tersimpan, namun Anda tidak dapat menambah data baru hingga berlangganan kembali.</p>
          <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/subscription" style="background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Berlangganan Kembali</a></p>
        `
      );
    } catch (_) {
      // Email not critical
    }
  }

  return downgraded;
};

// ──────────────────────────────────────────────────
// Downgrade owner to FREE plan
// Called when grace period expires
// ──────────────────────────────────────────────────

const downgradeToFreePlan = async (ownerId: string): Promise<void> => {
  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'FREE' } });
  if (!freePlan) {
    console.error('[Subscription] FREE plan not found. Cannot downgrade.');
    return;
  }

  // Check if a FREE subscription already exists and is ACTIVE
  const existingFree = await prisma.subscription.findFirst({
    where: { userId: ownerId, status: 'ACTIVE', plan: { name: 'FREE' } },
  });

  if (existingFree) return; // Already on FREE plan

  // Create fresh FREE subscription
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 100);

  await prisma.subscription.create({
    data: {
      userId: ownerId,
      planId: freePlan.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate,
      gracePeriodUntil: null,
    },
  });

  console.log(`[Subscription] Created FREE plan for owner: ${ownerId}`);
};

// ──────────────────────────────────────────────────
// Subscription Reminder Checks (7, 3, 1 days before expiry)
// ──────────────────────────────────────────────────

export const runSubscriptionReminderChecks = async () => {
  const now = new Date();

  // Reminder thresholds: 7 days, 3 days, 1 day
  const REMINDER_THRESHOLDS = [7, 3, 1];

  for (const daysLeft of REMINDER_THRESHOLDS) {
    const windowStart = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000 - 60 * 60 * 1000); // threshold - 1 hour
    const windowEnd = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000 + 60 * 60 * 1000);   // threshold + 1 hour

    const expiringSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: windowStart, lte: windowEnd },
        plan: { name: { not: 'FREE' } },
      },
      include: {
        user: true,
        plan: true,
      },
    });

    for (const sub of expiringSubs) {
      const owner = sub.user;
      const actualDaysLeft = Math.ceil((new Date(sub.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`[Subscription Reminder] Sending ${daysLeft}-day reminder to ${owner.email} (${actualDaysLeft} days left)`);

      // 1. Send Website Notification via Socket.IO
      try {
        const io = getIO();
        io.to(`user_${owner.id}`).emit('subscription_warning', {
          message: `⚠️ Langganan ${sub.plan.name} Anda akan berakhir dalam ${actualDaysLeft} hari pada ${new Date(sub.endDate).toLocaleDateString('id-ID')}.`,
          endDate: sub.endDate,
          daysLeft: actualDaysLeft,
        });
      } catch (err) {
        console.error('[Subscription Reminder] Failed to send socket warning:', err);
      }

      // 2. Send Email
      try {
        const emailSubject = `Peringatan: Paket Langganan KasirMu Premium Segera Berakhir`;
        const emailHtml = `
          <h1>Pemberitahuan KasirMu</h1>
          <p>Halo ${owner.name},</p>
          <p>Paket langganan <strong>${sub.plan.name}</strong> Anda akan berakhir dalam <strong>${actualDaysLeft} hari</strong> pada tanggal <strong>${new Date(sub.endDate).toLocaleDateString('id-ID')}</strong>.</p>
          <p>Silakan lakukan perpanjangan paket agar transaksi toko Anda tidak terganggu.</p>
          <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/subscription" style="background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Perpanjang Sekarang</a></p>
        `;
        await sendEmail(owner.email, emailSubject, emailHtml);
      } catch (err) {
        console.error('[Subscription Reminder] Failed to send email warning:', err);
      }

      // 3. Send WhatsApp if phone is available
      if (owner.phone) {
        try {
          const whatsappMsg = `[KasirMu] Halo ${owner.name}, paket langganan ${sub.plan.name} Anda akan berakhir dalam ${actualDaysLeft} hari (${new Date(sub.endDate).toLocaleDateString('id-ID')}). Segera perpanjang paket Anda di dashboard.`;
          await NotificationService.sendWhatsApp(owner.phone, whatsappMsg);
        } catch (err) {
          console.error('[Subscription Reminder] Failed to send WhatsApp warning:', err);
        }
      }
    }
  }
};
