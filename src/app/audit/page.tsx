import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const ACTOR_COLORS: Record<string, string> = {
  SYSTEM: "bg-blue-100 text-blue-800 border-blue-200",
  AGENT: "bg-violet-100 text-violet-800 border-violet-200",
  HUMAN: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const EVENT_COLORS: Record<string, string> = {
  INVARIANT_VIOLATION: "bg-red-50 border-l-red-500",
  POLICY_EVALUATION: "bg-zinc-50 border-l-zinc-300",
  AI_INVESTIGATION: "bg-violet-50 border-l-violet-400",
  HUMAN_OVERRIDE: "bg-emerald-50 border-l-emerald-400",
  ALIAS_CREATED: "bg-amber-50 border-l-amber-400",
};

export default async function AuditPage() {
  const latestRun = await prisma.reconciliationRun.findFirst({
    orderBy: { startedAt: "desc" },
  });

  const events = latestRun
    ? await prisma.auditEvent.findMany({
        where: { runId: latestRun.id },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    : [];

  const summary = {
    total: events.length,
    system: events.filter((e) => e.actorType === "SYSTEM").length,
    agent: events.filter((e) => e.actorType === "AGENT").length,
    human: events.filter((e) => e.actorType === "HUMAN").length,
    invariantViolations: events.filter((e) => e.eventType === "INVARIANT_VIOLATION").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-zinc-500">
          Immutable log of every decision made by the system, AI agent, and human reviewers.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total Events", value: summary.total, cls: "text-zinc-900" },
          { label: "System", value: summary.system, cls: "text-blue-700" },
          { label: "AI Agent", value: summary.agent, cls: "text-violet-700" },
          { label: "Human", value: summary.human, cls: "text-emerald-700" },
          { label: "Invariant Blocks", value: summary.invariantViolations, cls: "text-red-700" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>
            Most recent {events.length} events from the current run. Red entries indicate financial invariant violations (policy gate fired).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>No audit events yet. Run the demo first.</p>
            </div>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {events.map((e) => {
                const rowColor = EVENT_COLORS[e.eventType] ?? "bg-white border-l-zinc-200";
                return (
                  <div
                    key={e.id}
                    className={`flex items-start gap-4 px-4 py-2 border-l-4 rounded-r ${rowColor}`}
                  >
                    <span className="text-zinc-400 whitespace-nowrap shrink-0">
                      {format(new Date(e.createdAt), "HH:mm:ss")}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${ACTOR_COLORS[e.actorType] ?? "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                      {e.actorType}
                    </span>
                    <span className="text-zinc-500 shrink-0">{e.eventType}</span>
                    <span className="font-semibold text-zinc-800 shrink-0">{e.action}</span>
                    <span className="text-zinc-500 truncate">{e.reason ?? "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
