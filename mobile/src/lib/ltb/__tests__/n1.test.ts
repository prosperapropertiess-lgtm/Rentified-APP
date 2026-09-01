import { calculateN1 } from '../rules/n1';

describe('N1 rent increase calculation — mechanics (values still NEEDS_REVIEW)', () => {
  it('flags an increase that exceeds the guideline', () => {
    const result = calculateN1({
      intendedServiceDate: '2026-09-01',
      lastIncreaseEffectiveDateOrTenancyStart: '2025-01-01',
      currentRent: 1700,
      proposedRent: 1800, // ~5.9%, above the 2.5% placeholder guideline
    });
    expect(result.exceedsGuideline).toBe(true);
    expect(result.proposedIncreasePercent).toBeCloseTo(5.88, 1);
  });

  it('does not flag an increase within the guideline', () => {
    const result = calculateN1({
      intendedServiceDate: '2026-09-01',
      lastIncreaseEffectiveDateOrTenancyStart: '2025-01-01',
      currentRent: 1700,
      proposedRent: 1730, // ~1.76%
    });
    expect(result.exceedsGuideline).toBe(false);
  });

  it('is not eligible yet if less than 12 months since the last increase/tenancy start', () => {
    const result = calculateN1({
      intendedServiceDate: '2026-09-01',
      lastIncreaseEffectiveDateOrTenancyStart: '2026-06-01',
      currentRent: 1700,
      proposedRent: 1730,
    });
    expect(result.isEligibleYet).toBe(false);
    expect(result.eligibilityDate).toBe('2027-06-01');
  });

  it('earliest effective date is governed by whichever of notice-period or eligibility-date is later', () => {
    // Eligibility date is far in the future (recent increase) — governs
    // over the 90-day notice-based date.
    const result = calculateN1({
      intendedServiceDate: '2026-09-01',
      lastIncreaseEffectiveDateOrTenancyStart: '2026-08-01',
      currentRent: 1700,
      proposedRent: 1730,
    });
    expect(result.eligibilityDate).toBe('2027-08-01');
    expect(result.earliestEffectiveDate).toBe('2027-08-01');
  });

  it('notice period governs when the tenancy is already long-eligible', () => {
    const result = calculateN1({
      intendedServiceDate: '2026-09-01',
      lastIncreaseEffectiveDateOrTenancyStart: '2020-01-01',
      currentRent: 1700,
      proposedRent: 1730,
    });
    // 90 days after Sept 1 = Nov 30.
    expect(result.earliestEffectiveDate).toBe('2026-11-30');
  });
});
