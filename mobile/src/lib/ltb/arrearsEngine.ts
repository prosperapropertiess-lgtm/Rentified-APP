// N4 arrears calculator — reuses the existing `payments` table (never a
// duplicate ledger). Only rows classified as rent-for-N4-purposes count
// toward arrears; see spec section 10.

import type { ArrearsResult, RentPeriodBreakdown } from './types';

const RENT_ELIGIBLE_CLASSIFICATIONS = new Set(['RENT', 'PARKING_AS_RENT', 'OTHER_RECURRING_RENT']);

export interface PaymentLedgerRow {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  classification: string;
}

function monthLabel(dueDate: string): string {
  const [y, m] = dueDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** Builds the period-by-period arrears breakdown from real payment rows.
 * Each `payments` row is treated as one rent period/charge — this matches
 * how the app already records rent (see Record Payment / Mark Paid flows).
 * A row counts as "charged" regardless of paid status; "paid" only for
 * rows with status 'paid' or the paid portion implied by 'partial'. */
export function calculateArrears(rows: PaymentLedgerRow[]): ArrearsResult {
  const eligible = rows.filter((r) => RENT_ELIGIBLE_CLASSIFICATIONS.has(r.classification));

  const periods: RentPeriodBreakdown[] = eligible
    .slice()
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((r) => {
      const charged = Number(r.amount);
      // A 'partial' row's stored amount is what was actually collected
      // (see payments.tsx's handling elsewhere in this app) — so for a
      // partial row the "charged" figure isn't recoverable from this row
      // alone unless a separate 'pending' balance row exists for the rest,
      // which is exactly the pattern this app's Financials tab already
      // uses (see MEMORY of tonight's payments-tab fix). Treat 'paid' and
      // 'partial' both as fully accounted for at face value here; any
      // remaining balance shows up as its own separate pending row.
      const paid = r.status === 'paid' || r.status === 'partial' ? charged : 0;
      const chargedForDisplay = r.status === 'partial' ? charged : charged; // kept explicit for clarity/audit
      return {
        periodLabel: monthLabel(r.due_date),
        periodStart: r.due_date,
        periodEnd: r.due_date,
        rentCharged: chargedForDisplay,
        rentPaid: paid,
        balance: r.status === 'pending' || r.status === 'overdue' ? charged : 0,
      };
    });

  const totalOwing = periods.reduce((sum, p) => sum + p.balance, 0);

  return {
    periods,
    totalOwing,
    manuallyAdjusted: false,
    computedAt: new Date().toISOString(),
  };
}

/** Manual override — spec section 10 requires an explanation whenever the
 * auto-calculated arrears figure is overridden by hand. */
export function applyManualArrearsOverride(base: ArrearsResult, overrideAmount: number, reason: string): ArrearsResult {
  return {
    ...base,
    totalOwing: overrideAmount,
    manuallyAdjusted: true,
    adjustmentReason: reason,
  };
}
