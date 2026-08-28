import { SourceRecord } from "@prisma/client";

export function normalizeEntityName(name: string | null): string | null {
  if (!name) return null;
  // Convert to lowercase
  let normalized = name.toLowerCase();
  // Remove common corporate suffixes
  const suffixes = [" pvt ltd", " pvt. ltd.", " pvt", " ltd", " inc", " corp", " llc", " inc.", " corp.", " llc."];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
    }
  }
  // Remove all non-alphanumeric characters except spaces
  normalized = normalized.replace(/[^a-z0-9 ]/g, "");
  // Replace multiple spaces with a single space and trim
  return normalized.replace(/\s+/g, " ").trim();
}

export function normalizeReference(reference: string | null): string | null {
  if (!reference) return null;
  // Common reference prefixes
  let normalized = reference.toLowerCase();
  const prefixes = ["inv-", "inv ", "invoice ", "ref-", "ref ", "payment for "];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
    }
  }
  // Remove all non-alphanumeric chars (so INV-004821 and inv4821 become 004821 and 4821)
  // Wait, 004821 and 4821 are different if we just remove non-alphanumerics. 
  // Let's remove leading zeros as well.
  normalized = normalized.replace(/[^a-z0-9]/g, "");
  normalized = normalized.replace(/^0+/, "");
  return normalized.trim();
}

export function normalizeDate(date: Date): Date {
  // Strip time component for date-level normalization
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function processNormalization(records: SourceRecord[]) {
  // In a real system, we'd use Prisma to update the DB here.
  // For the deterministic engine, we can just return normalized objects.
  return records.map(record => ({
    sourceRecordId: record.id,
    normalizedExternalId: normalizeReference(record.externalId),
    normalizedCounterparty: normalizeEntityName(record.counterpartyName),
    normalizedReference: normalizeReference(record.reference),
    normalizedDate: normalizeDate(record.recordDate),
    amountMinor: record.amount,
    currency: record.currency,
  }));
}
