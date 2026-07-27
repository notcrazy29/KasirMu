import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { z } from 'zod';
import { logAudit } from '../services/audit';

export const updateTaxSettingSchema = z.object({
  body: z.object({
    taxName: z.string().min(1, 'Nama pajak wajib diisi').max(100),
    percentage: z.number().min(0, 'Persentase minimal 0').max(100),
    isActive: z.boolean(),
    calculationType: z.enum(['INCLUSIVE', 'EXCLUSIVE']),
  })
});

export const getTaxSetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let storeId = req.user?.storeId;

    if (req.user?.role === 'SUPER_ADMIN') {
      const queryStoreId = req.query.storeId as string;
      if (queryStoreId) {
        storeId = queryStoreId;
      }
    }

    if (!storeId) {
      return res.status(400).json({ message: 'Store ID is required' });
    }

    const taxSetting = await prisma.taxSetting.findUnique({
      where: { storeId }
    });

    if (!taxSetting) {
      return res.json({
        taxSetting: {
          storeId,
          taxName: 'PPN',
          percentage: 0,
          calculationType: 'EXCLUSIVE',
          isActive: false,
          createdBy: 'SYSTEM',
          updatedAt: new Date(),
          createdAt: new Date(),
        }
      });
    }

    return res.json({ taxSetting });
  } catch (err) {
    next(err);
  }
};

export const updateTaxSetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const storeId = req.user.storeId;
    if (!storeId) return res.status(400).json({ message: 'User does not belong to a store' });

    const { taxName, percentage, isActive, calculationType } = req.body;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';

    const oldSetting = await prisma.taxSetting.findUnique({
      where: { storeId }
    });

    const oldPercent = oldSetting ? Number(oldSetting.percentage) : 0;
    const oldName = oldSetting ? oldSetting.taxName : '-';

    const taxSetting = await prisma.taxSetting.upsert({
      where: { storeId },
      update: {
        taxName,
        percentage,
        calculationType,
        isActive,
        createdBy: req.user.name,
      },
      create: {
        storeId,
        taxName,
        percentage,
        calculationType,
        isActive,
        createdBy: req.user.name,
      }
    });

    await logAudit({
      action: 'UPDATE_TAX_SETTING',
      actorId: req.user.id,
      targetId: taxSetting.id,
      description: `Owner: ${req.user.name}, Nama Pajak: ${taxName} (Lama: ${oldName}), Persentase Baru: ${percentage}% (Lama: ${oldPercent}%), Tipe: ${calculationType}, Aktif: ${isActive}, IP: ${ipAddress}`
    });

    return res.json({ message: 'Pengaturan pajak berhasil disimpan', taxSetting });
  } catch (err) {
    next(err);
  }
};

export const deleteTaxSetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const storeId = req.user.storeId;
    if (!storeId) return res.status(400).json({ message: 'User does not belong to a store' });

    const oldSetting = await prisma.taxSetting.findUnique({
      where: { storeId }
    });

    if (oldSetting) {
      await prisma.taxSetting.delete({
        where: { storeId }
      });

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
      await logAudit({
        action: 'DELETE_TAX_SETTING',
        actorId: req.user.id,
        targetId: oldSetting.id,
        description: `Owner: ${req.user.name} menghapus pengaturan pajak ${oldSetting.taxName} (${oldSetting.percentage}%), IP: ${ipAddress}`
      });
    }

    return res.json({ message: 'Pengaturan pajak berhasil dihapus/reset' });
  } catch (err) {
    next(err);
  }
};
