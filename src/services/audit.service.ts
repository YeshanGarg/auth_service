import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";

interface AuditInput {
    actorId?: number;
    action: string;
    entity: string;
    entityId?: number;
    metadata?: Prisma.InputJsonObject;
    ip?: string;
    userAgent?: string;
}

export async function logAudit (data:AuditInput){
    await prisma.auditLog.create({data});
}