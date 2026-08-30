import { NextResponse } from "next/server";
import { investigateException } from "@/lib/ai-controller";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const decision = await investigateException(id);
    if (!decision) {
      return NextResponse.json({ error: "AI Investigation failed or disabled" }, { status: 500 });
    }
    return NextResponse.json({ success: true, decision });
  } catch (error) {
    return NextResponse.json({ error: "Failed to run AI investigation" }, { status: 500 });
  }
}
