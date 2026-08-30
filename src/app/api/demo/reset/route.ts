import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    // Note: In a real app this would be highly authenticated or not exist.
    // This is purely for the hackathon demo.
    
    // Delete in reverse dependency order
    await prisma.auditEvent.deleteMany({});
    await prisma.evaluationCase.deleteMany({});
    await prisma.reconciliationDecision.deleteMany({});
    await prisma.matchCandidate.deleteMany({});
    await prisma.agentRun.deleteMany({});
    await prisma.exception.deleteMany({});
    await prisma.normalizedRecord.deleteMany({});
    await prisma.sourceRecord.deleteMany({});
    await prisma.entityAlias.deleteMany({});
    await prisma.reconciliationRun.deleteMany({});
    await prisma.reconciliationRule.deleteMany({});
    await prisma.merchant.deleteMany({});

    return NextResponse.json({ success: true, message: "Database wiped clean for demo" });
  } catch (error) {
    console.error("Failed to reset database", error);
    return NextResponse.json({ error: "Failed to reset database" }, { status: 500 });
  }
}
