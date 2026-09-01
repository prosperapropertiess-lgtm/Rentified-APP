// Display-only balance/state derivation for the Rent Collection dashboard
// — spec B section 1.1's possible payment states. This mirrors the
// `calculateBalance` logic inside the `rent-reminders` edge function
// (kept in sync manually, same pattern as the LTB edge function) but is
// NEVER the authority for actually sending a reminder — the edge
// function re-derives this itself server-side before every send,
// per spec section 1.9 (payment arrives before send) and 4.5
// ("Do NOT trust client-provided outstanding balance").

export type RentState = 'NOT_DUE' | 'DUE_TODAY' | 'PAID' | 'PARTIAL' | 'OUTSTANDING' | 'OVERDUE';

export interface PaymentRow {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  classification: string;
  paid_at: string | null;
}

export interface BalanceResult {
  totalOwing: number;
  totalCharged: number;
  totalPaid: number;
  state: RentState;
  mostRecentPaidAt: string | null;
  latestDueDate: string | null;
}

const RENT_ELIGIBLE = new Set(['RENT', 'PARKING_AS_RENT', 'OTHER_RECURRING_RENT']);

export function calculateBalance(rows: PaymentRow[]): BalanceResult {
  const eligible = rows.filter((r) => RENT_ELIGIBLE.has(r.classification));
  const today = new Date().toISOString().slice(0, 10);
  let totalOwing = 0;
  let totalCharged = 0;
  let totalPaid = 0;
  let mostRecentPaidAt: string | null = null;
  let latestDueDate: string | null = null;

  const sorted = [...eligible].sort((a, b) => a.due_date.localeCompare(b.due_date));
  for (const r of sorted) {
    const charged = Number(r.amount);
    const paid = r.status === 'paid' || r.status === 'partial' ? charged : 0;
    // A charge due in the future isn't "owing" yet just because no
    // payment has been recorded — only count pending/overdue balances
    // for periods that have actually come due.
    const isDueNow = r.due_date <= today;
    const owingForThisRow = (r.status === 'pending' || r.status === 'overdue') && isDueNow ? charged : 0;
    totalCharged += charged;
    totalPaid += paid;
    totalOwing += owingForThisRow;
    if (r.paid_at && (!mostRecentPaidAt || r.paid_at > mostRecentPaidAt)) mostRecentPaidAt = r.paid_at;
    latestDueDate = r.due_date;
  }

  const anyDueRows = eligible.some((r) => r.due_date <= today);

  let state: RentState;
  if (!anyDueRows) {
    // Nothing has come due yet — a future-dated pending charge is not
    // the same as an unpaid one, regardless of its raw status flag.
    state = 'NOT_DUE';
  } else if (totalOwing > 0 && totalPaid > 0) {
    // Distinguishing "paid something but not enough" from "paid
    // nothing" is spec-required (section 1.8) — this is the signal for
    // it, not the raw row status (a real partial payment is commonly
    // recorded as a 'partial' row for the collected amount PLUS a
    // separate 'pending' row for the remainder, so checking only the
    // most recent row's status misses it entirely).
    state = 'PARTIAL';
  } else if (totalOwing <= 0) {
    state = 'PAID';
  } else if (latestDueDate === today) {
    state = 'DUE_TODAY';
  } else {
    state = 'OVERDUE';
  }

  return { totalOwing, totalCharged, totalPaid, state, mostRecentPaidAt, latestDueDate };
}

export const RENT_STATE_LABELS: Record<RentState, string> = {
  NOT_DUE: 'Not Due',
  DUE_TODAY: 'Due Today',
  PAID: 'Paid',
  PARTIAL: 'Partial',
  OUTSTANDING: 'Outstanding',
  OVERDUE: 'Overdue',
};

export const RENT_STATE_COLORS: Record<RentState, { color: string; bg: string }> = {
  NOT_DUE: { color: '#64748b', bg: '#F1F5F9' },
  DUE_TODAY: { color: '#B45309', bg: '#FEF3C7' },
  PAID: { color: '#166534', bg: '#DCFCE7' },
  PARTIAL: { color: '#B45309', bg: '#FEF3C7' },
  OUTSTANDING: { color: '#B45309', bg: '#FEF3C7' },
  OVERDUE: { color: '#8B2030', bg: '#FCE7EA' },
};

export function isEligibleForReminder(state: RentState): boolean {
  return state === 'OUTSTANDING' || state === 'OVERDUE' || state === 'PARTIAL' || state === 'DUE_TODAY';
}
