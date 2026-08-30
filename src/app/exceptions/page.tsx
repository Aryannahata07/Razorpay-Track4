"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exceptions")
      .then(res => res.json())
      .then(data => {
        setExceptions(data.exceptions || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exception Workbench</h1>
          <p className="text-zinc-500">Investigate and resolve reconciliation exceptions.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open Exceptions</CardTitle>
          <CardDescription>
            {exceptions.length} records requiring human review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-32 flex items-center justify-center">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-zinc-500">
                      No exceptions found. Run reconciliation to generate data.
                    </TableCell>
                  </TableRow>
                ) : (
                  exceptions.map(exc => (
                    <TableRow key={exc.id}>
                      <TableCell>
                        <Badge variant={exc.status === "OPEN" ? "destructive" : "secondary"}>
                          {exc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{exc.sourceRecord?.externalId}</TableCell>
                      <TableCell>₹{(exc.sourceRecord?.amount / 100).toFixed(2)}</TableCell>
                      <TableCell>{exc.category}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          exc.severity === "HIGH" ? "text-red-600 border-red-200 bg-red-50" : 
                          "text-orange-600 border-orange-200 bg-orange-50"
                        }>
                          {exc.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button render={<Link href={`/exceptions/${exc.id}`} />} variant="outline" size="sm">
                          Investigate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
