import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';
import crypto from 'crypto';

// Validation Schemas
export const createStoreSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Store name must be at least 2 characters'),
    address: z.string().optional(),
    phone: z.string().optional(),
    logo: z.string().optional(),
  }),
});

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Branch name must be at least 2 characters'),
    address: z.string().optional(),
    phone: z.string().optional(),
  }),
});

export const createStore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { name, address, phone, logo } = req.body;
    
    // Generate secure unique pairing code
    const pairingCode = `pair_${crypto.randomBytes(8).toString('hex')}`;

    const store = await prisma.store.create({
      data: {
        name,
        address,
        phone,
        logo,
        ownerId,
        pairingCode,
      },
    });

    return res.status(201).json({
      message: 'Store created successfully',
      store,
    });
  } catch (error) {
    next(error);
  }
};

export const getStores = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const stores = await prisma.store.findMany({
      where: { ownerId },
      include: {
        branches: true,
        _count: {
          select: { cashiers: true, products: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ stores });
  } catch (error) {
    next(error);
  }
};

export const getStoreDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const ownerId = req.user?.id;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { branches: true },
    });

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    if (store.ownerId !== ownerId && req.user?.storeId !== storeId) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    return res.json({ store });
  } catch (error) {
    next(error);
  }
};

export const createBranch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const ownerId = req.user?.id;
    const { name, address, phone } = req.body;

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Unauthorized to add branches to this store' });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        address,
        phone,
        storeId,
      },
    });

    return res.status(201).json({
      message: 'Branch created successfully',
      branch,
    });
  } catch (error) {
    next(error);
  }
};

export const getBranches = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;

    const branches = await prisma.branch.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
    });

    return res.json({ branches });
  } catch (error) {
    next(error);
  }
};

export const verifyStorePin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const { pin } = req.body;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { exitPin: true },
    });

    if (!store) {
      return res.status(404).json({ message: 'Outlet tidak ditemukan' });
    }

    const isValid = store.exitPin === pin;
    return res.json({ valid: isValid });
  } catch (error) {
    next(error);
  }
};

export const updateStorePin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const ownerId = req.user?.id;
    const { pin } = req.body;

    if (!pin || pin.length < 4) {
      return res.status(400).json({ message: 'PIN harus minimal 4 digit' });
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Tidak memiliki otorisasi untuk mengubah PIN outlet ini' });
    }

    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: { exitPin: pin },
      select: { id: true, name: true, exitPin: true },
    });

    return res.json({
      message: 'PIN Otorisasi berhasil diperbarui',
      store: updatedStore,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStoreMidtrans = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const ownerId = req.user?.id;
    const { serverKey, clientKey } = req.body;

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Tidak memiliki otorisasi untuk mengubah pengaturan outlet ini' });
    }

    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: {
        midtransServerKey: serverKey || null,
        midtransClientKey: clientKey || null,
      },
      select: { id: true, name: true, midtransServerKey: true, midtransClientKey: true },
    });

    return res.json({
      message: 'Kredensial Midtrans berhasil diperbarui',
      store: updatedStore,
    });
  } catch (error) {
    next(error);
  }
};

