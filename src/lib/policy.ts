import { prisma } from "@/lib/prisma";

const POLICY_THRESHOLDS = {
  AUTO_RECONCILE: 0.85,
  REVIEW_REQUIRED: 0.60
};

/**
 * Financial invariant check.
 * Returns a failed invariant description, or null if all invariants pass.
 *
 * Invariants:
 * 1. AMOUNT_INVARIANT: If the payment-to-invoice ratio differs by more than 50%, 
 *    the match MUST NOT be auto-approved — even if entity and reference match.
 *    This catches the adversarial case: ₹10K payment ≠ ₹100K invoice.
 * 2. ZERO_AMOUNT_INVARIANT: Zero-amount matches are always blocked.
 */
function checkFinancialInvariants(
  paymentAmount: number,
  invoiceAmount: number
): string | null {
  if (paymentAmount === 0 || invoiceAmount === 0) {
    return "ZERO_AMOUNT_INVARIANT: Zero-amount record detected — cannot auto-match";
  }

  const ratio = paymentAmount / invoiceAmount;
  // Block if payment is less than 10% OR greater than 150% of invoice amount
  if (ratio < 0.10) {
    return `AMOUNT_INVARIANT: Payment (${(paymentAmount / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}) is only ${(ratio * 100).toFixed(1)}% of invoice (${(invoiceAmount / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}). Ratio threshold: ≥10%. BLOCKED.`;
  }
  if (ratio > 1.50) {
    return `AMOUNT_INVARIANT: Payment exceeds invoice by ${((ratio - 1) * 100).toFixed(1)}%. Possible duplicate or mis-keyed amount. BLOCKED.`;
  }

  return null; // All invariants pass
}

export async function runPolicyEngine(runId: string) {
  // Fetch pending records that have candidates
  const records = await prisma.sourceRecord.findMany({
    where: { runId, status: "PENDING", sourceType: "PAYMENT" },
    include: {
      candidatesSource: {
        orderBy: { overallScore: 'desc' },
        include: { candidateRecord: true }
      }
    }
  });

  // Check for 1-to-1 invariant (duplicate payments claiming the same invoice)
  const candidateClaims = new Map<string, string[]>();
  for (const record of records) {
    if (record.candidatesSource.length > 0) {
      const topCand = record.candidatesSource[0];
      // Only care if they are actually competing (score > 0.6)
      if (topCand.overallScore >= 0.6) {
        const topCandId = topCand.candidateRecordId;
        if (!candidateClaims.has(topCandId)) candidateClaims.set(topCandId, []);
        candidateClaims.get(topCandId)!.push(record.id);
      }
    }
  }

  for (const record of records) {
    if (record.candidatesSource.length === 0) {
      // No candidates found -> UNRESOLVED
      await recordDecision(runId, record.id, null, "UNRESOLVED", 0, "MISSING_RECORD", ["No matches found"]);
      continue;
    }

    const topCandidate = record.candidatesSource[0];
    const topCandId = topCandidate.candidateRecordId;

    // Safety Gate: 1-to-1 Invariant Violation (Duplicates)
    if (candidateClaims.get(topCandId) && candidateClaims.get(topCandId)!.length > 1) {
      await recordDecision(runId, record.id, topCandId, "REVIEW_REQUIRED", topCandidate.overallScore, "DUPLICATE", 
        ["Multiple payments are competing for this exact invoice"], ["1-to-1 matching invariant violated"]);
      continue;
    }

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

    // ── FINANCIAL INVARIANT GATE ────────────────────────────────────────────
    // This check runs AFTER scoring but BEFORE any approval.
    // It catches adversarial cases where entity + reference both match
    // but the amount is wildly different (e.g., ₹10K payment → ₹1,00,000 invoice).
    if (topCandidate.overallScore >= POLICY_THRESHOLDS.REVIEW_REQUIRED && topCandidate.candidateRecord) {
      const invariantFailure = checkFinancialInvariants(
        record.amount,
        topCandidate.candidateRecord.amount
      );
      if (invariantFailure) {
        await recordDecision(
          runId,
          record.id,
          topCandidate.candidateRecordId,
          "REVIEW_REQUIRED",
          topCandidate.overallScore,
          "AMOUNT_VARIANCE",
          [`Score: ${topCandidate.overallScore.toFixed(2)} — would have been AUTO_RECONCILED but blocked by invariant check`],
          [invariantFailure]
        );
        // Also create a specific audit event flagging the invariant failure
        await prisma.auditEvent.create({
          data: {
            runId,
            entityType: "RECORD",
            entityId: record.id,
            eventType: "INVARIANT_VIOLATION",
            actorType: "SYSTEM",
            action: "BLOCKED",
            reason: `Financial invariant failed: ${invariantFailure}`,
          }
        });
        continue;
      }
    }
    // ── END FINANCIAL INVARIANT GATE ────────────────────────────────────────

    // Policy thresholds
    if (topCandidate.overallScore >= POLICY_THRESHOLDS.AUTO_RECONCILE) {
      await recordDecision(runId, record.id, topCandidate.candidateRecordId, "AUTO_RECONCILED", topCandidate.overallScore, "NONE", ["Policy threshold met exactly"]);
    } else if (topCandidate.overallScore >= POLICY_THRESHOLDS.REVIEW_REQUIRED) {
      let rootCause = "UNKNOWN";
      
      // If the overall score is decent but the entity score is 0, it's highly likely an entity mismatch
      if (topCandidate.entityScore === 0) {
        rootCause = "ENTITY_AMBIGUITY";
      }
      
      await recordDecision(runId, record.id, topCandidate.candidateRecordId, "REVIEW_REQUIRED", topCandidate.overallScore, rootCause, ["Scores are moderate, review required"]);
    } else {
      let rootCause = "UNKNOWN";
      if (topCandidate.entityScore === 0 && topCandidate.overallScore > 0.4) {
        rootCause = "ENTITY_AMBIGUITY";
      }
      await recordDecision(runId, record.id, null, "UNRESOLVED", topCandidate.overallScore, rootCause, ["Scores are too low"]);
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
