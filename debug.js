const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const run = await prisma.reconciliationRun.findFirst({
    orderBy: { startedAt: 'desc' },
  });

  if (!run) return console.log('no run');

  // Find an EXACT match that failed to auto-reconcile
  const cases = await prisma.evaluationCase.findMany({
    where: { runId: run.id },
    include: {
      sourceRecord: {
        include: {
          decisionsSource: true,
          candidatesSource: {
            orderBy: { overallScore: 'desc' },
            take: 2,
            include: { candidateRecord: true }
          }
        }
      }
    }
  });

  for (const ec of cases) {
    const rawPayload = JSON.parse(ec.sourceRecord.rawPayload || '{}');
    if (rawPayload.discrepancyClass === 'CLASS_A_EXACT') {
      const decision = ec.sourceRecord.decisionsSource[0];
      if (decision && decision.decision !== 'AUTO_RECONCILED') {
        console.log('Failed EXACT match:', ec.sourceRecord.id);
        console.log('Decision:', decision.decision, 'RootCause:', decision.rootCause);
        console.log('Top Candidate:', ec.sourceRecord.candidatesSource[0]);
        console.log('Second Candidate:', ec.sourceRecord.candidatesSource[1]);
        console.log('---');
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
