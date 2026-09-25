import type {
  DetectedColumns,
  NormalizationStats,
  Period,
  Transaction,
  TransactionStatus,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Value parsers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Parse a spreadsheet cell into a number.
 * Handles: "1,250,000", "฿1,250,000.00", "THB 500", " 42 ", "-1,000",
 * "(1,000)" (accounting negative), numbers, null/undefined/blank → null.
 */
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;

  let s = String(value).trim();
  if (s === "" || s === "-" || s === "—") return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }

  s = s.replace(/฿|THB|บาท|\s|,/gi, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }

  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const EN_MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

const TH_MONTHS: Record<string, number> = {
  "ม.ค.": 1, "มกราคม": 1, "ก.พ.": 2, "กุมภาพันธ์": 2, "มี.ค.": 3, "มีนาคม": 3,
  "เม.ย.": 4, "เมษายน": 4, "พ.ค.": 5, "พฤษภาคม": 5, "มิ.ย.": 6, "มิถุนายน": 6,
  "ก.ค.": 7, "กรกฎาคม": 7, "ส.ค.": 8, "สิงหาคม": 8, "ก.ย.": 9, "กันยายน": 9,
  "ต.ค.": 10, "ตุลาคม": 10, "พ.ย.": 11, "พฤศจิกายน": 11, "ธ.ค.": 12, "ธันวาคม": 12,
};

const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

/** Two-digit years → 20xx; Buddhist-era years (e.g. 2569) → CE. */
function normalizeYear(raw: string, buddhistShort = false): number | null {
  let year = Number(raw);
  if (!Number.isInteger(year)) return null;
  if (raw.length <= 2) year = buddhistShort ? 2500 + year - 543 : 2000 + year;
  if (year > 2400) year -= 543;
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : null;
}

function validDate(year: number | null, month: number, day: number): Date | null {
  if (year === null || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects overflow such as 31/02 rolling into March.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

/**
 * Parse a full date. Supports ISO (2026-09-25, 2026/09/25) and day-first
 * dates as used in Thailand (25/09/2026, 25-09-2569). Returns a UTC date or
 * null if the value is blank or invalid (e.g. a mistyped year like 0206).
 */
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return validDate(normalizeYear(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return validDate(normalizeYear(m[3]), Number(m[2]), Number(m[1]));

  return null;
}

/**
 * Parse the cell that decides which month a row belongs to.
 * Accepts month labels ("Jan-26", "Aug26", "Jul 26", "September 2026",
 * "ม.ค. 69"), year-month ("2026-09") and full dates ("2026-09-25", "25/09/2026").
 */
export function parsePeriod(value: unknown): Period | null {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  if (!s) return null;

  // "Jan-26", "Aug26", "Jul 26", "September 2026", "Sep'26"
  let m = s.match(/^([A-Za-z]{3,9})\.?[\s\-/'’]*(\d{2}|\d{4})$/);
  if (m) {
    const month = EN_MONTHS[m[1].toLowerCase()];
    const year = normalizeYear(m[2]);
    return month && year ? { year, month } : null;
  }

  // "ม.ค. 69", "มกราคม 2569"
  m = s.match(/^([฀-๿.]+)\s*(\d{2}|\d{4})$/);
  if (m) {
    const month = TH_MONTHS[m[1]];
    const year = normalizeYear(m[2], true);
    return month && year ? { year, month } : null;
  }

  // "2026-09", "2026/9"
  m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) {
    const year = normalizeYear(m[1]);
    const month = Number(m[2]);
    return year && month >= 1 && month <= 12 ? { year, month } : null;
  }

  const date = parseDate(s);
  return date ? { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 } : null;
}

/* -------------------------------------------------------------------------- */
/*  Header detection                                                          */
/* -------------------------------------------------------------------------- */

/** Lowercase and turn punctuation into spaces: "Est. Revenue" → "est revenue". */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[._:/\\()\[\]\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Alias lists in priority order. The period aliases put month-style columns
 * ahead of plain dates because a "Progress Monthly" column is the month the
 * work is recognised in, which is what the P&L should be grouped by.
 */
const COLUMN_ALIASES = {
  period: [
    "progress monthly", "month", "period", "เดือน", "date", "transaction date",
    "วันที่", "invoice date", "doc date", "posting date",
  ],
  revenue: [
    "revenue", "est revenue", "estimated revenue", "income", "รายได้", "sales",
    "ยอดขาย", "total revenue",
  ],
  cost: [
    "cost", "est cost", "estimated cost", "expense", "expenses", "ต้นทุน",
    "ค่าใช้จ่าย", "total cost",
  ],
  description: [
    "description", "project name description", "project name", "project",
    "รายละเอียด", "รายการ", "detail", "details",
  ],
} as const;

/** Headers that mention a keyword but are clearly not the value column. */
const EXCLUDED_HEADER = /margin|หมายเหตุ|note|remark|comment|%/i;

/** Display names used in error messages, as the requirement specifies. */
const REQUIRED_LABEL = { period: "Date", revenue: "Revenue", cost: "Cost" } as const;

export class SheetFormatError extends Error {}

function findColumn(headers: string[], aliases: readonly string[]): string | null {
  const normalized = headers.map((h) => ({ header: h, key: normalizeHeader(h) }));

  // 1. Exact match, alias order = priority.
  for (const alias of aliases) {
    const hit = normalized.find((h) => h.key === alias);
    if (hit) return hit.header;
  }

  // 2. Whole-word "contains" match, skipping note/margin columns.
  for (const alias of aliases) {
    const pattern = new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
    const hit = normalized.find(
      (h) => !EXCLUDED_HEADER.test(h.header) && pattern.test(h.key),
    );
    if (hit) return hit.header;
  }
  return null;
}

export function detectColumns(headers: string[]): DetectedColumns {
  const period = findColumn(headers, COLUMN_ALIASES.period);
  const revenue = findColumn(headers, COLUMN_ALIASES.revenue);
  const cost = findColumn(headers, COLUMN_ALIASES.cost);

  const missing = (
    [["period", period], ["revenue", revenue], ["cost", cost]] as const
  ).find(([, found]) => !found);
  if (missing) {
    throw new SheetFormatError(
      `Required column '${REQUIRED_LABEL[missing[0]]}' was not found in Google Sheets.`,
    );
  }

  return {
    period: period!,
    revenue: revenue!,
    cost: cost!,
    description: findColumn(headers, COLUMN_ALIASES.description),
  };
}

/** Blank headers become "Column N"; duplicates get " (2)", " (3)"… */
export function dedupeHeaders(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((h, i) => {
    const base = h.replace(/\s+/g, " ").trim() || `Column ${i + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

/* -------------------------------------------------------------------------- */
/*  Row normalization                                                         */
/* -------------------------------------------------------------------------- */

const SUMMARY_CELL = /^(grand\s*)?total$|^sub\s*total$|^รวม(ทั้งสิ้น|ทั้งหมด)?$/i;

type RowKind = "empty" | "summary" | "data";

function classifyRow(cells: string[]): RowKind {
  if (cells.every((c) => c === "")) return "empty";
  if (cells.some((c) => SUMMARY_CELL.test(c))) return "summary";
  return "data";
}

export interface NormalizeContext {
  columns: DetectedColumns;
  /** The last non-continuation transaction; continuation rows inherit its period. */
  previous: Transaction | null;
}

/**
 * Turn one CSV record into a Transaction, or null if the row carries no
 * financial data (blank line, a numbered row with nothing in it, etc.).
 */
export function normalizeTransaction(
  record: Record<string, string>,
  sheetRow: number,
  ctx: NormalizeContext,
): Transaction | null {
  const { columns, previous } = ctx;
  const revenue = parseNumber(record[columns.revenue]);
  const cost = parseNumber(record[columns.cost]);
  const periodCell = record[columns.period] ?? "";
  const description = columns.description ? record[columns.description] ?? "" : "";

  if (revenue === null && cost === null && !description) return null;

  // A cost-only line with no description and no month continues the row above
  // (e.g. a second sub-contractor on the same project).
  const isContinuation =
    previous !== null && revenue === null && !description && !periodCell;

  let period: Period | null;
  let status: TransactionStatus;
  if (isContinuation) {
    period = previous.period;
    status = previous.status;
  } else {
    period = parsePeriod(periodCell);
    status = period ? "included" : periodCell ? "invalid-period" : "unscheduled";
  }

  return {
    id: String(sheetRow),
    sheetRow,
    period,
    status,
    revenue: revenue ?? 0,
    cost: cost ?? 0,
    isContinuation,
    raw: record,
  };
}

export interface NormalizedSheet {
  headers: string[];
  columns: DetectedColumns;
  transactions: Transaction[];
  stats: NormalizationStats;
}

/**
 * Convert parsed CSV rows (first row = headers) into validated transactions.
 * Throws SheetFormatError if the sheet is empty or required columns are missing.
 */
export function normalizeSheet(rows: string[][]): NormalizedSheet {
  const headerIndex = rows.findIndex((r) => r.some((c) => c.trim() !== ""));
  if (headerIndex === -1) {
    throw new SheetFormatError("The Google Sheet is empty.");
  }

  const headers = dedupeHeaders(rows[headerIndex]);
  const columns = detectColumns(headers);

  const stats: NormalizationStats = {
    sourceRows: 0,
    transactions: 0,
    continuationRows: 0,
    skippedEmptyRows: 0,
    skippedSummaryRows: 0,
    unscheduledRows: 0,
    invalidPeriodRows: 0,
  };

  const transactions: Transaction[] = [];
  let previous: Transaction | null = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const cells = headers.map((_, c) => (rows[i][c] ?? "").trim());
    stats.sourceRows++;

    const kind = classifyRow(cells);
    if (kind === "empty") {
      stats.skippedEmptyRows++;
      continue;
    }
    if (kind === "summary") {
      stats.skippedSummaryRows++;
      continue;
    }

    const record = Object.fromEntries(headers.map((h, c) => [h, cells[c]]));
    const tx = normalizeTransaction(record, i + 1, { columns, previous });
    if (!tx) {
      stats.skippedEmptyRows++;
      continue;
    }

    transactions.push(tx);
    if (tx.isContinuation) stats.continuationRows++;
    else previous = tx;
    if (tx.status === "unscheduled") stats.unscheduledRows++;
    if (tx.status === "invalid-period") stats.invalidPeriodRows++;
  }

  stats.transactions = transactions.length;
  return { headers, columns, transactions, stats };
}
