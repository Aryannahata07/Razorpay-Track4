import { prisma } from "@/lib/prisma";

export type EvaluationMetrics = {
  totalRecords: number;
  autoReconciled: number;
  reviewRequired: number;
  unresolved: number;
  
  precision: number;
  recall: number;
  f1: number;
  autoResolutionRate: number;
  abstentionRate: number;
  exceptionRate: number;
  falsePositiveRate: number;
  throughputPerSecond: number;
};

export async function evaluateRun(runId: string, split: "development" | "held_out" | "all" = "held_out"): Promise<EvaluationMetrics> {
  const run = await prisma.reconciliationRun.findUnique({
    where: { id: runId }
  });
  
  if (!run) throw new Error("Run not found");

  // Fetch all decisions and evaluation cases
  const whereSplit = split === "all" ? {} : { datasetSplit: split };
  
  const cases = await prisma.evaluationCase.findMany({
    where: { runId, ...whereSplit },
    include: {
      sourceRecord: {
        include: {
          decisionsSource: true
        }
      }
    }
  });

  const totalRecords = cases.length;
  if (totalRecords === 0) {
    return {
      totalRecords: 0,
      autoReconciled: 0,
      reviewRequired: 0,
      unresolved: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      autoResolutionRate: 0,
      abstentionRate: 0,
      exceptionRate: 0,
      falsePositiveRate: 0,
      throughputPerSecond: 0,
    };
  }

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;
  
  let autoReconciled = 0;
  let reviewRequired = 0;
  let unresolved = 0;

  for (const evalCase of cases) {
    // There should be only one final decision per source record
    const decision = evalCase.sourceRecord.decisionsSource[0];
    const actualStatus = decision?.decision || "UNRESOLVED";
    const predictedMatch = decision?.matchedRecordId || null;

    if (actualStatus === "AUTO_RECONCILED") {
      autoReconciled++;
    } else if (actualStatus === "REVIEW_REQUIRED") {
      reviewRequired++;
    } else {
      unresolved++;
    }

    // Ground truth: MATCH means it SHOULD have matched to groundTruthMatchId
    // UNRESOLVED means it SHOULD NOT have matched.

    if (evalCase.groundTruthDecision === "MATCH") {
      if (actualStatus === "AUTO_RECONCILED" && predictedMatch === evalCase.groundTruthMatchId) {
        truePositives++;
      } else if (actualStatus === "AUTO_RECONCILED" && predictedMatch !== evalCase.groundTruthMatchId) {
        // Matched the wrong thing!
        falsePositives++;
        falseNegatives++; // missed the real match
      } else {
        // REVIEW or UNRESOLVED -> abstained
        falseNegatives++;
      }
    } else {
      // Ground truth UNRESOLVED
      if (actualStatus === "AUTO_RECONCILED") {
        falsePositives++; // matched when it shouldn't have
      } else {
        trueNegatives++; // correctly abstained
      }
    }
  }

  const precision = (truePositives + falsePositives) > 0 
    ? truePositives / (truePositives + falsePositives) 
    : 0;
    
  const recall = (truePositives + falseNegatives) > 0
    ? truePositives / (truePositives + falseNegatives)
    : 0;

  const f1 = (precision + recall) > 0 
    ? (2 * precision * recall) / (precision + recall)
    : 0;

  const autoResolutionRate = autoReconciled / totalRecords;
  const abstentionRate = (reviewRequired + unresolved) / totalRecords;
  
  // Actually false positive rate here: FP / Actual Negatives
  const actualNegatives = totalRecords - (truePositives + falseNegatives); 
  // (Note: in binary classification FPR = FP / (FP + TN))
  const falsePositiveRate = (falsePositives + trueNegatives) > 0 
    ? falsePositives / (falsePositives + trueNegatives)
    : 0;

  const exceptions = await prisma.exception.count({
    where: { runId }
  });
  const exceptionRate = exceptions / totalRecords;

  const durationMs = run.durationMs || 1000;
  const throughputPerSecond = (totalRecords / durationMs) * 1000;

  const metrics = {
    totalRecords,
    autoReconciled,
    reviewRequired,
    unresolved,
    precision,
    recall,
    f1,
    autoResolutionRate,
    abstentionRate,
    exceptionRate,
    falsePositiveRate,
    throughputPerSecond,
  };

  // Optionally save back to run if this is the 'all' split or main evaluation
  if (split === "held_out") {
    await prisma.reconciliationRun.update({
      where: { id: runId },
      data: {
        precision,
        recall,
        f1Score: f1,
        autoResolutionRate,
      }
    });
  }

  return metrics;
}
