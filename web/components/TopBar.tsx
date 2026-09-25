"use client";

import { usePathname } from "next/navigation";
import { Badge } from "./Badge";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/contacts": "Contacts",
  "/deals": "Deals",
  "/tasks": "Tasks",
};

function titleFromPath(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];

  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) return "Dashboard";

  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function TopBar() {
  const pathname = usePathname();
  const title = titleFromPath(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        <Badge tone="info">Pro plan</Badge>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            DU
          </div>
          <span className="hidden text-sm text-zinc-600 sm:inline dark:text-zinc-300">
            Demo User
          </span>
        </div>
      </div>
    </header>
  );
}
