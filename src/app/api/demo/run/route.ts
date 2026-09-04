import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSyntheticData } from "@/lib/synthetic-data";
import { processNormalization } from "@/lib/normalization";
import { runDeterministicReconciliation } from "@/lib/reconciliation";
import { runPolicyEngine } from "@/lib/policy";
import { evaluateRun } from "@/lib/evaluation";

/**
 * POST /api/demo/run
 * Atomic one-click demo endpoint: seed + reconcile + evaluate in one request.
 * Returns progress steps and final metrics.
 */
export async function POST() {
  try {
    // ── STEP 1: RESET ────────────────────────────────────────────────────────
    await prisma.evaluationCase.deleteMany();
    await prisma.agentRun.deleteMany();
    await prisma.exception.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.reconciliationDecision.deleteMany();
    await prisma.matchCandidate.deleteMany();
    await prisma.normalizedRecord.deleteMany();
    await prisma.sourceRecord.deleteMany();
    await prisma.reconciliationRun.deleteMany();
    // Note: Keep entityAlias and merchant to preserve learned rules

    // ── STEP 2: SEED ─────────────────────────────────────────────────────────
    let merchant = await prisma.merchant.findFirst();
    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: { name: "Demo Merchant Inc.", industry: "Retail" },
      });
    }

    const run = await prisma.reconciliationRun.create({
      data: { merchantId: merchant.id, status: "STARTED" },
    });

    const records = generateSyntheticData(4217, 250);
    let recordCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const rec of records) {
        const sourceRec = await tx.sourceRecord.create({
          data: {
            id: rec.id,
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
          },
        });

        if (rec.sourceType === "PAYMENT") {
          const split = recordCount % 5 === 0 ? "held_out" : "development";
          await tx.evaluationCase.create({
            data: {
              runId: run.id,
              sourceRecordId: sourceRec.id,
              groundTruthDecision: rec.groundTruthDecision,
              groundTruthMatchId: rec.groundTruthMatchId,
              groundTruthRootCause: rec.groundTruthRootCause,
              datasetSplit: split,
            },
          });
        }
        recordCount++;
      }
    });

    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: { sourceCount: recordCount, recordCount },
    });

    // ── STEP 3: NORMALIZE ────────────────────────────────────────────────────
    const allRecords = await prisma.sourceRecord.findMany({
      where: { runId: run.id },
    });

    const normalizedData = await processNormalization(allRecords, merchant.id);

    await prisma.$transaction(
      normalizedData.map((norm) =>
        prisma.normalizedRecord.upsert({
          where: { sourceRecordId: norm.sourceRecordId },
          update: norm,
          create: norm,
        })
      )
    );

    // ── STEP 4: RECONCILE ────────────────────────────────────────────────────
    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: { status: "RUNNING" },
    });

    await runDeterministicReconciliation(run.id);

    // ── STEP 5: POLICY ───────────────────────────────────────────────────────
    await runPolicyEngine(run.id);

    // ── STEP 6: EVALUATE ─────────────────────────────────────────────────────
    const metrics = await evaluateRun(run.id, "all");

    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        precision: metrics.precision,
        recall: metrics.recall,
        f1Score: metrics.f1,
        unresolvedCount: metrics.unresolved,
        reviewCount: metrics.reviewRequired,
        matchedCount: metrics.autoReconciled,
      },
    });

    return NextResponse.json({
      success: true,
      runId: run.id,
      recordCount,
      metrics: {
        precision: metrics.precision,
        recall: metrics.recall,
        f1Score: metrics.f1,
        resolvedCount: metrics.autoReconciled,
        exceptionCount: metrics.reviewRequired,
      },
      steps: [
        { step: "reset", status: "done" },
        { step: "seed", status: "done", detail: `${recordCount} records generated` },
        { step: "normalize", status: "done" },
        { step: "reconcile", status: "done" },
        { step: "policy", status: "done" },
        { step: "evaluate", status: "done", detail: `F1: ${(metrics.f1 * 100).toFixed(1)}%` },
      ],
    });
  } catch (error) {
    console.error("Demo run error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
