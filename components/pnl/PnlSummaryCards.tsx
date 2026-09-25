import { Coins, Percent, Receipt, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPercent, formatTHB } from "@/lib/format";
import type { PnlFigures } from "@/lib/types";

interface CardSpec {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Mark identity (matches the chart series) – text itself stays neutral. */
  accent: string;
  negative?: boolean;
}

export function PnlSummaryCards({
  figures,
  periodLabel,
}: {
  figures: PnlFigures;
  periodLabel: string;
}) {
  const cards: CardSpec[] = [
    { label: "Revenue", value: formatTHB(figures.revenue), icon: Coins, accent: "bg-revenue" },
    { label: "Cost", value: formatTHB(figures.cost), icon: Receipt, accent: "bg-cost" },
    {
      label: "Margin",
      value: formatTHB(figures.margin),
      icon: TrendingUp,
      accent: "bg-margin",
      negative: figures.margin < 0,
    },
    {
      label: "% Margin",
      value: formatPercent(figures.marginPct),
      icon: Percent,
      accent: "bg-foreground/60",
      negative: figures.marginPct < 0,
    },
  ];

  return (
    <section aria-label="Executive summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, accent, negative }) => (
        <Card key={label} className="shadow-sm ring-foreground/[0.07]">
          <CardContent className="space-y-3 px-5 py-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className={cn("size-2.5 rounded-full", accent)} aria-hidden />
                {label}
              </span>
              <Icon className="size-4 text-muted-foreground/70" aria-hidden />
            </div>
            <p
              className={cn(
                "text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.75rem]",
                negative ? "text-negative" : "text-foreground",
              )}
            >
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
