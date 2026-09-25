import type { NextRequest } from "next/server";
import { loadPnlSheet, SheetConnectionError } from "@/lib/google-sheet";
import { SheetFormatError } from "@/lib/normalize";
import type { PnlErrorResponse, PnlSuccessResponse } from "@/lib/types";

/**
 * GET /api/pnl            → normalized sheet data (sheet cached ~60s on the server)
 * GET /api/pnl?refresh=1  → bypasses the cache and re-downloads the sheet
 */
export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.has("refresh");

  try {
    const sheet = await loadPnlSheet({ force });
    const body: PnlSuccessResponse = {
      error: false,
      fetchedAt: new Date().toISOString(),
      ...sheet,
    };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const known = err instanceof SheetFormatError || err instanceof SheetConnectionError;
    if (!known) console.error("[api/pnl] Unexpected error", err);

    const body: PnlErrorResponse = {
      error: true,
      message: known
        ? (err as Error).message
        : "Unexpected error while processing the Google Sheets data.",
    };
    const status = err instanceof SheetFormatError ? 422 : 502;
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  }
}
