export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const safe = (value: number) => (Number.isFinite(value) ? value : 0);

/** ฿1,250,000 — whole baht, sign in front of the symbol for negatives. */
export function formatTHB(value: number): string {
  const n = Math.round(safe(value));
  const body = `฿${integerFormatter.format(Math.abs(n))}`;
  return n < 0 ? `-${body}` : body;
}

/** ฿1.25M / ฿350K — for chart axes where space is tight. */
export function formatCompactTHB(value: number): string {
  const n = safe(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}฿${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}฿${trim(abs / 1_000)}K`;
  return `${sign}฿${Math.round(abs)}`;
}

function trim(n: number): string {
  return n.toFixed(n >= 10 ? 0 : 1).replace(/\.0$/, "");
}

/** 35.5% — always one decimal, never NaN/Infinity. */
export function formatPercent(value: number): string {
  return `${safe(value).toFixed(1)}%`;
}

export function formatPeriodShort(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

export function formatPeriodLong(year: number, month: number): string {
  return `${MONTH_LONG[month - 1]} ${year}`;
}

/** 25 Sep 2026 08:30 (Bangkok time). */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  // Shift to Bangkok time (UTC+7, no DST) and format by hand: en-GB prints "Sept".
  const bkk = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(bkk.getUTCDate())} ${MONTH_SHORT[bkk.getUTCMonth()]} ${bkk.getUTCFullYear()} ${pad(bkk.getUTCHours())}:${pad(bkk.getUTCMinutes())}`;
}
