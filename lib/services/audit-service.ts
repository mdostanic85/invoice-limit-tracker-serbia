import { prisma } from "@/lib/db/prisma";
import type { AuditAction, Prisma } from "@prisma/client";

export interface AuditEventInput {
  organizationId: string;
  entityType: string;
  entityId?: string;
  action: AuditAction;
  actorUserId: string;
  payload: Record<string, unknown>;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorUserId: input.actorUserId,
      payload: input.payload as Prisma.InputJsonValue,
    },
  });
}
