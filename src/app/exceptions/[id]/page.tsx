"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Bot, Check, X, AlertTriangle } from "lucide-react";

export default function ExceptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [exception, setException] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [investigating, setInvestigating] = useState(false);
  const [aiDecision, setAiDecision] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/exceptions/${params.id}`)
      .then(res => res.json())
      .then(data => {
        setException(data.exception);
        setLoading(false);
      });
  }, [params.id]);

  const handleInvestigate = async () => {
    setInvestigating(true);
    try {
      const res = await fetch(`/api/exceptions/${params.id}/investigate`, { method: "POST" });
      const data = await res.json();
      if (data.decision) {
        setAiDecision(data.decision);
      } else {
        alert("AI Investigation failed. Check provider config.");
      }
    } catch (e) {
      alert("Error triggering investigation.");
    }
    setInvestigating(false);
  };

  const handleApproveMatch = async () => {
    try {
      const res = await fetch(`/api/exceptions/${params.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution: "APPROVED_MATCH",
          suggestedAlias: aiDecision?.suggestedAlias || null
        })
      });
      if (res.ok) {
        alert("Match approved and exception resolved!");
        router.push("/exceptions");
      } else {
        alert("Failed to resolve exception");
      }
    } catch (e) {
      alert("Error resolving exception");
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!exception) return <div>Exception not found.</div>;

  const sourceRec = exception.sourceRecord;
  const candidates = sourceRec.candidatesSource || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exception Investigation</h1>
          <p className="text-zinc-500">ID: {exception.id}</p>
        </div>
        <Badge variant={exception.status === "OPEN" ? "destructive" : "secondary"} className="ml-auto">
          {exception.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Source Record</CardTitle>
              <CardDescription>{sourceRec.sourceType}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-zinc-500">Amount</div>
                <div className="text-2xl font-bold">₹{(sourceRec.amount / 100).toFixed(2)}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-500">Reference</div>
                  <div className="font-medium">{sourceRec.externalId}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-500">Date</div>
                  <div className="font-medium">{new Date(sourceRec.recordDate).toLocaleDateString()}</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-500">Counterparty</div>
                <div className="font-medium">{sourceRec.counterpartyName || "N/A"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exception Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-zinc-500">Category</div>
                <div className="font-medium">{exception.category}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-500">Description</div>
                <div className="font-medium">{exception.description}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Candidates Evaluated</CardTitle>
              <CardDescription>Records identified by the deterministic engine</CardDescription>
            </CardHeader>
            <CardContent>
              {candidates.length === 0 ? (
                <div className="text-sm text-zinc-500">No candidates found.</div>
              ) : (
                <div className="space-y-4">
                  {candidates.map((c: any, i: number) => (
                    <div key={c.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-lg">Candidate {i + 1}: {c.candidateRecord?.externalId}</div>
                          <div className="text-sm text-zinc-500">{c.candidateRecord?.counterpartyName}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">₹{(c.candidateRecord?.amount / 100).toFixed(2)}</div>
                          <div className="text-sm text-zinc-500">{new Date(c.candidateRecord?.recordDate).toLocaleDateString()}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 text-sm">
                        <div className="bg-zinc-100 p-2 rounded">
                          <span className="block text-zinc-500 text-xs uppercase">Overall Match</span>
                          <span className="font-medium">{(c.overallScore * 100).toFixed(0)}%</span>
                        </div>
                        <div className="bg-zinc-100 p-2 rounded">
                          <span className="block text-zinc-500 text-xs uppercase">Amount</span>
                          <span className="font-medium">{(c.amountScore * 100).toFixed(0)}%</span>
                        </div>
                        <div className="bg-zinc-100 p-2 rounded">
                          <span className="block text-zinc-500 text-xs uppercase">Reference</span>
                          <span className="font-medium">{(c.referenceScore * 100).toFixed(0)}%</span>
                        </div>
                        <div className={`p-2 rounded ${c.contradictionScore > 0 ? "bg-red-50 text-red-800" : "bg-zinc-100"}`}>
                          <span className="block text-xs uppercase opacity-70">Contradictions</span>
                          <span className="font-medium">{(c.contradictionScore * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg shadow-blue-900/5 ring-1 ring-zinc-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#02042B] to-[#0a0f44] px-6 py-5 border-b border-blue-900/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 bg-blue-500 rounded-full blur-3xl opacity-10 -mr-10 -mt-10" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 text-white tracking-tight">
                    <Bot className="h-6 w-6 text-[#3395FF]" />
                    AI Investigation
                  </h3>
                  <p className="text-sm text-blue-200/80 mt-1">Controller agent analysis and rule resolution</p>
                </div>
              </div>
            </div>
            <CardContent className="pt-6">
              {!aiDecision ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="mb-4 text-center max-w-sm text-zinc-500 text-sm">
                    The deterministic engine found ambiguity. Trigger the AI agent to deeply analyze the evidence, contradictions, and suggest rules.
                  </div>
                  <Button 
                    onClick={handleInvestigate} 
                    disabled={investigating}
                    className="bg-[#3395FF] hover:bg-[#2b80e0] text-white shadow-lg shadow-[#3395FF]/20 transition-all hover:scale-105"
                  >
                    {investigating ? (
                      <span className="flex items-center gap-2 animate-pulse">
                        <Bot className="h-4 w-4 animate-bounce" /> Analyzing Evidence...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Bot className="h-4 w-4" /> Trigger AI Investigation
                      </span>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Top Stats Row */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-50 border rounded-xl">
                    <div className="flex items-center gap-3">
                      <Badge className={
                        aiDecision.recommendedAction === "AUTO_RECONCILED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                        aiDecision.recommendedAction === "REVIEW_REQUIRED" ? "bg-orange-100 text-orange-800 border-orange-200" : "bg-red-100 text-red-800 border-red-200"
                      } variant="outline">
                        {aiDecision.recommendedAction.replace("_", " ")}
                      </Badge>
                      <span className="text-sm font-medium text-zinc-600 bg-zinc-200/50 px-2 py-1 rounded-md">
                        {aiDecision.rootCause}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <span className="text-sm font-semibold text-zinc-700">Confidence</span>
                      <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${aiDecision.confidence > 0.8 ? 'bg-emerald-500' : aiDecision.confidence > 0.5 ? 'bg-orange-500' : 'bg-red-500'}`}
                          style={{ width: `${aiDecision.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-zinc-900">{(aiDecision.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Evidence Box */}
                    <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-3">
                      <h4 className="font-semibold text-sm text-emerald-900 flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600" /> Evidence Found
                      </h4>
                      <ul className="text-sm space-y-2">
                        {aiDecision.evidence.map((e: string, i: number) => (
                          <li key={i} className="flex gap-2 items-start text-emerald-800 leading-relaxed">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Contradictions / Info Box */}
                    <div className="space-y-4">
                      {aiDecision.contradictions?.length > 0 && (
                        <div className="p-5 bg-red-50/50 border border-red-100 rounded-xl space-y-3 h-full">
                          <h4 className="font-semibold text-sm text-red-900 flex items-center gap-2">
                            <X className="h-4 w-4 text-red-600" /> Contradictions
                          </h4>
                          <ul className="text-sm space-y-2">
                            {aiDecision.contradictions.map((e: string, i: number) => (
                              <li key={i} className="flex gap-2 items-start text-red-800 leading-relaxed">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                                <span>{e}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {aiDecision.additionalInformationRequired?.length > 0 && (
                        <div className="p-5 bg-orange-50/50 border border-orange-100 rounded-xl space-y-3">
                          <h4 className="font-semibold text-sm text-orange-900 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600" /> Additional Info Required
                          </h4>
                          <ul className="text-sm space-y-2">
                            {aiDecision.additionalInformationRequired.map((e: string, i: number) => (
                              <li key={i} className="flex gap-2 items-start text-orange-800 leading-relaxed">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                                <span>{e}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Rule Suggestion Box */}
                  {aiDecision.suggestedAlias && (
                    <div className="mt-6 p-6 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 bg-blue-100 rounded-full blur-3xl opacity-50 -mr-10 -mt-10" />
                      
                      <h4 className="font-semibold text-lg flex items-center gap-2 text-[#02042B] relative z-10">
                        <Bot className="h-5 w-5 text-[#3395FF]" /> AI Rule Suggestion
                      </h4>
                      <p className="text-sm text-zinc-600 mt-2 relative z-10">
                        The Controller Agent has identified a recurring pattern and suggests adding the following alias to the Deterministic Engine's memory:
                      </p>
                      
                      <div className="flex flex-col sm:flex-row items-center gap-4 mt-5 relative z-10">
                        <div className="flex-1 w-full bg-white border border-zinc-200 p-3 rounded-lg shadow-sm text-center">
                          <div className="text-xs text-zinc-500 font-medium uppercase mb-1">Incoming Name</div>
                          <div className="font-mono text-red-600 text-sm font-semibold truncate" title={aiDecision.suggestedAlias.sourceName}>"{aiDecision.suggestedAlias.sourceName}"</div>
                        </div>
                        
                        <div className="text-zinc-400 hidden sm:block">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </div>
                        
                        <div className="flex-1 w-full bg-white border border-blue-200 p-3 rounded-lg shadow-sm text-center ring-2 ring-blue-500/20">
                          <div className="text-xs text-blue-600 font-medium uppercase mb-1">Target Entity</div>
                          <div className="font-mono text-emerald-600 text-sm font-semibold truncate" title={aiDecision.suggestedAlias.normalizedName}>"{aiDecision.suggestedAlias.normalizedName}"</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            {aiDecision && exception.status === "OPEN" && (
               <CardFooter className="flex flex-col gap-4 border-t pt-6 bg-zinc-50 rounded-b-lg">
                  {aiDecision.suggestedAlias ? (
                    <div className="w-full text-sm text-blue-700 bg-blue-50 border border-blue-200 p-3 rounded-lg shadow-sm">
                      <strong className="flex items-center gap-1 mb-1"><Bot className="w-4 h-4" /> Demo Tip: What happens next?</strong>
                      By clicking <strong>Approve Match & Save Rule</strong>, you aren't just resolving this one exception. You are permanently teaching the Deterministic Engine that <em>"{aiDecision.suggestedAlias.sourceName}"</em> means <em>"{aiDecision.suggestedAlias.normalizedName}"</em>. The next time you click "Run Reconciliation", this will be auto-reconciled instantly!
                    </div>
                  ) : (
                    <div className="w-full text-sm text-zinc-600 bg-white border p-3 rounded-lg">
                      <strong>Note:</strong> The AI determined this was a one-off mismatch (not an entity alias), so no rule is suggested. You are just approving this single match.
                    </div>
                  )}
                  <div className="flex gap-3 justify-end w-full">
                    <Button variant="outline">Keep Unresolved</Button>
                    <Button variant="default" onClick={handleApproveMatch} className="bg-[#3395FF] hover:bg-[#2b80e0]">
                      {aiDecision.suggestedAlias ? "Approve Match & Save Rule to Memory" : "Approve Match Only"}
                    </Button>
                  </div>
               </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
