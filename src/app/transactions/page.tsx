import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

function formatAmount(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    RECONCILED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    EXCEPTION: "bg-amber-100 text-amber-800 border-amber-200",
    PENDING: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    PAYMENT: "bg-blue-100 text-blue-800 border-blue-200",
    INVOICE: "bg-purple-100 text-purple-800 border-purple-200",
    SETTLEMENT: "bg-teal-100 text-teal-800 border-teal-200",
    REFUND: "bg-rose-100 text-rose-800 border-rose-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[type] ?? "bg-zinc-100 text-zinc-600"}`}>
      {type}
    </span>
  );
}

export default async function TransactionsPage() {
  const latestRun = await prisma.reconciliationRun.findFirst({
    orderBy: { startedAt: "desc" },
  });

  const records = latestRun
    ? await prisma.sourceRecord.findMany({
        where: { runId: latestRun.id },
        include: {
          decisionsSource: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: [{ sourceType: "asc" }, { recordDate: "desc" }],
        take: 500,
      })
    : [];

  const stats = {
    total: records.length,
    reconciled: records.filter((r) => r.status === "RECONCILED").length,
    exceptions: records.filter((r) => r.status === "EXCEPTION").length,
    pending: records.filter((r) => r.status === "PENDING").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-zinc-500">
          {latestRun
            ? `Run: ${latestRun.id.slice(0, 8)}… — ${records.length} records`
            : "No data yet. Run the demo to generate records."}
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Records", value: stats.total, cls: "text-zinc-900" },
          { label: "Reconciled", value: stats.reconciled, cls: "text-emerald-700" },
          { label: "Exceptions", value: stats.exceptions, cls: "text-amber-700" },
          { label: "Pending", value: stats.pending, cls: "text-zinc-500" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source Records</CardTitle>
          <CardDescription>
            All records ingested in the latest reconciliation run, with their policy decisions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p className="text-lg font-medium">No records yet</p>
              <p className="text-sm mt-1">Go to the Overview dashboard and click "Run Full Demo" to generate data.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="text-left py-2 px-3 font-medium">External ID</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                    <th className="text-left py-2 px-3 font-medium">Counterparty</th>
                    <th className="text-left py-2 px-3 font-medium">Reference</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-right py-2 px-3 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {records.map((r) => {
                    const decision = r.decisionsSource[0];
                    return (
                      <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-2 px-3 font-mono text-xs text-zinc-600">{r.externalId}</td>
                        <td className="py-2 px-3">
                          <TypeBadge type={r.sourceType} />
                        </td>
                        <td className="py-2 px-3 text-zinc-600 whitespace-nowrap">
                          {format(new Date(r.recordDate), "dd MMM yyyy")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-medium">
                          {formatAmount(r.amount)}
                        </td>
                        <td className="py-2 px-3 text-zinc-700 max-w-[160px] truncate">
                          {r.counterpartyName ?? <span className="text-zinc-400 italic">—</span>}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs text-zinc-500">
                          {r.reference ?? <span className="text-zinc-400">—</span>}
                        </td>
                        <td className="py-2 px-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-500 text-xs">
                          {decision ? `${(decision.confidence * 100).toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
