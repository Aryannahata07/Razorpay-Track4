import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Finance Controller | Razorpay Track 4",
  description: "Evidence-driven financial reconciliation with controlled autonomy. AI investigates, deterministic controls verify, policy decides.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex font-sans antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <header className="flex h-14 items-center gap-4 border-b bg-white px-6">
            <div className="flex-1">
              {/* Header content like Breadcrumbs or Run selector could go here */}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                DEMO / TEST MODE
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-zinc-50/20 p-6">
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </main>
        </div>
      </body>
    </html>
  );
}
