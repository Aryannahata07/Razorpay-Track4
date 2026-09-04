import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { resolution, suggestedAlias } = body;

    const exception = await prisma.exception.findUnique({
      where: { id },
      include: { 
        sourceRecord: true,
        run: true 
      }
    });

    if (!exception) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 1. Mark Exception as RESOLVED
    await prisma.exception.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() }
    });

    // Also update the source record and decision
    const decisions = await prisma.reconciliationDecision.findMany({
      where: { sourceRecordId: exception.sourceRecordId }
    });
    if (decisions[0]) {
      await prisma.reconciliationDecision.update({
        where: { id: decisions[0].id },
        data: {
          decision: "AUTO_RECONCILED",
          confidence: 1.0,
          decisionReason: "Human controller manual override approval"
        }
      });
    }

    await prisma.sourceRecord.update({
      where: { id: exception.sourceRecordId },
      data: { status: "RECONCILED" }
    });

    // 2. Add an Audit Event
    await prisma.auditEvent.create({
      data: {
        runId: exception.sourceRecord.runId,
        entityType: "EXCEPTION",
        entityId: id,
        eventType: "HUMAN_OVERRIDE",
        actorType: "HUMAN",
        action: resolution,
        reason: "Human reviewed AI investigation and approved",
        metadata: JSON.stringify({ suggestedAlias })
      }
    });

    // 3. Create Alias Rule if passed
    if (suggestedAlias) {
      // Check if this exact alias rule already exists
      const existing = await prisma.entityAlias.findFirst({
        where: {
          merchantId: exception.run.merchantId,
          alias: suggestedAlias.sourceName,
          canonicalEntity: suggestedAlias.normalizedName
        }
      });

      if (!existing) {
        // Create the alias rule
        await prisma.entityAlias.create({
          data: {
            merchantId: exception.run.merchantId,
            alias: suggestedAlias.sourceName,
            canonicalEntity: suggestedAlias.normalizedName,
            confidence: 1.0,
            source: "HUMAN_APPROVED",
            approved: true
          }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resolve error:", error);
    return NextResponse.json({ error: "Failed to resolve exception" }, { status: 500 });
  }
}
