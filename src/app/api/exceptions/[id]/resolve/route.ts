import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { resolution, suggestedAlias } = body;

    const exception = await prisma.exception.findUnique({
      where: { id },
      include: { sourceRecord: true }
    });

    if (!exception) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 1. Mark Exception as RESOLVED
    await prisma.exception.update({
      where: { id },
      data: { status: "RESOLVED" }
    });

    // 2. Add an Audit Event
    await prisma.auditEvent.create({
      data: {
        runId: exception.sourceRecord.runId,
        recordId: exception.sourceRecordId,
        eventType: "HUMAN_OVERRIDE",
        description: `Human resolved exception ${id} as ${resolution}`,
        actor: "HumanController"
      }
    });

    // 3. Create Alias Rule if passed
    if (suggestedAlias) {
      // Upsert the alias so we don't crash on duplicates
      await prisma.entityAlias.upsert({
        where: {
          merchantId_sourceName: {
            merchantId: exception.merchantId,
            sourceName: suggestedAlias.sourceName
          }
        },
        update: {
          normalizedName: suggestedAlias.normalizedName,
          confidence: 1.0,
          source: "HUMAN_APPROVED"
        },
        create: {
          merchantId: exception.merchantId,
          sourceName: suggestedAlias.sourceName,
          normalizedName: suggestedAlias.normalizedName,
          confidence: 1.0,
          source: "HUMAN_APPROVED"
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resolve error:", error);
    return NextResponse.json({ error: "Failed to resolve exception" }, { status: 500 });
  }
}
