import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';
import { createSnapPayment } from '../services/midtrans';
import { emitToStore } from '../services/socket';
import { checkFeatureAccess } from '../services/subscription';

// Validation Schemas
export const createTransactionSchema = z.object({
  body: z.object({
    storeId: z.string().uuid('Invalid Store ID'),
    branchId: z.string().uuid().optional().nullable(),
    discount: z.number().nonnegative().optional(),
    paymentMethod: z.enum(['CASH', 'QRIS']),
    customerName: z.string().optional().nullable(),
    customerPhone: z.string().optional().nullable(),
    tableNumber: z.string().optional().nullable(),
    orderType: z.enum(['DINE_IN', 'TAKE_AWAY']),
    notes: z.string().optional().nullable(),
    items: z.array(
      z.object({
        productId: z.string().uuid('Invalid Product ID'),
        quantity: z.number().int().positive('Quantity must be greater than 0'),
      })
    ).min(1, 'Transaction must contain at least one item'),
  }),
});

export const startShiftSchema = z.object({
  body: z.object({
    startingCash: z.number().nonnegative('Starting cash cannot be negative'),
    storeId: z.string().uuid('Invalid Store ID'),
    branchId: z.string().uuid().optional(),
  }),
});

export const endShiftSchema = z.object({
  body: z.object({
    endingCash: z.number().nonnegative('Ending cash cannot be negative'),
  }),
});

// Transaction Handlers
export const createTransaction = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cashierId = req.user?.id;
    if (!cashierId) return res.status(401).json({ message: 'Unauthorized' });

    const {
      storeId,
      branchId,
      discount = 0,
      paymentMethod,
      items,
      customerName,
      customerPhone,
      tableNumber,
      orderType,
      notes,
    } = req.body;

    const finalTableNumber = orderType === 'TAKE_AWAY' ? null : tableNumber;

    // 1. Verify active shift for this cashier in this store
    const activeShift = await prisma.shift.findFirst({
      where: {
        userId: cashierId,
        storeId,
        status: 'OPEN',
      },
    });

    if (!activeShift) {
      return res.status(400).json({ message: 'Active shift is required to perform transactions' });
    }

    // 2. Fetch products and calculate pricing
    const productIds = items.map((i: any) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId },
    });

    if (dbProducts.length !== items.length) {
      return res.status(400).json({ message: 'One or more products were not found' });
    }

    let subtotal = 0;
    const itemDetailsToInsert: { productId: string; productName: string; price: any; quantity: number; total: number }[] = [];

    // Check stocks before updating
    for (const item of items) {
      const product = dbProducts.find((p) => p.id === item.productId)!;
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for product: ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` 
        });
      }
      const itemTotal = Number(product.price) * item.quantity;
      subtotal += itemTotal;

      itemDetailsToInsert.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity,
        total: itemTotal,
      });
    }

    const subtotalAfterDiscount = subtotal - discount;
    const baseAmount = subtotalAfterDiscount < 0 ? 0 : subtotalAfterDiscount;
    let tax = 0;
    let finalTotal = baseAmount;

    const taxSetting = await prisma.taxSetting.findUnique({
      where: { storeId }
    });

    if (taxSetting && taxSetting.isActive) {
      const percentage = Number(taxSetting.percentage);
      if (taxSetting.calculationType === 'INCLUSIVE') {
        tax = Math.round(baseAmount - (baseAmount / (1 + (percentage / 100))));
        finalTotal = baseAmount;
      } else {
        tax = Math.round(baseAmount * (percentage / 100));
        finalTotal = baseAmount + tax;
      }
    }

    // Generate daily sequential Invoice and Queue Numbers
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const countTodayInStore = await prisma.transaction.count({
      where: {
        storeId,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    const countTodayGlobal = await prisma.transaction.count({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let invoiceNumber = '';
    let queueNumber = '';
    let isUnique = false;
    let seqStore = countTodayInStore + 1;
    let seqGlobal = countTodayGlobal + 1;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const seqStr = seqGlobal.toString().padStart(4, '0');
      invoiceNumber = `INV-${dateStr}-${seqStr}`;
      queueNumber = `A${seqStore.toString().padStart(3, '0')}`;

      const existing = await prisma.transaction.findFirst({
        where: {
          OR: [
            { invoiceNumber },
            {
              storeId,
              queueNumber,
              createdAt: {
                gte: startOfToday,
                lte: endOfToday,
              },
            },
          ],
        },
      });

      if (!existing) {
        isUnique = true;
      } else {
        seqStore++;
        seqGlobal++;
        attempts++;
      }
    }

    const transactionNumber = invoiceNumber;

    // 3. Database Transaction (Atomic operations)
    const result = await prisma.$transaction(async (tx) => {
      // Create Transaction
      const transaction = await tx.transaction.create({
        data: {
          transactionNumber,
          invoiceNumber,
          queueNumber,
          customerName,
          customerPhone,
          tableNumber: finalTableNumber,
          orderType,
          notes,
          paymentStatus: paymentMethod === 'CASH' ? 'PAID' : 'PENDING_PAYMENT',
          storeId,
          branchId,
          cashierId,
          subtotal,
          discount,
          tax,
          total: finalTotal,
          paymentMethod,
          status: paymentMethod === 'CASH' ? 'PAID' : 'PENDING',
          shiftId: activeShift.id,
          items: {
            create: itemDetailsToInsert.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              price: item.price,
              quantity: item.quantity,
              total: item.total,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Update inventory stocks and log
      for (const item of items) {
        const product = dbProducts.find((p) => p.id === item.productId)!;
        
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.stockLog.create({
          data: {
            productId: product.id,
            type: 'OUT',
            quantity: item.quantity,
            description: `Sale transaction ${transactionNumber}`,
            userId: cashierId,
          },
        });
      }

      // If CASH, update shift cumulative totals
      if (paymentMethod === 'CASH') {
        await tx.shift.update({
          where: { id: activeShift.id },
          data: { totalSales: { increment: finalTotal } },
        });
      }

      return transaction;
    });

    // 4. Handle QRIS integration if chosen
    let paymentDetails = null;
    let finalTransactionData = result;
    let snapMidtransClientKey: string | undefined;
    let snapMidtransEnvironment: string | undefined;

    if (paymentMethod === 'QRIS') {
      try {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { ownerId: true },
        });

        if (!store) {
          return res.status(404).json({ message: 'Toko tidak ditemukan' });
        }

        const featureAccess = await checkFeatureAccess(store.ownerId, 'canUseQRIS');
        if (!featureAccess.allowed) {
          return res.status(403).json({
            message: 'Fitur Pembayaran QRIS hanya tersedia untuk paket PREMIUM. Silakan upgrade paket Anda.',
            code: 'FEATURE_NOT_AVAILABLE',
          });
        }

        // createSnapPayment resolves credentials internally from PaymentGateway table
        const snapData = await createSnapPayment(
          transactionNumber,
          finalTotal,
          storeId,
        );
        snapMidtransClientKey = snapData.clientKey;
        snapMidtransEnvironment = snapData.environment;
        
        // Save snap token and redirect URL directly to Transaction model
        finalTransactionData = await prisma.transaction.update({
          where: { id: result.id },
          data: {
            snapToken: snapData.snapToken,
            paymentUrl: snapData.paymentUrl,
            midtransOrderId: snapData.midtransOrderId,
            midtransTransactionId: snapData.midtransTransactionId || null,
            qrString: snapData.qrString || null,
            transactionStatus: 'pending',
            paymentType: 'qris',
            status: 'WAITING_PAYMENT',
            expiredAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes limit
          },
          include: {
            items: true,
          },
        });

        // Also create/populate legacy Payment table for compatibility
        paymentDetails = await prisma.payment.create({
          data: {
            transactionId: result.id,
            paymentType: 'qris',
            grossAmount: finalTotal,
            transactionStatus: 'pending',
            transactionIdMidtrans: snapData.midtransTransactionId || null,
            qrCodeUrl: snapData.qrCodeUrl || null,
            qrData: snapData.qrString || null,
            expiryTime: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
      } catch (err) {
        console.error('Failed to create QRIS payment:', err);
        // Clean up the created transaction if QRIS initialization fails
        await prisma.transaction.delete({ where: { id: result.id } }).catch(() => {});
        throw new Error('QRIS Payment generation failed. Try again.');
      }
    } else {
      // Create completed CASH payment
      paymentDetails = await prisma.payment.create({
        data: {
          transactionId: result.id,
          paymentType: 'cash',
          grossAmount: finalTotal,
          transactionStatus: 'settlement',
        },
      });
    }

    // 5. Emit real-time synchronization updates
    // Update inventory stocks on owners/cashiers screens
    for (const item of result.items) {
      const dbProd = dbProducts.find((p) => p.id === item.productId);
      if (dbProd) {
        emitToStore(storeId, 'stock_update', { 
          productId: item.productId, 
          newStock: dbProd.stock - item.quantity 
        });
      }
    }

    // Broadcast new transaction to owner real-time dashboard
    emitToStore(storeId, 'new_transaction', {
      transactionId: finalTransactionData.id,
      transactionNumber: finalTransactionData.transactionNumber,
      total: finalTransactionData.total,
      paymentMethod: finalTransactionData.paymentMethod,
      status: finalTransactionData.status,
      createdAt: finalTransactionData.createdAt,
      cashierName: req.user?.name,
      cashier: { name: req.user?.name },
    });

    return res.status(201).json({
      message: 'Transaction created successfully',
      transaction: finalTransactionData,
      payment: paymentDetails,
      // Expose clientKey & environment so frontend can load correct Snap JS
      midtransClientKey: snapMidtransClientKey,
      midtransEnvironment: snapMidtransEnvironment,
    });
  } catch (error: any) {
    next(error);
  }
};

export const getTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      return res.status(400).json({ message: 'Store ID query parameter is required' });
    }

    const {
      invoiceNumber,
      queueNumber,
      customerName,
      customerPhone,
      cashierName,
      branchId,
      date,
      search,
    } = req.query;

    const whereClause: any = { storeId };

    if (branchId) {
      whereClause.branchId = branchId as string;
    }

    if (invoiceNumber) {
      whereClause.invoiceNumber = { contains: invoiceNumber as string };
    }
    if (queueNumber) {
      whereClause.queueNumber = { contains: queueNumber as string };
    }
    if (customerName) {
      whereClause.customerName = { contains: customerName as string };
    }
    if (customerPhone) {
      whereClause.customerPhone = { contains: customerPhone as string };
    }
    if (cashierName) {
      whereClause.cashier = {
        name: { contains: cashierName as string },
      };
    }
    if (date) {
      const targetDate = new Date(date as string);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      whereClause.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (search) {
      const searchStr = search as string;
      whereClause.OR = [
        { invoiceNumber: { contains: searchStr } },
        { transactionNumber: { contains: searchStr } },
        { queueNumber: { contains: searchStr } },
        { customerName: { contains: searchStr } },
        { customerPhone: { contains: searchStr } },
        {
          cashier: {
            name: { contains: searchStr },
          },
        },
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        cashier: { select: { name: true } },
        items: true,
        payment: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // limit to 100 latest
    });

    return res.json({ transactions });
  } catch (error) {
    next(error);
  }
};

export const getTransactionDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        items: true,
        payment: true,
        cashier: { select: { name: true } },
        store: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    return res.json({ transaction });
  } catch (error) {
    next(error);
  }
};

// Shift Handlers
export const startShift = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { startingCash, storeId, branchId } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Check if shift is already active
    const activeShift = await prisma.shift.findFirst({
      where: { userId, storeId, status: 'OPEN' },
    });

    if (activeShift) {
      return res.status(400).json({ message: 'You already have an active open shift' });
    }

    let scheduleId: string | null = null;
    if (req.user?.role === 'CASHIER') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const schedule = await prisma.shiftSchedule.findFirst({
        where: {
          cashierId: userId,
          storeId,
          startTime: { gte: startOfToday, lte: endOfToday },
          status: 'SCHEDULED'
        }
      });

      if (schedule) {
        scheduleId = schedule.id;
      }
    }

    const shift = await prisma.shift.create({
      data: {
        userId,
        storeId,
        branchId,
        startingCash,
        totalSales: 0,
        status: 'OPEN',
        scheduleId: scheduleId || undefined,
      },
    });

    if (scheduleId) {
      await prisma.shiftSchedule.update({
        where: { id: scheduleId },
        data: { status: 'IN_PROGRESS' }
      });
    }

    return res.status(201).json({
      message: 'Cashier shift opened successfully',
      shift,
    });
  } catch (error) {
    next(error);
  }
};

export const endShift = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { endingCash } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: 'OPEN' },
    });

    if (!activeShift) {
      return res.status(400).json({ message: 'No active open shift found to close' });
    }

    const shift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        endingCash,
        endTime: new Date(),
        status: 'CLOSED',
      },
    });

    if (shift.scheduleId) {
      await prisma.shiftSchedule.update({
        where: { id: shift.scheduleId },
        data: { status: 'FINISHED' }
      });
    }

    return res.json({
      message: 'Cashier shift closed successfully',
      shift,
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveShift = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const storeId = req.query.storeId as string;

    if (!userId || !storeId) {
      return res.status(400).json({ message: 'User ID and Store ID are required' });
    }

    const shift = await prisma.shift.findFirst({
      where: { userId, storeId, status: 'OPEN' },
    });

    return res.json({ shift });
  } catch (error) {
    next(error);
  }
};

export const getShifts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query.storeId as string;
    const userId = req.query.userId as string; // Optional filter by cashier

    if (!storeId) {
      return res.status(400).json({ message: 'Store ID query parameter is required' });
    }

    const whereClause: any = { storeId };
    if (userId) {
      whereClause.userId = userId;
    }

    const shifts = await prisma.shift.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ shifts });
  } catch (error) {
    next(error);
  }
};

export const forceEndShift = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    const { id } = req.params; // shiftId
    const { endingCash } = req.body;

    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    // Verify shift exists and belongs to a store owned by the owner
    const shift = await prisma.shift.findFirst({
      where: { id },
      include: { store: true },
    });

    if (!shift || shift.store.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Unauthorized access to shift context' });
    }

    if (shift.status === 'CLOSED') {
      return res.status(400).json({ message: 'Shift is already closed' });
    }

    const expectedEndingCash = Number(shift.startingCash) + Number(shift.totalSales);
    const finalEndingCash = endingCash !== undefined ? endingCash : expectedEndingCash;

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        endingCash: finalEndingCash,
        endTime: new Date(),
        status: 'CLOSED',
      },
    });

    if (updatedShift.scheduleId) {
      await prisma.shiftSchedule.update({
        where: { id: updatedShift.scheduleId },
        data: { status: 'FINISHED' }
      });
    }

    // Notify the store via WebSocket that the shift has been force-closed
    emitToStore(shift.storeId, 'shift_closed', { shiftId: shift.id });

    return res.json({
      message: 'Cashier shift force closed successfully',
      shift: updatedShift,
    });
  } catch (error) {
    next(error);
  }
};

export const getNextCashiers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) return res.status(400).json({ message: 'Store ID is required' });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const schedules = await prisma.shiftSchedule.findMany({
      where: {
        storeId,
        startTime: { gte: startOfToday, lte: endOfToday },
        status: 'SCHEDULED'
      },
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            profileImage: true,
            status: true,
            isOnline: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    return res.json({ schedules });
  } catch (err) {
    next(err);
  }
};

export const getTodayShifts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) return res.status(400).json({ message: 'Store ID is required' });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const schedules = await prisma.shiftSchedule.findMany({
      where: {
        storeId,
        startTime: { gte: startOfToday, lte: endOfToday }
      },
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            profileImage: true,
            isOnline: true
          }
        },
        shifts: {
          orderBy: { startTime: 'desc' }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    return res.json({ schedules });
  } catch (err) {
    next(err);
  }
};
