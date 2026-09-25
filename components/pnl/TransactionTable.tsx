"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortFn,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPeriodShort, MONTH_LONG } from "@/lib/format";
import { parseNumber } from "@/lib/normalize";
import type { DetectedColumns, Transaction } from "@/lib/types";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const helper = createColumnHelper<typeof features, Transaction>();

type SortValue = number | string | undefined;

/** Numbers compare numerically, text with Thai-aware natural ordering. */
const compareValues: SortFn<typeof features, Transaction> = (a, b, columnId) => {
  const x = a.getValue<SortValue>(columnId);
  const y = b.getValue<SortValue>(columnId);
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x).localeCompare(String(y), "th", { numeric: true, sensitivity: "base" });
};

const PAGE_SIZES = [10, 25, 50, 100];

type Scope = "period" | "no-month" | "all";

/** A column is numeric if most filled cells are amounts like "1,250.00". */
function detectNumericHeaders(headers: string[], rows: Transaction[]): Set<string> {
  const numeric = new Set<string>();
  for (const h of headers) {
    const values = rows.map((r) => r.raw[h]).filter(Boolean);
    if (!values.length) continue;
    const amounts = values.filter((v) => parseNumber(v) !== null);
    const formatted = values.some((v) => /[,.฿]/.test(v));
    if (formatted && amounts.length / values.length >= 0.8) numeric.add(h);
  }
  return numeric;
}

function periodLabel(tx: Transaction): string {
  if (tx.period) return formatPeriodShort(tx.period.year, tx.period.month);
  return tx.status === "invalid-period" ? "Invalid month" : "No month";
}

export function TransactionTable({
  headers,
  columns: detected,
  transactions,
  year,
  month,
}: {
  headers: string[];
  columns: DetectedColumns;
  transactions: Transaction[];
  year: number;
  month: number | null;
}) {
  const [scope, setScope] = useState<Scope>("period");
  const [query, setQuery] = useState("");

  const numericHeaders = useMemo(
    () => detectNumericHeaders(headers, transactions),
    [headers, transactions],
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor((tx) => tx.sheetRow, {
          id: "__row",
          header: "Row",
          sortFn: compareValues,
          cell: (info) => (
            <span className="text-muted-foreground tabular-nums">{info.getValue()}</span>
          ),
        }),
        helper.accessor(
          (tx): SortValue => (tx.period ? tx.period.year * 100 + tx.period.month : undefined),
          {
            id: "__period",
            header: "P&L Month",
            sortFn: compareValues,
            sortUndefined: "last",
            cell: (info) => {
              const tx = info.row.original;
              return (
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  {tx.period ? (
                    <span className="font-medium">{periodLabel(tx)}</span>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      {periodLabel(tx)}
                    </Badge>
                  )}
                  {tx.isContinuation && (
                    <Badge variant="secondary" title="Extra cost line for the row above">
                      + cost line
                    </Badge>
                  )}
                </div>
              );
            },
          },
        ),
        ...headers.map((h) =>
          helper.accessor(
            (tx): SortValue => {
              const raw = tx.raw[h];
              if (!raw) return undefined;
              return numericHeaders.has(h) ? parseNumber(raw) ?? undefined : raw;
            },
            {
              id: h,
              header: h,
              sortFn: compareValues,
              sortUndefined: "last",
              cell: (info) => info.row.original.raw[h] ?? "",
            },
          ),
        ),
      ]),
    [headers, numericHeaders],
  );

  const scopedLabel = month ? formatPeriodShort(year, month) : String(year);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (scope === "period") {
        if (!tx.period || tx.status !== "included" || tx.period.year !== year) return false;
        if (month && tx.period.month !== month) return false;
      } else if (scope === "no-month" && tx.status === "included") {
        return false;
      }
      if (!q) return true;
      return (
        periodLabel(tx).toLowerCase().includes(q) ||
        Object.values(tx.raw).some((v) => v.toLowerCase().includes(q))
      );
    });
  }, [transactions, scope, query, year, month]);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (tx) => tx.id,
    enableSortingRemoval: true,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  const { pageIndex, pageSize } = table.state.pagination;
  const total = data.length;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);
  const pageCount = Math.max(1, table.getPageCount());

  const isNumeric = (id: string) =>
    numericHeaders.has(id) || id === detected.revenue || id === detected.cost;
  const isWide = (id: string) => id === detected.description;

  return (
    <Card className="shadow-sm ring-foreground/[0.07]">
      <CardHeader className="gap-3 px-5">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Transaction Details</CardTitle>
          <CardDescription>Original rows from Google Sheets</CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search transactions"
              className="h-9 pl-8"
            />
          </div>
          <Select
            items={[
              { label: `Selected period (${scopedLabel})`, value: "period" },
              { label: "No month", value: "no-month" },
              { label: "All rows", value: "all" },
            ]}
            value={scope}
            onValueChange={(v) => v && setScope(v as Scope)}
          >
            <SelectTrigger aria-label="Filter rows" className="h-9 sm:min-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="period">
                Selected period ({month ? `${MONTH_LONG[month - 1]} ${year}` : year})
              </SelectItem>
              <SelectItem value="no-month">No month</SelectItem>
              <SelectItem value="all">All rows</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        <Table className="text-[13px]">
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const numeric = isNumeric(header.column.id);
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                      }
                      className={cn("first:pl-5 last:pr-5", numeric && "text-right")}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm whitespace-nowrap hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                          numeric && "flex-row-reverse",
                        )}
                      >
                        <table.FlexRender header={header} />
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="py-10 pl-5 text-left text-muted-foreground sm:text-center"
                >
                  No transactions match.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => {
                    const id = cell.column.id;
                    const text = row.original.raw[id];
                    return (
                      <TableCell
                        key={cell.id}
                        title={isWide(id) ? text : undefined}
                        className={cn(
                          "align-top first:pl-5 last:pr-5",
                          isNumeric(id) && "text-right tabular-nums",
                          isWide(id)
                            ? "max-w-[360px] min-w-[260px] whitespace-normal"
                            : "max-w-[240px] truncate",
                        )}
                      >
                        {isWide(id) ? (
                          <span className="line-clamp-2">{text}</span>
                        ) : (
                          <table.FlexRender cell={cell} />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 border-t px-5 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page</span>
            <Select
              items={PAGE_SIZES.map((n) => ({ label: String(n), value: String(n) }))}
              value={String(pageSize)}
              onValueChange={(v) => v && table.setPageSize(Number(v))}
            >
              <SelectTrigger aria-label="Rows per page" size="sm" className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <span className="text-muted-foreground tabular-nums">
              {from}–{to} of {total} · Page {pageIndex + 1} of {pageCount}
            </span>
            <div className="flex items-center gap-1">
              <PagerButton label="First page" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronsLeft />
              </PagerButton>
              <PagerButton label="Previous page" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft />
              </PagerButton>
              <PagerButton label="Next page" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <ChevronRight />
              </PagerButton>
              <PagerButton label="Last page" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
                <ChevronsRight />
              </PagerButton>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PagerButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button variant="outline" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
