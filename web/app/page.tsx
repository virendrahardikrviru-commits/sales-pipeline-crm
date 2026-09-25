import { Briefcase, CheckSquare, DollarSign, Users } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Card } from "@/components/Card";
import { MonthlyPipelineChart } from "@/components/charts/MonthlyPipelineChart";
import { SalesByProductChart } from "@/components/charts/SalesByProductChart";
import { SalesByRepChart } from "@/components/charts/SalesByRepChart";
import { EmptyState } from "@/components/EmptyState";
import {
  getDashboardSummary,
  getMonthlyPipeline,
  getSalesByProduct,
  getSalesByRep,
  listRecentActivity,
} from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ActivityItem, ActivityKind } from "@/lib/types";

const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  contact: "Contact",
  deal: "Deal",
  task: "Task",
};

const ACTIVITY_TONES: Record<ActivityKind, BadgeTone> = {
  contact: "info",
  deal: "success",
  task: "neutral",
};

export default async function Page() {
  const [summary, activity, salesByProduct, salesByRep, monthlyPipeline] =
    await Promise.all([
      getDashboardSummary(),
      listRecentActivity(undefined, 10),
      getSalesByProduct(),
      getSalesByRep(),
      getMonthlyPipeline(),
    ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Total Contacts"
          value={summary.totalContacts}
          hint="All time"
          icon={<Users className="h-4 w-4" />}
        />
        <Card
          title="Open Deals"
          value={summary.openDeals}
          hint="Lead + Qualified + Proposal"
          icon={<Briefcase className="h-4 w-4" />}
        />
        <Card
          title="Pipeline Value"
          value={formatCurrency(summary.pipelineValue)}
          hint="Sum of open deal values"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <Card
          title="Tasks Due Today"
          value={summary.tasksDueToday}
          hint="Incomplete, due today"
          icon={<CheckSquare className="h-4 w-4" />}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Analytics
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <header className="mb-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Sales by product
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Excludes Lost deals
              </p>
            </header>
            <SalesByProductChart data={salesByProduct} />
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <header className="mb-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Sales by rep
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Total vs won
              </p>
            </header>
            <SalesByRepChart data={salesByRep} />
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
            <header className="mb-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Pipeline trend
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Last 12 months
              </p>
            </header>
            <MonthlyPipelineChart data={monthlyPipeline} />
          </article>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {activity.map((item) => (
              <ActivityRow key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Badge tone={ACTIVITY_TONES[item.kind]}>{ACTIVITY_LABELS[item.kind]}</Badge>
      <p className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
        {item.label}
      </p>
      <time className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
        {formatDate(item.createdAt)}
      </time>
    </li>
  );
}
