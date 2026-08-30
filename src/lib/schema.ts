import { z } from "zod";

// --- API Input Schemas ---

export const RunReconciliationSchema = z.object({
  merchantId: z.string().uuid(),
  // For demo, we might not pass merchantId but just use a default seeded one
});

// --- Agent Structured Output Schema ---

export const AgentDecisionSchema = z.object({
  rootCause: z.enum([
    "AMOUNT_VARIANCE",
    "REFERENCE_CONFLICT",
    "DUPLICATE",
    "PARTIAL_PAYMENT",
    "SPLIT_PAYMENT",
    "TIMING_DIFFERENCE",
    "ENTITY_AMBIGUITY",
    "REFUND",
    "MISSING_RECORD",
    "UNKNOWN",
    "NONE"
  ]).describe("The identified root cause of the discrepancy or NONE if it's a clean match"),
  recommendedAction: z.enum([
    "AUTO_RECONCILED",
    "REVIEW_REQUIRED",
    "UNRESOLVED"
  ]).describe("The action recommended by the AI based on the evidence"),
  confidence: z.number().min(0).max(1).describe("Confidence score from 0 to 1"),
  evidence: z.array(z.string()).describe("A list of factual evidence points supporting the recommendation"),
  contradictions: z.array(z.string()).describe("A list of factual points that contradict the recommendation or highlight ambiguity"),
  additionalInformationRequired: z.array(z.string()).describe("List of missing information that would help make a better decision (e.g., 'Verify remittance advice')"),
  suggestedAlias: z.object({
    sourceName: z.string().describe("The raw entity name found in the source record"),
    normalizedName: z.string().describe("The canonical/expected entity name it should map to")
  }).nullable().describe("If the root cause is ENTITY_AMBIGUITY, suggest an alias mapping rule. Otherwise return null.")
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

// --- Synthetic Data Generator Schemas ---

export const DiscrepancyClassSchema = z.enum([
  "CLASS_A_EXACT",
  "CLASS_B_ENTITY_VAR",
  "CLASS_C_DATE_DRIFT",
  "CLASS_D_REF_VAR",
  "CLASS_E_PARTIAL",
  "CLASS_F_SPLIT",
  "CLASS_G_DUPLICATE",
  "CLASS_H_REFUND",
  "CLASS_I_FEE_VARIANCE",
  "CLASS_J_CONTRADICTION",
  "CLASS_K_AMBIGUOUS",
  "CLASS_L_UNRESOLVED"
]);
