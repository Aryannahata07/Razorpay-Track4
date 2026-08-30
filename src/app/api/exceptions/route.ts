import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  try {
    const whereClause = runId ? { runId } : {};
    const exceptions = await prisma.exception.findMany({
      where: whereClause,
      include: {
        sourceRecord: true
      },
      orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json({ exceptions });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch exceptions" }, { status: 500 });
  }
}
