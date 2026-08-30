import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const exception = await prisma.exception.findUnique({
      where: { id },
      include: {
        sourceRecord: {
          include: {
            candidatesSource: {
              include: { candidateRecord: true },
              orderBy: { overallScore: "desc" }
            }
          }
        },
        agentRuns: {
          orderBy: { startedAt: "desc" },
          take: 1
        }
      }
    });
    
    if (!exception) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    return NextResponse.json({ exception });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch exception" }, { status: 500 });
  }
}
