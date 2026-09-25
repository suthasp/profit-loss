import { MONTH_SHORT } from "./format";
import type { MonthlyPnlRow, PnlFigures, Transaction } from "./types";

/** Margin = Revenue − Cost */
export function calculateMargin(revenue: number, cost: number): number {
  return revenue - cost;
}

/** Margin % = Margin / Revenue × 100, and 0 when Revenue is 0 (never NaN/Infinity). */
export function calculateMarginPct(margin: number, revenue: number): number {
  if (!revenue || !Number.isFinite(revenue) || !Number.isFinite(margin)) return 0;
  const pct = (margin / revenue) * 100;
  return Number.isFinite(pct) ? pct : 0;
}

/** Build P&L figures from summed revenue and cost. */
export function toFigures(revenue: number, cost: number): PnlFigures {
  const margin = calculateMargin(revenue, cost);
  return { revenue, cost, margin, marginPct: calculateMarginPct(margin, revenue) };
}

/** Transactions that belong to a month and can be counted in the P&L. */
export function isCountable(tx: Transaction): tx is Transaction & { period: NonNullable<Transaction["period"]> } {
  return tx.status === "included" && tx.period !== null;
}

/** Years that have at least one countable transaction, newest first. */
export function getAvailableYears(transactions: Transaction[]): number[] {
  const years = new Set<number>();
  for (const tx of transactions) if (isCountable(tx)) years.add(tx.period.year);
  return [...years].sort((a, b) => b - a);
}

/** Twelve rows, January → December (calendar order), for one year. */
export function calculateMonthlyPnl(transactions: Transaction[], year: number): MonthlyPnlRow[] {
  const sums = Array.from({ length: 12 }, () => ({ revenue: 0, cost: 0, count: 0 }));

  for (const tx of transactions) {
    if (!isCountable(tx) || tx.period.year !== year) continue;
    const bucket = sums[tx.period.month - 1];
    bucket.revenue += tx.revenue;
    bucket.cost += tx.cost;
    bucket.count++;
  }

  return sums.map((s, i) => ({
    year,
    month: i + 1,
    label: MONTH_SHORT[i],
    transactionCount: s.count,
    ...toFigures(s.revenue, s.cost),
  }));
}

/**
 * Totals from summed revenue and cost. The margin % is recalculated from the
 * totals, never averaged across months.
 */
export function calculateTotals(rows: Pick<PnlFigures, "revenue" | "cost">[]): PnlFigures {
  let revenue = 0;
  let cost = 0;
  for (const r of rows) {
    revenue += r.revenue;
    cost += r.cost;
  }
  return toFigures(revenue, cost);
}

/** Summary for the selected year and optional month (null = all months). */
export function calculateSummary(monthly: MonthlyPnlRow[], month: number | null): PnlFigures {
  return calculateTotals(month === null ? monthly : monthly.filter((r) => r.month === month));
}
