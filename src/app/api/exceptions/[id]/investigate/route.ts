import { NextResponse } from "next/server";
import { investigateException } from "@/lib/ai-controller";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const decision = await investigateException(params.id);
    if (!decision) {
      return NextResponse.json({ error: "AI Investigation failed or disabled" }, { status: 500 });
    }
    return NextResponse.json({ success: true, decision });
  } catch (error) {
    return NextResponse.json({ error: "Failed to run AI investigation" }, { status: 500 });
  }
}
