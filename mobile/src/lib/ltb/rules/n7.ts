// N7 — Causing Serious Problems in the Rental Unit or Residential Complex.
// Verified 2026-08-31 directly against the official N7 form/instructions
// (tribunalsontario.ca). Simpler than N5/N6/N8: a flat notice period
// regardless of reason, no cure period, no first/second-notice distinction.

import { addDays } from '../dateEngine';
import { evaluateServiceMethod } from '../serviceMethodRules';
import type { CalendarDate, DateCalculationResult, LTBRule, ServiceMethod } from '../types';

export type N7Reason = 'impaired_safety' | 'wilful_damage' | 'inconsistent_use_serious_damage' | 'small_building_interference';

// VERIFIED 2026-08-31 against the official N7 form's four "Reason" options.
export const N7_REASON_LABELS: Record<N7Reason, string> = {
  impaired_safety: "Tenant's behaviour (or a visitor/occupant's) seriously impaired another person's safety in the complex",
  wilful_damage: 'Tenant (or a visitor/occupant) wilfully damaged the rental unit or residential complex',
  inconsistent_use_serious_damage: 'Tenant used the unit/complex in a way inconsistent with residential use, causing or expected to cause serious damage',
  small_building_interference: 'In a building of 3 or fewer units where the landlord also lives, substantial interference with the landlord\'s reasonable enjoyment or lawful rights',
};

export const N7_RULE_NEEDS_REVIEW: LTBRule = {
  ruleId: 'N7_MIN_NOTICE',
  formCode: 'N7',
  jurisdiction: 'ON',
  version: 'NOTICE-PERIOD-VERIFIED-2026-08-31',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  // Service-method extra-day figures remain unverified (see serviceMethodRules.ts).
  needsReview: true,
  description: 'Minimum notice period for N7 — verified 2026-08-31 against the official N7 form. Flat 10 days regardless of reason.',
  logic: {
    // VERIFIED 2026-08-31: "The termination date the landlord sets out in
    // this notice must be at least 10 days after the landlord gives you
    // this notice." No exception by reason or tenancy frequency.
    minNoticeDays: 10,
  },
};

interface CalculateN7DatesInput {
  intendedServiceDate: CalendarDate;
  serviceMethod: ServiceMethod;
  hasEmailConsentOnFile?: boolean;
}

export function calculateN7Dates(input: CalculateN7DatesInput): DateCalculationResult & { serviceAllowed: boolean; serviceDenyReason?: string } {
  const methodResult = evaluateServiceMethod({ method: input.serviceMethod, formCode: 'N7', hasEmailConsentOnFile: input.hasEmailConsentOnFile });
  const deemedServiceDate = addDays(input.intendedServiceDate, methodResult.extraDays);
  const minNoticeDays = N7_RULE_NEEDS_REVIEW.logic.minNoticeDays as number;
  const earliestValidTerminationDate = addDays(deemedServiceDate, minNoticeDays);

  return {
    deemedServiceDate,
    minimumNoticeDays: minNoticeDays,
    earliestValidTerminationDate,
    ruleId: N7_RULE_NEEDS_REVIEW.ruleId,
    ruleVersion: N7_RULE_NEEDS_REVIEW.version,
    needsReview: N7_RULE_NEEDS_REVIEW.needsReview,
    serviceAllowed: methodResult.allowed,
    serviceDenyReason: methodResult.reason,
    explanation: [
      { label: 'Notice intended to be served', value: input.intendedServiceDate },
      { label: 'Service method', value: input.serviceMethod },
      { label: 'Extra days for this service method', value: `${methodResult.extraDays} day(s) — service-method extra-day rules are still NEEDS_REVIEW` },
      { label: 'Deemed service date', value: deemedServiceDate },
      { label: 'Minimum required notice', value: `${minNoticeDays} days — verified 2026-08-31 against the official N7 form` },
      { label: 'Earliest permitted termination date', value: earliestValidTerminationDate },
    ],
  };
}
