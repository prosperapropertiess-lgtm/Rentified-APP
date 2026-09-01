// N4 — Non-payment of Rent. Notice period verified 2026-08-31 directly
// against the official N4 form/instructions (tribunalsontario.ca) — see
// LTB_BUILD_STATUS.md. WATCH ITEM: Bill 60 (Fighting Delays, Building
// Faster Act, 2025) passed the Ontario legislature Nov 24, 2025 and is
// widely reported to reduce this to 7 days for monthly/yearly tenancies.
// The live official form (fetched 2026-08-31) still says 14 days — either
// that provision hasn't been proclaimed into force yet, or the form
// hasn't been reprinted. Trusting the actual current official form over
// secondary commentary, but re-check this periodically; it may change.

import { addDays, todayCalendarDate } from '../dateEngine';
import { evaluateServiceMethod } from '../serviceMethodRules';
import type { CalendarDate, DateCalculationResult, LTBRule, ServiceMethod } from '../types';

export const N4_RULE_NEEDS_REVIEW: LTBRule = {
  ruleId: 'N4_MIN_NOTICE',
  formCode: 'N4',
  jurisdiction: 'ON',
  version: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  // The notice-period figures below (14/7 days) are verified. needsReview
  // stays true at the overall-rule level because calculateN4Dates() below
  // still depends on serviceMethodRules.ts's extra-day figures (mail =
  // +5 days, etc.), which are NOT verified — see that file.
  needsReview: true,
  description: 'Minimum notice period for N4 (non-payment of rent), by tenancy rent frequency. Notice-period figures verified 2026-08-31 against the official N4 form/instructions — see the Bill 60 watch note above. Service-method extra-day figures remain unverified.',
  logic: {
    // VERIFIED 2026-08-31 against the official N4 form: "If your tenant
    // pays rent by the month or year, you must give at least 14 days
    // notice. If your tenant pays rent by the day or week, you must give
    // at least 7 days notice." The form doesn't name "biweekly" as its
    // own category — treated as the general (monthly/yearly) case since
    // only "day or week" are named as the shorter exception.
    minNoticeDaysByFrequency: { monthly: 14, yearly: 14, weekly: 7, daily: 7, biweekly: 14 } as Record<string, number>,
  },
};

interface CalculateN4DatesInput {
  intendedServiceDate: CalendarDate;
  serviceMethod: ServiceMethod;
  rentFrequency: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'yearly';
  hasEmailConsentOnFile?: boolean;
}

export function calculateN4Dates(input: CalculateN4DatesInput): DateCalculationResult & { serviceAllowed: boolean; serviceDenyReason?: string } {
  const methodResult = evaluateServiceMethod({ method: input.serviceMethod, formCode: 'N4', hasEmailConsentOnFile: input.hasEmailConsentOnFile });
  const deemedServiceDate = addDays(input.intendedServiceDate, methodResult.extraDays);
  const minNoticeDays = (N4_RULE_NEEDS_REVIEW.logic.minNoticeDaysByFrequency as Record<string, number>)[input.rentFrequency] ?? 14;
  const earliestValidTerminationDate = addDays(deemedServiceDate, minNoticeDays);

  return {
    deemedServiceDate,
    minimumNoticeDays: minNoticeDays,
    earliestValidTerminationDate,
    ruleId: N4_RULE_NEEDS_REVIEW.ruleId,
    ruleVersion: N4_RULE_NEEDS_REVIEW.version,
    needsReview: true,
    serviceAllowed: methodResult.allowed,
    serviceDenyReason: methodResult.reason,
    explanation: [
      { label: 'Notice intended to be served', value: input.intendedServiceDate },
      { label: 'Service method', value: input.serviceMethod },
      { label: 'Extra days for this service method', value: `${methodResult.extraDays} day(s) — NEEDS_REVIEW` },
      { label: 'Deemed service date', value: deemedServiceDate },
      { label: 'Minimum required notice', value: `${minNoticeDays} days (${input.rentFrequency} tenancy) — NEEDS_REVIEW` },
      { label: 'Earliest permitted termination date', value: earliestValidTerminationDate },
    ],
  };
}

/** Earliest an L1 application could potentially be prepared — the day
 * after the N4 termination date, PROVIDED rent remains owing and the
 * notice hasn't been voided. NEEDS_REVIEW: confirm there's no additional
 * waiting period beyond the termination date itself. */
export function calculateEarliestL1Date(n4TerminationDate: CalendarDate): CalendarDate {
  return addDays(n4TerminationDate, 1);
}

export function daysUntil(target: CalendarDate): number {
  const today = todayCalendarDate();
  const [ty, tm, td] = today.split('-').map(Number);
  const [gy, gm, gd] = target.split('-').map(Number);
  const a = Date.UTC(ty, tm - 1, td);
  const b = Date.UTC(gy, gm - 1, gd);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
