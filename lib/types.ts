/** A calendar month in a specific year. `month` is 1–12. */
export interface Period {
  year: number;
  month: number;
}

/**
 * Why a row does or does not count toward the monthly P&L.
 * - included:       has a valid month and is counted
 * - unscheduled:    the month cell is blank, so it can't be placed in a month
 * - invalid-period: the month cell has a value that couldn't be parsed
 * - cancelled:      the month cell marks the PO as cancelled (e.g. "ยกเลิก PO")
 */
export type TransactionStatus = "included" | "unscheduled" | "invalid-period" | "cancelled";

export interface Transaction {
  /** Stable id for tables/keys (sheet row number as string). */
  id: string;
  /** 1-based row number as it appears in Google Sheets (header = row 1). */
  sheetRow: number;
  period: Period | null;
  status: TransactionStatus;
  revenue: number;
  cost: number;
  /**
   * True when the row only carries extra cost lines (e.g. an additional
   * sub-contractor) for the transaction above it. It inherits that row's period.
   */
  isContinuation: boolean;
  /** Original cell values keyed by (de-duplicated) sheet header. */
  raw: Record<string, string>;
}

export interface DetectedColumns {
  period: string;
  revenue: string;
  cost: string;
  description: string | null;
  /** Purchase order number column, if present. */
  poNumber: string | null;
  /** Invoice number column, if present. A PO with an invoice number has been billed. */
  invoiceNumber: string | null;
}

export interface NormalizationStats {
  sourceRows: number;
  transactions: number;
  continuationRows: number;
  skippedEmptyRows: number;
  skippedSummaryRows: number;
  unscheduledRows: number;
  invalidPeriodRows: number;
  cancelledRows: number;
}

export interface PnlSuccessResponse {
  error: false;
  fetchedAt: string;
  headers: string[];
  columns: DetectedColumns;
  stats: NormalizationStats;
  transactions: Transaction[];
}

export interface PnlErrorResponse {
  error: true;
  message: string;
}

export type PnlApiResponse = PnlSuccessResponse | PnlErrorResponse;

export interface PnlFigures {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

export interface PoSummary {
  /** Unique PO numbers in the period. */
  poCount: number;
  /** Unique POs that have an invoice number on at least one of their rows. */
  invoicedCount: number;
  notInvoicedCount: number;
  /** Share of POs (by count) that are invoiced, 0–100. */
  invoicedPct: number;
  poRevenue: number;
  invoicedRevenue: number;
  notInvoicedRevenue: number;
}

export interface MonthlyPnlRow extends PnlFigures {
  month: number;
  year: number;
  /** Short label for axes and tables, e.g. "Jan". */
  label: string;
  transactionCount: number;
}
