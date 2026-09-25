"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  LabelList,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
  type TooltipContentProps,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactTHB, formatPercent, formatPeriodLong, formatTHB } from "@/lib/format";
import type { MonthlyPnlRow } from "@/lib/types";

const SERIES = [
  { key: "revenue", label: "Revenue", color: "var(--series-revenue)", kind: "bar" },
  { key: "cost", label: "Cost", color: "var(--series-cost)", kind: "bar" },
  { key: "marginPctPlot", label: "Margin %", color: "var(--series-margin)", kind: "line" },
] as const;

export function MonthlyPnlChart({
  rows,
  year,
  selectedMonth,
}: {
  rows: MonthlyPnlRow[];
  year: number;
  selectedMonth: number | null;
}) {
  const hasData = rows.some((r) => r.transactionCount > 0);
  // Months without revenue have no meaningful margin %: leave a gap, not a 0% dip.
  const data = rows.map((r) => ({ ...r, marginPctPlot: r.revenue ? r.marginPct : null }));

  return (
    <Card className="shadow-sm ring-foreground/[0.07]">
      <CardHeader className="flex flex-col gap-3 px-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Monthly P&amp;L Progress</CardTitle>
          <CardDescription>
            Revenue and cost (left axis) with margin % (right axis) by month · {year}
          </CardDescription>
        </div>
        <Legend />
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        {hasData ? (
          <div className="overflow-x-auto">
            <div className="h-[380px] min-w-[760px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data}
                  margin={{ top: 28, right: 8, bottom: 0, left: 8 }}
                  barGap={2}
                  barCategoryGap="22%"
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="amount"
                    tickFormatter={formatCompactTHB}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    tickFormatter={(v: number) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <ReferenceLine yAxisId="amount" y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} />
                  <Tooltip
                    content={(props) => <PnlTooltip {...props} year={year} />}
                    cursor={{ fill: "var(--muted)", opacity: 0.7 }}
                  />
                  {SERIES.map((s) =>
                    s.kind === "bar" ? (
                      <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.label}
                        yAxisId="amount"
                        fill={s.color}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                        isAnimationActive={false}
                      >
                        {rows.map((r) => (
                          <Cell
                            key={r.month}
                            fillOpacity={selectedMonth && r.month !== selectedMonth ? 0.3 : 1}
                          />
                        ))}
                        <LabelList dataKey={s.key} content={BarValueLabel} />
                      </Bar>
                    ) : (
                      <Line
                        key={s.key}
                        dataKey={s.key}
                        name={s.label}
                        yAxisId="pct"
                        type="monotone"
                        connectNulls={false}
                        isAnimationActive={false}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={{ r: 4, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
                        activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                      >
                        <LabelList dataKey={s.key} content={PercentLabel} />
                      </Line>
                    ),
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No transactions with a month in {year}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact amount for a bar. Written vertically inside the bar so it avoids
 * collides with the margin % pills; bars too short to hold it get it on top.
 */
function BarValueLabel({ x, y, width, height, value }: LabelProps) {
  const n = Number(value);
  if (!n || x == null || y == null || width == null || height == null) return null;
  const text = formatCompactTHB(n);
  const cx = Number(x) + Number(width) / 2;
  const top = Number(y);
  const fitsInside = Math.abs(Number(height)) >= text.length * 6 + 10;

  if (!fitsInside) {
    return (
      <text x={cx} y={top - 5} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
        {text}
      </text>
    );
  }
  // Anchored at the bar's base, where the margin % pills rarely reach.
  const base = top + Number(height) - 6;
  return (
    <text
      x={cx}
      y={base}
      transform={`rotate(-90 ${cx} ${base})`}
      textAnchor="start"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={600}
      fill="#fff"
    >
      {text}
    </text>
  );
}

/** Margin % above each point, on a pill so it stays legible over bars. */
function PercentLabel({ x, y, value }: LabelProps) {
  if (value == null || x == null || y == null) return null;
  const text = formatPercent(Number(value));
  const w = text.length * 6 + 10;
  const cx = Number(x);
  const top = Number(y) - 24;
  return (
    <g>
      <rect
        x={cx - w / 2}
        y={top}
        width={w}
        height={16}
        rx={8}
        fill="var(--card)"
        stroke="var(--series-margin)"
        strokeWidth={1}
      />
      <text
        x={cx}
        y={top + 11.5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="var(--foreground)"
        className="tabular-nums"
      >
        {text}
      </text>
    </g>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          {s.kind === "bar" ? (
            <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
          ) : (
            <span className="relative flex h-2.5 w-4 items-center">
              <span className="h-0.5 w-full rounded" style={{ background: s.color }} />
              <span
                className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full"
                style={{ background: s.color }}
              />
            </span>
          )}
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function PnlTooltip({
  active,
  payload,
  year,
}: TooltipContentProps & { year: number }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as MonthlyPnlRow;

  const lines = [
    { label: "Revenue", value: formatTHB(row.revenue), color: SERIES[0].color },
    { label: "Cost", value: formatTHB(row.cost), color: SERIES[1].color },
    { label: "Margin", value: formatTHB(row.margin), color: SERIES[2].color },
    { label: "Margin %", value: formatPercent(row.marginPct), color: null },
  ];

  return (
    <div className="min-w-52 rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md">
      <p className="mb-2 text-sm font-semibold text-foreground">{formatPeriodLong(year, row.month)}</p>
      <dl className="space-y-1">
        {lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-[2px]"
                style={{ background: l.color ?? "transparent" }}
                aria-hidden
              />
              {l.label}:
            </dt>
            <dd className="font-medium text-foreground tabular-nums">{l.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
