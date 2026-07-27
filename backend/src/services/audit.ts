import prisma from '../config/db';

export const logAudit = async (data: {
  action: string;
  actorId: string;
  targetId?: string;
  description: string;
}) => {
  try {
    const log = await prisma.auditLog.create({
      data: {
        action: data.action,
        actorId: data.actorId,
        targetId: data.targetId || null,
        description: data.description,
      },
    });
    console.log(`[Audit Logged] ${data.action} - ${data.description}`);
    return log;
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
