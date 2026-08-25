export function money(amount: number | string | null | undefined) {
  const n = Number(amount ?? 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
