import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPercent, formatTHB } from "@/lib/format";
import type { MonthlyPnlRow, PnlFigures } from "@/lib/types";

export function MonthlyPnlTable({
  rows,
  total,
  year,
  selectedMonth,
}: {
  rows: MonthlyPnlRow[];
  total: PnlFigures;
  year: number;
  selectedMonth: number | null;
}) {
  return (
    <Card className="shadow-sm ring-foreground/[0.07]">
      <CardHeader className="px-5">
        <CardTitle className="text-base font-semibold">Monthly P&amp;L</CardTitle>
        <CardDescription>
          Total % Margin is calculated from total revenue and cost, not averaged across months.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Month</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="pr-5 text-right">% Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const empty = r.transactionCount === 0;
              return (
                <TableRow
                  key={r.month}
                  data-state={r.month === selectedMonth ? "selected" : undefined}
                  className={cn("tabular-nums", empty && "text-muted-foreground/70")}
                >
                  <TableCell className="pl-5 font-medium">{r.label}</TableCell>
                  <TableCell className="text-right">{formatTHB(r.revenue)}</TableCell>
                  <TableCell className="text-right">{formatTHB(r.cost)}</TableCell>
                  <TableCell className={cn("text-right", r.margin < 0 && "text-negative")}>
                    {formatTHB(r.margin)}
                  </TableCell>
                  <TableCell className={cn("pr-5 text-right", r.marginPct < 0 && "text-negative")}>
                    {formatPercent(r.marginPct)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold tabular-nums hover:bg-muted/50">
              <TableCell className="pl-5">Total (YTD {year})</TableCell>
              <TableCell className="text-right">{formatTHB(total.revenue)}</TableCell>
              <TableCell className="text-right">{formatTHB(total.cost)}</TableCell>
              <TableCell className={cn("text-right", total.margin < 0 && "text-negative")}>
                {formatTHB(total.margin)}
              </TableCell>
              <TableCell className={cn("pr-5 text-right", total.marginPct < 0 && "text-negative")}>
                {formatPercent(total.marginPct)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
