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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Investigation
              </CardTitle>
              <CardDescription>Let the Controller agent analyze this ambiguity.</CardDescription>
            </CardHeader>
            <CardContent>
              {!aiDecision ? (
                <Button onClick={handleInvestigate} disabled={investigating}>
                  {investigating ? "Agent is investigating..." : "Trigger AI Investigation"}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4 items-center">
                    <Badge variant={
                      aiDecision.recommendedAction === "AUTO_RECONCILED" ? "default" :
                      aiDecision.recommendedAction === "REVIEW_REQUIRED" ? "secondary" : "destructive"
                    }>
                      {aiDecision.recommendedAction}
                    </Badge>
                    <span className="text-sm text-zinc-500">
                      Confidence: {(aiDecision.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="text-sm text-zinc-500">
                      Root Cause: {aiDecision.rootCause}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Evidence Found</h4>
                    <ul className="text-sm space-y-1">
                      {aiDecision.evidence.map((e: string, i: number) => (
                        <li key={i} className="flex gap-2 items-start text-green-700">
                          <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {aiDecision.contradictions?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Contradictions</h4>
                      <ul className="text-sm space-y-1">
                        {aiDecision.contradictions.map((e: string, i: number) => (
                          <li key={i} className="flex gap-2 items-start text-red-700">
                            <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {aiDecision.additionalInformationRequired?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Additional Info Required</h4>
                      <ul className="text-sm space-y-1">
                        {aiDecision.additionalInformationRequired.map((e: string, i: number) => (
                          <li key={i} className="flex gap-2 items-start text-orange-700">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            {aiDecision && exception.status === "OPEN" && (
               <CardFooter className="flex gap-3 justify-end border-t pt-4">
                  <Button variant="outline">Mark Unresolved</Button>
                  <Button variant="default">Approve Match</Button>
               </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
