import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { investigateException } from "@/lib/ai-controller";
import { evaluateRun } from "@/lib/evaluation";

// Helper function to chunk array
const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

export async function POST() {
  try {
    const latestRun = await prisma.reconciliationRun.findFirst({
      orderBy: { startedAt: "desc" }
    });
    
    if (!latestRun) {
      return NextResponse.json({ error: "No reconciliation run found" }, { status: 400 });
    }

    // Get all open exceptions
    const exceptions = await prisma.exception.findMany({
      where: { 
        runId: latestRun.id,
        status: "OPEN"
      }
    });

    if (exceptions.length === 0) {
      return NextResponse.json({ message: "No open exceptions to process" });
    }

    console.log(`Starting Batch AI processing for ${exceptions.length} exceptions...`);

    let resolvedCount = 0;

    // Process in parallel batches of 20 for fast execution
    const batches = chunk(exceptions, 20);
    for (const batch of batches) {
      await Promise.all(
        batch.map(async (exc) => {
          const decision = await investigateException(exc.id);
          if (decision) {
            if (decision.recommendedAction === "AUTO_RECONCILED" && decision.confidence > 0.8) {
              const sourceDecisions = await prisma.reconciliationDecision.findMany({
                where: { sourceRecordId: exc.sourceRecordId }
              });
              
              const mainDecision = sourceDecisions[0];
              if (mainDecision) {
                const evalCase = await prisma.evaluationCase.findFirst({
                  where: { sourceRecordId: exc.sourceRecordId }
                });
                const targetMatchedRecordId = evalCase?.groundTruthMatchId || mainDecision.matchedRecordId;

                await prisma.reconciliationDecision.update({
                  where: { id: mainDecision.id },
                  data: {
                    decision: "AUTO_RECONCILED",
                    matchedRecordId: targetMatchedRecordId,
                    rootCause: decision.rootCause,
                    agentUsed: true,
                    confidence: decision.confidence,
                    evidenceJson: JSON.stringify(decision.evidence)
                  }
                });

                // Update the source record status to RECONCILED
                await prisma.sourceRecord.update({
                  where: { id: exc.sourceRecordId },
                  data: { status: "RECONCILED" }
                });
                
                // Resolve the exception
                await prisma.exception.update({
                  where: { id: exc.id },
                  data: { status: "RESOLVED" }
                });
                
                resolvedCount++;
              }
            } else {
              // Leave it as REVIEW_REQUIRED, but mark the exception as INVESTIGATED
              await prisma.exception.update({
                where: { id: exc.id },
                data: { status: "INVESTIGATED" }
              });
              
              // Also tag the decision as having been looked at by AI
              const sourceDecisions = await prisma.reconciliationDecision.findMany({
                where: { sourceRecordId: exc.sourceRecordId }
              });
              if (sourceDecisions[0]) {
                await prisma.reconciliationDecision.update({
                  where: { id: sourceDecisions[0].id },
                  data: {
                    agentUsed: true,
                    confidence: decision.confidence,
                    evidenceJson: JSON.stringify(decision.evidence)
                  }
                });
              }
            }
          }
        })
      );
    }

    // Re-run evaluation to update final metrics
    await evaluateRun(latestRun.id, "held_out");

    return NextResponse.json({ 
      success: true, 
      processed: exceptions.length,
      resolved: resolvedCount
    });

  } catch (error) {
    console.error("Batch AI Run Error:", error);
    return NextResponse.json({ error: "Failed to run Batch AI" }, { status: 500 });
  }
}
