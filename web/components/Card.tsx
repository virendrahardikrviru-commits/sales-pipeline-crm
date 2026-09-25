import type { ReactNode } from "react";

export interface CardProps {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}

export function Card({ title, value, hint, icon }: CardProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {title}
        </p>
        {icon ? (
          <div className="text-zinc-400 dark:text-zinc-500">{icon}</div>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </section>
  );
}
