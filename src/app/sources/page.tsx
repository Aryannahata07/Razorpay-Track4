"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, CheckCircle, AlertTriangle, Database } from "lucide-react";

export default function SourcesPage() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; count?: number; error?: string } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      // Hardcode a default merchantId for demo purposes
      formData.append("merchantId", "00000000-0000-0000-0000-000000000000");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        setResult({ success: true, count: data.count });
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (err) {
      setResult({ success: false, error: "Upload failed" });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
        <p className="text-zinc-500">Manage connections and upload raw data files.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>File Upload (CSV)</CardTitle>
            <CardDescription>Upload a standard CSV file to ingest source records into the pending queue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-zinc-200 rounded-lg p-10 flex flex-col items-center justify-center bg-zinc-50/50 text-zinc-500 hover:bg-zinc-50 transition-colors">
              <UploadCloud className="h-10 w-10 mb-4 text-zinc-400" />
              <p className="mb-2 text-sm font-medium">Drag & drop your CSV file here</p>
              <p className="text-xs mb-4">Required columns: externalId, sourceType, recordDate, amount, currency</p>
              
              <div className="relative">
                <Button disabled={uploading}>
                  {uploading ? "Uploading..." : "Browse Files"}
                </Button>
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {result?.success && (
              <div className="p-3 bg-green-50 text-green-700 text-sm rounded flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Successfully uploaded {result.count} records.
              </div>
            )}
            
            {result?.error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {result.error}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Connections</CardTitle>
            <CardDescription>Direct API integrations for continuous ingestion.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               <div className="flex items-center justify-between p-4 border rounded-lg">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-blue-50 text-blue-600 rounded">
                     <FileText className="h-5 w-5" />
                   </div>
                   <div>
                     <div className="font-semibold text-sm">Razorpay Sandbox</div>
                     <div className="text-xs text-zinc-500">Connected (Test Mode)</div>
                   </div>
                 </div>
                 <Button variant="outline" size="sm" disabled>Sync Now</Button>
               </div>
               
               <div className="flex items-center justify-between p-4 border rounded-lg opacity-60 grayscale">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-zinc-100 text-zinc-600 rounded">
                     <Database className="h-5 w-5" />
                   </div>
                   <div>
                     <div className="font-semibold text-sm">ERP / NetSuite</div>
                     <div className="text-xs text-zinc-500">Not Connected</div>
                   </div>
                 </div>
                 <Button variant="outline" size="sm">Connect</Button>
               </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
