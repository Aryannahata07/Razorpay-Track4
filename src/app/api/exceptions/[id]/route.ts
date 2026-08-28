import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const exception = await prisma.exception.findUnique({
      where: { id: params.id },
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
