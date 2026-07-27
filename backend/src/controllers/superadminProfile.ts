import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logAudit } from '../services/audit';

// GET /api/super-admin/profile
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        fullName: true,
        phone: true,
        profileImage: true,
        twoFactorEnabled: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const sessions = await prisma.userSession.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: { actorId: userId },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ user, sessions, auditLogs });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/super-admin/profile
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { name, fullName } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || user.name,
        fullName: fullName || user.fullName,
      },
    });

    await logAudit({
      action: 'UPDATE_PROFILE',
      actorId: userId,
      description: `Super Admin updated basic profile info: ${updatedUser.name}`,
    });

    return res.json({
      message: 'Profil berhasil diperbarui',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        username: updatedUser.username,
        phone: updatedUser.phone,
        profileImage: updatedUser.profileImage,
        twoFactorEnabled: updatedUser.twoFactorEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/super-admin/change-username
export const changeUsername = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan Password saat ini wajib diisi' });
    }

    // Validation rules: 5-30 chars, alphanumeric/underscore/dot
    const usernameRegex = /^[a-zA-Z0-9_\.]+$/;
    if (username.length < 5 || username.length > 30 || !usernameRegex.test(username)) {
      return res.status(400).json({ 
        message: 'Username harus terdiri dari 5-30 karakter dan hanya mengandung huruf, angka, underscore (_), atau titik (.)' 
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    // Re-authenticate
    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Password saat ini salah' });
    }

    // Uniqueness check
    if (username !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return res.status(400).json({ message: 'Username sudah digunakan oleh akun lain' });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { username },
    });

    await logAudit({
      action: 'CHANGE_USERNAME',
      actorId: userId,
      description: `Super Admin changed username to ${username}`,
    });

    return res.json({ message: 'Username berhasil diperbarui', username });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/super-admin/change-email
export const changeEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email baru dan Password saat ini wajib diisi' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    // Re-authenticate
    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Password saat ini salah' });
    }

    // Check if new email is in use
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      return res.status(400).json({ message: 'Email sudah digunakan oleh akun lain' });
    }

    // Generate token valid for 24 hours
    const token = crypto.randomBytes(32).toString('hex');
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Save verification entry
    await prisma.emailVerification.create({
      data: {
        userId,
        newEmail: email,
        token,
        expiredAt,
      },
    });

    const verifyLink = `http://localhost:5000/api/auth/verify-email?token=${token}`;
    console.log(`\n=========================================\n[Email Verification Link Generated]\nTo: ${email}\nLink: ${verifyLink}\nValid for 24 hours.\n=========================================\n`);

    // Log verification link to public log file for easy testing
    const logPath = path.join(__dirname, '../../logs/email_verification.log');
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(logPath, `\nTime: ${new Date().toISOString()}\nEmail: ${email}\nLink: ${verifyLink}\n------------------\n`);

    await logAudit({
      action: 'CHANGE_EMAIL',
      actorId: userId,
      description: `Super Admin requested email change to ${email}. Verification sent.`,
    });

    return res.json({ 
      message: 'Link verifikasi telah dikirim ke email baru Anda. Email lama Anda akan tetap aktif sampai verifikasi selesai.',
      link: verifyLink // returned for dev ease
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/verify-email
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Token verifikasi diperlukan' });
    }

    const verification = await prisma.emailVerification.findUnique({
      where: { token: String(token) },
    });

    if (!verification) {
      return res.status(400).json({ message: 'Token verifikasi tidak valid' });
    }

    if (verification.expiredAt < new Date()) {
      return res.status(400).json({ message: 'Token verifikasi sudah kedaluwarsa (berlaku 24 jam)' });
    }

    // Update email in User table
    await prisma.user.update({
      where: { id: verification.userId },
      data: { email: verification.newEmail },
    });

    // Delete token record
    await prisma.emailVerification.delete({
      where: { id: verification.id },
    });

    await logAudit({
      action: 'VERIFY_EMAIL',
      actorId: verification.userId,
      description: `User successfully verified new email: ${verification.newEmail}`,
    });

    // Redirect to frontend with success query param
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?email_verified=true`);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/super-admin/change-password
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Seluruh kolom password wajib diisi' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Konfirmasi password baru tidak cocok' });
    }

    // Strict validation
    // min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        message: 'Password baru minimal 12 karakter, mengandung setidaknya 1 huruf besar, 1 huruf kecil, 1 angka, dan 1 karakter spesial.' 
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    // Re-authenticate old password
    if (!user.password || !(await bcrypt.compare(oldPassword, user.password))) {
      return res.status(401).json({ message: 'Password lama Anda salah' });
    }

    // Check against last 5 passwords
    const passwordHistories = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Check current active password as well
    const isCurrentMatch = await bcrypt.compare(newPassword, user.password);
    if (isCurrentMatch) {
      return res.status(400).json({ message: 'Password baru tidak boleh sama dengan password saat ini atau 5 password terakhir Anda.' });
    }

    for (const history of passwordHistories) {
      if (await bcrypt.compare(newPassword, history.hash)) {
        return res.status(400).json({ message: 'Password baru tidak boleh sama dengan 5 password terakhir Anda.' });
      }
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);

    // Save old password hash into history (before updating user password)
    await prisma.passwordHistory.create({
      data: {
        userId,
        hash: user.password,
      },
    });

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNew },
    });

    await logAudit({
      action: 'CHANGE_PASSWORD',
      actorId: userId,
      description: `Super Admin changed password. Revoking all device sessions.`,
    });

    // Invalidate all active device sessions
    await prisma.userSession.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Clear HTTP-Only cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');

    return res.json({ 
      message: 'Password berhasil diubah. Sesi di seluruh perangkat telah dihentikan. Silakan login kembali.' 
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/super-admin/change-phone
export const changePhone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Nomor telepon baru wajib diisi' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = crypto.createHash('sha256').update(otp).digest('hex');

    // Create verification code record
    await prisma.oTPVerification.create({
      data: {
        userId,
        phone,
        otpCode: hashedCode,
        expiredAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes validity
      },
    });

    // Log verification details to file for local testing
    const logMsg = `\n=========================================\nTime: ${new Date().toISOString()}\nTo (Phone): ${phone}\nOTP Code: ${otp}\nMessage: [KasirMu] Kode verifikasi nomor telepon baru Anda adalah ${otp}.\n=========================================\n`;
    const logPath = path.join(__dirname, '../../logs/otp.log');
    fs.appendFileSync(logPath, logMsg);

    return res.json({ 
      message: 'Kode OTP verifikasi telah dikirim ke nomor telepon baru Anda.',
      phone 
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/super-admin/verify-phone
export const verifyPhone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { phone, otpCode } = req.body;

    if (!phone || !otpCode) {
      return res.status(400).json({ message: 'Nomor telepon dan Kode OTP wajib diisi' });
    }

    const hashedCode = crypto.createHash('sha256').update(otpCode).digest('hex');

    const verification = await prisma.oTPVerification.findFirst({
      where: {
        userId,
        phone,
        otpCode: hashedCode,
        verified: false,
        expiredAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return res.status(400).json({ message: 'Kode OTP tidak valid atau sudah kedaluwarsa' });
    }

    // Mark as verified
    await prisma.oTPVerification.update({
      where: { id: verification.id },
      data: { verified: true },
    });

    // Update phone in User table
    await prisma.user.update({
      where: { id: userId },
      data: { 
        phone,
        phoneVerified: true,
      },
    });

    await logAudit({
      action: 'CHANGE_PHONE',
      actorId: userId,
      description: `Super Admin successfully updated and verified phone number: ${phone}`,
    });

    return res.json({ message: 'Nomor telepon berhasil diverifikasi dan diperbarui' });
  } catch (error) {
    next(error);
  }
};

// POST /api/super-admin/upload-avatar
export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { image } = req.body; // base64 string

    if (!image) {
      return res.status(400).json({ message: 'Payload foto Base64 diperlukan' });
    }

    // Check size limit: 2MB ~ 2.7M characters in base64 string
    if (image.length > 2.8 * 1024 * 1024) {
      return res.status(400).json({ message: 'Ukuran foto melebihi batas maksimal 2 MB' });
    }

    // Ensure format is valid base64 image data (JPG, PNG, WEBP)
    if (!image.startsWith('data:image/jpeg') && 
        !image.startsWith('data:image/png') && 
        !image.startsWith('data:image/webp')) {
      return res.status(400).json({ message: 'Format foto harus berupa JPG, PNG, atau WEBP' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { profileImage: image },
    });

    await logAudit({
      action: 'UPLOAD_PROFILE_PHOTO',
      actorId: userId,
      description: `Super Admin uploaded a new profile image.`,
    });

    return res.json({ message: 'Foto profil berhasil diperbarui', profileImage: image });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/super-admin/avatar
export const deleteAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { profileImage: null },
    });

    await logAudit({
      action: 'DELETE_PROFILE_PHOTO',
      actorId: userId,
      description: `Super Admin deleted profile image.`,
    });

    return res.json({ message: 'Foto profil berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

// POST /api/super-admin/toggle-2fa
export const toggle2FA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { enable } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: !!enable },
    });

    await logAudit({
      action: enable ? 'ENABLE_2FA' : 'DISABLE_2FA',
      actorId: userId,
      description: `Super Admin ${enable ? 'enabled' : 'disabled'} Two-Factor Authentication.`,
    });

    return res.json({ 
      message: `2FA berhasil ${enable ? 'diaktifkan' : 'dinonaktifkan'}.`,
      twoFactorEnabled: user.twoFactorEnabled 
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/super-admin/logout-all-devices
export const logoutAllDevices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    await prisma.userSession.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    await logAudit({
      action: 'FORCE_LOGOUT_ALL_DEVICES',
      actorId: userId,
      description: `Super Admin forced logout on all device sessions.`,
    });

    return res.json({ message: 'Berhasil memutuskan sesi di semua perangkat' });
  } catch (error) {
    next(error);
  }
};
