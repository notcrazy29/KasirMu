const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const subs = await p.subscription.findMany({
    where: { status: { in: ['PENDING_PAYMENT', 'ACTIVE', 'CANCELLED'] } },
    include: { plan: true, user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  console.log('\n=== Recent Subscriptions ===');
  subs.forEach(s => {
    console.log({
      id: s.id.substring(0, 12) + '...',
      status: s.status,
      plan: s.plan.name,
      user: s.user.email,
      midtransOrderId: s.midtransOrderId,
      startDate: s.startDate,
      endDate: s.endDate,
      createdAt: s.createdAt,
    });
  });

  const payments = await p.subscriptionPayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('\n=== Recent SubscriptionPayments ===');
  payments.forEach(p2 => {
    console.log({
      id: p2.id.substring(0, 12) + '...',
      subscriptionId: p2.subscriptionId.substring(0, 12) + '...',
      status: p2.status,
      amount: p2.amount,
      orderId: p2.orderId,
      paidAt: p2.paidAt,
    });
  });

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
