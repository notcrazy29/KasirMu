import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { 
  createSnapPayment, 
  getTransactionStatus, 
  cancelTransaction, 
  verifyWebhookSignature,
  resolveStoreCredentials
} from '../services/midtrans';
import { emitToStore } from '../services/socket';

/**
 * POST /api/payment/create
 * Creates a Midtrans Snap transaction for an existing transaction.
 */
export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ message: 'Transaction ID is required' });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { 
        store: true,
        items: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status === 'PAID') {
      return res.status(400).json({ message: 'Transaction is already paid' });
    }

    // Call Midtrans Snap Payment Service
    const snapResult = await createSnapPayment(
      transaction.transactionNumber,
      Number(transaction.total),
      transaction.storeId
    );

    // Save snap token and redirect URL directly to Transaction model
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        snapToken: snapResult.snapToken,
        paymentUrl: snapResult.paymentUrl,
        midtransOrderId: snapResult.midtransOrderId,
        midtransTransactionId: snapResult.midtransTransactionId || null,
        qrString: snapResult.qrString || null,
        transactionStatus: 'pending',
        paymentType: 'qris',
        status: 'WAITING_PAYMENT',
        expiredAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes limit
      },
    });

    // Keep Payment table synchronized as fallback/legacy compliance
    await prisma.payment.upsert({
      where: { transactionId: transaction.id },
      update: {
        paymentType: 'qris',
        grossAmount: transaction.total,
        transactionStatus: 'pending',
        transactionIdMidtrans: snapResult.midtransTransactionId || null,
        qrCodeUrl: snapResult.qrCodeUrl || null,
        qrData: snapResult.qrString || null,
        expiryTime: new Date(Date.now() + 15 * 60 * 1000),
      },
      create: {
        transactionId: transaction.id,
        paymentType: 'qris',
        grossAmount: transaction.total,
        transactionStatus: 'pending',
        transactionIdMidtrans: snapResult.midtransTransactionId || null,
        qrCodeUrl: snapResult.qrCodeUrl || null,
        qrData: snapResult.qrString || null,
        expiryTime: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    return res.status(200).json({
      message: 'Midtrans payment created successfully',
      snapToken: snapResult.snapToken,
      paymentUrl: snapResult.paymentUrl,
      qrCodeUrl: snapResult.qrCodeUrl,
      qrString: snapResult.qrString,
      transaction: updatedTransaction,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/payment/status/:id
 * Fetches and updates the payment status from Midtrans.
 */
export const getPaymentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // Can be transactionId or transactionNumber

    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { id },
          { transactionNumber: id },
        ],
      },
      include: {
        store: true,
        items: true,
        cashier: { select: { name: true } },
      },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Call status check from Midtrans API using PaymentGateway credentials
    let midtransStatus: any = null;
    try {
      midtransStatus = await getTransactionStatus(
        transaction.transactionNumber,
        transaction.storeId,
      );
    } catch (err) {
      console.warn(`[Midtrans Status Check] Could not query status for ${transaction.transactionNumber}:`, err);
    }

    if (midtransStatus) {
      const {
        transaction_status: txStatus,
        fraud_status: fraudStatus,
        payment_type: payType,
        transaction_id: midtransTxId,
        settlement_time: settleTime,
      } = midtransStatus;

      // Map status
      let mappedStatus = transaction.status;
      let paymentStatusStr = transaction.paymentStatus;

      if (txStatus === 'settlement' || txStatus === 'capture') {
        mappedStatus = 'PAID';
        paymentStatusStr = 'PAID';
      } else if (txStatus === 'deny' || txStatus === 'cancel') {
        mappedStatus = 'CANCELLED';
        paymentStatusStr = 'CANCELLED';
      } else if (txStatus === 'expire') {
        mappedStatus = 'EXPIRED';
        paymentStatusStr = 'CANCELLED';
      } else if (txStatus === 'pending') {
        mappedStatus = 'WAITING_PAYMENT';
        paymentStatusStr = 'PENDING_PAYMENT';
      }

      // If transition to success/failed has happened and is different from DB, update DB
      if (mappedStatus !== transaction.status) {
        await prisma.$transaction(async (tx) => {
          // If status changes to PAID, update shift totals
          if (mappedStatus === 'PAID' && transaction.status !== 'PAID') {
            if (transaction.shiftId) {
              await tx.shift.update({
                where: { id: transaction.shiftId },
                data: { totalSales: { increment: transaction.total } },
              });
            }
          }

          // If status changes from pending state to CANCELLED or EXPIRED, restore product stock
          if (
            (mappedStatus === 'CANCELLED' || mappedStatus === 'EXPIRED') &&
            (transaction.status === 'PENDING' || transaction.status === 'WAITING_PAYMENT')
          ) {
            for (const item of transaction.items) {
              if (item.productId) {
                const updatedProd = await tx.product.update({
                  where: { id: item.productId },
                  data: { stock: { increment: item.quantity } },
                });
                await tx.stockLog.create({
                  data: {
                    productId: item.productId,
                    type: 'IN',
                    quantity: item.quantity,
                    description: `Restore stock from cancelled/expired transaction ${transaction.transactionNumber}`,
                    userId: transaction.cashierId,
                  },
                });
                // Emit stock update
                emitToStore(transaction.storeId, 'stock_update', {
                  productId: item.productId,
                  newStock: updatedProd.stock,
                });
              }
            }
          }

          // Update transaction
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              status: mappedStatus,
              paymentStatus: paymentStatusStr,
              transactionStatus: txStatus,
              fraudStatus: fraudStatus || null,
              paymentType: payType || null,
              midtransTransactionId: midtransTxId || null,
              settlementTime: settleTime ? new Date(settleTime) : null,
            },
          });

          // Sync legacy payment table
          await tx.payment.updateMany({
            where: { transactionId: transaction.id },
            data: {
              transactionStatus: txStatus,
              transactionIdMidtrans: midtransTxId || null,
            },
          });
        });

        // Notify client
        emitToStore(transaction.storeId, 'payment_status', {
          transactionId: transaction.id,
          transactionNumber: transaction.transactionNumber,
          status: mappedStatus,
          cashierName: transaction.cashier?.name,
        });
      }
    }

    // Fetch latest updated transaction
    const latestTx = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: { payment: true, cashier: { select: { name: true } } },
    });

    return res.status(200).json({ transaction: latestTx });
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/payment/cancel
 * Cancels a transaction in Midtrans and releases reserved stock.
 */
export const cancelPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ message: 'Transaction ID is required' });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { 
        store: true, 
        items: true,
        cashier: { select: { name: true } },
      },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status === 'PAID') {
      return res.status(400).json({ message: 'Cannot cancel a paid transaction' });
    }

    // Call Midtrans Cancel API using PaymentGateway credentials
    try {
      await cancelTransaction(
        transaction.transactionNumber,
        transaction.storeId,
      );
    } catch (err) {
      console.warn(`[Midtrans Cancel] Could not cancel transaction ${transaction.transactionNumber} in Midtrans:`, err);
    }

    // Update status and restore stocks atomically in database
    await prisma.$transaction(async (tx) => {
      // Restore stocks only if transaction was pending / waiting payment
      if (transaction.status === 'PENDING' || transaction.status === 'WAITING_PAYMENT') {
        for (const item of transaction.items) {
          if (item.productId) {
            const updatedProd = await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
            await tx.stockLog.create({
              data: {
                productId: item.productId,
                type: 'IN',
                quantity: item.quantity,
                description: `Restore stock from cancelled transaction ${transaction.transactionNumber}`,
                userId: transaction.cashierId,
              },
            });
            // Emit stock update
            emitToStore(transaction.storeId, 'stock_update', {
              productId: item.productId,
              newStock: updatedProd.stock,
            });
          }
        }
      }

      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'CANCELLED',
          transactionStatus: 'cancel',
        },
      });

      await tx.payment.updateMany({
        where: { transactionId: transactionId },
        data: {
          transactionStatus: 'cancel',
        },
      });
    });

    // Notify cashier
    emitToStore(transaction.storeId, 'payment_status', {
      transactionId: transaction.id,
      transactionNumber: transaction.transactionNumber,
      status: 'CANCELLED',
      cashierName: transaction.cashier?.name,
    });

    return res.status(200).json({ message: 'Transaction cancelled successfully' });
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/payment/webhook
 * Handles Midtrans status callbacks (webhook).
 */
export const handleMidtransWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      order_id: transactionNumber,
      transaction_status: transactionStatus,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      payment_type: paymentType,
      transaction_id: midtransTransactionId,
      fraud_status: fraudStatus,
      settlement_time: settlementTimeStr,
    } = req.body;

    console.log(`[Midtrans Webhook] Received update for ${transactionNumber}: ${transactionStatus}`);

    // 1. Fetch transaction
    const transaction = await prisma.transaction.findUnique({
      where: { transactionNumber },
      include: {
        store: { select: { midtransServerKey: true } },
        items: true,
        cashier: { select: { name: true } },
      },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // 2. Validate webhook signature using PaymentGateway credentials
    const storeCredentials = await resolveStoreCredentials(transaction.storeId);
    const isValid = verifyWebhookSignature(
      transactionNumber,
      statusCode,
      grossAmount,
      signatureKey,
      storeCredentials.serverKey
    );

    if (!isValid) {
      console.error(`[Midtrans Webhook] Signature verification failed for order ${transactionNumber}`);
      return res.status(401).json({ message: 'Unauthorized signature key' });
    }

    // 3. Determine new statuses
    let mappedStatus = transaction.status;
    let paymentStatusStr = transaction.paymentStatus;

    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      mappedStatus = 'PAID';
      paymentStatusStr = 'PAID';
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel') {
      mappedStatus = 'CANCELLED';
      paymentStatusStr = 'CANCELLED';
    } else if (transactionStatus === 'expire') {
      mappedStatus = 'EXPIRED';
      paymentStatusStr = 'CANCELLED';
    } else if (transactionStatus === 'pending') {
      mappedStatus = 'WAITING_PAYMENT';
      paymentStatusStr = 'PENDING_PAYMENT';
    }

    // 4. Update database if status changed
    if (mappedStatus !== transaction.status) {
      await prisma.$transaction(async (tx) => {
        // If status changed to PAID, add total sales to the shift
        if (mappedStatus === 'PAID' && transaction.status !== 'PAID') {
          if (transaction.shiftId) {
            await tx.shift.update({
              where: { id: transaction.shiftId },
              data: { totalSales: { increment: transaction.total } },
            });
          }
        }

        // If status changed to cancelled or expired, restore product stock
        if (
          (mappedStatus === 'CANCELLED' || mappedStatus === 'EXPIRED') &&
          (transaction.status === 'PENDING' || transaction.status === 'WAITING_PAYMENT')
        ) {
          for (const item of transaction.items) {
            if (item.productId) {
              const updatedProd = await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
              await tx.stockLog.create({
                data: {
                  productId: item.productId,
                  type: 'IN',
                  quantity: item.quantity,
                  description: `Restore stock from webhook: ${transactionStatus} for transaction ${transactionNumber}`,
                  userId: transaction.cashierId,
                },
              });
              // Emit stock update
              emitToStore(transaction.storeId, 'stock_update', {
                productId: item.productId,
                newStock: updatedProd.stock,
              });
            }
          }
        }

        // Update transaction model
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: mappedStatus,
            paymentStatus: paymentStatusStr,
            transactionStatus: transactionStatus,
            fraudStatus: fraudStatus || null,
            paymentType: paymentType || null,
            midtransTransactionId: midtransTransactionId || null,
            settlementTime: settlementTimeStr ? new Date(settlementTimeStr) : null,
          },
        });

        // Sync legacy payment table
        await tx.payment.updateMany({
          where: { transactionId: transaction.id },
          data: {
            transactionStatus: transactionStatus,
            transactionIdMidtrans: midtransTransactionId || null,
          },
        });
      });

      // 5. Emit real-time updates via Socket.IO
      // Sync cashier POS screen
      emitToStore(transaction.storeId, 'payment_status', {
        transactionId: transaction.id,
        transactionNumber: transaction.transactionNumber,
        status: mappedStatus,
        cashierName: transaction.cashier?.name,
      });

      // Sync owner dashboard (send new transaction event if paid)
      if (mappedStatus === 'PAID') {
        emitToStore(transaction.storeId, 'new_transaction', {
          id: transaction.id,
          transactionNumber: transaction.transactionNumber,
          total: transaction.total,
          paymentMethod: 'QRIS',
          status: 'PAID',
          createdAt: transaction.createdAt,
          cashierName: transaction.cashier?.name,
          cashier: { name: transaction.cashier?.name },
        });
      }
    }

    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Dev simulation endpoint to trigger payment settle manually (for testing / fallback)
 */
export const simulatePaymentCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionNumber, status = 'settlement' } = req.body;

    const transaction = await prisma.transaction.findUnique({
      where: { transactionNumber },
      include: { 
        items: true,
        cashier: { select: { name: true } },
      },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    console.log(`[Simulator Webhook] Simulating '${status}' for order '${transactionNumber}'`);

    let mappedStatus = transaction.status;
    let paymentStatusStr = transaction.paymentStatus;

    if (status === 'settlement') {
      mappedStatus = 'PAID';
      paymentStatusStr = 'PAID';
    } else if (status === 'cancel') {
      mappedStatus = 'CANCELLED';
      paymentStatusStr = 'CANCELLED';
    } else if (status === 'expire') {
      mappedStatus = 'EXPIRED';
      paymentStatusStr = 'CANCELLED';
    }

    if (mappedStatus !== transaction.status) {
      await prisma.$transaction(async (tx) => {
        if (mappedStatus === 'PAID' && transaction.status !== 'PAID') {
          if (transaction.shiftId) {
            await tx.shift.update({
              where: { id: transaction.shiftId },
              data: { totalSales: { increment: transaction.total } },
            });
          }
        }

        if (
          (mappedStatus === 'CANCELLED' || mappedStatus === 'EXPIRED') &&
          (transaction.status === 'PENDING' || transaction.status === 'WAITING_PAYMENT')
        ) {
          for (const item of transaction.items) {
            if (item.productId) {
              const updatedProd = await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
              await tx.stockLog.create({
                data: {
                  productId: item.productId,
                  type: 'IN',
                  quantity: item.quantity,
                  description: `Restore stock from simulator: ${status} for transaction ${transactionNumber}`,
                  userId: transaction.cashierId,
                },
              });
              emitToStore(transaction.storeId, 'stock_update', {
                productId: item.productId,
                newStock: updatedProd.stock,
              });
            }
          }
        }

        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: mappedStatus,
            paymentStatus: paymentStatusStr,
            transactionStatus: status,
            midtransTransactionId: `sim-midtrans-id-${Math.random().toString(36).substring(2, 11)}`,
            settlementTime: mappedStatus === 'PAID' ? new Date() : null,
          },
        });

        await tx.payment.updateMany({
          where: { transactionId: transaction.id },
          data: {
            transactionStatus: status,
            transactionIdMidtrans: `sim-midtrans-id-${Math.random().toString(36).substring(2, 11)}`,
          },
        });
      });

      emitToStore(transaction.storeId, 'payment_status', {
        transactionId: transaction.id,
        transactionNumber: transaction.transactionNumber,
        status: mappedStatus,
        cashierName: transaction.cashier?.name,
      });

      if (mappedStatus === 'PAID') {
        emitToStore(transaction.storeId, 'new_transaction', {
          id: transaction.id,
          transactionNumber: transaction.transactionNumber,
          total: transaction.total,
          paymentMethod: 'QRIS',
          status: 'PAID',
          createdAt: transaction.createdAt,
          cashierName: transaction.cashier?.name,
          cashier: { name: transaction.cashier?.name },
        });
      }
    }

    return res.status(200).json({
      message: `Successfully simulated status to ${mappedStatus}`,
      transactionNumber,
      status: mappedStatus,
    });
  } catch (error) {
    next(error);
  }
};
