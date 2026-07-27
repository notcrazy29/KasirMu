import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/auth';

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query.storeId as string;
    const period = (req.query.period as string) || 'month'; // 'day' | 'week' | 'month' | 'year'

    if (!storeId) {
      return res.status(400).json({ message: 'Store ID query parameter is required' });
    }

    // Determine start date based on period
    const now = new Date();
    let startDate = new Date();
    
    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    // 1. Fetch PAID transactions within the active period
    const transactions = await prisma.transaction.findMany({
      where: { 
        storeId, 
        status: 'PAID',
        createdAt: {
          gte: startDate,
        },
      },
      include: { 
        items: true,
        cashier: {
          select: { id: true, name: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Calculations
    let totalRevenue = 0;
    let totalTxCount = transactions.length;
    let paymentMethodSplit = { CASH: 0, QRIS: 0 };
    
    // Group sales by dynamic brackets
    const salesOverTime: Record<string, number> = {};

    transactions.forEach((tx) => {
      totalRevenue += Number(tx.total);
      
      // Payment split
      if (tx.paymentMethod === 'CASH') {
        paymentMethodSplit.CASH += 1;
      } else {
        paymentMethodSplit.QRIS += 1;
      }

      // Group key based on period
      let groupKey = '';
      if (period === 'day') {
        groupKey = tx.createdAt.toISOString().slice(0, 13) + ':00'; // YYYY-MM-DDTHH:00
      } else if (period === 'year') {
        groupKey = tx.createdAt.toISOString().slice(0, 7); // YYYY-MM
      } else {
        groupKey = tx.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      }
      
      salesOverTime[groupKey] = (salesOverTime[groupKey] || 0) + Number(tx.total);
    });

    // Format salesOverTime to array for Recharts
    const salesChartData = Object.keys(salesOverTime)
      .map((key) => {
        let label = key;
        if (period === 'day') {
          // format: HH:00
          label = key.slice(11, 16);
        } else if (period === 'year') {
          // format: MMM YYYY
          const date = new Date(key + '-02');
          label = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        } else {
          // format: D MMM
          const date = new Date(key);
          label = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        }
        return {
          date: label,
          revenue: salesOverTime[key],
          rawKey: key,
        };
      })
      .sort((a, b) => a.rawKey.localeCompare(b.rawKey));

    // 3. Aggregate Cashier Reports
    const cashiers = await prisma.user.findMany({
      where: { storeId },
      select: { id: true, name: true, role: true },
    });

    const cashierReportsMap = new Map();
    cashiers.forEach((c) => {
      cashierReportsMap.set(c.id, {
        cashierId: c.id,
        name: c.name,
        role: c.role,
        txCount: 0,
        revenue: 0,
        paymentSplit: { CASH: 0, QRIS: 0 },
      });
    });

    transactions.forEach((tx) => {
      let report = cashierReportsMap.get(tx.cashierId);
      if (!report) {
        report = {
          cashierId: tx.cashierId,
          name: tx.cashier?.name || 'Unknown User',
          role: tx.cashier?.role || 'CASHIER',
          txCount: 0,
          revenue: 0,
          paymentSplit: { CASH: 0, QRIS: 0 },
        };
        cashierReportsMap.set(tx.cashierId, report);
      }
      
      report.txCount += 1;
      report.revenue += Number(tx.total);
      if (tx.paymentMethod === 'CASH') {
        report.paymentSplit.CASH += Number(tx.total);
      } else {
        report.paymentSplit.QRIS += Number(tx.total);
      }
    });

    const cashierReports = Array.from(cashierReportsMap.values())
      .sort((a, b) => b.revenue - a.revenue); // Sort by highest revenue first

    // 4. Best-Selling Products Grouping (restricted by timeframe)
    const bestSellers = await prisma.transactionItem.groupBy({
      by: ['productId', 'productName'],
      where: {
        transaction: {
          storeId,
          status: 'PAID',
          createdAt: {
            gte: startDate,
          },
        },
      },
      _sum: {
        quantity: true,
        total: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    });

    const formattedBestSellers = bestSellers.map((item) => ({
      productId: item.productId,
      name: item.productName,
      quantitySold: item._sum.quantity || 0,
      totalSalesVal: item._sum.total || 0,
    }));

    // 5. Stock alert (realtime snapshot, not timeframe-bound)
    const stockAlerts = await prisma.product.findMany({
      where: {
        storeId,
        stock: {
          lte: prisma.product.fields.minStockAlert,
        },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        minStockAlert: true,
      },
      take: 10,
    });

    return res.json({
      summary: {
        totalRevenue,
        totalTxCount,
        paymentSplit: paymentMethodSplit,
      },
      salesChartData,
      bestSellers: formattedBestSellers,
      cashierReports,
      stockAlerts,
    });
  } catch (error) {
    next(error);
  }
};
