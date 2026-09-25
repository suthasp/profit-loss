"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, formatTHB, MONTH_LONG } from "@/lib/format";
import {
  calculateMonthlyPnl,
  calculateSummary,
  calculateTotals,
  getAvailableYears,
} from "@/lib/pnl-calculation";
import type { PnlApiResponse, PnlSuccessResponse } from "@/lib/types";
import { PnlSummaryCards } from "./PnlSummaryCards";
import { MonthlyPnlChart } from "./MonthlyPnlChart";
import { MonthlyPnlTable } from "./MonthlyPnlTable";
import { TransactionTable } from "./TransactionTable";

const ALL_MONTHS = "all";

async function fetchPnl(refresh: boolean): Promise<PnlSuccessResponse> {
  const res = await fetch(refresh ? "/api/pnl?refresh=1" : "/api/pnl", { cache: "no-store" });
  let body: PnlApiResponse;
  try {
    body = await res.json();
  } catch {
    throw new Error(`The server returned an unreadable response (HTTP ${res.status}).`);
  }
  if (body.error) throw new Error(body.message);
  return body;
}

export function PnlDashboard() {
  const [data, setData] = useState<PnlSuccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<string>(ALL_MONTHS);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await fetchPnl(refresh);
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load(false);
  }, [load]);

  const years = useMemo(() => (data ? getAvailableYears(data.transactions) : []), [data]);

  // Default to the current year when it has data, otherwise the latest year.
  // Keep the user's choice across refreshes as long as it still exists.
  const activeYear = useMemo(() => {
    if (year !== null && years.includes(year)) return year;
    const current = new Date().getFullYear();
    return years.includes(current) ? current : years[0] ?? current;
  }, [year, years]);

  const selectedMonth = month === ALL_MONTHS ? null : Number(month);

  const monthly = useMemo(
    () => (data ? calculateMonthlyPnl(data.transactions, activeYear) : []),
    [data, activeYear],
  );
  const summary = useMemo(() => calculateSummary(monthly, selectedMonth), [monthly, selectedMonth]);
  const yearTotal = useMemo(() => calculateTotals(monthly), [monthly]);

  const excluded = useMemo(() => {
    if (!data) return null;
    const rows = data.transactions.filter((t) => t.status !== "included");
    return rows.length ? { count: rows.length, revenue: calculateTotals(rows).revenue } : null;
  }, [data]);

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={() => load(false)} />;

  const periodLabel = selectedMonth
    ? `${MONTH_LONG[selectedMonth - 1]} ${activeYear}`
    : `Full year ${activeYear}`;

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            P&amp;L Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={years.map((y) => ({ label: String(y), value: String(y) }))}
              value={String(activeYear)}
              onValueChange={(v) => v && setYear(Number(v))}
            >
              <SelectTrigger aria-label="Year" className="h-9 min-w-24 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={[
                { label: "All Months", value: ALL_MONTHS },
                ...MONTH_LONG.map((m, i) => ({ label: m, value: String(i + 1) })),
              ]}
              value={month}
              onValueChange={(v) => v && setMonth(v)}
            >
              <SelectTrigger aria-label="Month" className="h-9 min-w-36 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MONTHS}>All Months</SelectItem>
                {MONTH_LONG.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 md:flex-col md:items-end md:gap-2">
          <p className="text-sm text-muted-foreground">
            Last Updated:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatDateTime(data.fetchedAt)}
            </span>
          </p>
          <Button
            variant="outline"
            className="h-9 bg-card"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive" className="bg-card">
          <AlertTriangle />
          <AlertTitle>Refresh failed — showing the last loaded data.</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PnlSummaryCards figures={summary} periodLabel={periodLabel} />

      <MonthlyPnlChart rows={monthly} year={activeYear} selectedMonth={selectedMonth} />

      <MonthlyPnlTable
        rows={monthly}
        total={yearTotal}
        year={activeYear}
        selectedMonth={selectedMonth}
      />

      {excluded && (
        <Alert className="bg-card">
          <Info />
          <AlertTitle>
            {excluded.count} row{excluded.count === 1 ? "" : "s"} not included in the monthly P&amp;L
          </AlertTitle>
          <AlertDescription>
            These rows have a blank or unreadable &lsquo;{data.columns.period}&rsquo; value, so they
            can&rsquo;t be placed in a month ({formatTHB(excluded.revenue)} revenue). Choose
            &ldquo;No month&rdquo; under Transaction Details to review them.
          </AlertDescription>
        </Alert>
      )}

      <TransactionTable
        headers={data.headers}
        columns={data.columns}
        transactions={data.transactions}
        year={activeYear}
        month={selectedMonth}
      />

      <footer className="pb-4 text-xs text-muted-foreground">
        Source: Google Sheets · Month from &lsquo;{data.columns.period}&rsquo; · Revenue from
        &lsquo;{data.columns.revenue}&rsquo; · Cost from &lsquo;{data.columns.cost}&rsquo; ·{" "}
        {data.stats.transactions} rows read
        {data.stats.continuationRows > 0 &&
          ` (${data.stats.continuationRows} extra cost lines grouped with the row above)`}
      </footer>
    </main>
  );
}

function LoadingState() {
  return (
    <main
      className="mx-auto w-full min-w-0 max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      aria-busy="true"
    >
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">P&amp;L Dashboard</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          Loading P&amp;L data...
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-card" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl bg-card" />
      <Skeleton className="h-72 rounded-xl bg-card" />
    </main>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <h1 className="text-lg font-semibold">Unable to load P&amp;L data.</h1>
          <p className="text-sm text-muted-foreground">
            Please check the Google Sheets connection.
          </p>
          {message && (
            <p className="w-full rounded-md bg-muted px-3 py-2 text-xs break-words text-muted-foreground">
              {message}
            </p>
          )}
          <Button onClick={onRetry} className="mt-1">
            <RefreshCw />
            Retry
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
