import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function logAuditEvent({
  runId,
  entityType,
  entityId,
  eventType,
  actorType,
  action,
  reason,
  metadata
}: {
  runId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actorType: "SYSTEM" | "AGENT" | "HUMAN";
  action: string;
  reason?: string;
  metadata?: any;
}) {
  return prisma.auditEvent.create({
    data: {
      runId,
      entityType,
      entityId,
      eventType,
      actorType,
      action,
      reason,
      metadata: metadata ? JSON.stringify(metadata) : null,
    }
  });
}
