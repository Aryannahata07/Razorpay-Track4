import { prisma } from "@/lib/prisma";

const POLICY_THRESHOLDS = {
  AUTO_RECONCILE: 0.85,
  REVIEW_REQUIRED: 0.60
};

export async function runPolicyEngine(runId: string) {
  // Fetch pending records that have candidates
  const records = await prisma.sourceRecord.findMany({
    where: { runId, status: "PENDING", sourceType: "PAYMENT" },
    include: {
      candidatesSource: {
        orderBy: { overallScore: 'desc' }
      }
    }
  });

  for (const record of records) {
    if (record.candidatesSource.length === 0) {
      // No candidates found -> UNRESOLVED
      await recordDecision(runId, record.id, null, "UNRESOLVED", 0, "MISSING_RECORD", ["No matches found"]);
      continue;
    }

    const topCandidate = record.candidatesSource[0];
    const secondCandidate = record.candidatesSource[1];

    // Check for ambiguity (two candidates very close in score)
    const isAmbiguous = secondCandidate && 
      (topCandidate.overallScore - secondCandidate.overallScore < 0.1) && 
      topCandidate.overallScore > 0.5;

    if (isAmbiguous) {
      await recordDecision(runId, record.id, topCandidate.candidateRecordId, "REVIEW_REQUIRED", topCandidate.overallScore, "ENTITY_AMBIGUITY", 
        ["Multiple candidates have similar scores"], ["Candidate A score is very close to Candidate B"]);
      continue;
    }

    // Safety Gate: Check for strong contradictions
    if (topCandidate.contradictionScore > 0.4) {
      await recordDecision(runId, record.id, topCandidate.candidateRecordId, "REVIEW_REQUIRED", topCandidate.overallScore, "REFERENCE_CONFLICT", 
        ["Scores are high but contradictions exist"], ["Contradiction threshold exceeded"]);
      continue;
    }

    // Policy thresholds
    if (topCandidate.overallScore >= POLICY_THRESHOLDS.AUTO_RECONCILE) {
      await recordDecision(runId, record.id, topCandidate.candidateRecordId, "AUTO_RECONCILED", topCandidate.overallScore, "NONE", ["Policy threshold met exactly"]);
    } else if (topCandidate.overallScore >= POLICY_THRESHOLDS.REVIEW_REQUIRED) {
      await recordDecision(runId, record.id, topCandidate.candidateRecordId, "REVIEW_REQUIRED", topCandidate.overallScore, "UNKNOWN", ["Scores are moderate, review required"]);
    } else {
      await recordDecision(runId, record.id, null, "UNRESOLVED", topCandidate.overallScore, "UNKNOWN", ["Scores are too low"]);
    }
  }
}

async function recordDecision(runId: string, sourceRecordId: string, matchedRecordId: string | null, decision: string, confidence: number, rootCause: string, evidence: string[] = [], contradictions: string[] = []) {
  await prisma.reconciliationDecision.create({
    data: {
      runId,
      sourceRecordId,
      matchedRecordId,
      decision,
      confidence,
      rootCause,
      evidenceJson: JSON.stringify(evidence),
      contradictionsJson: JSON.stringify(contradictions),
      policyResult: decision === "AUTO_RECONCILED" ? "PASSED" : "FAILED"
    }
  });

  // Update record status
  await prisma.sourceRecord.update({
    where: { id: sourceRecordId },
    data: {
      status: decision === "AUTO_RECONCILED" ? "RECONCILED" : (decision === "UNRESOLVED" ? "PENDING" : "EXCEPTION")
    }
  });

  // If review required or unresolved, create an exception
  if (decision === "REVIEW_REQUIRED" || decision === "UNRESOLVED") {
    await prisma.exception.create({
      data: {
        runId,
        sourceRecordId,
        severity: decision === "REVIEW_REQUIRED" ? "MEDIUM" : "HIGH",
        category: rootCause,
        title: `Exception for ${decision}`,
        description: `Policy engine marked this as ${decision} due to ${rootCause}`,
        recommendedAction: "Manual Review"
      }
    });
  }

  // Audit event
  await prisma.auditEvent.create({
    data: {
      runId,
      entityType: "RECORD",
      entityId: sourceRecordId,
      eventType: "POLICY_EVALUATION",
      actorType: "SYSTEM",
      action: decision,
      reason: rootCause
    }
  });
}
