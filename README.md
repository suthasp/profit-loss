# P&L Dashboard

A profit & loss dashboard built with Next.js. It reads a published Google Sheets CSV (no database) and shows revenue, cost, margin and % margin by month.

Open **`/dashboard/pnl`** (the root `/` redirects there).

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Recharts · TanStack Table · lucide-react · PapaParse

## Getting started

```bash
npm install
cp .env.example .env.local   # then edit if you use a different sheet
npm run dev
```

Then open http://localhost:3000/dashboard/pnl

For production:

```bash
npm run build
npm start
```

## Configuration

The data source is set in one place, the `GOOGLE_SHEET_CSV_URL` environment variable (`.env.local`):

```env
GOOGLE_SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/e/<id>/pub?gid=0&single=true&output=csv"
```

To get this URL in Google Sheets: **File → Share → Publish to web**, pick the sheet, choose **Comma-separated values (.csv)**, and click **Publish**.

The published CSV is public, and the app needs no API keys or credentials. The URL is read only on the server (`lib/google-sheet.ts`) and is never sent to the browser.

## How it works

```
Browser ──► GET /api/pnl ──► Google Sheets CSV
                 │
                 ├─ CSV parser        (PapaParse)
                 ├─ Normalize data    (lib/normalize.ts)
                 └─ JSON ──► Dashboard ──► Calculate P&L (lib/pnl-calculation.ts)
```

- **Caching:** the server caches the sheet for 60 seconds, so the browser never calls Google directly.
- **Refresh:** the **Refresh** button calls `/api/pnl?refresh=1`, which clears that cache and downloads the sheet again.

### Column detection

Columns are found by header name, not by position. Aliases are listed in priority order in `lib/normalize.ts` (`COLUMN_ALIASES`):

| Purpose | Accepted headers (examples) |
|---|---|
| Month / date | Progress Monthly, Month, Period, เดือน, Date, Transaction Date, วันที่ |
| Revenue | Revenue, Est. Revenue, Income, รายได้, Sales |
| Cost | Cost, Est. Cost, Expense, ต้นทุน, ค่าใช้จ่าย |
| Description (optional) | Project Name / Description, Description, รายละเอียด |

Matching ignores case and punctuation. Columns such as `Margin`, `Margin %` or `หมายเหตุ Cost` are never mistaken for Revenue or Cost.

If a required column is missing, the API responds with HTTP 422:

```json
{ "error": true, "message": "Required column 'Revenue' was not found in Google Sheets." }
```

### Data rules

- **Numbers:** `1,250,000`, `฿1,250,000.00`, `-500` and `(1,000)` are all accepted. A blank or non-numeric cell counts as 0.
- **Month values:** `Jan-26`, `Aug26`, `Jul 26`, `September 2026`, `2026-09`, `2026-09-25`, `25/09/2026` and Thai forms such as `ม.ค. 69` are accepted. Buddhist-era years are converted to CE.
- **Invalid dates:** values such as `19/03/0206` are treated as invalid.
- **Blank rows and total rows:** blank rows and `Total` / `Grand Total` / `รวม` rows are skipped.
- **Extra cost lines:** a row with a cost but no description, no revenue and no month is treated as an extra cost line for the row above. It is counted in that row's month.
- **Rows without a month:** rows with a blank or unreadable month stay out of the monthly P&L. The dashboard lists them in a notice and under the **No month** filter in Transaction Details.

### Calculations (`lib/pnl-calculation.ts`)

```
Margin    = Revenue − Cost
Margin %  = Margin ÷ Revenue × 100      (0% when Revenue is 0, never NaN or Infinity)
Totals    = sums of monthly Revenue and Cost; Total % Margin is recalculated from
            those totals, never averaged across months
```

## Project structure

```
app/
├── api/pnl/route.ts          GET /api/pnl → JSON
├── dashboard/pnl/page.tsx    Dashboard page
└── page.tsx                  Redirects to /dashboard/pnl
components/
├── pnl/
│   ├── PnlDashboard.tsx      Data loading, filters, loading/error/refresh states
│   ├── PnlSummaryCards.tsx   Revenue / Cost / Margin / % Margin
│   ├── MonthlyPnlChart.tsx   Bars (Revenue, Cost) + line (Margin), custom tooltip
│   ├── MonthlyPnlTable.tsx   Jan–Dec plus Total (YTD)
│   └── TransactionTable.tsx  Search, filter, sort, pagination (10/25/50/100)
└── ui/                       shadcn/ui components
lib/
├── google-sheet.ts           Fetch and cache the CSV (server only)
├── normalize.ts              parseNumber, parseDate, parsePeriod, header detection, normalizeTransaction
├── pnl-calculation.ts        calculateMonthlyPnl, calculateTotals, margin helpers
├── format.ts                 Amounts (no currency symbol), %, dates
└── types.ts                  Shared types
```
