"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Database, AlertCircle, CheckCircle, Clock } from "lucide-react";

export default function Dashboard() {
  const [runData, setRunData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchRun = async () => {
    setLoading(true);
    const res = await fetch("/api/run");
    const data = await res.json();
    setRunData(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchRun();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      await fetchRun();
    } catch (e) {
      alert("Seeding failed");
    }
    setSeeding(false);
  };

  const handleRunReconciliation = async () => {
    if (!runData?.run?.id) return;
    setRunning(true);
    try {
      await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: runData.run.id })
      });
      await fetchRun();
    } catch (e) {
      alert("Reconciliation failed");
    }
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Controller</h1>
          <p className="text-zinc-500">Reconciliation Overview & Metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSeed} disabled={seeding || running}>
            <Database className="mr-2 h-4 w-4" />
            {seeding ? "Generating..." : "Generate Test Data"}
          </Button>
          <Button onClick={handleRunReconciliation} disabled={running || seeding || !runData?.run || runData?.run?.status === "COMPLETED"}>
            <Play className="mr-2 h-4 w-4" />
            {running ? "Processing..." : "Run Reconciliation"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center">Loading...</div>
      ) : !runData?.run ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Database className="h-12 w-12 text-zinc-300 mb-4" />
          <CardTitle className="mb-2">No Active Run</CardTitle>
          <CardDescription className="max-w-md">
            Click "Generate Test Data" to seed the database with synthetic records.
          </CardDescription>
        </Card>
      ) : (
        <>
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
                <CardTitle className="text-sm font-medium">Review Required</CardTitle>
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
                  <CardTitle>Evaluation Metrics (Held-out Set)</CardTitle>
                  <CardDescription>
                    Performance evaluated against hidden ground truth.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-zinc-500">Precision</div>
                    <div className="text-3xl font-bold">{(runData.metrics.precision * 100).toFixed(1)}%</div>
                    <p className="text-xs text-zinc-500">Correctly resolved / Total auto-resolved</p>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">Recall</div>
                    <div className="text-3xl font-bold">{(runData.metrics.recall * 100).toFixed(1)}%</div>
                    <p className="text-xs text-zinc-500">Correctly resolved / Total actual matches</p>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">F1 Score</div>
                    <div className="text-3xl font-bold">{(runData.metrics.f1 * 100).toFixed(1)}%</div>
                    <p className="text-xs text-zinc-500">Harmonic mean of Precision & Recall</p>
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
                    <div className="text-sm font-medium text-zinc-500">False-Positive Rate</div>
                    <div className="text-2xl font-bold text-red-600">{(runData.metrics.falsePositiveRate * 100).toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">Abstention Rate</div>
                    <div className="text-2xl font-bold">{(runData.metrics.abstentionRate * 100).toFixed(1)}%</div>
                    <p className="text-xs text-zinc-500">System deliberately escalated</p>
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
