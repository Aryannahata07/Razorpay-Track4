// Deterministic PRNG — Linear Congruential Generator
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
    return new Date(
      start.getTime() + this.next() * (end.getTime() - start.getTime())
    );
  }

  uuid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.floor(this.next() * 16);
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export type SyntheticRecord = {
  id: string;
  sourceType: "PAYMENT" | "INVOICE" | "SETTLEMENT" | "REFUND";
  externalId: string;
  recordDate: Date;
  amount: number; // minor units (paise)
  currency: string;
  counterpartyName: string | null;
  reference: string | null;
  description: string | null;

  // Ground truth (hidden from UI, used by evaluation engine)
  groundTruthDecision: "MATCH" | "UNRESOLVED";
  groundTruthMatchId: string | null;
  groundTruthRootCause: string;
  discrepancyClass: string;
  isHeroScenario?: boolean;
  heroLabel?: string;
};

const BASE_COMPANIES = [
  "Acme Industries",
  "Globex Corp",
  "Soylent Corp",
  "Initech",
  "Umbrella Corp",
  "Stark Industries",
  "Wayne Enterprises",
  "Massive Dynamic",
];

const ENTITY_ALIAS_MAP: Record<string, string> = {
  "Acme Industries": "ACME INC",
  "Globex Corp": "Globex Corporation",
  "Soylent Corp": "Soylent",
  "Initech": "Initech LLC",
  "Umbrella Corp": "Umbrella",
  "Stark Industries": "Stark Ind",
  "Wayne Enterprises": "Wayne Ent",
  "Massive Dynamic": "Massive Dyn",
};

function makeInvoice(rng: SeededRandom, overrides: Partial<SyntheticRecord> = {}): SyntheticRecord {
  const base: SyntheticRecord = {
    id: rng.uuid(),
    sourceType: "INVOICE",
    externalId: `INV-${rng.nextInt(1000, 9999)}`,
    recordDate: rng.nextDate(new Date("2024-01-01"), new Date("2024-06-01")),
    amount: rng.nextInt(5000, 90000) * 100,
    currency: "INR",
    counterpartyName: rng.nextItem(BASE_COMPANIES),
    reference: null,
    description: "Services rendered",
    groundTruthDecision: "MATCH",
    groundTruthMatchId: null,
    groundTruthRootCause: "NONE",
    discrepancyClass: "CLASS_A_EXACT",
  };
  return { ...base, ...overrides };
}

function generateHeroScenarios(rng: SeededRandom): SyntheticRecord[] {
  const records: SyntheticRecord[] = [];

  // HERO 1: Easy Match — everything aligns perfectly
  {
    const inv = makeInvoice(rng, {
      externalId: "INV-HERO1", amount: 4872000, counterpartyName: "Acme Industries",
      discrepancyClass: "CLASS_A_EXACT", isHeroScenario: true, heroLabel: "Hero 1: Easy Match",
    });
    records.push(inv, {
      id: rng.uuid(), sourceType: "PAYMENT", externalId: "PAY-HERO1",
      recordDate: new Date(inv.recordDate.getTime() + 86400000 * 2),
      amount: inv.amount, currency: "INR", counterpartyName: "Acme Industries",
      reference: "INV-HERO1", description: "Payment for Invoice INV-HERO1",
      groundTruthDecision: "MATCH", groundTruthMatchId: inv.id,
      groundTruthRootCause: "NONE", discrepancyClass: "CLASS_A_EXACT",
      isHeroScenario: true, heroLabel: "Hero 1: Easy Match",
    });
  }

  // HERO 2: Fuzzy Entity — names differ but refer to same entity
  {
    const inv = makeInvoice(rng, {
      externalId: "INV-HERO2", amount: 7500000, counterpartyName: "Globex Corp",
      discrepancyClass: "CLASS_B_ENTITY_VAR", isHeroScenario: true, heroLabel: "Hero 2: Fuzzy Entity",
    });
    records.push(inv, {
      id: rng.uuid(), sourceType: "PAYMENT", externalId: "PAY-HERO2",
      recordDate: new Date(inv.recordDate.getTime() + 86400000),
      amount: inv.amount, currency: "INR", counterpartyName: "Globex Corporation",
      reference: "INV-HERO2", description: "Payment",
      groundTruthDecision: "MATCH", groundTruthMatchId: inv.id,
      groundTruthRootCause: "ENTITY_AMBIGUITY", discrepancyClass: "CLASS_B_ENTITY_VAR",
      isHeroScenario: true, heroLabel: "Hero 2: Fuzzy Entity",
    });
  }

  // HERO 3: Partial Payment — 3 instalments cover one invoice
  {
    const inv = makeInvoice(rng, {
      externalId: "INV-HERO3", amount: 10000000, counterpartyName: "Stark Industries",
      discrepancyClass: "CLASS_E_PARTIAL", isHeroScenario: true, heroLabel: "Hero 3: Partial Payment",
    });
    records.push(inv);
    for (const [suffix, amt, daysOffset, desc] of [
      ["-1", 4000000, 2, "Partial Payment 1/3"],
      ["-2", 3500000, 15, "Partial Payment 2/3"],
      ["-3", 2500000, 28, "Partial Payment 3/3"],
    ] as [string, number, number, string][]) {
      records.push({
        id: rng.uuid(), sourceType: "PAYMENT", externalId: "PAY-HERO3" + suffix,
        recordDate: new Date(inv.recordDate.getTime() + 86400000 * daysOffset),
        amount: amt, currency: "INR", counterpartyName: "Stark Industries",
        reference: "INV-HERO3", description: desc,
        groundTruthDecision: "MATCH", groundTruthMatchId: inv.id,
        groundTruthRootCause: "PARTIAL_PAYMENT", discrepancyClass: "CLASS_E_PARTIAL",
        isHeroScenario: true, heroLabel: "Hero 3: Partial Payment",
      });
    }
  }

  // HERO 4: Contradiction — amount matches Inv A, reference points to Inv B
  {
    const invA = makeInvoice(rng, {
      externalId: "INV-HERO4A", amount: 5000000, counterpartyName: "Wayne Enterprises",
      discrepancyClass: "CLASS_J_CONTRADICTION", isHeroScenario: true,
      heroLabel: "Hero 4: Contradiction (Candidate A)",
    });
    const invB = makeInvoice(rng, {
      externalId: "INV-HERO4B", amount: 3800000, counterpartyName: "Wayne Enterprises",
      discrepancyClass: "CLASS_J_CONTRADICTION", isHeroScenario: true,
      heroLabel: "Hero 4: Contradiction (Candidate B)",
    });
    records.push(invA, invB, {
      id: rng.uuid(), sourceType: "PAYMENT", externalId: "PAY-HERO4",
      recordDate: new Date(invA.recordDate.getTime() + 86400000 * 3),
      amount: invA.amount, currency: "INR", counterpartyName: "Wayne Enterprises",
      reference: "INV-HERO4B", description: "Payment per remittance INV-HERO4B",
      groundTruthDecision: "UNRESOLVED", groundTruthMatchId: null,
      groundTruthRootCause: "REFERENCE_CONFLICT", discrepancyClass: "CLASS_J_CONTRADICTION",
      isHeroScenario: true, heroLabel: "Hero 4: Contradiction",
    });
  }

  // HERO 5: Ambiguous — two identical invoices, no reference to distinguish
  {
    const invA = makeInvoice(rng, {
      externalId: "INV-HERO5A", amount: 5000000, counterpartyName: "Umbrella Corp",
      reference: null, discrepancyClass: "CLASS_K_AMBIGUOUS", isHeroScenario: true,
      heroLabel: "Hero 5: Ambiguous (Candidate A)",
    });
    const invB = makeInvoice(rng, {
      externalId: "INV-HERO5B", amount: 5000000, counterpartyName: "Umbrella Corp",
      reference: null, discrepancyClass: "CLASS_K_AMBIGUOUS", isHeroScenario: true,
      heroLabel: "Hero 5: Ambiguous (Candidate B)",
    });
    records.push(invA, invB, {
      id: rng.uuid(), sourceType: "PAYMENT", externalId: "PAY-HERO5",
      recordDate: new Date(invA.recordDate.getTime() + 86400000 * 2),
      amount: 5000000, currency: "INR", counterpartyName: "Umbrella Corp",
      reference: null, description: "Payment — Umbrella Corp",
      groundTruthDecision: "UNRESOLVED", groundTruthMatchId: null,
      groundTruthRootCause: "ENTITY_AMBIGUITY", discrepancyClass: "CLASS_K_AMBIGUOUS",
      isHeroScenario: true, heroLabel: "Hero 5: Ambiguous",
    });
  }

  // HERO 6: Adversarial — ₹10K payment references ₹1,00,000 invoice (10× gap)
  // Entity + reference both match; financial invariant MUST block auto-reconcile
  {
    const inv = makeInvoice(rng, {
      externalId: "INV-HERO6", amount: 10000000, counterpartyName: "Massive Dynamic",
      discrepancyClass: "CLASS_L_UNRESOLVED", isHeroScenario: true,
      heroLabel: "Hero 6: Adversarial — Policy Block",
    });
    records.push(inv, {
      id: rng.uuid(), sourceType: "PAYMENT", externalId: "PAY-HERO6",
      recordDate: new Date(inv.recordDate.getTime() + 86400000),
      amount: 1000000, currency: "INR", counterpartyName: "Massive Dynamic",
      reference: "INV-HERO6", description: "Payment for INV-HERO6",
      groundTruthDecision: "UNRESOLVED", groundTruthMatchId: null,
      groundTruthRootCause: "AMOUNT_VARIANCE", discrepancyClass: "CLASS_L_UNRESOLVED",
      isHeroScenario: true, heroLabel: "Hero 6: Adversarial — Policy Block",
    });
  }

  return records;
}

const CLASS_WEIGHTS: [string, number][] = [
  ["CLASS_A_EXACT", 0.30],
  ["CLASS_B_ENTITY_VAR", 0.22],
  ["CLASS_C_DATE_DRIFT", 0.08],
  ["CLASS_D_REF_VAR", 0.08],
  ["CLASS_E_PARTIAL", 0.07],
  ["CLASS_F_SPLIT", 0.05],
  ["CLASS_G_DUPLICATE", 0.05],
  ["CLASS_H_REFUND", 0.04],
  ["CLASS_I_FEE_VARIANCE", 0.04],
  ["CLASS_J_CONTRADICTION", 0.04],
  ["CLASS_K_AMBIGUOUS", 0.02],
  ["CLASS_L_UNRESOLVED", 0.01],
];

function pickClass(rng: SeededRandom): string {
  const r = rng.next();
  let cumulative = 0;
  for (const [cls, weight] of CLASS_WEIGHTS) {
    cumulative += weight;
    if (r < cumulative) return cls;
  }
  return "CLASS_A_EXACT";
}

function generateBulkRecords(rng: SeededRandom, targetCount: number): SyntheticRecord[] {
  const records: SyntheticRecord[] = [];

  while (records.length < targetCount) {
    const cls = pickClass(rng);
    const amount = rng.nextInt(1000, 90000) * 100;
    const company = rng.nextItem(BASE_COMPANIES);
    const invoiceId = `INV-${rng.nextInt(1000, 9999)}`;
    const payId = `PAY-${rng.nextInt(10000, 99999)}`;
    const baseDate = rng.nextDate(new Date("2024-01-01"), new Date("2024-06-01"));

    const inv = makeInvoice(rng, { externalId: invoiceId, amount, counterpartyName: company, recordDate: baseDate, discrepancyClass: cls });

    if (cls === "CLASS_A_EXACT") {
      records.push(inv, {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 2),
        amount, currency: "INR", counterpartyName: company, reference: invoiceId,
        description: "Payment for invoice", groundTruthDecision: "MATCH",
        groundTruthMatchId: inv.id, groundTruthRootCause: "NONE", discrepancyClass: cls,
      });

    } else if (cls === "CLASS_B_ENTITY_VAR") {
      const aliasName = ENTITY_ALIAS_MAP[company] || company + " Ltd";
      records.push(inv, {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000),
        amount, currency: "INR", counterpartyName: aliasName, reference: invoiceId,
        description: "Payment", groundTruthDecision: "MATCH",
        groundTruthMatchId: inv.id, groundTruthRootCause: "ENTITY_AMBIGUITY", discrepancyClass: cls,
      });

    } else if (cls === "CLASS_C_DATE_DRIFT") {
      records.push(inv, {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * rng.nextInt(31, 90)),
        amount, currency: "INR", counterpartyName: company, reference: invoiceId,
        description: "Payment", groundTruthDecision: "MATCH",
        groundTruthMatchId: inv.id, groundTruthRootCause: "TIMING_DIFFERENCE", discrepancyClass: cls,
      });

    } else if (cls === "CLASS_D_REF_VAR") {
      const num = invoiceId.split("-")[1];
      const variants = [invoiceId.toLowerCase(), invoiceId.replace("-", ""), `Invoice ${num}`, `inv${num}`];
      records.push(inv, {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 5),
        amount, currency: "INR", counterpartyName: company, reference: rng.nextItem(variants),
        description: "Payment", groundTruthDecision: "MATCH",
        groundTruthMatchId: inv.id, groundTruthRootCause: "REFERENCE_CONFLICT", discrepancyClass: cls,
      });

    } else if (cls === "CLASS_E_PARTIAL") {
      const p1amt = Math.floor(amount * 0.6);
      records.push(inv,
        { id: rng.uuid(), sourceType: "PAYMENT", externalId: payId + "-1",
          recordDate: new Date(baseDate.getTime() + 86400000 * 2), amount: p1amt,
          currency: "INR", counterpartyName: company, reference: invoiceId,
          description: "Partial Payment 1/2", groundTruthDecision: "MATCH",
          groundTruthMatchId: inv.id, groundTruthRootCause: "PARTIAL_PAYMENT", discrepancyClass: cls },
        { id: rng.uuid(), sourceType: "PAYMENT", externalId: payId + "-2",
          recordDate: new Date(baseDate.getTime() + 86400000 * 18), amount: amount - p1amt,
          currency: "INR", counterpartyName: company, reference: invoiceId,
          description: "Partial Payment 2/2", groundTruthDecision: "MATCH",
          groundTruthMatchId: inv.id, groundTruthRootCause: "PARTIAL_PAYMENT", discrepancyClass: cls }
      );

    } else if (cls === "CLASS_F_SPLIT") {
      const invB = makeInvoice(rng, {
        externalId: `INV-${rng.nextInt(1000, 9999)}-B`, amount: Math.floor(amount * 0.4),
        counterpartyName: company, recordDate: baseDate, discrepancyClass: cls,
      });
      inv.amount = amount - invB.amount;
      records.push(inv, invB, {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 3),
        amount, currency: "INR", counterpartyName: company, reference: invoiceId,
        description: "Split payment covering two invoices", groundTruthDecision: "MATCH",
        groundTruthMatchId: inv.id, groundTruthRootCause: "PARTIAL_PAYMENT", discrepancyClass: cls,
      });

    } else if (cls === "CLASS_G_DUPLICATE") {
      records.push(inv,
        { id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
          recordDate: new Date(baseDate.getTime() + 86400000), amount,
          currency: "INR", counterpartyName: company, reference: invoiceId,
          description: "Payment", groundTruthDecision: "MATCH",
          groundTruthMatchId: inv.id, groundTruthRootCause: "DUPLICATE", discrepancyClass: cls },
        { id: rng.uuid(), sourceType: "PAYMENT", externalId: payId + "-DUP",
          recordDate: new Date(baseDate.getTime() + 86400000), amount,
          currency: "INR", counterpartyName: company, reference: invoiceId,
          description: "Payment (duplicate posting)", groundTruthDecision: "UNRESOLVED",
          groundTruthMatchId: null, groundTruthRootCause: "DUPLICATE", discrepancyClass: cls }
      );

    } else if (cls === "CLASS_H_REFUND") {
      const payRec: SyntheticRecord = {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000), amount,
        currency: "INR", counterpartyName: company, reference: invoiceId,
        description: "Payment", groundTruthDecision: "MATCH",
        groundTruthMatchId: inv.id, groundTruthRootCause: "NONE", discrepancyClass: cls,
      };
      records.push(inv, payRec, {
        id: rng.uuid(), sourceType: "REFUND", externalId: `REF-${rng.nextInt(10000, 99999)}`,
        recordDate: new Date(baseDate.getTime() + 86400000 * 7),
        amount: Math.floor(amount * 0.25), currency: "INR", counterpartyName: company,
        reference: invoiceId, description: `Partial refund for ${payId}`,
        groundTruthDecision: "UNRESOLVED", groundTruthMatchId: null,
        groundTruthRootCause: "REFUND", discrepancyClass: cls,
      });

    } else if (cls === "CLASS_I_FEE_VARIANCE") {
      const payRec: SyntheticRecord = {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000), amount,
        currency: "INR", counterpartyName: company, reference: invoiceId,
        description: "Payment", groundTruthDecision: "MATCH",
        groundTruthMatchId: inv.id, groundTruthRootCause: "NONE", discrepancyClass: cls,
      };
      records.push(inv, payRec, {
        id: rng.uuid(), sourceType: "SETTLEMENT", externalId: `SETL-${rng.nextInt(10000, 99999)}`,
        recordDate: new Date(baseDate.getTime() + 86400000 * 3),
        amount: Math.floor(amount * 0.98), currency: "INR",
        counterpartyName: company, reference: payId,
        description: "Settlement after 2% processing fee",
        groundTruthDecision: "MATCH", groundTruthMatchId: payRec.id,
        groundTruthRootCause: "AMOUNT_VARIANCE", discrepancyClass: cls,
      });

    } else if (cls === "CLASS_J_CONTRADICTION") {
      const invB = makeInvoice(rng, {
        externalId: `INV-${rng.nextInt(1000, 9999)}-B`,
        amount: Math.floor(amount * 1.3), counterpartyName: company,
        recordDate: baseDate, discrepancyClass: cls,
      });
      records.push(inv, invB, {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 2),
        amount, currency: "INR", counterpartyName: company,
        reference: invB.externalId, description: `Payment — see ${invB.externalId}`,
        groundTruthDecision: "UNRESOLVED", groundTruthMatchId: null,
        groundTruthRootCause: "REFERENCE_CONFLICT", discrepancyClass: cls,
      });

    } else if (cls === "CLASS_K_AMBIGUOUS") {
      const invB = makeInvoice(rng, {
        externalId: `INV-${rng.nextInt(1000, 9999)}-B`, amount,
        counterpartyName: company, recordDate: baseDate, discrepancyClass: cls,
      });
      records.push(inv, invB, {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 2),
        amount, currency: "INR", counterpartyName: company,
        reference: null, description: "Payment",
        groundTruthDecision: "UNRESOLVED", groundTruthMatchId: null,
        groundTruthRootCause: "ENTITY_AMBIGUITY", discrepancyClass: cls,
      });

    } else {
      // CLASS_L_UNRESOLVED — genuinely insufficient evidence
      records.push(inv, {
        id: rng.uuid(), sourceType: "PAYMENT", externalId: payId,
        recordDate: new Date(baseDate.getTime() + 86400000 * 2),
        amount: amount + rng.nextInt(1000, 50000) * 100,
        currency: "INR", counterpartyName: "Unknown Entity",
        reference: `MISC-${rng.nextInt(100, 999)}`,
        description: "Payment — insufficient details",
        groundTruthDecision: "UNRESOLVED", groundTruthMatchId: null,
        groundTruthRootCause: "UNKNOWN", discrepancyClass: cls,
      });
    }
  }

  return records;
}

/**
 * Generate a fully deterministic synthetic dataset.
 * Hero scenarios come first (easy to find in demos).
 * Bulk records fill remaining slots across all 12 discrepancy classes.
 */
export function generateSyntheticData(seed: number = 4217, count: number = 250): SyntheticRecord[] {
  const rng = new SeededRandom(seed);
  const heroRecords = generateHeroScenarios(rng);
  const bulkRecords = generateBulkRecords(rng, Math.max(0, count - heroRecords.length));
  return [...heroRecords, ...bulkRecords].slice(0, count);
}
