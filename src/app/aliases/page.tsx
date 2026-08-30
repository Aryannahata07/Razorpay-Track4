import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AliasesPage() {
  const aliases = await prisma.entityAlias.findMany({
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rule Memory</h1>
        <p className="text-zinc-500">Manage learned entity mapping rules.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entity Aliases</CardTitle>
          <CardDescription>Rules applied automatically during the deterministic normalization phase.</CardDescription>
        </CardHeader>
        <CardContent>
          {aliases.length === 0 ? (
            <div className="text-zinc-500 text-sm">No rules learned yet. Use the AI Controller to investigate exceptions and suggest rules.</div>
          ) : (
            <div className="space-y-4">
              {aliases.map(alias => (
                <div key={alias.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4 text-sm font-mono">
                    <span className="text-red-700 bg-red-50 px-2 py-1 rounded">"{alias.alias}"</span>
                    <span className="text-zinc-400">→</span>
                    <span className="text-green-700 bg-green-50 px-2 py-1 rounded">"{alias.canonicalEntity}"</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={alias.source === "HUMAN_APPROVED" ? "default" : "secondary"}>
                      {alias.source}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
