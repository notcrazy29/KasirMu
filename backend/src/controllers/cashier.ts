import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/auth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'kasirmu_super_jwt_secret_key_2026_secure';

// Validation Schemas
export const createCashierSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().min(3, 'ID Login / Username must be at least 3 characters').regex(/^[a-zA-Z0-9_.-]+$/, 'ID Login / Username only allows letters, numbers, dot, dash, and underscore'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    storeId: z.string().uuid('Invalid Store ID'),
  }),
});

export const pairStoreSchema = z.object({
  body: z.object({
    pairingCode: z.string().min(3, 'Pairing code is required'),
  }),
});

export const createCashier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    const { name, email, password, storeId } = req.body;

    // Verify owner owns the target store
    const store = await prisma.store.findFirst({
      where: { id: storeId, ownerId },
    });

    if (!store) {
      return res.status(403).json({ message: 'Unauthorized store context' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'ID Login / Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const cashier = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'CASHIER',
        storeId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      message: 'Cashier created successfully',
      cashier,
    });
  } catch (error) {
    next(error);
  }
};

export const getCashiers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    const storeId = req.query.storeId as string;

    if (!storeId) {
      return res.status(400).json({ message: 'Store ID query parameter is required' });
    }

    // Verify owner owns the store
    const store = await prisma.store.findFirst({
      where: { id: storeId, ownerId },
    });

    if (!store) {
      return res.status(403).json({ message: 'Unauthorized access to store' });
    }

    const cashiers = await prisma.user.findMany({
      where: { storeId, role: 'CASHIER' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ cashiers });
  } catch (error) {
    next(error);
  }
};

export const pairCashier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cashierId = req.user?.id;
    const { pairingCode } = req.body;

    if (!cashierId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find the store matching the pairing code
    const store = await prisma.store.findUnique({
      where: { pairingCode },
    });

    if (!store) {
      return res.status(404).json({ message: 'Invalid pairing code' });
    }

    // Associate cashier user to the store
    const updatedUser = await prisma.user.update({
      where: { id: cashierId },
      data: { storeId: store.id },
    });

    // Generate a fresh JWT with updated storeId
    const token = jwt.sign(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        storeId: store.id,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      message: `Successfully paired with store: ${store.name}`,
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        storeId: store.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCashierSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    email: z.string().min(3, 'ID Login / Username must be at least 3 characters').regex(/^[a-zA-Z0-9_.-]+$/, 'ID Login / Username only allows letters, numbers, dot, dash, and underscore').optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  }),
});

export const updateCashier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    const { id } = req.params;
    const { name, email, password } = req.body;

    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    // Verify the cashier exists and belongs to a store owned by the requesting owner
    const cashier = await prisma.user.findFirst({
      where: { id, role: 'CASHIER' },
      include: { store: true },
    });

    if (!cashier || !cashier.storeId || cashier.store?.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Unauthorized access to cashier context' });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) {
      // Check if email already exists for another user
      const existingUser = await prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (existingUser) {
        return res.status(400).json({ message: 'ID Login / Username already exists' });
      }
      updateData.email = email;
    }
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedCashier = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return res.json({
      message: 'Cashier updated successfully',
      cashier: updatedCashier,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCashier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    const { id } = req.params;

    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    // Verify the cashier exists and belongs to a store owned by the requesting owner
    const cashier = await prisma.user.findFirst({
      where: { id, role: 'CASHIER' },
      include: { store: true },
    });

    if (!cashier || !cashier.storeId || cashier.store?.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Unauthorized access to cashier context' });
    }

    // Check if the cashier has any transactions or shifts or stock logs
    const hasTransactions = await prisma.transaction.findFirst({ where: { cashierId: id } });
    const hasShifts = await prisma.shift.findFirst({ where: { userId: id } });
    const hasStockLogs = await prisma.stockLog.findFirst({ where: { userId: id } });

    if (hasTransactions || hasShifts || hasStockLogs) {
      // Soft delete: disassociate from the store so they don't see it or show up in lists
      await prisma.user.update({
        where: { id },
        data: { storeId: null },
      });
      return res.json({ message: 'Cashier disassociated (soft-deleted) successfully due to existing transaction records.' });
    }

    // Otherwise, hard delete is safe
    await prisma.user.delete({ where: { id } });

    return res.json({ message: 'Cashier deleted successfully' });
  } catch (error) {
    next(error);
  }
};
