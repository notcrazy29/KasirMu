import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { logAudit } from '../services/audit';
import { sendEmail } from '../services/email';
import { assignFreePlan } from '../services/subscription';
import { getIO } from '../services/socket';

const JWT_SECRET = process.env.JWT_SECRET || 'kasirmu_super_jwt_secret_key_2026_secure';

// Validation Schemas
export const createStoreSchemaSuper = z.object({
  body: z.object({
    name: z.string().min(2, 'Store name must be at least 2 characters'),
    address: z.string().optional(),
    phone: z.string().optional(),
    logo: z.string().optional(),
    ownerId: z.string().uuid('Invalid owner user ID'),
  }),
});

export const updateStoreSchemaSuper = z.object({
  body: z.object({
    name: z.string().min(2, 'Store name must be at least 2 characters'),
    address: z.string().optional(),
    phone: z.string().optional(),
    logo: z.string().optional(),
    ownerId: z.string().uuid('Invalid owner user ID'),
  }),
});

export const createUserSchemaSuper = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.enum(['OWNER', 'CASHIER', 'SUPER_ADMIN']),
    storeId: z.string().uuid('Invalid store ID').nullable().optional(),
  }),
});

export const updateUserSchemaSuper = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.enum(['OWNER', 'CASHIER', 'SUPER_ADMIN']),
    storeId: z.string().uuid('Invalid store ID').nullable().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional().nullable(),
  }),
});

// Controllers
export const getSuperAdminStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic counts
    const ownerCount = await prisma.user.count({ where: { role: 'OWNER' } });
    const cashierCount = await prisma.user.count({ where: { role: 'CASHIER' } });
    const storeCount = await prisma.store.count();
    const transactionCount = await prisma.transaction.count();
    const activeShiftsCount = await prisma.shift.count({ where: { status: 'OPEN' } });

    const pendingAccountsCount = await prisma.user.count({ 
      where: { 
        status: { in: ['PENDING', 'PENDING_APPROVAL'] } 
      } 
    });
    const suspendedAccountsCount = await prisma.user.count({ where: { status: 'SUSPENDED' } });
    const userCount = await prisma.user.count();

    // Calculate Platform-wide Revenue
    const revenueAggregate = await prisma.transaction.aggregate({
      _sum: {
        total: true,
      },
      where: {
        status: 'PAID',
      },
    });
    const totalRevenue = Number(revenueAggregate._sum.total || 0);

    // Fetch recent 5 transactions system-wide
    const recentTransactions = await prisma.transaction.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        cashier: {
          select: { name: true },
        },
        store: {
          select: { name: true },
        },
      },
    });

    // Timeline data for charts: last 7 days revenue
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const timelineTx = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: 'PAID'
      },
      select: {
        total: true,
        createdAt: true,
        paymentMethod: true
      }
    });

    const dailyStatsMap: Record<string, { date: string, revenue: number, count: number, qris: number, cash: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyStatsMap[dateStr] = { date: dateStr, revenue: 0, count: 0, qris: 0, cash: 0 };
    }

    timelineTx.forEach(t => {
      const dateStr = t.createdAt.toISOString().split('T')[0];
      if (dailyStatsMap[dateStr]) {
        const amt = Number(t.total);
        dailyStatsMap[dateStr].revenue += amt;
        dailyStatsMap[dateStr].count += 1;
        if (t.paymentMethod === 'QRIS') {
          dailyStatsMap[dateStr].qris += amt;
        } else {
          dailyStatsMap[dateStr].cash += amt;
        }
      }
    });

    const dailyStats = Object.values(dailyStatsMap).sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      stats: {
        userCount,
        ownerCount,
        cashierCount,
        storeCount,
        transactionCount,
        activeShiftsCount,
        totalRevenue,
        pendingAccountsCount,
        suspendedAccountsCount,
      },
      recentTransactions,
      dailyStats
    });
  } catch (error) {
    next(error);
  }
};

export const getStores = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await prisma.store.findMany({
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            branches: true,
            products: true,
            cashiers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ stores });
  } catch (error) {
    next(error);
  }
};

export const createStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, address, phone, logo, ownerId } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    // Verify Owner exists
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) {
      return res.status(404).json({ message: 'Owner user not found' });
    }

    const pairingCode = `pair_${crypto.randomBytes(8).toString('hex')}`;

    const store = await prisma.store.create({
      data: {
        name,
        address,
        phone,
        logo,
        ownerId,
        pairingCode,
        status: 'ACTIVE'
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await logAudit({
      action: 'CREATE_STORE',
      actorId,
      targetId: store.id,
      description: `Super Admin created store ${name} for owner ${owner.email}`,
    });

    return res.status(201).json({
      message: 'Store created successfully',
      store,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, address, phone, logo, ownerId, status } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    // Verify Store exists
    const existingStore = await prisma.store.findUnique({ where: { id } });
    if (!existingStore) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Verify Owner exists
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) {
      return res.status(404).json({ message: 'Owner user not found' });
    }

    const store = await prisma.store.update({
      where: { id },
      data: {
        name,
        address,
        phone,
        logo,
        ownerId,
        status: status || undefined
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await logAudit({
      action: 'UPDATE_STORE',
      actorId,
      targetId: store.id,
      description: `Super Admin updated store ${name} parameters (Status: ${store.status})`,
    });

    return res.json({
      message: 'Store updated successfully',
      store,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const existingStore = await prisma.store.findUnique({ where: { id } });
    if (!existingStore) {
      return res.status(404).json({ message: 'Store not found' });
    }

    await prisma.store.delete({ where: { id } });

    await logAudit({
      action: 'DELETE_STORE',
      actorId,
      targetId: id,
      description: `Super Admin deleted store: ${existingStore.name}`,
    });

    return res.json({ message: 'Store and all associated data deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, role, status } = req.query;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search) } },
        { email: { contains: String(search) } },
      ];
    }

    if (role) {
      whereClause.role = String(role);
    }

    if (status) {
      whereClause.status = String(status);
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        ownedStores: {
          select: { id: true, name: true },
        },
        store: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ users });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role, storeId } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already in use' });
    }

    // Verify storeId if provided
    if (storeId) {
      const storeExists = await prisma.store.findUnique({ where: { id: storeId } });
      if (!storeExists) {
        return res.status(404).json({ message: 'Associated store not found' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        status: 'ACTIVE', // Admin created users are active immediately
        storeId: role === 'CASHIER' ? storeId : null,
      },
      include: {
        store: {
          select: { id: true, name: true },
        },
      },
    });

    await logAudit({
      action: 'CREATE_USER',
      actorId,
      targetId: user.id,
      description: `Super Admin created user ${user.email} (Role: ${user.role})`,
    });

    // Strip password from response
    const { password: _, ...userWithoutPassword } = user;

    return res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { email, name, role, storeId, password, status } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check email uniqueness if email is changing
    if (email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already in use by another user' });
      }
    }

    // Verify storeId if provided
    if (storeId) {
      const storeExists = await prisma.store.findUnique({ where: { id: storeId } });
      if (!storeExists) {
        return res.status(404).json({ message: 'Associated store not found' });
      }
    }

    const updateData: any = {
      email,
      name,
      role,
      storeId: role === 'CASHIER' ? storeId : null,
      status: status || undefined,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        store: {
          select: { id: true, name: true },
        },
      },
    });

    await logAudit({
      action: 'UPDATE_USER',
      actorId,
      targetId: user.id,
      description: `Super Admin updated user data for ${user.email} (Role: ${user.role}, Status: ${user.status})`,
    });

    // Strip password from response
    const { password: _, ...userWithoutPassword } = user;

    return res.json({
      message: 'User updated successfully',
      user: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    await prisma.user.delete({ where: { id } });

    await logAudit({
      action: 'DELETE_USER',
      actorId,
      targetId: id,
      description: `Super Admin deleted user account: ${existingUser.email}`,
    });

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ transactions });
  } catch (error) {
    next(error);
  }
};

// Owner approvals
export const approveUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        approvedById: actorId,
        verifiedAt: new Date(),
        approvedAt: new Date(),
      }
    });

    // Auto-create store if user is OWNER and has no store yet, using completed registration details
    if (user.role === 'OWNER') {
      const existingStores = await prisma.store.findMany({ where: { ownerId: userId } });
      if (existingStores.length === 0 && user.storeName) {
        const pairingCode = `pair_${crypto.randomBytes(8).toString('hex')}`;
        await prisma.store.create({
          data: {
            name: user.storeName,
            address: user.storeAddress || '',
            phone: user.phone || '',
            logo: user.storeLogo || '',
            ownerId: userId,
            pairingCode,
            status: 'ACTIVE'
          }
        });
      }

      // Auto-assign FREE subscription plan to newly approved owner
      await assignFreePlan(userId);
    }

    await logAudit({
      action: 'APPROVE_USER',
      actorId,
      targetId: userId,
      description: `Approved owner registration for: ${user.email}`,
    });

    const emailHtml = `
      <h1>Registrasi Disetujui!</h1>
      <p>Halo ${user.name},</p>
      <p>Akun owner Anda dengan email <strong>${user.email}</strong> telah disetujui oleh administrator.</p>
      <p>Sekarang Anda dapat login dan mengakses dashboard utama KasirMu untuk mengelola toko Anda.</p>
    `;
    await sendEmail(user.email, 'Registrasi KasirMu Disetujui', emailHtml);

    return res.json({
      message: 'Account approved successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        status: updatedUser.status
      }
    });
  } catch (error) {
    next(error);
  }
};

export const rejectUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, reason } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'REJECTED',
      }
    });

    await logAudit({
      action: 'REJECT_USER',
      actorId,
      targetId: userId,
      description: `Rejected owner registration for: ${user.email}. Reason: ${reason || 'Tidak ditentukan'}`,
    });

    const emailHtml = `
      <h1>Registrasi Ditolak</h1>
      <p>Halo ${user.name},</p>
      <p>Mohon maaf, pendaftaran akun owner Anda dengan email <strong>${user.email}</strong> telah ditolak oleh administrator.</p>
      <p><strong>Alasan penolakan:</strong> ${reason || 'Data profil tidak valid atau tidak memenuhi kriteria platform.'}</p>
    `;
    await sendEmail(user.email, 'Registrasi KasirMu Ditolak', emailHtml);

    return res.json({
      message: 'Account rejected successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        status: updatedUser.status
      }
    });
  } catch (error) {
    next(error);
  }
};

export const suspendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, status } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newStatus = status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: newStatus,
      }
    });

    await logAudit({
      action: newStatus === 'SUSPENDED' ? 'SUSPEND_USER' : 'UNSUSPEND_USER',
      actorId,
      targetId: userId,
      description: `${newStatus === 'SUSPENDED' ? 'Suspended' : 'Unsuspended'} user account: ${user.email}`,
    });

    return res.json({
      message: `Account status updated to ${newStatus}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        status: updatedUser.status
      }
    });
  } catch (error) {
    next(error);
  }
};

export const suspendStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId, status } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const newStatus = status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';

    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: {
        status: newStatus
      }
    });

    await logAudit({
      action: newStatus === 'SUSPENDED' ? 'SUSPEND_STORE' : 'UNSUSPEND_STORE',
      actorId,
      targetId: storeId,
      description: `${newStatus === 'SUSPENDED' ? 'Suspended' : 'Unsuspended'} store/outlet: ${store.name}`,
    });

    return res.json({
      message: `Store status updated to ${newStatus}`,
      store: updatedStore
    });
  } catch (error) {
    next(error);
  }
};

// Owner impersonation
export const impersonateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    const adminId = (req as any).user?.id;

    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedStores: {
          select: { id: true, name: true }
        }
      }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.role !== 'OWNER') {
      return res.status(400).json({ message: 'Only OWNER accounts can be impersonated' });
    }

    const storeId = targetUser.ownedStores.length > 0 ? targetUser.ownedStores[0].id : null;

    const token = jwt.sign(
      { 
        id: targetUser.id, 
        email: targetUser.email, 
        name: targetUser.name, 
        role: targetUser.role, 
        status: targetUser.status, 
        storeId,
        impersonatedBy: adminId 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await logAudit({
      action: 'IMPERSONATE',
      actorId: adminId,
      targetId: userId,
      description: `Super Admin impersonated owner: ${targetUser.email}`,
    });

    return res.json({
      message: 'Impersonation session generated successfully',
      token,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        status: targetUser.status,
        storeId,
      },
      stores: targetUser.ownedStores,
    });
  } catch (error) {
    next(error);
  }
};

// Activity logs
export const getLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const loginActivities = await prisma.loginActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return res.json({ auditLogs, loginActivities });
  } catch (error) {
    next(error);
  }
};

// Subscriptions
export const getSubscriptionPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' }
    });
    return res.json({ plans });
  } catch (error) {
    next(error);
  }
};

export const createSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, price, features, durationDays } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        description,
        price,
        features,
        durationDays: Number(durationDays || 30),
      }
    });

    await logAudit({
      action: 'CREATE_PLAN',
      actorId,
      targetId: plan.id,
      description: `Created subscription plan: ${name} (Price: ${price})`,
    });

    return res.status(201).json({ message: 'Subscription plan created', plan });
  } catch (error) {
    next(error);
  }
};

export const updateSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, price, features, durationDays, isActive } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name,
        description,
        price,
        features,
        durationDays: durationDays ? Number(durationDays) : undefined,
        isActive,
      }
    });

    await logAudit({
      action: 'UPDATE_PLAN',
      actorId,
      targetId: plan.id,
      description: `Updated subscription plan: ${name} (Active: ${isActive})`,
    });

    return res.json({ message: 'Subscription plan updated', plan });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.subscriptionPayment.findMany({
      include: {
        subscription: {
          include: {
            user: { select: { name: true, email: true } },
            plan: { select: { name: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ payments });
  } catch (error) {
    next(error);
  }
};

export const simulateSubscribe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Create subscription
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        startDate,
        endDate,
      }
    });

    // Create payment
    const payment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        amount: plan.price,
        status: 'PAID',
        paymentMethod: 'SIMULATOR',
        referenceId: `SUB-PAY-${Date.now()}`
      }
    });

    await logAudit({
      action: 'SUBSCRIBE',
      actorId: userId,
      targetId: subscription.id,
      description: `User subscribed to plan ${plan.name}. Payment amount: ${plan.price}`,
    });

    return res.status(201).json({
      message: 'Subscription simulation success',
      subscription,
      payment
    });
  } catch (error) {
    next(error);
  }
};

// Maintenance mode
export const getMaintenanceMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mode = await prisma.systemSetting.findUnique({
      where: { key: 'maintenance_mode' }
    });
    const message = await prisma.systemSetting.findUnique({
      where: { key: 'maintenance_message' }
    });

    return res.json({
      maintenanceMode: mode?.value === 'true',
      message: message?.value || ''
    });
  } catch (error) {
    next(error);
  }
};

export const toggleMaintenanceMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enabled, message } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    await prisma.systemSetting.upsert({
      where: { key: 'maintenance_mode' },
      update: { value: enabled ? 'true' : 'false' },
      create: { key: 'maintenance_mode', value: enabled ? 'true' : 'false' }
    });

    if (message !== undefined) {
      await prisma.systemSetting.upsert({
        where: { key: 'maintenance_message' },
        update: { value: message },
        create: { key: 'maintenance_message', value: message }
      });
    }

    await logAudit({
      action: 'TOGGLE_MAINTENANCE',
      actorId,
      description: `Maintenance mode toggled to ${enabled}. Message: ${message || 'none'}`,
    });

    return res.json({
      message: `Maintenance mode updated to ${enabled}`,
      maintenanceMode: enabled,
      maintenanceMessage: message
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────
// Manual Subscription Override (Super Admin Only)
// ──────────────────────────────────────────────────

export const getOwnerSubscriptionsList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owners = await prisma.user.findMany({
      where: { role: 'OWNER' },
      select: {
        id: true,
        name: true,
        fullName: true,
        email: true,
        phone: true,
        storeName: true,
        status: true,
        ownedStores: {
          select: { id: true, name: true },
        },
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ownerList = owners.map((owner) => {
      const activeSub = owner.subscriptions[0] || null;
      const planName = activeSub?.plan?.name || 'FREE';
      const subStatus = activeSub?.status || 'ACTIVE';
      const isLifetime = activeSub?.isLifetime || false;
      const isPremium =
        (planName === 'PRO' || planName === 'PREMIUM' || planName === 'PREMIUM TRIAL') &&
        subStatus === 'ACTIVE';

      return {
        id: owner.id,
        name: owner.fullName || owner.name,
        email: owner.email,
        phone: owner.phone || '-',
        storeName: owner.ownedStores[0]?.name || owner.storeName || 'Toko Belum Dibuat',
        currentPlan: planName,
        status: subStatus,
        isPremium,
        isLifetime,
        expiredDate: isLifetime ? null : activeSub?.endDate || null,
        source: activeSub?.source || 'MIDTRANS',
        reason: activeSub?.reason || null,
      };
    });

    return res.json({ owners: ownerList });
  } catch (error) {
    next(error);
  }
};

export const grantOwnerSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ownerId, planName, duration, reason } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    if (!ownerId) {
      return res.status(400).json({ message: 'Owner user ID wajib diisi' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ message: 'Alasan pemberian manual wajib diisi' });
    }

    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner || owner.role !== 'OWNER') {
      return res.status(404).json({ message: 'Akun Owner tidak ditemukan' });
    }

    // If requested plan is FREE, call revoke logic directly
    if (planName === 'FREE') {
      return revokeOwnerSubscription(req, res, next);
    }

    // Find PREMIUM plan from database
    let premiumPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: 'PREMIUM' },
    });

    if (!premiumPlan) {
      premiumPlan = await prisma.subscriptionPlan.findFirst({
        where: { name: { in: ['PRO', 'PREMIUM TRIAL'] } },
      });
    }

    if (!premiumPlan) {
      return res.status(404).json({ message: 'Paket PREMIUM tidak ditemukan di database' });
    }

    // Calculate dates & lifetime status
    const startDate = new Date();
    let endDate: Date | null = new Date();
    let isLifetime = false;

    switch (duration) {
      case '1_MONTH':
        endDate.setDate(endDate.getDate() + 30);
        break;
      case '3_MONTHS':
        endDate.setDate(endDate.getDate() + 90);
        break;
      case '6_MONTHS':
        endDate.setDate(endDate.getDate() + 180);
        break;
      case '12_MONTHS':
        endDate.setDate(endDate.getDate() + 365);
        break;
      case 'LIFETIME':
        endDate = null;
        isLifetime = true;
        break;
      default:
        endDate.setDate(endDate.getDate() + 30);
    }

    // Step 1: Cancel any existing active/grace subscriptions for this owner
    await prisma.subscription.updateMany({
      where: {
        userId: ownerId,
        status: { in: ['ACTIVE', 'GRACE_PERIOD', 'PENDING_PAYMENT'] },
      },
      data: { status: 'CANCELLED' },
    });

    // Step 2: Create new manual subscription
    const newSub = await prisma.subscription.create({
      data: {
        userId: ownerId,
        planId: premiumPlan.id,
        status: 'ACTIVE',
        startDate,
        endDate,
        isLifetime,
        source: 'MANUAL_GRANT',
        reason: reason.trim(),
        gracePeriodUntil: null,
      },
    });

    // Step 3: Record in SubscriptionPayment history as MANUAL_GRANT
    const referenceId = `MANUAL-${Date.now()}`;
    await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: newSub.id,
        amount: 0,
        status: 'PAID',
        paymentType: 'MANUAL_GRANT',
        paymentMethod: 'SUPER_ADMIN',
        reason: reason.trim(),
        referenceId,
        orderId: referenceId,
        paidAt: startDate,
      },
    });

    // Step 4: Audit Log
    const durationLabel = isLifetime ? 'Tanpa Batas Waktu (Lifetime)' : `${duration.replace('_', ' ')}`;
    await logAudit({
      action: 'MANUAL_GRANT_PREMIUM',
      actorId,
      targetId: ownerId,
      description: `Super Admin memberikan Paket PREMIUM (${durationLabel}) kepada owner: ${owner.email}. Alasan: ${reason.trim()}`,
    });

    // Step 5: Realtime WebSockets Emit
    try {
      const io = getIO();
      io.to(`user_${ownerId}`).emit('subscription_overridden', {
        planName: premiumPlan.name,
        isPremium: true,
        isLifetime,
        endDate: endDate ? endDate.toISOString() : null,
        message: `🎉 Selamat! Paket Premium Anda telah diaktifkan oleh Super Admin (${durationLabel}).`,
        source: 'MANUAL_GRANT',
      });
      io.to(`user_${ownerId}`).emit('subscription_upgraded', {
        planName: premiumPlan.name,
        endDate: endDate ? endDate.toISOString() : null,
        isPremium: true,
        isGracePeriod: false,
        message: `🎉 Selamat! Paket Premium Anda telah diaktifkan oleh Super Admin.`,
      });
    } catch (_) {
      // Socket not critical
    }

    return res.json({
      message: `Berhasil mengaktifkan Paket Premium (${durationLabel}) untuk ${owner.name}`,
      subscription: newSub,
    });
  } catch (error) {
    next(error);
  }
};

export const revokeOwnerSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ownerId, reason } = req.body;
    const actorId = (req as any).user?.id || 'SYSTEM';

    if (!ownerId) {
      return res.status(400).json({ message: 'Owner user ID wajib diisi' });
    }

    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner || owner.role !== 'OWNER') {
      return res.status(404).json({ message: 'Akun Owner tidak ditemukan' });
    }

    // Find FREE plan
    const freePlan = await prisma.subscriptionPlan.findFirst({
      where: { name: 'FREE' },
    });

    if (!freePlan) {
      return res.status(404).json({ message: 'Paket FREE tidak ditemukan di database' });
    }

    // Cancel all current active/grace subscriptions
    await prisma.subscription.updateMany({
      where: {
        userId: ownerId,
        status: { in: ['ACTIVE', 'GRACE_PERIOD', 'PENDING_PAYMENT'] },
      },
      data: { status: 'CANCELLED' },
    });

    // Create fresh FREE plan subscription
    const newSub = await prisma.subscription.create({
      data: {
        userId: ownerId,
        planId: freePlan.id,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: null,
        isLifetime: false,
        source: 'MANUAL_GRANT',
        reason: reason?.trim() || 'Dicabut oleh Super Admin',
      },
    });

    // Audit Log
    await logAudit({
      action: 'MANUAL_REVOKE_PREMIUM',
      actorId,
      targetId: ownerId,
      description: `Super Admin mencabut Paket Premium milik owner: ${owner.email}. Alasan: ${reason?.trim() || 'Pencabutan manual'}`,
    });

    // Realtime WebSockets Emit
    try {
      const io = getIO();
      io.to(`user_${ownerId}`).emit('subscription_overridden', {
        planName: freePlan.name,
        isPremium: false,
        isLifetime: false,
        endDate: null,
        message: 'Status Premium Anda telah dicabut. Akun Anda kini menggunakan paket FREE.',
        source: 'MANUAL_GRANT',
      });
      io.to(`user_${ownerId}`).emit('subscription_expired', {
        planName: freePlan.name,
        isGracePeriod: false,
        isPremium: false,
        message: 'Status Premium Anda telah dicabut.',
      });
    } catch (_) {
      // Socket not critical
    }

    return res.json({
      message: `Berhasil mencabut status Premium untuk ${owner.name}. Akun dikembalikan ke paket FREE.`,
      subscription: newSub,
    });
  } catch (error) {
    next(error);
  }
};

