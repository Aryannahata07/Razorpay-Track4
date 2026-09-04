"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Shield, Sliders, Database, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings &amp; Configuration</h1>
        <p className="text-zinc-500">
          Manage AI controller providers, policy thresholds, and invariant safety gates.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* LLM Provider Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-violet-600" />
                <CardTitle>AI Provider &amp; Model</CardTitle>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>
            </div>
            <CardDescription>Configured language model for autonomous exception investigation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-zinc-50/50">
              <div>
                <p className="font-semibold text-sm">Primary LLM</p>
                <p className="text-xs text-zinc-500">Groq OpenAI-Compatible Gateway</p>
              </div>
              <span className="font-mono text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded border border-violet-200">llama3-8b-8192</span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-zinc-50/50">
              <div>
                <p className="font-semibold text-sm">Rate-Limit Resiliency</p>
                <p className="text-xs text-zinc-500">Automatic Fallback Engine</p>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Cooldown Active</Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-zinc-50/50">
              <div>
                <p className="font-semibold text-sm">Structured Output Enforcement</p>
                <p className="text-xs text-zinc-500">Zod Schema Guardrails</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        {/* Policy Thresholds Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-blue-600" />
              <CardTitle>Reconciliation Policy Thresholds</CardTitle>
            </div>
            <CardDescription>Heuristic score gates applied before auto-approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-semibold text-sm">Auto-Reconcile Threshold</p>
                <p className="text-xs text-zinc-500">Score required for instant closing</p>
              </div>
              <span className="font-mono text-sm font-bold text-emerald-700">≥ 0.85</span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-semibold text-sm">Human Review Threshold</p>
                <p className="text-xs text-zinc-500">Score triggering exception workbench</p>
              </div>
              <span className="font-mono text-sm font-bold text-amber-700">≥ 0.60</span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-semibold text-sm">Amount Variance Invariant</p>
                <p className="text-xs text-zinc-500">Hard ratio bound to prevent mismatch</p>
              </div>
              <span className="font-mono text-sm font-bold text-red-700">10% - 150%</span>
            </div>
          </CardContent>
        </Card>

        {/* Database & Infrastructure */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-zinc-600" />
              <CardTitle>Ledger Storage &amp; Infrastructure</CardTitle>
            </div>
            <CardDescription>Local storage status for enterprise auditability.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="p-3 border rounded-lg">
              <p className="text-xs text-zinc-500">Database Engine</p>
              <p className="text-sm font-bold mt-1">SQLite via Prisma ORM v7</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-xs text-zinc-500">Environment</p>
              <p className="text-sm font-bold mt-1">Local Sandbox / Development</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-xs text-zinc-500">Audit Trail Retention</p>
              <p className="text-sm font-bold mt-1">Immutable Event Log</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
