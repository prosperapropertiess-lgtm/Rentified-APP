export function money(amount: number | string | null | undefined) {
  const n = Number(amount ?? 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Rent dates are calendar dates, not exact instants — they're stored as UTC
// timestamps (date-only values default to UTC midnight), so reading them
// with local Date methods (toLocaleDateString, getMonth, etc.) rolls them
// back a day in any timezone west of UTC. Always read with UTC accessors.
export function monthDay(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function monthYear(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
