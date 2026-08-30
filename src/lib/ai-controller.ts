import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AgentDecisionSchema, AgentDecision } from "./schema";
import { prisma } from "@/lib/prisma";

export function getAIModel() {
  const provider = process.env.LLM_PROVIDER || "groq";
  
  if (provider === "gemini") {
    if (!process.env.LLM_API_KEY) return null;
    const google = createGoogleGenerativeAI({
      apiKey: process.env.LLM_API_KEY
    });
    return google(process.env.LLM_MODEL || "gemini-1.5-pro");
  }

  // Default to groq (using openai compatible endpoint)
  if (!process.env.LLM_API_KEY) return null;
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.LLM_API_KEY
  });
  return groq(process.env.LLM_MODEL || "llama3-8b-8192");
}

export async function investigateException(exceptionId: string): Promise<AgentDecision | null> {
  const model = getAIModel();
  if (!model) {
    // Graceful fallback if no AI configured
    return null;
  }

  const exception = await prisma.exception.findUnique({
    where: { id: exceptionId },
    include: {
      sourceRecord: {
        include: {
          candidatesSource: {
            include: { candidateRecord: true }
          }
        }
      }
    }
  });

  if (!exception) return null;

  const agentRun = await prisma.agentRun.create({
    data: {
      exceptionId,
      provider: process.env.LLM_PROVIDER || "groq",
      model: process.env.LLM_MODEL || "unknown",
      status: "RUNNING"
    }
  });

  try {
    const prompt = `
      You are the AI Finance Controller investigating a reconciliation exception.
      
      Exception Details:
      Severity: ${exception.severity}
      Category: ${exception.category}
      Description: ${exception.description}

      Source Record (The Payment/Transaction): 
      ${JSON.stringify({
        id: exception.sourceRecord.id,
        amount: exception.sourceRecord.amount,
        reference: exception.sourceRecord.reference,
        counterparty: exception.sourceRecord.counterpartyName,
        date: exception.sourceRecord.recordDate
      }, null, 2)}
      
      Top Candidates (Potential matches): 
      ${JSON.stringify(exception.sourceRecord.candidatesSource.map(c => ({
        candidateId: c.candidateRecordId,
        amount: c.candidateRecord.amount,
        reference: c.candidateRecord.reference,
        counterparty: c.candidateRecord.counterpartyName,
        date: c.candidateRecord.recordDate,
        scores: {
           amount: c.amountScore,
           reference: c.referenceScore,
           entity: c.entityScore,
           overall: c.overallScore,
           contradiction: c.contradictionScore
        }
      })), null, 2)}
      
      Review the evidence and provide a structured decision.
      Never invent facts. Use only provided evidence.
      Determine if this should be AUTO_RECONCILED (only if evidence is overwhelming and no contradictions exist),
      REVIEW_REQUIRED (if it's a likely match but needs human confirmation due to ambiguity),
      or UNRESOLVED (if evidence is weak).

      If the discrepancy is due to ENTITY_AMBIGUITY (e.g. "Razorpay Software Pvt Ltd" vs "RZP"), 
      and you believe they are the same entity, you MUST provide a \`suggestedAlias\` mapping 
      the \`sourceName\` (raw name) to the \`normalizedName\` (the canonical name).
    `;

    const { object } = await generateObject({
      model,
      schema: AgentDecisionSchema,
      prompt,
    });

    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        toolCalls: JSON.stringify(object)
      }
    });

    return object;
  } catch (error) {
    console.error("AI Investigation failed", error);
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "FAILED",
        completedAt: new Date()
      }
    });
    return null; // Graceful fallback
  }
}
