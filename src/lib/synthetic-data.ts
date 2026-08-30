import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

// Deterministic PRNG
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextItem<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  nextDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + this.next() * (end.getTime() - start.getTime()));
  }

  uuid(): string {
    // Generate deterministic UUID-like string for our mock data
    return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => {
      const r = this.nextInt(0, 15);
      return r.toString(16);
    });
  }
}

export type SyntheticRecord = {
  id: string;
  sourceType: "PAYMENT" | "INVOICE" | "SETTLEMENT" | "REFUND";
  externalId: string;
  recordDate: Date;
  amount: number; // minor units
  currency: string;
  counterpartyName: string | null;
  reference: string | null;
  description: string | null;
  
  // Ground truth
  groundTruthDecision: "MATCH" | "UNRESOLVED";
  groundTruthMatchId: string | null; // ID of the canonical target it should match to
  groundTruthRootCause: string;
  discrepancyClass: string;
};

const BASE_COMPANIES = [
  "Acme Industries", "Globex Corp", "Soylent Corp", "Initech", 
  "Umbrella Corp", "Stark Industries", "Wayne Enterprises", "Massive Dynamic"
];

export function generateSyntheticData(seed: number = 4217, count: number = 250): SyntheticRecord[] {
  const rng = new SeededRandom(seed);
  const records: SyntheticRecord[] = [];
  
  let i = 0;
  
  // We'll generate pairs or clusters of records. 
  // Let's assume on average a cluster is 2 records (1 invoice, 1 payment).
  // So we need about count / 2 clusters.
  
  while (records.length < count) {
    const rand = rng.next();
    let discrepancyClass = "CLASS_A_EXACT";
    
    // Weight the data for a dramatic demo:
    // 40% exact matches (to show baseline success)
    // 40% entity variance (to give plenty of demo targets for the AI)
    // 20% other complex errors (to show realistic exceptions)
    if (rand < 0.4) {
      discrepancyClass = "CLASS_A_EXACT";
    } else if (rand < 0.8) {
      discrepancyClass = "CLASS_B_ENTITY_VAR";
    } else {
      discrepancyClass = rng.nextItem([
        "CLASS_C_DATE_DRIFT",
        "CLASS_D_REF_VAR",
        "CLASS_E_PARTIAL",
        "CLASS_F_SPLIT",
        "CLASS_G_DUPLICATE",
        "CLASS_J_CONTRADICTION",
        "CLASS_K_AMBIGUOUS",
        "CLASS_L_UNRESOLVED"
      ]);
    }

    const amount = rng.nextInt(1000, 100000) * 100; // in paise
    const company = rng.nextItem(BASE_COMPANIES);
    const invoiceId = `INV-${rng.nextInt(1000, 9999)}`;
    const payId = `PAY-${rng.nextInt(10000, 99999)}`;
    const baseDate = rng.nextDate(new Date('2024-01-01'), new Date('2024-06-01'));
    
    // Core Invoice (Target)
    const invoice: SyntheticRecord = {
      id: rng.uuid(),
      sourceType: "INVOICE",
      externalId: invoiceId,
      recordDate: baseDate,
      amount,
      currency: "INR",
      counterpartyName: company,
      reference: null,
      description: "Services rendered",
      
      groundTruthDecision: "MATCH",
      groundTruthMatchId: null, // this will be the target for others
      groundTruthRootCause: "NONE",
      discrepancyClass
    };
    
    if (discrepancyClass === "CLASS_A_EXACT") {
      const payment: SyntheticRecord = {
        id: rng.uuid(),
        sourceType: "PAYMENT",
        externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 2), // +2 days
        amount,
        currency: "INR",
        counterpartyName: company,
        reference: invoiceId,
        description: "Payment for invoice",
        groundTruthDecision: "MATCH",
        groundTruthMatchId: invoice.id,
        groundTruthRootCause: "NONE",
        discrepancyClass
      };
      records.push(invoice, payment);
    } else if (discrepancyClass === "CLASS_B_ENTITY_VAR") {
      // Map base companies to ONE specific, deterministic alias so the rule memory works perfectly
      const aliasMap: Record<string, string> = {
        "Acme Industries": "ACME INC",
        "Globex Corp": "Globex Corporation",
        "Soylent Corp": "Soylent",
        "Initech": "Initech LLC",
        "Umbrella Corp": "Umbrella",
        "Stark Industries": "Stark Ind",
        "Wayne Enterprises": "Wayne Ent",
        "Massive Dynamic": "Massive Dyn"
      };
      
      const payment: SyntheticRecord = {
        id: rng.uuid(),
        sourceType: "PAYMENT",
        externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000),
        amount,
        currency: "INR",
        counterpartyName: aliasMap[company] || company,
        reference: invoiceId,
        description: "Payment",
        groundTruthDecision: "MATCH",
        groundTruthMatchId: invoice.id,
        groundTruthRootCause: "ENTITY_AMBIGUITY",
        discrepancyClass
      };
      records.push(invoice, payment);
    } else if (discrepancyClass === "CLASS_C_DATE_DRIFT") {
      const payment: SyntheticRecord = {
        id: rng.uuid(),
        sourceType: "PAYMENT",
        externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * rng.nextInt(30, 90)), // +30 to 90 days
        amount,
        currency: "INR",
        counterpartyName: company,
        reference: invoiceId,
        description: "Payment",
        groundTruthDecision: "MATCH",
        groundTruthMatchId: invoice.id,
        groundTruthRootCause: "TIMING_DIFFERENCE",
        discrepancyClass
      };
      records.push(invoice, payment);
    } else if (discrepancyClass === "CLASS_D_REF_VAR") {
      const refVariants = [invoiceId.toLowerCase(), invoiceId.replace("-", ""), `Invoice ${invoiceId.split("-")[1]}`];
      const payment: SyntheticRecord = {
        id: rng.uuid(),
        sourceType: "PAYMENT",
        externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 5),
        amount,
        currency: "INR",
        counterpartyName: company,
        reference: rng.nextItem(refVariants),
        description: "Payment",
        groundTruthDecision: "MATCH",
        groundTruthMatchId: invoice.id,
        groundTruthRootCause: "REFERENCE_CONFLICT",
        discrepancyClass
      };
      records.push(invoice, payment);
    } else if (discrepancyClass === "CLASS_E_PARTIAL") {
      const p1 = Math.floor(amount * 0.6);
      const p2 = amount - p1;
      const payment1: SyntheticRecord = {
        id: rng.uuid(),
        sourceType: "PAYMENT",
        externalId: payId + "-1",
        recordDate: new Date(baseDate.getTime() + 86400000 * 2),
        amount: p1,
        currency: "INR",
        counterpartyName: company,
        reference: invoiceId,
        description: "Partial Payment 1",
        groundTruthDecision: "MATCH",
        groundTruthMatchId: invoice.id,
        groundTruthRootCause: "PARTIAL_PAYMENT",
        discrepancyClass
      };
      const payment2: SyntheticRecord = {
        id: rng.uuid(),
        sourceType: "PAYMENT",
        externalId: payId + "-2",
        recordDate: new Date(baseDate.getTime() + 86400000 * 15),
        amount: p2,
        currency: "INR",
        counterpartyName: company,
        reference: invoiceId,
        description: "Partial Payment 2",
        groundTruthDecision: "MATCH",
        groundTruthMatchId: invoice.id,
        groundTruthRootCause: "PARTIAL_PAYMENT",
        discrepancyClass
      };
      records.push(invoice, payment1, payment2);
    } else if (discrepancyClass === "CLASS_L_UNRESOLVED") {
      const payment: SyntheticRecord = {
        id: rng.uuid(),
        sourceType: "PAYMENT",
        externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 2),
        amount: amount + 100, // slightly off amount
        currency: "INR",
        counterpartyName: "Unknown Entity", // missing/bad entity
        reference: "random-ref", // missing ref
        description: "Payment",
        groundTruthDecision: "UNRESOLVED",
        groundTruthMatchId: null,
        groundTruthRootCause: "UNKNOWN",
        discrepancyClass
      };
      records.push(invoice, payment);
    } else {
      // Fallback to exact for any unhandled classes in this simple mock
      const payment: SyntheticRecord = {
        id: rng.uuid(),
        sourceType: "PAYMENT",
        externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 2), 
        amount,
        currency: "INR",
        counterpartyName: company,
        reference: invoiceId,
        description: "Payment for invoice",
        groundTruthDecision: "MATCH",
        groundTruthMatchId: invoice.id,
        groundTruthRootCause: "NONE",
        discrepancyClass: "CLASS_A_EXACT"
      };
      records.push(invoice, payment);
    }
  }

  // Trim to exactly 'count' if we went over
  return records.slice(0, count);
}
