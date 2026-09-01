// N5 — Interference, Damage or Overcrowding. Notice periods and cure
// window verified 2026-08-31 directly against the official N5
// form/instructions (tribunalsontario.ca) — see LTB_BUILD_STATUS.md.
// needsReview stays true because calculateN5Dates() still depends on
// serviceMethodRules.ts's extra-day figures, which are NOT verified.

import { addDays } from '../dateEngine';
import { evaluateServiceMethod } from '../serviceMethodRules';
import type { CalendarDate, DateCalculationResult, LTBRule, ServiceMethod } from '../types';

export const N5_RULE_NEEDS_REVIEW: LTBRule = {
  ruleId: 'N5_MIN_NOTICE_AND_CURE',
  formCode: 'N5',
  jurisdiction: 'ON',
  version: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  needsReview: true,
  description: 'Minimum notice period and cure/void window for N5, first vs. subsequent notice. Verified 2026-08-31 against the official N5 form/instructions.',
  logic: {
    // VERIFIED 2026-08-31 against the official N5 form: "If this is your
    // first N5 Notice... in the past 6 months, the termination date...
    // must be at least 20 days after the landlord gave you this notice."
    minNoticeDaysFirstNotice: 20,
    // VERIFIED 2026-08-31: "You have 7 days to stop the activities or
    // correct the behaviour... and avoid eviction."
    curePeriodDaysFirstNotice: 7,
    // VERIFIED 2026-08-31: the official form uses "in the past 6 months"
    // (a calendar-month concept, not exactly 180 days) — 180 is a close
    // approximation. A landlord also cannot serve a second N5 unless at
    // least 7 days have passed since the first (enforced in
    // n5Workflow.ts's SUBSEQUENT_TOO_SOON check).
    subsequentNoticeLookbackDays: 180,
    // VERIFIED 2026-08-31: "If this is your second N5 Notice... in the
    // past 6 months, the termination date... must be at least 14 days
    // after the landlord gave you this notice."
    minNoticeDaysSubsequentNotice: 14,
  },
};

interface CalculateN5DatesInput {
  intendedServiceDate: CalendarDate;
  serviceMethod: ServiceMethod;
  isSubsequentNotice: boolean;
  hasEmailConsentOnFile?: boolean;
}

export function calculateN5Dates(input: CalculateN5DatesInput): DateCalculationResult & { cureDeadline: CalendarDate | null; serviceAllowed: boolean; serviceDenyReason?: string } {
  const methodResult = evaluateServiceMethod({ method: input.serviceMethod, formCode: 'N5', hasEmailConsentOnFile: input.hasEmailConsentOnFile });
  const deemedServiceDate = addDays(input.intendedServiceDate, methodResult.extraDays);
  const logic = N5_RULE_NEEDS_REVIEW.logic as Record<string, number>;
  const minNoticeDays = input.isSubsequentNotice ? logic.minNoticeDaysSubsequentNotice : logic.minNoticeDaysFirstNotice;
  const earliestValidTerminationDate = addDays(deemedServiceDate, minNoticeDays);
  const cureDeadline = input.isSubsequentNotice ? null : addDays(deemedServiceDate, logic.curePeriodDaysFirstNotice);

  return {
    deemedServiceDate,
    minimumNoticeDays: minNoticeDays,
    earliestValidTerminationDate,
    cureDeadline,
    ruleId: N5_RULE_NEEDS_REVIEW.ruleId,
    ruleVersion: N5_RULE_NEEDS_REVIEW.version,
    needsReview: true,
    serviceAllowed: methodResult.allowed,
    serviceDenyReason: methodResult.reason,
    explanation: [
      { label: 'Notice type', value: input.isSubsequentNotice ? 'Subsequent N5 (prior N5 found within lookback window)' : 'First N5 for this tenancy' },
      { label: 'Notice intended to be served', value: input.intendedServiceDate },
      { label: 'Service method', value: input.serviceMethod },
      { label: 'Deemed service date', value: deemedServiceDate },
      { label: 'Minimum required notice', value: `${minNoticeDays} days — NEEDS_REVIEW` },
      { label: 'Earliest permitted termination date', value: earliestValidTerminationDate },
      ...(cureDeadline ? [{ label: 'Cure/monitoring period ends', value: `${cureDeadline} — NEEDS_REVIEW` }] : []),
    ],
  };
}

/** A prior N5 counts as "subsequent-triggering" if served within the
 * lookback window ending on the new notice's intended service date. */
export function isWithinN5Lookback(priorN5ServedDate: CalendarDate, newIntendedServiceDate: CalendarDate): boolean {
  const lookbackDays = (N5_RULE_NEEDS_REVIEW.logic as Record<string, number>).subsequentNoticeLookbackDays;
  const windowStart = addDays(newIntendedServiceDate, -lookbackDays);
  return priorN5ServedDate >= windowStart && priorN5ServedDate <= newIntendedServiceDate;
}
