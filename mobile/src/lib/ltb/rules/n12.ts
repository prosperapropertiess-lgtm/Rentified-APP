// N12 — Landlord, Purchaser or Family Member Requires the Unit. Notice
// period and compensation verified 2026-08-31 directly against the
// official N12 form/instructions (tribunalsontario.ca) — see
// LTB_BUILD_STATUS.md. Unlike N4/N5/N8, the official N12 form does NOT
// carve out a shorter period for daily/weekly tenancies — it's a flat 60
// days regardless of rent frequency. Compensation (one month's rent, or
// an acceptable alternate unit) is confirmed mandatory with no notice-
// length exception (an earlier secondary source suggested a 120-day
// exception — the official form contradicts that; trust the form).

import { addDays } from '../dateEngine';
import { evaluateServiceMethod } from '../serviceMethodRules';
import type { CalendarDate, DateCalculationResult, LTBRule, ServiceMethod } from '../types';

export type N12Reason = 'landlord_use' | 'purchaser_use' | 'qualifying_family_member' | 'other';

export const N12_REASON_LABELS: Record<N12Reason, string> = {
  landlord_use: 'Landlord will occupy the unit',
  purchaser_use: 'Purchaser will occupy the unit',
  qualifying_family_member: 'A qualifying family member will occupy the unit',
  other: 'Other currently authorized category',
};

export const N12_RULE_NEEDS_REVIEW: LTBRule = {
  ruleId: 'N12_MIN_NOTICE_AND_COMPENSATION',
  formCode: 'N12',
  jurisdiction: 'ON',
  version: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  // Notice period and compensation figures below are verified. needsReview
  // stays true because calculateN12Dates() still depends on
  // serviceMethodRules.ts's extra-day figures, which are NOT verified.
  needsReview: true,
  description: 'Minimum notice period and mandatory compensation for N12. Notice-period and compensation figures verified 2026-08-31 against the official N12 form/instructions. Service-method extra-day figures remain unverified.',
  logic: {
    // VERIFIED 2026-08-31: the official N12 form states "at least 60 days"
    // flat, with no shorter period for daily/weekly tenancies (unlike
    // N4/N5/N8, which do carve one out). Same 60 days for every frequency.
    minNoticeDaysByFrequency: { monthly: 60, yearly: 60, weekly: 60, daily: 60, biweekly: 60 } as Record<string, number>,
    // VERIFIED 2026-08-31: "The landlord must pay you an amount equal to
    // one month's rent by the termination date... or offer you another
    // rental unit that is acceptable to you." No exception found for
    // longer notice periods.
    compensationMonthsOfRent: 1,
  },
};

interface CalculateN12DatesInput {
  intendedServiceDate: CalendarDate;
  serviceMethod: ServiceMethod;
  rentFrequency: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'yearly';
  hasEmailConsentOnFile?: boolean;
}

export function calculateN12Dates(input: CalculateN12DatesInput): DateCalculationResult & { serviceAllowed: boolean; serviceDenyReason?: string } {
  const methodResult = evaluateServiceMethod({ method: input.serviceMethod, formCode: 'N12', hasEmailConsentOnFile: input.hasEmailConsentOnFile });
  const deemedServiceDate = addDays(input.intendedServiceDate, methodResult.extraDays);
  const minNoticeDays = (N12_RULE_NEEDS_REVIEW.logic.minNoticeDaysByFrequency as Record<string, number>)[input.rentFrequency] ?? 60;
  const earliestValidTerminationDate = addDays(deemedServiceDate, minNoticeDays);

  return {
    deemedServiceDate,
    minimumNoticeDays: minNoticeDays,
    earliestValidTerminationDate,
    ruleId: N12_RULE_NEEDS_REVIEW.ruleId,
    ruleVersion: N12_RULE_NEEDS_REVIEW.version,
    needsReview: N12_RULE_NEEDS_REVIEW.needsReview,
    serviceAllowed: methodResult.allowed,
    serviceDenyReason: methodResult.reason,
    explanation: [
      { label: 'Notice intended to be served', value: input.intendedServiceDate },
      { label: 'Service method', value: input.serviceMethod },
      { label: 'Extra days for this service method', value: `${methodResult.extraDays} day(s) — service-method extra-day rules are still NEEDS_REVIEW` },
      { label: 'Deemed service date', value: deemedServiceDate },
      { label: 'Minimum required notice', value: `${minNoticeDays} days — verified 2026-08-31 against the official N12 form` },
      { label: 'Earliest permitted termination date', value: earliestValidTerminationDate },
      { label: 'Compensation', value: 'One month\'s rent, or an acceptable alternate unit — mandatory, verified 2026-08-31.' },
      { label: 'Reminder', value: 'The termination date must also align with the end of a rental period/term, and cannot be earlier than the end of a fixed term — confirm this manually.' },
    ],
  };
}
