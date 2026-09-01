// N1 — Notice of Rent Increase. Notice period, minimum gap, and the 2026
// guideline % were verified 2026-08-31 directly against tribunalsontario.ca
// and the official N1 form/instructions PDF — see LTB_BUILD_STATUS.md.
// The guideline % is set annually and must be re-checked every January.

import { addDays, addMonths, todayCalendarDate } from '../dateEngine';
import type { CalendarDate, LTBRule } from '../types';

export const N1_RULE_NEEDS_REVIEW: LTBRule = {
  ruleId: 'N1_GUIDELINE_AND_NOTICE',
  formCode: 'N1',
  jurisdiction: 'ON',
  version: 'VERIFIED-2026-08-31',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  needsReview: false,
  description: 'Minimum notice period, minimum gap between increases, and the annual guideline percentage for N1. Verified 2026-08-31 against tribunalsontario.ca and the official N1 form/instructions.',
  logic: {
    // VERIFIED 2026-08-31: Ontario's official 2026 rent increase guideline
    // is 2.1% (down from 2.5% in 2025). This is set annually and WILL
    // change again for 2027 — re-check every January, do not assume this
    // stays correct indefinitely.
    guidelinePercent: 2.1,
    // VERIFIED 2026-08-31 against the official N1 form: "The landlord must
    // give the tenant this notice at least 90 days before the date of the
    // rent increase."
    minNoticeDays: 90,
    // VERIFIED 2026-08-31 against the official N1 form: "A landlord may
    // increase the rent if at least 12 months have passed since the last
    // rent increase or since a new tenant moved into the rental unit."
    minMonthsSinceLastIncrease: 12,
  },
};

interface CalculateN1Input {
  intendedServiceDate: CalendarDate;
  lastIncreaseEffectiveDateOrTenancyStart: CalendarDate;
  currentRent: number;
  proposedRent: number;
}

export interface N1CalculationResult {
  guidelinePercent: number;
  proposedIncreasePercent: number;
  exceedsGuideline: boolean;
  eligibilityDate: CalendarDate;
  isEligibleYet: boolean;
  earliestEffectiveDate: CalendarDate;
  ruleId: string;
  ruleVersion: string;
  needsReview: boolean;
}

export function calculateN1(input: CalculateN1Input): N1CalculationResult {
  const logic = N1_RULE_NEEDS_REVIEW.logic as Record<string, number>;
  const eligibilityDate = addMonths(input.lastIncreaseEffectiveDateOrTenancyStart, logic.minMonthsSinceLastIncrease);
  const isEligibleYet = eligibilityDate <= todayCalendarDate();

  const noticeBasedEarliest = addDays(input.intendedServiceDate, logic.minNoticeDays);
  // Effective date must satisfy BOTH the notice-period requirement and the
  // 12-months-since-last-increase requirement — whichever is later governs.
  const earliestEffectiveDate = noticeBasedEarliest > eligibilityDate ? noticeBasedEarliest : eligibilityDate;

  const proposedIncreasePercent = input.currentRent > 0 ? ((input.proposedRent - input.currentRent) / input.currentRent) * 100 : 0;

  return {
    guidelinePercent: logic.guidelinePercent,
    proposedIncreasePercent: Math.round(proposedIncreasePercent * 100) / 100,
    exceedsGuideline: proposedIncreasePercent > logic.guidelinePercent,
    eligibilityDate,
    isEligibleYet,
    earliestEffectiveDate,
    ruleId: N1_RULE_NEEDS_REVIEW.ruleId,
    ruleVersion: N1_RULE_NEEDS_REVIEW.version,
    needsReview: N1_RULE_NEEDS_REVIEW.needsReview,
  };
}
