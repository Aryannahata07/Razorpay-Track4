"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, AlertCircle, CheckCircle, Database, Settings, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const routes = [
  { href: "/", label: "Overview", icon: BarChart2 },
  { href: "/exceptions", label: "Exceptions", icon: AlertCircle },
  { href: "/transactions", label: "Transactions", icon: Activity },
  { href: "/aliases", label: "Rule Memory", icon: CheckCircle },
  { href: "/sources", label: "Data Sources", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 border-r bg-zinc-50/50 hidden md:block">
      <div className="flex h-14 items-center border-b px-6">
        <span className="font-semibold text-lg tracking-tight">AI Finance Controller</span>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 hover:text-zinc-900",
              pathname === route.href || pathname.startsWith(route.href + '/') 
                ? "bg-zinc-100 text-zinc-900" 
                : "text-zinc-500"
            )}
          >
            <route.icon className="h-4 w-4" />
            {route.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
