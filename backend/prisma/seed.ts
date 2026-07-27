import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Clean existing records to avoid unique constraints conflict
  await prisma.stockLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.shiftSchedule.deleteMany();
  
  // Set storeId to null for users to break relation before deleting stores
  await prisma.user.updateMany({ data: { storeId: null } });
  
  await prisma.branch.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();

  // 2. Hash default passwords
  const hashedOwnerPassword = await bcrypt.hash('owner123', 10);
  const hashedCashierPassword = await bcrypt.hash('cashier123', 10);
  const hashedSuperPassword = await bcrypt.hash('SuperAdmin123!', 10);

  // 3. Create Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@smartpos.com',
      password: hashedSuperPassword,
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      verifiedAt: new Date(),
    },
  });
  console.log(`Created Super Admin: ${superAdmin.email}`);

  // 3b. Create Owner
  const owner = await prisma.user.create({
    data: {
      email: 'owner@kasirmu.com',
      password: hashedOwnerPassword,
      name: 'Budi Setiawan',
      role: 'OWNER',
      status: 'ACTIVE',
      verifiedAt: new Date(),
    },
  });
  console.log(`Created Owner: ${owner.email}`);

  // 4. Create Store
  const store = await prisma.store.create({
    data: {
      name: 'KopiMu Cafe & Resto',
      address: 'Jl. Pemuda No. 120, Semarang',
      phone: '08123456789',
      logo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=200&auto=format&fit=crop',
      ownerId: owner.id,
      pairingCode: 'pair_kopimu_2026',
    },
  });
  console.log(`Created Store: ${store.name} (Pairing Code: ${store.pairingCode})`);

  // 5. Create Branch
  const branch = await prisma.branch.create({
    data: {
      name: 'Pemuda Main Branch',
      address: 'Jl. Pemuda No. 120, Semarang',
      phone: '08123456789',
      storeId: store.id,
    },
  });
  console.log(`Created Branch: ${branch.name}`);

  // 6. Create Cashiers (already paired to the store)
  const cashier = await prisma.user.create({
    data: {
      email: 'cashier@kasirmu.com',
      username: 'cashier01',
      password: hashedCashierPassword,
      name: 'Siti Rahma',
      role: 'CASHIER',
      status: 'ACTIVE',
      storeId: store.id,
    },
  });
  console.log(`Created Cashier: ${cashier.email}`);

  const cashier2 = await prisma.user.create({
    data: {
      email: 'andi@kasirmu.com',
      username: 'andi02',
      password: hashedCashierPassword,
      name: 'Andi Wijaya',
      role: 'CASHIER',
      status: 'ACTIVE',
      storeId: store.id,
      profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop'
    },
  });
  console.log(`Created Cashier 2: ${cashier2.email}`);

  // 7. Create Categories
  const catCoffee = await prisma.category.create({
    data: { name: 'Coffee Drinks', storeId: store.id },
  });
  const catNonCoffee = await prisma.category.create({
    data: { name: 'Non-Coffee Drinks', storeId: store.id },
  });
  const catPastry = await prisma.category.create({
    data: { name: 'Pastries & Breads', storeId: store.id },
  });
  const catHeavyFood = await prisma.category.create({
    data: { name: 'Main Course', storeId: store.id },
  });
  console.log('Created Categories');

  // 8. Create Products
  const productsData = [
    {
      name: 'Espresso Single Shot',
      barcode: '888001',
      description: 'Strong concentrated coffee shot.',
      price: 18000.0,
      costPrice: 6000.0,
      stock: 50,
      minStockAlert: 10,
      categoryId: catCoffee.id,
      image: 'https://images.unsplash.com/photo-1510707577719-ea7c199a5312?q=80&w=200&auto=format&fit=crop',
    },
    {
      name: 'Iced Cappuccino Latte',
      barcode: '888002',
      description: 'Espresso with cold milk and rich milk foam.',
      price: 28000.0,
      costPrice: 9000.0,
      stock: 40,
      minStockAlert: 8,
      categoryId: catCoffee.id,
      image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=200&auto=format&fit=crop',
    },
    {
      name: 'Matcha Green Tea Latte',
      barcode: '888003',
      description: 'Premium Kyoto matcha whisked with fresh milk.',
      price: 30000.0,
      costPrice: 11000.0,
      stock: 25,
      minStockAlert: 5,
      categoryId: catNonCoffee.id,
      image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?q=80&w=200&auto=format&fit=crop',
    },
    {
      name: 'Butter Croissant',
      barcode: '888004',
      description: 'Flaky and buttery French pastry.',
      price: 22000.0,
      costPrice: 8500.0,
      stock: 15,
      minStockAlert: 5,
      categoryId: catPastry.id,
      image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=200&auto=format&fit=crop',
    },
    {
      name: 'Nasi Goreng Khas KopiMu',
      barcode: '888005',
      description: 'Signature fried rice served with sunny side up egg and satay.',
      price: 35000.0,
      costPrice: 15000.0,
      stock: 30,
      minStockAlert: 5,
      categoryId: catHeavyFood.id,
      image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=200&auto=format&fit=crop',
    },
    {
      name: 'Fudge Chocolate Cookie',
      barcode: '888006',
      description: 'Soft-baked cookie filled with decadent dark chocolate chips.',
      price: 15000.0,
      costPrice: 5000.0,
      stock: 4, // low stock trigger test
      minStockAlert: 5,
      categoryId: catPastry.id,
      image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?q=80&w=200&auto=format&fit=crop',
    },
  ];

  const productsList = [];
  for (const item of productsData) {
    const prod = await prisma.product.create({
      data: {
        ...item,
        storeId: store.id,
      },
    });
    productsList.push(prod);

    // Initial stock logs
    await prisma.stockLog.create({
      data: {
        productId: prod.id,
        type: 'IN',
        quantity: item.stock,
        description: 'Seeded initial inventory',
        userId: owner.id,
      },
    });
  }
  console.log(`Created ${productsList.length} Products with Stock Logs`);

  // 9. Seed historical transactions for reports
  // Generate transactions spread over the last 7 days
  const shiftsList = [];
  
  // Create 3 historical shifts for this cashier
  for (let i = 6; i >= 0; i -= 2) {
    const shiftDate = new Date();
    shiftDate.setDate(shiftDate.getDate() - i);
    
    // Start of day
    shiftDate.setHours(8, 0, 0, 0);

    const histShift = await prisma.shift.create({
      data: {
        userId: cashier.id,
        storeId: store.id,
        branchId: branch.id,
        startTime: shiftDate,
        endTime: new Date(shiftDate.getTime() + 8 * 60 * 60 * 1000), // 8 hours shift
        startingCash: 500000.0,
        endingCash: 950000.0,
        totalSales: 0, // will calculate below
        status: 'CLOSED',
      },
    });
    shiftsList.push(histShift);
  }

  // Generate 15 transactions distributed among shifts
  const paymentMethods = ['CASH', 'QRIS'] as const;
  let totalRevenueSeeded = 0;

  for (let j = 0; j < 15; j++) {
    // Pick a shift
    const shift = shiftsList[j % shiftsList.length];
    const txTime = new Date(shift.startTime.getTime() + (j * 20 * 60 * 1000)); // offset by 20m increments
    const method = paymentMethods[j % 2];
    
    // Pick 1-3 random products
    const selectedProds = productsList.slice(0, 1 + (j % 3));
    let subtotal = 0;
    
    const itemDetails = selectedProds.map((prod) => {
      const quantity = 1 + (j % 2);
      const total = Number(prod.price) * quantity;
      subtotal += total;
      
      return {
        productId: prod.id,
        productName: prod.name,
        price: prod.price,
        quantity,
        total,
      };
    });

    const discount = j % 5 === 0 ? 5000 : 0;
    const finalTotal = subtotal - discount;

    const txNumber = `TX-${txTime.toISOString().slice(0, 10).replace(/-/g, '')}-${1000 + j}`;

    const txRecord = await prisma.transaction.create({
      data: {
        transactionNumber: txNumber,
        storeId: store.id,
        branchId: branch.id,
        cashierId: cashier.id,
        subtotal,
        discount,
        total: finalTotal,
        paymentMethod: method,
        status: 'PAID',
        shiftId: shift.id,
        createdAt: txTime,
        updatedAt: txTime,
        items: {
          create: itemDetails.map(it => ({
            productId: it.productId,
            productName: it.productName,
            price: it.price,
            quantity: it.quantity,
            total: it.total
          }))
        }
      },
    });

    // Create completed payment log
    await prisma.payment.create({
      data: {
        transactionId: txRecord.id,
        paymentType: method.toLowerCase(),
        grossAmount: finalTotal,
        transactionStatus: 'settlement',
        createdAt: txTime,
        updatedAt: txTime,
      },
    });

    // Deduct stock log for this transaction
    for (const it of itemDetails) {
      await prisma.stockLog.create({
        data: {
          productId: it.productId,
          type: 'OUT',
          quantity: it.quantity,
          description: `Historical sale ${txNumber}`,
          userId: cashier.id,
          createdAt: txTime,
        },
      });
    }

    // Accumulate shift totalSales
    await prisma.shift.update({
      where: { id: shift.id },
      data: {
        totalSales: { increment: finalTotal },
      },
    });

    totalRevenueSeeded += finalTotal;
  }

  // Create schedules today for both cashiers
  const now = new Date();
  const todaySitiStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  const todaySitiEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0, 0);

  const todayAndiStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0, 0);
  const todayAndiEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0, 0, 0);

  const sitiSchedule = await prisma.shiftSchedule.create({
    data: {
      storeId: store.id,
      cashierId: cashier.id,
      shiftName: 'Shift Pagi',
      startTime: todaySitiStart,
      endTime: todaySitiEnd,
      status: 'IN_PROGRESS',
    }
  });

  const andiSchedule = await prisma.shiftSchedule.create({
    data: {
      storeId: store.id,
      cashierId: cashier2.id,
      shiftName: 'Shift Siang',
      startTime: todayAndiStart,
      endTime: todayAndiEnd,
      status: 'SCHEDULED',
    }
  });

  // Create one active OPEN shift for current session testing
  await prisma.shift.create({
    data: {
      userId: cashier.id,
      storeId: store.id,
      branchId: branch.id,
      startTime: new Date(),
      startingCash: 300000.0,
      status: 'OPEN',
      scheduleId: sitiSchedule.id,
    },
  });

  console.log(`Seeded historical shifts. Cumulative sales seeded: IDR ${totalRevenueSeeded}`);

  // 10. Seed Subscription plans
  await prisma.subscriptionPayment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();

  const freePlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'FREE',
      description: 'Paket gratis untuk memulai bisnis Anda',
      price: 0,
      features: '1 Toko,5 Produk,2 Kategori,3 Kasir,Pembayaran Tunai,Dashboard Dasar',
      durationDays: 36500, // ~100 tahun = unlimited
      isActive: true,
      // Resource limits
      maxStore: 1,
      maxProduct: 5,
      maxCashier: 3,
      maxCategory: 2,
      // Feature flags - all disabled for FREE
      canUseMidtrans: false,
      canUseQRIS: false,
      canUseExport: false,
      canUseAnalytics: false,
      canUseAPI: false,
      canUseAI: false,
      canUseMultiBranch: false,
      canUseLoyalty: false,
      canUsePromo: false,
    }
  });

  const premiumPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'PREMIUM',
      description: 'Solusi lengkap untuk bisnis berkembang — paket premium',
      price: 80000,
      features: '5 Toko,Produk Unlimited,Kasir Unlimited,Kategori Unlimited,QRIS Midtrans,GoPay,Bank Transfer,Credit Card,Payment Link,Laporan Lengkap,Export Excel,Export PDF,Dashboard Realtime,AI Analytics,AI Sales Prediction,Customer Member,Promo & Voucher,Multi Cabang,Audit Log,Backup Otomatis,Notifikasi WhatsApp,API Access',
      durationDays: 30,
      isActive: true,
      // Resource limits (-1 = unlimited)
      maxStore: 5,
      maxProduct: -1,
      maxCashier: -1,
      maxCategory: -1,
      // Feature flags - all enabled for PREMIUM
      canUseMidtrans: true,
      canUseQRIS: true,
      canUseExport: true,
      canUseAnalytics: true,
      canUseAPI: true,
      canUseAI: true,
      canUseMultiBranch: true,
      canUseLoyalty: true,
      canUsePromo: true,
    }
  });

  const premiumTrialPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'PREMIUM TRIAL',
      description: 'Paket uji coba premium gratis 30 hari',
      price: 0,
      features: '5 Toko,Produk Unlimited,Kasir Unlimited,Kategori Unlimited,QRIS Midtrans,GoPay,Bank Transfer,Credit Card,Payment Link,Laporan Lengkap,Export Excel,Export PDF,Dashboard Realtime,AI Analytics,AI Sales Prediction,Customer Member,Promo & Voucher,Multi Cabang,Audit Log,Backup Otomatis,Notifikasi WhatsApp,API Access',
      durationDays: 30,
      isActive: true,
      // Resource limits (-1 = unlimited)
      maxStore: 5,
      maxProduct: -1,
      maxCashier: -1,
      maxCategory: -1,
      // Feature flags - all enabled for PREMIUM TRIAL
      canUseMidtrans: true,
      canUseQRIS: true,
      canUseExport: true,
      canUseAnalytics: true,
      canUseAPI: true,
      canUseAI: true,
      canUseMultiBranch: true,
      canUseLoyalty: true,
      canUsePromo: true,
    }
  });

  // Assign PREMIUM plan to demo owner (since they have more than 5 products in seed)
  const ownerSubscription = await prisma.subscription.create({
    data: {
      userId: owner.id,
      planId: premiumPlan.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }
  });

  console.log(`Seeded Subscription Plans: FREE (id: ${freePlan.id}), PREMIUM (id: ${premiumPlan.id}) & PREMIUM TRIAL (id: ${premiumTrialPlan.id})`);
  console.log(`Assigned PREMIUM plan to owner: ${owner.email}`);


  // 11. Seed System Settings
  await prisma.systemSetting.deleteMany();
  await prisma.systemSetting.createMany({
    data: [
      {
        key: 'maintenance_mode',
        value: 'false',
      },
      {
        key: 'maintenance_message',
        value: 'Sistem sedang dalam pemeliharaan berkala untuk peningkatan performa. Silakan kembali beberapa saat lagi.',
      }
    ]
  });
  console.log('Seeded System Settings');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
