import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDeterministicReconciliation } from "@/lib/reconciliation";
import { runPolicyEngine } from "@/lib/policy";
import { evaluateRun } from "@/lib/evaluation";

export async function POST(request: Request) {
  try {
    const { runId } = await request.json();

    if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

    const startTime = Date.now();

    // 1. Run Candidate Generation & Scoring
    await runDeterministicReconciliation(runId);

    // 2. Run Policy Engine (auto-reconcile, review, unresolved)
    await runPolicyEngine(runId);

    // 3. Update Run metrics and status
    const durationMs = Date.now() - startTime;
    await prisma.reconciliationRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", completedAt: new Date(), durationMs }
    });

    // 4. Run Evaluation
    const metrics = await evaluateRun(runId, "held_out");

    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    console.error("Reconciliation run failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const runs = await prisma.reconciliationRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 1
    });

    if (runs.length === 0) return NextResponse.json({ run: null, metrics: null });

    const run = runs[0];
    let metrics = null;
    if (run.status === "COMPLETED") {
       metrics = await evaluateRun(run.id, "held_out");
    }

    return NextResponse.json({ run, metrics });
  } catch (error) {
    console.error("GET /api/run error:", error);
    return NextResponse.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}
