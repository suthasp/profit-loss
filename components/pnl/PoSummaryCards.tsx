import { FileCheck2, FileClock, FileText, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatPercent, formatTHB } from "@/lib/format";
import type { PoSummary } from "@/lib/types";

interface StatSpec {
  label: string;
  count: number;
  detail: string;
  icon: LucideIcon;
}

/** Unique POs and how many have been invoiced (have an Invoice No.). */
export function PoSummaryCards({
  summary,
  periodLabel,
}: {
  summary: PoSummary;
  periodLabel: string;
}) {
  const stats: StatSpec[] = [
    {
      label: "Purchase Orders",
      count: summary.poCount,
      detail: `${formatTHB(summary.poRevenue)} revenue`,
      icon: FileText,
    },
    {
      label: "Invoiced",
      count: summary.invoicedCount,
      detail: `${formatPercent(summary.invoicedPct)} of POs · ${formatTHB(summary.invoicedRevenue)}`,
      icon: FileCheck2,
    },
    {
      label: "Not Invoiced",
      count: summary.notInvoicedCount,
      detail: `${formatPercent(summary.poCount ? 100 - summary.invoicedPct : 0)} of POs · ${formatTHB(summary.notInvoicedRevenue)}`,
      icon: FileClock,
    },
  ];

  return (
    <section aria-label="PO and invoice status">
      <Card className="shadow-sm ring-foreground/[0.07]">
        <CardContent className="space-y-4 px-5 py-1">
          <div className="grid gap-4 sm:grid-cols-3 sm:divide-x">
            {stats.map(({ label, count, detail, icon: Icon }) => (
              <div key={label} className="space-y-1 sm:pl-4 sm:first:pl-0">
                <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                  {label}
                </p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                  {count.toLocaleString("en-US")}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div
              className="flex h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${summary.invoicedCount} of ${summary.poCount} POs invoiced`}
            >
              <div
                className="h-full rounded-full bg-revenue"
                style={{ width: `${summary.invoicedPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.invoicedCount} of {summary.poCount} POs invoiced · {periodLabel} · counted
              by unique PO No.; invoiced = has an Invoice No.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
