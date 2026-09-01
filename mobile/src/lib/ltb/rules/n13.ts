// N13 — Demolition, Repairs/Renovation Requiring Vacancy, or Conversion.
// Notice period and compensation verified 2026-08-31 directly against the
// official N13 form/instructions (tribunalsontario.ca) — see
// LTB_BUILD_STATUS.md. Like N12, the official form does NOT carve out a
// shorter period for daily/weekly tenancies — flat 120 days for every
// frequency, with one narrow exception (mobile home / land lease owners,
// 1 year) modeled below.

import { addDays } from '../dateEngine';
import { evaluateServiceMethod } from '../serviceMethodRules';
import type { CalendarDate, DateCalculationResult, LTBRule, ServiceMethod } from '../types';

export type N13Reason = 'demolition' | 'renovation_repair' | 'conversion' | 'other';

export const N13_REASON_LABELS: Record<N13Reason, string> = {
  demolition: 'Demolition',
  renovation_repair: 'Repair/renovation requiring vacancy',
  conversion: 'Conversion to another use',
  other: 'Other currently authorized ground',
};

export const N13_RULE_NEEDS_REVIEW: LTBRule = {
  ruleId: 'N13_MIN_NOTICE',
  formCode: 'N13',
  jurisdiction: 'ON',
  version: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  // Notice period and compensation figures below are verified. needsReview
  // stays true because calculateN13Dates() still depends on
  // serviceMethodRules.ts's extra-day figures, which are NOT verified.
  needsReview: true,
  description: 'Minimum notice period and compensation for N13. Notice-period and compensation figures verified 2026-08-31 against the official N13 form/instructions. Service-method extra-day figures remain unverified.',
  logic: {
    // VERIFIED 2026-08-31: "at least 120 days" flat, every frequency —
    // the official form does not carve out a shorter period for
    // daily/weekly tenancies (unlike N4/N5/N8).
    minNoticeDaysByFrequency: { monthly: 120, yearly: 120, weekly: 120, daily: 120, biweekly: 120 } as Record<string, number>,
    // VERIFIED 2026-08-31: mobile home park / land lease community
    // exception — termination date must be at least 1 year (365 days)
    // after the notice, if the tenant owns the mobile home / land lease
    // home.
    mobileHomeMinNoticeDays: 365,
  },
};

export interface N13CompensationInput {
  reason: N13Reason;
  unitsInComplex: number | null;
  tenantPlansToMoveBackIn: boolean; // only meaningful when reason === 'renovation_repair'
  orderedByLawToDemolishOrRepair: boolean;
  isMobileHomeOrLandLeaseOwner: boolean;
  repairPeriodMonths: number | null; // only meaningful when tenantPlansToMoveBackIn
}

export interface N13CompensationResult {
  required: boolean;
  description: string;
  needsReview: boolean;
}

/** VERIFIED 2026-08-31 against the official N13 form's "Compensation or
 * another unit" section — this is real, calculated compensation, not a
 * free-text field. See LTB_BUILD_STATUS.md for the exact source text. */
export function calculateN13Compensation(input: N13CompensationInput): N13CompensationResult {
  if (input.orderedByLawToDemolishOrRepair) {
    return { required: false, description: 'No compensation required — the landlord was ordered to demolish or repair the unit under an Act or law.', needsReview: false };
  }
  if (input.isMobileHomeOrLandLeaseOwner) {
    return { required: true, description: "Mobile home / land lease exception: the lesser of one year's rent or $3,000, or an acceptable alternate unit — by the termination date.", needsReview: false };
  }

  const unitsKnown = input.unitsInComplex !== null;
  const largeComplex = unitsKnown && (input.unitsInComplex as number) >= 5;
  const capMonths = largeComplex ? 3 : 1;

  if (input.reason === 'renovation_repair' && input.tenantPlansToMoveBackIn) {
    if (input.repairPeriodMonths !== null) {
      const owedMonths = Math.min(capMonths, input.repairPeriodMonths);
      return { required: true, description: `${owedMonths} month(s)' rent (the lesser of ${capMonths} months or the estimated repair period) — by the termination date.`, needsReview: !unitsKnown };
    }
    return { required: true, description: `Up to ${capMonths} month(s)' rent, or the rent for the repair period if shorter — enter expected start/completion dates to calculate exactly.`, needsReview: true };
  }

  return { required: true, description: `${capMonths} month(s)' rent, or an acceptable alternate unit — by the termination date.`, needsReview: !unitsKnown };
}

interface CalculateN13DatesInput {
  intendedServiceDate: CalendarDate;
  serviceMethod: ServiceMethod;
  rentFrequency: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'yearly';
  hasEmailConsentOnFile?: boolean;
  isMobileHomeOrLandLeaseOwner?: boolean;
}

export function calculateN13Dates(input: CalculateN13DatesInput): DateCalculationResult & { serviceAllowed: boolean; serviceDenyReason?: string } {
  const methodResult = evaluateServiceMethod({ method: input.serviceMethod, formCode: 'N13', hasEmailConsentOnFile: input.hasEmailConsentOnFile });
  const deemedServiceDate = addDays(input.intendedServiceDate, methodResult.extraDays);
  const minNoticeDays = input.isMobileHomeOrLandLeaseOwner
    ? N13_RULE_NEEDS_REVIEW.logic.mobileHomeMinNoticeDays as number
    : (N13_RULE_NEEDS_REVIEW.logic.minNoticeDaysByFrequency as Record<string, number>)[input.rentFrequency] ?? 120;
  const earliestValidTerminationDate = addDays(deemedServiceDate, minNoticeDays);

  return {
    deemedServiceDate,
    minimumNoticeDays: minNoticeDays,
    earliestValidTerminationDate,
    ruleId: N13_RULE_NEEDS_REVIEW.ruleId,
    ruleVersion: N13_RULE_NEEDS_REVIEW.version,
    needsReview: N13_RULE_NEEDS_REVIEW.needsReview,
    serviceAllowed: methodResult.allowed,
    serviceDenyReason: methodResult.reason,
    explanation: [
      { label: 'Notice intended to be served', value: input.intendedServiceDate },
      { label: 'Service method', value: input.serviceMethod },
      { label: 'Extra days for this service method', value: `${methodResult.extraDays} day(s) — service-method extra-day rules are still NEEDS_REVIEW` },
      { label: 'Deemed service date', value: deemedServiceDate },
      { label: 'Minimum required notice', value: `${minNoticeDays} days — verified 2026-08-31 against the official N13 form${input.isMobileHomeOrLandLeaseOwner ? ' (mobile home / land lease exception)' : ''}` },
      { label: 'Earliest permitted termination date', value: earliestValidTerminationDate },
      { label: 'Reminder', value: 'The termination date must also align with the end of a rental period/term, and cannot be earlier than the end of a fixed term — confirm this manually.' },
    ],
  };
}
