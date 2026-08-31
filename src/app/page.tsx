"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Database, AlertCircle, CheckCircle, Clock, Zap, RefreshCw, Shield } from "lucide-react";

type DemoStep = { step: string; status: "pending" | "running" | "done" | "error"; detail?: string };

const STEP_LABELS: Record<string, string> = {
  reset: "Reset database",
  seed: "Generate 250 synthetic records",
  normalize: "Normalize & apply alias rules",
  reconcile: "Run deterministic matching engine",
  policy: "Apply policy gate + financial invariants",
  evaluate: "Calculate Precision / Recall / F1",
};

export default function Dashboard() {
  const [runData, setRunData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [steps, setSteps] = useState<DemoStep[]>([]);

  const fetchRun = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/run?t=${Date.now()}`);
      const data = await res.json();
      setRunData(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchRun(); }, []);

  const handleRunFullDemo = async () => {
    setDemoRunning(true);
    setDemoError(null);
    const stepKeys = ["reset", "seed", "normalize", "reconcile", "policy", "evaluate"];
    // Show all steps as pending, first as running
    setSteps(stepKeys.map((s, i) => ({ step: s, status: i === 0 ? "running" : "pending" })));

    // Simulate step progression while request is in flight
    let stepIdx = 0;
    const advance = () => {
      stepIdx++;
      if (stepIdx < stepKeys.length) {
        setSteps((prev) =>
          prev.map((s, i) => ({
            ...s,
            status: i < stepIdx ? "done" : i === stepIdx ? "running" : "pending",
          }))
        );
      }
    };
    const intervals = [800, 1200, 2000, 3500, 1200].map((delay, i) =>
      setTimeout(advance, delay + (i > 0 ? [800, 1200, 2000, 3500][i - 1] : 0))
    );

    try {
      const res = await fetch("/api/demo/run", { method: "POST" });
      const data = await res.json();
      intervals.forEach(clearTimeout);

      if (!data.success) throw new Error(data.error ?? "Unknown error");

      // Mark all done with server-returned details
      setSteps(
        (data.steps ?? stepKeys.map((s) => ({ step: s, status: "done" }))).map((s: any) => ({
          ...s,
          status: "done",
        }))
      );
      await fetchRun();
    } catch (e: any) {
      intervals.forEach(clearTimeout);
      setDemoError(e.message ?? "Demo run failed");
      setSteps((prev) => prev.map((s) => s.status === "running" ? { ...s, status: "error" } : s));
    }

    setDemoRunning(false);
  };

  const handleRefresh = () => fetchRun();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#02042B] text-white p-8 rounded-xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-[#3395FF] opacity-20 blur-3xl" />
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Finance Controller</h1>
          <p className="text-blue-200">Reconciliation Overview &amp; Metrics</p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          {!demoRunning && runData?.run && (
            <>
              <Button
                variant="secondary"
                onClick={handleRefresh}
                className="bg-white/10 text-white hover:bg-white/20 border-0"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={async () => {
                  setDemoRunning(true);
                  setSteps([{ step: "Batch AI Resolution", status: "running", detail: "Processing exceptions..." }]);
                  try {
                    const res = await fetch("/api/demo/run-ai", { method: "POST" });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    setSteps([{ step: "Batch AI Resolution", status: "done", detail: `Processed ${data.processed}, Resolved ${data.resolved}` }]);
                    await fetchRun();
                  } catch (e: any) {
                    setSteps([{ step: "Batch AI Resolution", status: "error", detail: e.message }]);
                  }
                  setDemoRunning(false);
                }}
                disabled={demoRunning}
                className="bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/20"
              >
                <Zap className="mr-2 h-4 w-4" />
                Run AI on Exceptions
              </Button>
            </>
          )}
          <Button
            onClick={handleRunFullDemo}
            disabled={demoRunning}
            className="bg-[#3395FF] hover:bg-[#2b80e0] text-white shadow-md shadow-[#3395FF]/20 min-w-[160px]"
          >
            {demoRunning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Deterministic Engine
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress Panel */}
      {steps.length > 0 && (
        <Card className="border-blue-100 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-900">Demo Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {steps.map((s) => (
                <div key={s.step} className="flex items-center gap-3 text-sm">
                  {s.status === "done" && <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />}
                  {s.status === "running" && <RefreshCw className="h-4 w-4 text-blue-600 shrink-0 animate-spin" />}
                  {s.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-zinc-300 shrink-0" />}
                  {s.status === "error" && <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
                  <span className={
                    s.status === "done" ? "text-zinc-700" :
                    s.status === "running" ? "text-blue-700 font-medium" :
                    s.status === "error" ? "text-red-700" : "text-zinc-400"
                  }>
                    {STEP_LABELS[s.step] ?? s.step}
                  </span>
                  {s.detail && <span className="text-zinc-500 text-xs">— {s.detail}</span>}
                </div>
              ))}
            </div>
            {demoError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                Error: {demoError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="h-32 flex items-center justify-center text-zinc-400">Loading…</div>
      ) : !runData?.run ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Database className="h-12 w-12 text-zinc-300 mb-4" />
          <CardTitle className="mb-2">No Active Run</CardTitle>
          <CardDescription className="max-w-md">
            Click <strong>"Run Full Demo"</strong> to seed the database with 250 synthetic records across all 12 discrepancy classes and run the full reconciliation pipeline.
          </CardDescription>
        </Card>
      ) : (
        <>
          {/* Core stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                <Database className="h-4 w-4 text-zinc-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{runData.metrics?.totalRecords || runData.run.recordCount || 0}</div>
                <p className="text-xs text-zinc-500">Processed in current batch</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Auto-Reconciled</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{runData.metrics?.autoReconciled || 0}</div>
                <p className="text-xs text-zinc-500">Closed automatically</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Exceptions</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{runData.metrics?.reviewRequired || 0}</div>
                <p className="text-xs text-zinc-500">Escalated for human review</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
                <Clock className="h-4 w-4 text-zinc-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{runData.metrics?.unresolved || 0}</div>
                <p className="text-xs text-zinc-500">Insufficient evidence</p>
              </CardContent>
            </Card>
          </div>

          {runData.metrics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Evaluation Metrics</CardTitle>
                  <CardDescription>
                    Performance evaluated against hidden ground truth labels.{" "}
                    <a href="/evaluation" className="text-blue-600 hover:underline">View full evaluation →</a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm font-medium text-zinc-500">Precision</div>
                    <div className="text-3xl font-bold text-emerald-600">{(runData.metrics.precision * 100).toFixed(1)}%</div>
                    <p className="text-xs text-zinc-500">Correctly resolved / Total auto-resolved</p>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">Recall</div>
                    <div className="text-3xl font-bold text-blue-600">{(runData.metrics.recall * 100).toFixed(1)}%</div>
                    <p className="text-xs text-zinc-500">Correctly resolved / Total actual matches</p>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">F1 Score</div>
                    <div className="text-3xl font-bold text-violet-600">{(runData.metrics.f1 * 100).toFixed(1)}%</div>
                    <p className="text-xs text-zinc-500">Harmonic mean of Precision &amp; Recall</p>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">Auto-Resolution Rate</div>
                    <div className="text-3xl font-bold">{(runData.metrics.autoResolutionRate * 100).toFixed(1)}%</div>
                    <p className="text-xs text-zinc-500">Records closed without human intervention</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Operational Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="text-sm font-medium text-zinc-500">Throughput</div>
                    <div className="text-2xl font-bold">{Math.round(runData.metrics.throughputPerSecond)} <span className="text-sm font-normal text-zinc-500">records / sec</span></div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500 flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-red-500" />
                      False-Positive Rate
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {(runData.metrics.falsePositiveRate * 100).toFixed(2)}%
                    </div>
                    <p className="text-xs text-zinc-500">Financial invariants prevent false approvals</p>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">Abstention Rate</div>
                    <div className="text-2xl font-bold">{(runData.metrics.abstentionRate * 100).toFixed(1)}%</div>
                    <p className="text-xs text-zinc-500">System deliberately escalated to humans</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

