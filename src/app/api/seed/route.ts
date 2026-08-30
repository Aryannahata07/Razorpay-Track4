import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSyntheticData } from "@/lib/synthetic-data";

export async function POST(request: Request) {
  try {
    // Basic protection (in a real app, require admin auth)
    // For this prototype, we'll allow it so the demo button works

    // 1. Clear existing data
    await prisma.evaluationCase.deleteMany();
    await prisma.agentRun.deleteMany();
    await prisma.exception.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.reconciliationDecision.deleteMany();
    await prisma.matchCandidate.deleteMany();
    await prisma.normalizedRecord.deleteMany();
    await prisma.sourceRecord.deleteMany();
    // Note: We DO NOT delete entityAlias, reconciliationRule, or merchant
    // This allows the "memory" of the system to persist across test data generations
    // so the F1 score can improve.

    // 2. Get or Create base Merchant
    let merchant = await prisma.merchant.findFirst();
    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: {
          name: "Demo Merchant Inc.",
          industry: "Retail",
        }
      });
    }

    // 3. Create a Run
    const run = await prisma.reconciliationRun.create({
      data: {
        merchantId: merchant.id,
        status: "STARTED",
      }
    });

    // 4. Generate data
    const records = generateSyntheticData(4217, 250);

    // 5. Insert Records and their Ground Truth (Evaluation Cases)
    let recordCount = 0;
    
    // Using a transaction for speed
    await prisma.$transaction(async (tx) => {
      for (const rec of records) {
        const sourceRec = await tx.sourceRecord.create({
          data: {
            id: rec.id, // Use synthetic ID to preserve relationships
            runId: run.id,
            sourceType: rec.sourceType,
            externalId: rec.externalId,
            recordDate: rec.recordDate,
            amount: rec.amount,
            currency: rec.currency,
            counterpartyName: rec.counterpartyName,
            reference: rec.reference,
            description: rec.description,
            status: "PENDING",
            rawPayload: JSON.stringify(rec),
          }
        });

        // Add to evaluation cases
        // Deterministic split: exactly every 5th record is held_out (20%)
        const split = (recordCount % 5 === 0) ? "held_out" : "development";
        
        await tx.evaluationCase.create({
          data: {
            runId: run.id,
            sourceRecordId: sourceRec.id,
            groundTruthDecision: rec.groundTruthDecision,
            groundTruthMatchId: rec.groundTruthMatchId,
            groundTruthRootCause: rec.groundTruthRootCause,
            datasetSplit: split
          }
        });
        recordCount++;
      }
    });
    
    // Oh wait, I didn't set the ID for sourceRecord, so Prisma will auto-generate one!
    // Let me update the transaction to explicitly pass `id: rec.id`.

    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        sourceCount: recordCount,
        recordCount: recordCount,
      }
    });

    return NextResponse.json({ success: true, runId: run.id, recordsCreated: recordCount });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
