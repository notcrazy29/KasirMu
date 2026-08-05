import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/auth';
import { getDateRangeForPeriod, getWibDateString } from '../utils/date';

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query.storeId as string;
    const period = (req.query.period as string) || 'today';
    const customStartDate = req.query.startDate as string | undefined;
    const customEndDate = req.query.endDate as string | undefined;

    if (!storeId) {
      return res.status(400).json({ message: 'Store ID query parameter is required' });
    }

    // 1. Get precise Date range in Asia/Jakarta timezone
    const { startDate, endDate, period: resolvedPeriod } = getDateRangeForPeriod(
      period,
      customStartDate,
      customEndDate
    );

    const whereClause: any = {
      storeId,
      status: 'PAID',
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    // 2. Fetch PAID transactions within the resolved time bounds
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: {
              select: { costPrice: true },
            },
          },
        },
        cashier: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Aggregations & Calculations
    let totalRevenue = 0;
    let totalTxCount = transactions.length;
    let totalProductsSold = 0;
    let totalTax = 0;
    let totalProfit = 0;
    const paymentMethodSplit = { CASH: 0, QRIS: 0 };
    const orderTypeSplit = { DINE_IN: 0, TAKE_AWAY: 0 };

    const salesOverTime: Record<string, number> = {};

    transactions.forEach((tx) => {
      const txTotal = Number(tx.total);
      const txTax = Number(tx.tax || 0);

      totalRevenue += txTotal;
      totalTax += txTax;

      // Payment method split
      if (tx.paymentMethod === 'CASH') {
        paymentMethodSplit.CASH += 1;
      } else {
        paymentMethodSplit.QRIS += 1;
      }

      // Order type split
      if (tx.orderType === 'TAKE_AWAY') {
        orderTypeSplit.TAKE_AWAY += 1;
      } else {
        orderTypeSplit.DINE_IN += 1;
      }

      // Items calculation (Products sold & Profit)
      tx.items.forEach((item) => {
        const qty = item.quantity;
        totalProductsSold += qty;

        const sellingPrice = Number(item.price);
        const costPrice = item.product ? Number(item.product.costPrice) : 0;
        const itemProfit = (sellingPrice - costPrice) * qty;
        totalProfit += itemProfit;
      });

      // Grouping key formatted according to Asia/Jakarta (WIB) local date
      const wibDateStr = getWibDateString(tx.createdAt); // YYYY-MM-DD
      let groupKey = wibDateStr;

      if (resolvedPeriod === 'today' || resolvedPeriod === 'yesterday') {
        // Group by hour in WIB: YYYY-MM-DD HH:00
        const options: Intl.DateTimeFormatOptions = {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          hour12: false,
        };
        const hourStr = new Intl.DateTimeFormat('en-US', options).format(tx.createdAt);
        groupKey = `${wibDateStr} ${hourStr}:00`;
      } else if (resolvedPeriod === 'year' || resolvedPeriod === 'all') {
        // Group by month: YYYY-MM
        groupKey = wibDateStr.slice(0, 7);
      }

      salesOverTime[groupKey] = (salesOverTime[groupKey] || 0) + txTotal;
    });

    // Format salesOverTime to array for Recharts
    const salesChartData = Object.keys(salesOverTime)
      .map((key) => {
        let label = key;
        if (resolvedPeriod === 'today' || resolvedPeriod === 'yesterday') {
          // format: HH:00
          label = key.split(' ')[1] || key;
        } else if (resolvedPeriod === 'year' || resolvedPeriod === 'all') {
          // format: MMM YYYY
          const date = new Date(`${key}-02`);
          label = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        } else {
          // format: D MMM
          const date = new Date(`${key}T00:00:00+07:00`);
          label = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        }
        return {
          date: label,
          revenue: salesOverTime[key],
          rawKey: key,
        };
      })
      .sort((a, b) => a.rawKey.localeCompare(b.rawKey));

    // 4. Aggregate Cashier Performance Reports
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
        profit: 0,
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
          profit: 0,
          paymentSplit: { CASH: 0, QRIS: 0 },
        };
        cashierReportsMap.set(tx.cashierId, report);
      }

      report.txCount += 1;
      report.revenue += Number(tx.total);

      tx.items.forEach((item) => {
        const sellingPrice = Number(item.price);
        const costPrice = item.product ? Number(item.product.costPrice) : 0;
        report.profit += (sellingPrice - costPrice) * item.quantity;
      });

      if (tx.paymentMethod === 'CASH') {
        report.paymentSplit.CASH += Number(tx.total);
      } else {
        report.paymentSplit.QRIS += Number(tx.total);
      }
    });

    const cashierReports = Array.from(cashierReportsMap.values())
      .sort((a, b) => b.revenue - a.revenue);

    // 5. Best-Selling Products Grouping for the active timeframe
    const itemWhereClause: any = {
      transaction: whereClause,
    };

    const bestSellers = await prisma.transactionItem.groupBy({
      by: ['productId', 'productName'],
      where: itemWhereClause,
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

    // 6. Stock alerts snapshot
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
      period: resolvedPeriod,
      summary: {
        totalRevenue,
        totalTxCount,
        totalProductsSold,
        totalTax,
        totalProfit,
        paymentSplit: paymentMethodSplit,
        orderTypeSplit,
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
