// N6 — Illegal Acts or Misrepresenting Income in a Rent-Geared-to-Income
// Unit. Verified 2026-08-31 directly against the official N6
// form/instructions (tribunalsontario.ca). Unusual shape: Reason 1
// (drug-related) has its own flat notice period; Reasons 2 and 3 share a
// first/second-notice mechanic similar to N5, EXCEPT the "second notice"
// trigger here is specifically "the first notice had a 7-day correction
// period" — i.e. this counts a prior N5 (or a Reason-2/3 N6) against the
// same 6-month window, not just a prior N6. This system tracks it as a
// simple isSubsequentNotice flag the landlord confirms, same as N5 — it
// does not automatically cross-reference every prior notice type.

import { addDays } from '../dateEngine';
import { evaluateServiceMethod } from '../serviceMethodRules';
import type { CalendarDate, DateCalculationResult, LTBRule, ServiceMethod } from '../types';

export type N6Reason = 'drug_related_illegal_act' | 'other_illegal_act' | 'misrepresented_rgi_income';

// VERIFIED 2026-08-31 against the official N6 form's three "Reason" options.
export const N6_REASON_LABELS: Record<N6Reason, string> = {
  drug_related_illegal_act: 'Illegal act involving production, trafficking, or possession-for-trafficking of an illegal drug',
  other_illegal_act: 'Illegal act or business at the complex (not drug-related)',
  misrepresented_rgi_income: 'Misrepresented income (or a household member\'s income) in a rent-geared-to-income unit',
};

export const N6_RULE_NEEDS_REVIEW: LTBRule = {
  ruleId: 'N6_MIN_NOTICE',
  formCode: 'N6',
  jurisdiction: 'ON',
  version: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  needsReview: true, // service-method extra-day figures remain unverified
  description: 'Minimum notice period for N6 — verified 2026-08-31 against the official N6 form. Reason 1 is a flat period; Reasons 2/3 depend on first-vs-second notice in the past 6 months.',
  logic: {
    // VERIFIED 2026-08-31: "For Reason 1, the termination date... must be
    // at least 10 days after the landlord gives you this notice."
    minNoticeDaysReason1: 10,
    // VERIFIED 2026-08-31: "For Reasons 2 and 3... if this is your first
    // Notice... in the past 6 months, at least 20 days... if this is your
    // second Notice... and the first notice had a 7 day correction
    // period, at least 14 days."
    minNoticeDaysReasons2And3First: 20,
    minNoticeDaysReasons2And3Subsequent: 14,
  },
};

interface CalculateN6DatesInput {
  reason: N6Reason;
  intendedServiceDate: CalendarDate;
  serviceMethod: ServiceMethod;
  isSubsequentNotice: boolean; // only meaningful for other_illegal_act / misrepresented_rgi_income
  hasEmailConsentOnFile?: boolean;
}

export function calculateN6Dates(input: CalculateN6DatesInput): DateCalculationResult & { serviceAllowed: boolean; serviceDenyReason?: string } {
  const methodResult = evaluateServiceMethod({ method: input.serviceMethod, formCode: 'N6', hasEmailConsentOnFile: input.hasEmailConsentOnFile });
  const deemedServiceDate = addDays(input.intendedServiceDate, methodResult.extraDays);

  const logic = N6_RULE_NEEDS_REVIEW.logic as Record<string, number>;
  const minNoticeDays = input.reason === 'drug_related_illegal_act'
    ? logic.minNoticeDaysReason1
    : input.isSubsequentNotice
      ? logic.minNoticeDaysReasons2And3Subsequent
      : logic.minNoticeDaysReasons2And3First;

  const earliestValidTerminationDate = addDays(deemedServiceDate, minNoticeDays);

  return {
    deemedServiceDate,
    minimumNoticeDays: minNoticeDays,
    earliestValidTerminationDate,
    ruleId: N6_RULE_NEEDS_REVIEW.ruleId,
    ruleVersion: N6_RULE_NEEDS_REVIEW.version,
    needsReview: N6_RULE_NEEDS_REVIEW.needsReview,
    serviceAllowed: methodResult.allowed,
    serviceDenyReason: methodResult.reason,
    explanation: [
      { label: 'Reason', value: input.reason },
      { label: 'Notice intended to be served', value: input.intendedServiceDate },
      { label: 'Service method', value: input.serviceMethod },
      { label: 'Extra days for this service method', value: `${methodResult.extraDays} day(s) — service-method extra-day rules are still NEEDS_REVIEW` },
      { label: 'Deemed service date', value: deemedServiceDate },
      { label: 'Minimum required notice', value: `${minNoticeDays} days — verified 2026-08-31 against the official N6 form` },
      { label: 'Earliest permitted termination date', value: earliestValidTerminationDate },
    ],
  };
}
