"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { SalesRepSummary } from "@/lib/types";

export function SalesByRepChart({ data }: { data: SalesRepSummary[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        No sales rep data yet
      </div>
    );
  }

  return (
    <div className="h-[300px] text-zinc-500 dark:text-zinc-400">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
          <XAxis
            dataKey="sales_rep"
            interval={0}
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatCurrency(Number(value))}
            width={72}
          />
          <Tooltip
            cursor={{ fill: "currentColor", opacity: 0.06 }}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Legend verticalAlign="top" height={28} />
          <Bar dataKey="total" name="Total" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="won" name="Won" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
