// N11 — Agreement to End the Tenancy. Structurally different from every
// other form built so far: it's a BILATERAL agreement the landlord and
// tenant both sign, not a unilateral notice with a legally-computed
// minimum period — the parties can agree to any date. Modeled to fit the
// same DateCalculationResult shape as the notice forms (deemedServiceDate,
// earliestValidTerminationDate) purely so it slots into the existing
// generic notice/[id].tsx service-recording and PDF-generation code
// without a special case — earliestValidTerminationDate here just means
// "the date they agreed to," not a legal floor.
//
// IMPORTANT restriction verified via secondary sources 2026-08-31 (the
// official N11 form itself is a fillable form with minimal instructional
// text, so this specific restriction should be double-checked against
// the RTA directly before relying on it): a landlord cannot require a
// tenant to sign this, and cannot require it be signed at the START of a
// tenancy for a later date. This system surfaces that as a mandatory
// reminder, not an enforced block (there's no way to verify voluntariness
// from a form).

import type { CalendarDate, DateCalculationResult } from '../types';

export const N11_RULE_NEEDS_REVIEW = {
  ruleId: 'N11_BILATERAL_AGREEMENT',
  formCode: 'N11',
  jurisdiction: 'ON',
  version: 'DRAFT-NEEDS-REVIEW',
  needsReview: true,
  description: 'N11 has no landlord-computed minimum notice period — the termination date is whatever both parties agree to. The voluntariness restriction (cannot be required, cannot be signed at tenancy start for a later date) is NEEDS_REVIEW against the RTA directly.',
};

interface CalculateN11Input {
  agreementSignedDate: CalendarDate;
  agreedTerminationDate: CalendarDate;
}

export function calculateN11Dates(input: CalculateN11Input): DateCalculationResult & { serviceAllowed: boolean; serviceDenyReason?: string } {
  return {
    deemedServiceDate: input.agreementSignedDate,
    minimumNoticeDays: 0,
    earliestValidTerminationDate: input.agreedTerminationDate,
    ruleId: N11_RULE_NEEDS_REVIEW.ruleId,
    ruleVersion: N11_RULE_NEEDS_REVIEW.version,
    needsReview: true,
    serviceAllowed: true,
    explanation: [
      { label: 'Agreement signed', value: input.agreementSignedDate },
      { label: 'Agreed termination date', value: input.agreedTerminationDate },
      { label: 'Reminder', value: 'No minimum notice period applies — this is a mutual agreement, not a unilateral notice. Confirm the tenant signed voluntarily and was not required to sign this at the start of the tenancy for a later date.' },
    ],
  };
}
