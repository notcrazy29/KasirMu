import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { z } from 'zod';
import { logAudit } from '../services/audit';
import crypto from 'crypto';
import { NotificationService } from '../services/notification';
import { createSessionAndTokens } from './session';
import { assignFreePlan } from '../services/subscription';

const JWT_SECRET = process.env.JWT_SECRET || 'kasirmu_super_jwt_secret_key_2026_secure';

// Validation Schemas
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Username atau Email wajib diisi'),
    password: z.string().min(1, 'Password wajib diisi'),
    targetRole: z.enum(['OWNER', 'CASHIER', 'SUPER_ADMIN']).optional(),
  }),
});

export const generateUniqueUsername = async (name: string, email: string): Promise<string> => {
  const base = (name || email.split('@')[0])
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '') || 'user';
  
  let candidate = base;
  let counter = 1;
  while (true) {
    const existing = await prisma.user.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
    candidate = `${base}${counter}`;
    counter++;
  }
};

export const validatePasswordStrength = (password: string): string | null => {
  if (password.length < 8) return 'Password minimal 8 karakter';
  if (!/[A-Z]/.test(password)) return 'Password minimal 1 huruf besar';
  if (!/[a-z]/.test(password)) return 'Password minimal 1 huruf kecil';
  if (!/[0-9]/.test(password)) return 'Password minimal 1 angka';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password minimal 1 karakter spesial (!@#$%^&* dll)';
  return null;
};


export const registerOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'OWNER',
        status: 'PENDING', // default status
      },
    });

    // Record audit trail
    await logAudit({
      action: 'REGISTER',
      actorId: user.id,
      description: `Owner registered new account: ${user.email} (Status: PENDING)`,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, storeId: null },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(201).json({
      message: 'Owner registered successfully. Waiting for administrator approval.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        storeId: null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawIdentifier = (req.body.email || req.body.username || req.body.identifier || '').trim();
    const { password } = req.body;

    if (!rawIdentifier) {
      return res.status(400).json({ message: 'Username atau Email wajib diisi' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password wajib diisi' });
    }
    
    // Extract metadata for tracking
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) device = 'Mobile';
    else if (/ipad|tablet/i.test(userAgent)) device = 'Tablet';

    // ── RATE LIMITER: Max 5 failed attempts in 15 minutes ──
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const failedAttempts = await prisma.loginActivity.count({
      where: {
        OR: [
          { email: rawIdentifier },
          { ipAddress }
        ],
        status: 'FAILED',
        createdAt: { gte: fifteenMinutesAgo }
      }
    });

    if (failedAttempts >= 5) {
      const oldestFailedInWindow = await prisma.loginActivity.findFirst({
        where: {
          OR: [{ email: rawIdentifier }, { ipAddress }],
          status: 'FAILED',
          createdAt: { gte: fifteenMinutesAgo }
        },
        orderBy: { createdAt: 'asc' }
      });
      const unblockAt = oldestFailedInWindow ? new Date(oldestFailedInWindow.createdAt.getTime() + 15 * 60 * 1000) : new Date(Date.now() + 15 * 60 * 1000);
      const remainingMinutes = Math.max(1, Math.ceil((unblockAt.getTime() - Date.now()) / (60 * 1000)));

      await logAudit({
        action: 'LOGIN_BLOCKED',
        actorId: 'SYSTEM',
        description: `Blocked login attempt for ${rawIdentifier} from IP ${ipAddress}. Too many failed attempts.`,
      });

      return res.status(429).json({
        message: `Terlalu banyak percobaan login yang gagal. Akun Anda diblokir sementara selama ${remainingMinutes} menit.`
      });
    }

    // Search by email OR username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: rawIdentifier },
          { username: rawIdentifier }
        ]
      },
      include: {
        ownedStores: {
          select: { id: true, name: true, status: true }
        }
      }
    });

    // ── Email / Username Validation Error Message ──
    if (!user) {
      await logAudit({
        action: 'LOGIN_FAILED',
        actorId: 'UNKNOWN',
        description: `Login failed for ${rawIdentifier}: Username atau Email tidak ditemukan.`
      });
      return res.status(400).json({ message: 'Username atau Email tidak ditemukan.' });
    }

    if (!user.password) {
      await prisma.loginActivity.create({
        data: {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          device,
          status: 'FAILED',
          description: 'Login failed: registered via Google',
        }
      });
      await logAudit({
        action: 'LOGIN_FAILED',
        actorId: user.id,
        description: `Login failed for ${user.email}: Registered via Google.`
      });
      return res.status(400).json({ message: 'Akun ini terdaftar via Google. Silakan login dengan Google.' });
    }

    // ── Password Validation Error Message ──
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Record failed login
      await prisma.loginActivity.create({
        data: {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          device,
          status: 'FAILED',
          description: 'Login failed: incorrect password',
        }
      });

      await logAudit({
        action: 'LOGIN_FAILED',
        actorId: user.id,
        description: `Login failed for ${user.email}: Password yang Anda masukkan salah.`
      });

      return res.status(400).json({ message: 'Password yang Anda masukkan salah.' });
    }

    // ── ROLE VALIDATION & ENFORCEMENT ──
    const targetRole = req.body.targetRole;
    if (targetRole === 'OWNER') {
      if (user.role !== 'OWNER') {
        await prisma.loginActivity.create({
          data: {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            device,
            status: 'FAILED',
            description: `Login failed: Role ${user.role} attempted Owner login`,
          }
        });
        return res.status(403).json({ message: 'Akun ini tidak memiliki akses ke Portal Owner.' });
      }
    } else if (targetRole === 'CASHIER') {
      if (user.role !== 'CASHIER') {
        await prisma.loginActivity.create({
          data: {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            device,
            status: 'FAILED',
            description: `Login failed: Role ${user.role} attempted Cashier login`,
          }
        });
        return res.status(403).json({ message: 'Akun ini bukan akun Kasir.' });
      }
    } else if (targetRole === 'SUPER_ADMIN') {
      if (user.role !== 'SUPER_ADMIN') {
        await prisma.loginActivity.create({
          data: {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            device,
            status: 'FAILED',
            description: `Login failed: Role ${user.role} attempted Super Admin login`,
          }
        });
        return res.status(403).json({ message: 'Akun tidak memiliki hak akses Super Admin.' });
      }
    } else {
      // If targetRole is missing, disallow Super Admin login without explicit targetRole
      if (user.role === 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Akun tidak memiliki hak akses Super Admin.' });
      }
    }

    // Status Validation
    if (user.status === 'SUSPENDED') {
      await prisma.loginActivity.create({
        data: {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          device,
          status: 'FAILED',
          description: 'Blocked login: account is suspended',
        }
      });
      return res.status(403).json({ message: 'Akun Anda ditangguhkan (SUSPENDED). Hubungi administrator.' });
    }

    if (user.status === 'REJECTED') {
      await prisma.loginActivity.create({
        data: {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          device,
          status: 'FAILED',
          description: 'Blocked login: registration rejected',
        }
      });
      return res.status(403).json({ message: 'Pendaftaran akun Anda ditolak (REJECTED). Hubungi administrator.' });
    }

    // Suspicious Login Detection
    const lastSuccessfulLogin = await prisma.loginActivity.findFirst({
      where: { userId: user.id, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    });

    let isSuspicious = false;
    let desc = 'Successful login';

    if (lastSuccessfulLogin) {
      const isNewIp = lastSuccessfulLogin.ipAddress !== ipAddress;
      const isNewDevice = lastSuccessfulLogin.device !== device;
      
      if (isNewIp || isNewDevice) {
        isSuspicious = true;
        desc = `Successful login flagged as suspicious. New IP: ${ipAddress} (previous: ${lastSuccessfulLogin.ipAddress}) or Device: ${device} (previous: ${lastSuccessfulLogin.device})`;
      }
    }

    // Record login activity in DB
    await prisma.loginActivity.create({
      data: {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        device,
        status: 'SUCCESS',
        isSuspicious,
        description: desc,
      }
    });

    // Write audit log
    await logAudit({
      action: 'LOGIN',
      actorId: user.id,
      description: `User ${user.email} logged in. Suspicious: ${isSuspicious}`,
    });

    // Register session and generate tokens
    const { accessToken, storeId: sessionStoreId } = await createSessionAndTokens(user, req, res);

    return res.json({
      message: 'Selamat datang kembali.',
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        storeId: sessionStoreId,
      },
      stores: user.role === 'OWNER' ? user.ownedStores : undefined,
    });
  } catch (error) {
    next(error);
  }
};

// Zod Profile Schema
export const completeProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Nama harus diisi'),
    birthPlace: z.string().min(2, 'Tempat lahir harus diisi'),
    birthDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Tanggal lahir tidak valid'),
    gender: z.enum(['MALE', 'FEMALE']),
    address: z.string().min(5, 'Alamat harus diisi'),
    province: z.string().min(2, 'Provinsi harus diisi'),
    city: z.string().min(2, 'Kota/Kabupaten harus diisi'),
    district: z.string().min(2, 'Kecamatan harus diisi'),
    postalCode: z.string().min(3, 'Kode pos tidak valid'),
    
    storeName: z.string().min(2, 'Nama toko harus diisi'),
    businessType: z.string().min(2, 'Jenis usaha harus diisi'),
    businessDescription: z.string().optional(),
    storeLogo: z.string().optional().nullable(),
    storeAddress: z.string().min(5, 'Alamat toko harus diisi'),

    username: z.string().optional(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
});

// Google Login / Registration
export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token Google diperlukan' });
    }

    let googleId: string;
    let email: string;
    let name: string;
    let picture: string | undefined;

    if (token.startsWith('mock_')) {
      // Mock OAuth for development
      googleId = token;
      const mockEmail = token.replace('mock_', '') + '@gmail.com';
      email = mockEmail;
      name = 'Google User (' + token.replace('mock_', '') + ')';
      picture = 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    } else {
      // Verify Google ID Token via tokeninfo endpoint
      const ticketResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      if (!ticketResponse.ok) {
        return res.status(400).json({ message: 'Token Google tidak valid atau kedaluwarsa' });
      }
      const payload = await ticketResponse.json() as any;
      googleId = payload.sub;
      email = payload.email;
      name = payload.name || 'Google User';
      picture = payload.picture;
    }

    // Find user
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        ownedStores: {
          select: { id: true, name: true, status: true }
        }
      }
    });

    if (user) {
      if (user.role !== 'OWNER') {
        return res.status(403).json({ message: 'Akun ini tidak memiliki akses ke Portal Owner.' });
      }
      // Link Google Account if not linked
      if (!user.googleId || !user.isGoogleVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            isGoogleVerified: true,
            loginProvider: user.password ? 'GOOGLE_AND_LOCAL' : 'GOOGLE',
          },
          include: {
            ownedStores: {
              select: { id: true, name: true, status: true }
            }
          }
        });
      }
    } else {
      // New registration for owner
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId,
          role: 'OWNER',
          status: 'PROFILE_INCOMPLETE',
          verifiedAt: new Date(),
          isGoogleVerified: true,
          loginProvider: 'GOOGLE',
        },
        include: {
          ownedStores: {
            select: { id: true, name: true, status: true }
          }
        }
      });

      await logAudit({
        action: 'REGISTER_OAUTH',
        actorId: user.id,
        description: `Owner registered new account via Google: ${user.email} (Status: PROFILE_INCOMPLETE)`,
      });
    }

    // Status Validation
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ message: 'Akun Anda ditangguhkan (SUSPENDED). Hubungi administrator.' });
    }

    if (user.status === 'REJECTED') {
      return res.status(403).json({ message: 'Pendaftaran akun Anda ditolak (REJECTED). Hubungi administrator.' });
    }

    // Register active session and generate tokens
    const { accessToken, storeId: sessionStoreId } = await createSessionAndTokens(user, req, res);

    return res.json({
      message: 'Login Google berhasil',
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        status: user.status,
        hasPassword: !!user.password,
        loginProvider: user.loginProvider,
        isGoogleVerified: user.isGoogleVerified,
        storeId: sessionStoreId,
      },
      stores: user.ownedStores,
    });
  } catch (error) {
    next(error);
  }
};

// Complete Profile
export const completeProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const {
      name,
      birthPlace,
      birthDate,
      gender,
      address,
      province,
      city,
      district,
      postalCode,
      storeName,
      businessType,
      businessDescription,
      storeLogo,
      storeAddress,
      username,
      password,
      confirmPassword,
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    if (user.status !== 'PROFILE_INCOMPLETE') {
      return res.status(400).json({ message: 'Profil Anda sudah dilengkapi' });
    }

    let assignedUsername = user.username;
    if (username || !assignedUsername) {
      const targetUsername = (username || '').trim();
      if (targetUsername) {
        if (targetUsername.length < 6 || targetUsername.length > 30) {
          return res.status(400).json({ message: 'Username harus 6 - 30 karakter' });
        }
        if (!/^[a-zA-Z0-9._]+$/.test(targetUsername)) {
          return res.status(400).json({ message: 'Username hanya boleh mengandung huruf, angka, underscore (_), dan titik (.)' });
        }
        const existingUser = await prisma.user.findFirst({
          where: { username: targetUsername, NOT: { id: userId } }
        });
        if (existingUser) {
          return res.status(400).json({ message: `Username '${targetUsername}' sudah digunakan oleh pengguna lain` });
        }
        assignedUsername = targetUsername;
      } else if (!assignedUsername) {
        assignedUsername = await generateUniqueUsername(name || user.name, user.email);
      }
    }

    let hashedPassword = user.password;
    if (password || !hashedPassword) {
      if (password) {
        if (!confirmPassword || password !== confirmPassword) {
          return res.status(400).json({ message: 'Konfirmasi password tidak cocok' });
        }
        const strengthErr = validatePasswordStrength(password);
        if (strengthErr) {
          return res.status(400).json({ message: strengthErr });
        }
        hashedPassword = await bcrypt.hash(password, 10);
      }
    }

    const parsedBirthDate = new Date(birthDate);

    // Save profile details
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        fullName: name,
        username: assignedUsername,
        password: hashedPassword,
        loginProvider: (user.googleId && hashedPassword) ? 'GOOGLE_AND_LOCAL' : hashedPassword ? 'LOCAL' : 'GOOGLE',
        birthPlace,
        birthDate: parsedBirthDate,
        gender,
        address,
        province,
        city,
        district,
        postalCode,
        storeName,
        businessType,
        businessDescription,
        storeLogo,
        storeAddress,
        status: 'PHONE_UNVERIFIED',
      }
    });

    await logAudit({
      action: 'COMPLETE_PROFILE',
      actorId: userId,
      description: `Owner completed profile details. Username: ${assignedUsername}. Status: PHONE_UNVERIFIED.`,
    });

    // Re-issue JWT token with updated status
    const jwtToken = jwt.sign(
      { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role, status: updatedUser.status, storeId: null },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: 'Profil berhasil dilengkapi',
      token: jwtToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        username: updatedUser.username,
        role: updatedUser.role,
        status: updatedUser.status,
        hasPassword: !!updatedUser.password,
        loginProvider: updatedUser.loginProvider,
        isGoogleVerified: updatedUser.isGoogleVerified,
        storeId: null,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update Username
export const updateUsername = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: 'Username wajib diisi' });

    const trimmed = username.trim();
    if (trimmed.length < 6 || trimmed.length > 30) {
      return res.status(400).json({ message: 'Username harus 6 - 30 karakter' });
    }
    if (!/^[a-zA-Z0-9._]+$/.test(trimmed)) {
      return res.status(400).json({ message: 'Username hanya boleh huruf, angka, underscore (_), dan titik (.)' });
    }

    const existing = await prisma.user.findFirst({
      where: { username: trimmed, NOT: { id: userId } }
    });
    if (existing) {
      return res.status(400).json({ message: 'Username sudah digunakan oleh akun lain' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { username: trimmed }
    });

    await logAudit({
      action: 'UPDATE_USERNAME',
      actorId: userId,
      description: `User updated username to ${trimmed}`
    });

    return res.json({ message: 'Username berhasil diperbarui', username: updated.username });
  } catch (error) {
    next(error);
  }
};

// Update Password
export const updatePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

    if (user.password) {
      if (!currentPassword) return res.status(400).json({ message: 'Password saat ini wajib diisi' });
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Password saat ini salah' });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Password baru dan konfirmasi password wajib diisi' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Konfirmasi password tidak cocok' });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) return res.status(400).json({ message: strengthError });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        loginProvider: user.googleId ? 'GOOGLE_AND_LOCAL' : 'LOCAL',
      }
    });

    await logAudit({
      action: 'UPDATE_PASSWORD',
      actorId: userId,
      description: `User updated account password`
    });

    return res.json({ message: 'Password berhasil diperbarui', hasPassword: true });
  } catch (error) {
    next(error);
  }
};

// Link Google Account
export const linkGoogleAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token Google diperlukan' });

    let googleId: string;
    if (token.startsWith('mock_')) {
      googleId = token;
    } else {
      const ticketResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      if (!ticketResponse.ok) return res.status(400).json({ message: 'Token Google tidak valid atau kedaluwarsa' });
      const payload = await ticketResponse.json() as any;
      googleId = payload.sub;
    }

    const existingGoogleUser = await prisma.user.findFirst({
      where: { googleId, NOT: { id: userId } }
    });
    if (existingGoogleUser) {
      return res.status(400).json({ message: 'Akun Google ini sudah terhubung ke akun KasirMu lain' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const newProvider = user?.password ? 'GOOGLE_AND_LOCAL' : 'GOOGLE';

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        isGoogleVerified: true,
        loginProvider: newProvider,
      }
    });

    await logAudit({
      action: 'LINK_GOOGLE',
      actorId: userId,
      description: `User linked Google account ID ${googleId}`
    });

    return res.json({ message: 'Akun Google berhasil dihubungkan', googleId: updated.googleId, isGoogleVerified: true });
  } catch (error) {
    next(error);
  }
};

// Unlink Google Account
export const unlinkGoogleAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

    if (!user.password) {
      return res.status(400).json({ message: 'Anda harus membuat password terlebih dahulu sebelum memutuskan akun Google.' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleId: null,
        isGoogleVerified: false,
        loginProvider: 'LOCAL',
      }
    });

    await logAudit({
      action: 'UNLINK_GOOGLE',
      actorId: userId,
      description: `User unlinked Google account`
    });

    return res.json({ message: 'Akun Google berhasil diputuskan' });
  } catch (error) {
    next(error);
  }
};

// Update Email
export const updateEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { newEmail, password } = req.body;

    if (!newEmail || !z.string().email().safeParse(newEmail).success) {
      return res.status(400).json({ message: 'Alamat email tidak valid' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

    if (user.password) {
      if (!password) return res.status(400).json({ message: 'Password wajib diisi untuk mengubah email' });
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Password salah' });
    }

    const existingEmail = await prisma.user.findFirst({
      where: { email: newEmail, NOT: { id: userId } }
    });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email sudah digunakan oleh akun lain' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail }
    });

    await logAudit({
      action: 'UPDATE_EMAIL',
      actorId: userId,
      description: `User updated email to ${newEmail}`
    });

    return res.json({ message: 'Email berhasil diperbarui', email: newEmail });
  } catch (error) {
    next(error);
  }
};

// Send Phone OTP
export const sendOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Nomor telepon wajib diisi' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    if (user.status !== 'PHONE_UNVERIFIED') {
      return res.status(400).json({ message: 'Verifikasi nomor telepon tidak diperlukan untuk status Anda saat ini' });
    }

    // Check lockout: count failed attempts in last 15 minutes (5 failures)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const lockedRecords = await prisma.oTPVerification.findMany({
      where: {
        userId,
        createdAt: { gte: fifteenMinsAgo },
        attempt: { gte: 5 }
      }
    });

    if (lockedRecords.length > 0) {
      const timeElapsed = (Date.now() - new Date(lockedRecords[0].createdAt).getTime()) / 1000;
      const timeLeft = Math.ceil(15 - timeElapsed / 60);
      return res.status(403).json({ 
        message: `Pengiriman OTP diblokir sementara. Silakan tunggu ${timeLeft} menit.` 
      });
    }

    // Rate Limit: check last OTP send request
    const lastOTP = await prisma.oTPVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (lastOTP) {
      const timeDiff = (Date.now() - new Date(lastOTP.createdAt).getTime()) / 1000;
      if (timeDiff < 60) {
        return res.status(429).json({ 
          message: `Mohon tunggu ${Math.ceil(60 - timeDiff)} detik sebelum mengirim ulang OTP` 
        });
      }

      // Check max resends in current window (last 15 minutes)
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const resendCount = await prisma.oTPVerification.count({
        where: {
          userId,
          createdAt: { gte: fifteenMinsAgo }
        }
      });

      if (resendCount >= 3) {
        return res.status(429).json({ 
          message: 'Batas maksimal kirim ulang OTP (3 kali) tercapai. Silakan coba lagi dalam 15 menit.' 
        });
      }
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP code using SHA-256 for secure storage
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    // OTP Expiry: 5 minutes from now
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save to DB
    await prisma.oTPVerification.create({
      data: {
        userId,
        phone,
        otpCode: hashedCode,
        expiredAt,
      }
    });

    // Send via notification service
    const sent = await NotificationService.sendOTP(phone, code);
    if (!sent) {
      return res.status(500).json({ message: 'Gagal mengirim OTP. Silakan hubungi support.' });
    }

    return res.json({
      message: 'OTP berhasil dikirim ke nomor telepon Anda',
      resendCooldown: 60
    });
  } catch (error) {
    next(error);
  }
};

// Verify Phone OTP
export const verifyOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { code, isFirebase, phone: submittedPhone } = req.body;

    if (isFirebase) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ message: 'User tidak ditemukan' });
      }

      const targetPhone = submittedPhone || user.phone;
      let updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          phone: targetPhone,
          phoneVerified: true,
          status: 'PENDING_APPROVAL',
        }
      });

      if (!updatedUser.username) {
        const generatedUsername = await generateUniqueUsername(updatedUser.name || 'user', updatedUser.email);
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { username: generatedUsername }
        });
      }

      await logAudit({
        action: 'VERIFY_OTP_FIREBASE',
        actorId: userId,
        description: `Phone ${targetPhone} successfully verified via Firebase. Username: ${updatedUser.username}.`,
      });

      const jwtToken = jwt.sign(
        { id: updatedUser.id, role: updatedUser.role, email: updatedUser.email, status: updatedUser.status },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Nomor telepon berhasil diverifikasi via Firebase',
        token: jwtToken,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
          username: updatedUser.username,
          hasPassword: !!updatedUser.password,
          phoneVerified: true,
        }
      });
    }

    if (!code || code.length !== 6) {
      return res.status(400).json({ message: 'Kode OTP harus berupa 6 digit angka' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    if (user.status !== 'PHONE_UNVERIFIED') {
      return res.status(400).json({ message: 'Nomor telepon sudah diverifikasi atau status tidak sesuai' });
    }

    // Check lockout: count failed attempts in last 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const lockedRecords = await prisma.oTPVerification.findMany({
      where: {
        userId,
        createdAt: { gte: fifteenMinsAgo },
        attempt: { gte: 5 }
      }
    });

    if (lockedRecords.length > 0) {
      const timeElapsed = (Date.now() - new Date(lockedRecords[0].createdAt).getTime()) / 1000;
      const timeLeft = Math.ceil(15 - timeElapsed / 60);
      return res.status(403).json({ 
        message: `Akun Anda dikunci sementara dari percobaan OTP. Silakan tunggu ${timeLeft} menit.` 
      });
    }

    // Find the latest active OTP verification record
    const latestOTP = await prisma.oTPVerification.findFirst({
      where: {
        userId,
        verified: false,
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!latestOTP) {
      return res.status(400).json({ message: 'Silakan kirim kode OTP terlebih dahulu' });
    }

    // Check expiry
    if (new Date() > latestOTP.expiredAt) {
      return res.status(400).json({ message: 'Kode OTP telah kedaluwarsa. Silakan kirim ulang.' });
    }

    // Hash the code to compare
    const hashedSubmitted = crypto.createHash('sha256').update(code).digest('hex');

    if (latestOTP.otpCode === hashedSubmitted) {
      // OTP is valid
      await prisma.oTPVerification.update({
        where: { id: latestOTP.id },
        data: { verified: true }
      });

      // Update user status & details
      let updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          phone: latestOTP.phone,
          phoneVerified: true,
          status: 'PENDING_APPROVAL',
        }
      });

      // Ensure username exists
      if (!updatedUser.username) {
        const generatedUsername = await generateUniqueUsername(updatedUser.name || 'user', updatedUser.email);
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { username: generatedUsername }
        });
      }

      await logAudit({
        action: 'VERIFY_OTP',
        actorId: userId,
        description: `Phone ${latestOTP.phone} successfully verified. Username: ${updatedUser.username}. Status: PENDING_APPROVAL.`,
      });

      // Re-issue JWT token with updated status
      const jwtToken = jwt.sign(
        { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role, status: updatedUser.status, storeId: null },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.cookie('token', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.json({
        message: 'Nomor telepon berhasil diverifikasi.',
        token: jwtToken,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          username: updatedUser.username,
          role: updatedUser.role,
          status: updatedUser.status,
          hasPassword: !!updatedUser.password,
          phoneVerified: true,
          storeId: null,
        }
      });
    } else {
      // Increment attempt
      const updatedOTP = await prisma.oTPVerification.update({
        where: { id: latestOTP.id },
        data: { attempt: { increment: 1 } }
      });

      if (updatedOTP.attempt >= 5) {
        await logAudit({
          action: 'OTP_LOCKOUT',
          actorId: userId,
          description: `User locked out from OTP attempts for 15 minutes due to 5 failures.`,
        });
        return res.status(403).json({ 
          message: 'Anda telah salah memasukkan OTP sebanyak 5 kali. Akun dikunci sementara selama 15 menit.' 
        });
      }

      const remaining = 5 - updatedOTP.attempt;
      return res.status(400).json({ 
        message: `Kode OTP salah. Sisa percobaan: ${remaining} kali.` 
      });
    }
  } catch (error) {
    next(error);
  }
};

// Reset Profile Status
export const resetProfileStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    if (user.status !== 'REJECTED') {
      return res.status(400).json({ message: 'Reset profil hanya dapat dilakukan untuk akun yang ditolak' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'PROFILE_INCOMPLETE',
      }
    });

    await logAudit({
      action: 'RESET_PROFILE',
      actorId: userId,
      description: `Owner reset profile from REJECTED back to PROFILE_INCOMPLETE to edit details.`,
    });

    const jwtToken = jwt.sign(
      { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role, status: updatedUser.status, storeId: null },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: 'Status profil berhasil direset, silakan lengkapi kembali data Anda.',
      token: jwtToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        status: updatedUser.status,
        storeId: null,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create Initial Password for Owner
export const createInitialPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({ message: 'Password dan Konfirmasi Password wajib diisi' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Konfirmasi password tidak cocok' });
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return res.status(400).json({ message: strengthError });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    // Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique username if null
    let username = user.username;
    if (!username) {
      username = await generateUniqueUsername(user.name || 'user', user.email);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        username,
      }
    });

    await logAudit({
      action: 'CREATE_PASSWORD',
      actorId: userId,
      description: `Owner created initial password. Username assigned: ${username}`,
    });

    const jwtToken = jwt.sign(
      { 
        id: updatedUser.id, 
        email: updatedUser.email, 
        name: updatedUser.name, 
        role: updatedUser.role, 
        status: updatedUser.status, 
        storeId: null 
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: 'Password berhasil dibuat',
      token: jwtToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        username: updatedUser.username,
        role: updatedUser.role,
        status: updatedUser.status,
        hasPassword: true,
        phoneVerified: updatedUser.phoneVerified,
        storeId: null,
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD FLOW
// ─────────────────────────────────────────────────────────────────────────────

// Step 1: Send OTP to Email
export const sendForgotPasswordOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email wajib diisi' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Email tidak ditemukan.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete existing OTPs for this email
    await prisma.passwordResetOTP.deleteMany({ where: { email } });

    await prisma.passwordResetOTP.create({
      data: {
        email,
        otpCode,
        expiredAt,
        verified: false,
      },
    });

    // Simulated log for local dev testing
    const logMsg = `\n=========================================\nTime: ${new Date().toISOString()}\nTo (Email): ${email}\nOTP Code: ${otpCode}\nMessage: [KasirMu] Kode OTP reset password Anda adalah ${otpCode}. Valid selama 5 menit.\n=========================================\n`;
    try {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(path.join(logDir, 'otp.log'), logMsg);
    } catch (e) {
      console.error('[OTP Log Error]', e);
    }

    await logAudit({
      action: 'FORGOT_PASSWORD_OTP_SENT',
      actorId: user.id,
      description: `Reset password OTP sent to ${email}`,
    });

    return res.json({ message: 'Kode OTP berhasil dikirim ke email Anda.' });
  } catch (error) {
    next(error);
  }
};

// Step 2: Verify OTP
export const verifyForgotPasswordOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otpCode } = req.body;
    if (!email || !otpCode) {
      return res.status(400).json({ message: 'Email dan Kode OTP wajib diisi' });
    }

    const record = await prisma.passwordResetOTP.findFirst({
      where: {
        email,
        otpCode,
        expiredAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(400).json({ message: 'Kode OTP tidak valid atau telah kedaluwarsa.' });
    }

    await prisma.passwordResetOTP.update({
      where: { id: record.id },
      data: { verified: true },
    });

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await logAudit({
        action: 'FORGOT_PASSWORD_OTP_VERIFIED',
        actorId: user.id,
        description: `Reset password OTP verified for ${email}`,
      });
    }

    return res.json({ message: 'Kode OTP berhasil diverifikasi.' });
  } catch (error) {
    next(error);
  }
};

// Step 3: Reset Password
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otpCode, newPassword } = req.body;
    if (!email || !otpCode || !newPassword) {
      return res.status(400).json({ message: 'Email, Kode OTP, dan Password Baru wajib diisi' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password minimal 8 karakter' });
    }

    const verifiedRecord = await prisma.passwordResetOTP.findFirst({
      where: {
        email,
        otpCode,
        verified: true,
      },
    });

    if (!verifiedRecord) {
      return res.status(400).json({ message: 'Sesi reset password tidak valid. Silakan ulangi dari awal.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Email tidak ditemukan.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Cleanup OTPs for this email
    await prisma.passwordResetOTP.deleteMany({ where: { email } });

    await logAudit({
      action: 'PASSWORD_RESET_SUCCESS',
      actorId: user.id,
      description: `Password reset successfully for ${email}`,
    });

    return res.json({ message: 'Password berhasil diperbarui. Silakan login kembali.' });
  } catch (error) {
    next(error);
  }
};


