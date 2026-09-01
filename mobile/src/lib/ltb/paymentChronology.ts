// Payment chronology for N8 (persistent late payment) — spec section 23.
// This deliberately only classifies each period's payment behavior; it
// never concludes the legal threshold for "persistent" is met. That
// judgment call is left to the landlord (see n8Workflow.ts's required
// grounds explanation field).

export type ChronologyStatus = 'on_time' | 'partially_late' | 'late' | 'unpaid';

export interface PaymentChronologyRow {
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  classification: string;
}

export interface ChronologyEntry {
  periodLabel: string;
  dueDate: string;
  paidAt: string | null;
  amountDue: number;
  status: ChronologyStatus;
}

const RENT_ELIGIBLE_CLASSIFICATIONS = new Set(['RENT', 'PARKING_AS_RENT', 'OTHER_RECURRING_RENT']);

function monthLabel(dueDate: string): string {
  const [y, m] = dueDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', timeZone: 'UTC' });
}

function classify(row: PaymentChronologyRow): ChronologyStatus {
  if (row.status === 'pending' || row.status === 'overdue') return 'unpaid';
  if (row.status === 'partial') return 'partially_late';
  // status === 'paid'
  if (!row.paid_at) return 'on_time'; // no paid_at recorded — nothing to compare against
  return row.paid_at.slice(0, 10) > row.due_date ? 'late' : 'on_time';
}

export function buildPaymentChronology(rows: PaymentChronologyRow[]): ChronologyEntry[] {
  return rows
    .filter((r) => RENT_ELIGIBLE_CLASSIFICATIONS.has(r.classification))
    .slice()
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((r) => ({
      periodLabel: monthLabel(r.due_date),
      dueDate: r.due_date,
      paidAt: r.paid_at,
      amountDue: Number(r.amount),
      status: classify(r),
    }));
}

export function countLatePeriods(entries: ChronologyEntry[]): number {
  return entries.filter((e) => e.status === 'late' || e.status === 'partially_late' || e.status === 'unpaid').length;
}
