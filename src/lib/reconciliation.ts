import type { SourceRecord } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { processNormalization } from "./normalization";

export async function runDeterministicReconciliation(runId: string) {
  const run = await prisma.reconciliationRun.findUnique({
    where: { id: runId },
    select: { merchantId: true }
  });
  
  // 1. Fetch pending records
  const records = await prisma.sourceRecord.findMany({
    where: { runId, status: "PENDING" }
  });

  // 2. Normalize and save to DB
  const normalizedRecordsData = await processNormalization(records, run?.merchantId);
  for (const norm of normalizedRecordsData) {
    await prisma.normalizedRecord.upsert({
      where: { sourceRecordId: norm.sourceRecordId },
      update: norm,
      create: norm
    });
  }

  // 3. Generate Candidates (For this prototype, we map payments to invoices)
  const invoices = records.filter(r => r.sourceType === "INVOICE");
  const payments = records.filter(r => r.sourceType === "PAYMENT");

  for (const payment of payments) {
    const payNorm = normalizedRecordsData.find(n => n.sourceRecordId === payment.id)!;
    
    let candidates = invoices.map(inv => {
      const invNorm = normalizedRecordsData.find(n => n.sourceRecordId === inv.id)!;
      
      let amountScore = 0;
      if (payNorm.amountMinor === invNorm.amountMinor) amountScore = 1;
      else if (payNorm.amountMinor < invNorm.amountMinor) amountScore = 0.6; // partial possible
      else amountScore = 0; // overpayment or mismatch

      let dateScore = 0;
      if (payNorm.normalizedDate && invNorm.normalizedDate) {
        const diffDays = (payNorm.normalizedDate.getTime() - invNorm.normalizedDate.getTime()) / 86400000;
        if (diffDays >= 0 && diffDays <= 30) dateScore = 1;
        else if (diffDays > 30 && diffDays <= 90) dateScore = 0.7;
        else dateScore = 0;
      }

      let referenceScore = 0;
      // If the payment's normalized reference matches the invoice's ID or reference
      if (payNorm.normalizedReference && invNorm.normalizedExternalId && 
         (payNorm.normalizedReference === invNorm.normalizedExternalId || invNorm.normalizedExternalId.includes(payNorm.normalizedReference))) {
        referenceScore = 1;
      }

      let entityScore = 0;
      if (payNorm.normalizedCounterparty === invNorm.normalizedCounterparty) {
        entityScore = 1;
      }

      const overallScore = (amountScore * 0.4) + (referenceScore * 0.3) + (entityScore * 0.2) + (dateScore * 0.1);
      
      let contradictionScore = 0;
      if (referenceScore === 0 && payNorm.normalizedReference && payNorm.normalizedReference.length > 3) {
         // Has a specific reference but it doesn't match this invoice
         contradictionScore += 0.5; 
      }
      if (amountScore === 0) contradictionScore += 0.3;

      return {
        candidateRecordId: inv.id,
        amountScore,
        dateScore,
        referenceScore,
        entityScore,
        semanticScore: 0,
        contradictionScore,
        overallScore
      };
    });

    // 4. Filter plausible candidates (score > 0.4)
    candidates = candidates.filter(c => c.overallScore > 0.4).sort((a, b) => b.overallScore - a.overallScore);

    // 5. Save candidates
    let rank = 1;
    for (const c of candidates) {
      await prisma.matchCandidate.create({
        data: {
          runId,
          sourceRecordId: payment.id,
          candidateRecordId: c.candidateRecordId,
          amountScore: c.amountScore,
          dateScore: c.dateScore,
          referenceScore: c.referenceScore,
          entityScore: c.entityScore,
          semanticScore: c.semanticScore,
          contradictionScore: c.contradictionScore,
          overallScore: c.overallScore,
          rank: rank++
        }
      });
    }
  }

  return true;
}
