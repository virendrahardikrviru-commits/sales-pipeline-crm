"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/format";
import type { MonthlySummary } from "@/lib/types";

function formatMonthLabel(month: string): string {
  const formatted = formatDate(`${month}-01`);
  if (formatted === "—") return month;
  return formatted.replace(/\s+\d{1,2},/, "");
}

export function MonthlyPipelineChart({ data }: { data: MonthlySummary[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        No pipeline data yet
      </div>
    );
  }

  return (
    <div className="h-[300px] text-zinc-500 dark:text-zinc-400">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.12} />
          <XAxis
            dataKey="month"
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatMonthLabel}
          />
          <YAxis
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatCurrency(Number(value))}
            width={72}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            labelFormatter={(label) => formatMonthLabel(String(label))}
          />
          <Legend verticalAlign="top" height={28} />
          <Area
            type="monotone"
            dataKey="total"
            name="Total"
            stackId="pipeline"
            stroke="#2563eb"
            fill="#2563eb"
            fillOpacity={0.28}
          />
          <Area
            type="monotone"
            dataKey="won"
            name="Won"
            stackId="pipeline"
            stroke="#16a34a"
            fill="#16a34a"
            fillOpacity={0.65}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
