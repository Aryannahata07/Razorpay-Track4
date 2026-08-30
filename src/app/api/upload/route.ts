import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const merchantId = formData.get("merchantId") as string;
    
    if (!file || !merchantId) {
      return NextResponse.json({ error: "Missing file or merchantId" }, { status: 400 });
    }

    const text = await file.text();
    
    // Parse CSV (assuming standard headers: externalId, sourceType, recordDate, amount, currency, counterpartyName, reference)
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
    }

    // Generate a run ID for this upload
    const runId = "upload-" + Date.now();

    const dataToInsert = records.map((r: any) => ({
      runId,
      merchantId,
      sourceType: r.sourceType || "UNKNOWN",
      externalId: r.externalId,
      recordDate: new Date(r.recordDate || Date.now()),
      amount: parseInt(r.amount, 10), // Must be in minor units
      currency: r.currency || "INR",
      counterpartyName: r.counterpartyName || null,
      reference: r.reference || null,
      status: "PENDING"
    }));

    await prisma.sourceRecord.createMany({
      data: dataToInsert
    });

    return NextResponse.json({ success: true, count: dataToInsert.length, runId });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
