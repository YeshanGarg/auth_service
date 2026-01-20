import { prisma } from "../config/prisma.js";

interface AuditInput {
    actorId?: number;
    action: string;
    entity: string;
    entityId?: number;
    metadata?: Record<string, any>;
    ip?: string;
    userAgent?: string;
}

export async function logAudit (data:AuditInput){
    await prisma.auditLog.create({data});
}