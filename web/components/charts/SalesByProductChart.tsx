"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ProductSalesSummary } from "@/lib/types";

export function SalesByProductChart({ data }: { data: ProductSalesSummary[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        No product data yet
      </div>
    );
  }

  return (
    <div className="h-[300px] text-zinc-500 dark:text-zinc-400">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 64, left: 8, bottom: 8 }}
        >
          <defs>
            <linearGradient id="productBarFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="currentColor"
            strokeOpacity={0.12}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatCurrency(Number(value))}
          />
          <YAxis
            type="category"
            dataKey="product"
            width={120}
            interval={0}
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "currentColor", opacity: 0.06 }}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Bar
            dataKey="total"
            name="Total"
            fill="url(#productBarFill)"
            radius={[0, 6, 6, 0]}
            maxBarSize={28}
          >
            <LabelList
              dataKey="total"
              position="right"
              className="fill-zinc-600 text-xs dark:fill-zinc-300"
              formatter={(value) => formatCurrency(Number(value))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
