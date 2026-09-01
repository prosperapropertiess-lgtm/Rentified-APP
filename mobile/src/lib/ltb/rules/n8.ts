// N8 — End Tenancy at End of Term / Persistent Late Payment. Notice
// period and all five grounds verified 2026-08-31 directly against the
// official N8 form/instructions (tribunalsontario.ca) — see
// LTB_BUILD_STATUS.md. needsReview stays true only because service-method
// extra-day figures remain unverified — the five grounds below are now
// all implemented and match the official form's exact wording.

import { addDays } from '../dateEngine';
import { evaluateServiceMethod } from '../serviceMethodRules';
import type { CalendarDate, DateCalculationResult, LTBRule, ServiceMethod } from '../types';

export type N8Reason =
  | 'persistent_late_payment'
  | 'no_longer_qualifies_subsidized_housing'
  | 'employment_conditioned_unit_ended'
  | 'aps_terminated_condo'
  | 'rehab_therapeutic_period_ended';

// VERIFIED 2026-08-31 against the official N8 form's five "Reason" options.
export const N8_REASON_LABELS: Record<N8Reason, string> = {
  persistent_late_payment: 'Tenant has persistently paid rent late',
  no_longer_qualifies_subsidized_housing: 'Tenant no longer qualifies to live in public or subsidized housing',
  employment_conditioned_unit_ended: "Unit was made available as a condition of tenant's employment, and that employment has ended",
  aps_terminated_condo: 'Tenancy was created in good faith based on an Agreement of Purchase and Sale for a proposed condo unit, and that agreement has been terminated',
  rehab_therapeutic_period_ended: 'Tenant occupies the unit specifically to receive rehabilitative or therapeutic services, and the agreed period has ended',
};

export const N8_RULE_NEEDS_REVIEW: LTBRule = {
  ruleId: 'N8_MIN_NOTICE',
  formCode: 'N8',
  jurisdiction: 'ON',
  version: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  needsReview: true,
  description: 'Minimum notice period and all five grounds for N8. Verified 2026-08-31 against the official N8 form/instructions. Service-method extra-day figures remain unverified.',
  logic: {
    // VERIFIED 2026-08-31 against the official N8 form: "For most types of
    // tenancies (including monthly) the termination date must be at least
    // 60 days... Exception: at least 28 days if daily or weekly." Like
    // N4, "biweekly" isn't named as its own category — treated as the
    // general (monthly) case since only "daily or weekly" are named as
    // the shorter exception.
    minNoticeDaysByFrequency: { monthly: 60, yearly: 60, weekly: 28, daily: 28, biweekly: 60 } as Record<string, number>,
  },
};

interface CalculateN8DatesInput {
  intendedServiceDate: CalendarDate;
  serviceMethod: ServiceMethod;
  rentFrequency: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'yearly';
  hasEmailConsentOnFile?: boolean;
}

export function calculateN8Dates(input: CalculateN8DatesInput): DateCalculationResult & { serviceAllowed: boolean; serviceDenyReason?: string } {
  const methodResult = evaluateServiceMethod({ method: input.serviceMethod, formCode: 'N8', hasEmailConsentOnFile: input.hasEmailConsentOnFile });
  const deemedServiceDate = addDays(input.intendedServiceDate, methodResult.extraDays);
  const minNoticeDays = (N8_RULE_NEEDS_REVIEW.logic.minNoticeDaysByFrequency as Record<string, number>)[input.rentFrequency] ?? 60;
  const earliestValidTerminationDate = addDays(deemedServiceDate, minNoticeDays);

  return {
    deemedServiceDate,
    minimumNoticeDays: minNoticeDays,
    earliestValidTerminationDate,
    ruleId: N8_RULE_NEEDS_REVIEW.ruleId,
    ruleVersion: N8_RULE_NEEDS_REVIEW.version,
    needsReview: true,
    serviceAllowed: methodResult.allowed,
    serviceDenyReason: methodResult.reason,
    explanation: [
      { label: 'Notice intended to be served', value: input.intendedServiceDate },
      { label: 'Service method', value: input.serviceMethod },
      { label: 'Extra days for this service method', value: `${methodResult.extraDays} day(s) — service-method extra-day rules are still NEEDS_REVIEW` },
      { label: 'Deemed service date', value: deemedServiceDate },
      { label: 'Minimum required notice', value: `${minNoticeDays} days — verified 2026-08-31 against the official N8 form` },
      { label: 'Earliest permitted termination date', value: earliestValidTerminationDate },
      { label: 'Reminder', value: 'The termination date must also align with the end of a rental period/term — confirm this manually, this system does not calculate period boundaries.' },
    ],
  };
}
