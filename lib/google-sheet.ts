import "server-only";
import Papa from "papaparse";
import { revalidateTag } from "next/cache";
import { normalizeSheet, type NormalizedSheet } from "./normalize";

/** Cache tag for the published CSV, so Refresh can invalidate it. */
const SHEET_CACHE_TAG = "pnl-google-sheet";
/** Seconds a cached copy of the sheet may be served before refetching. */
export const SHEET_REVALIDATE_SECONDS = 60;

export class SheetConnectionError extends Error {}

/** The only place the data source URL is read. */
function getSheetCsvUrl(): string {
  const url = process.env.GOOGLE_SHEET_CSV_URL?.trim();
  if (!url) {
    throw new SheetConnectionError(
      "GOOGLE_SHEET_CSV_URL is not set. Add it to .env.local (see .env.example).",
    );
  }
  return url;
}

/**
 * Download the published CSV. Normal loads are cached for 60 seconds;
 * `force` invalidates the cache and goes straight to Google.
 */
export async function fetchSheetCsv({ force = false } = {}): Promise<string> {
  const url = getSheetCsvUrl();

  if (force) revalidateTag(SHEET_CACHE_TAG, { expire: 0 });

  let res: Response;
  try {
    res = await fetch(
      url,
      force
        ? { cache: "no-store" }
        : { next: { revalidate: SHEET_REVALIDATE_SECONDS, tags: [SHEET_CACHE_TAG] } },
    );
  } catch (err) {
    throw new SheetConnectionError(
      `Could not reach Google Sheets (${err instanceof Error ? err.message : "network error"}).`,
    );
  }

  if (!res.ok) {
    throw new SheetConnectionError(`Google Sheets responded with HTTP ${res.status}.`);
  }

  const text = await res.text();
  // An unpublished or private sheet returns an HTML sign-in page instead of CSV.
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new SheetConnectionError(
      "Google Sheets returned a web page instead of CSV. Make sure the sheet is published to the web as CSV.",
    );
  }
  return text;
}

export function parseCsv(text: string): string[][] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
  // Papa reports recoverable issues (e.g. ragged rows) as errors; rows are still usable.
  return result.data.filter((row) => Array.isArray(row));
}

/** Google Sheets → CSV parser → normalized transactions. */
export async function loadPnlSheet({ force = false } = {}): Promise<NormalizedSheet> {
  const csv = await fetchSheetCsv({ force });
  return normalizeSheet(parseCsv(csv));
}
