// N4 date-calculation fixtures per spec section 52. These verify the
// MECHANICS (arithmetic, service-method extra days, month/year rollover)
// are internally consistent — they do NOT certify the underlying rule
// VALUES (14-day notice, mail = +5 days, etc.) are legally correct. Those
// are marked NEEDS_REVIEW in rules/n4.ts and must be confirmed against a
// live Tribunals Ontario source before this suite can be treated as a
// legal-accuracy guarantee.

import { calculateN4Dates } from '../rules/n4';

describe('N4 date calculation — mechanics (values still NEEDS_REVIEW)', () => {
  it('monthly tenancy + hand delivery', () => {
    const result = calculateN4Dates({
      intendedServiceDate: '2026-09-03',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'monthly',
    });
    expect(result.deemedServiceDate).toBe('2026-09-03'); // 0 extra days
    expect(result.minimumNoticeDays).toBe(14);
    expect(result.earliestValidTerminationDate).toBe('2026-09-17');
    expect(result.needsReview).toBe(true);
  });

  it('monthly tenancy + regular mail adds extra deemed-service days', () => {
    const result = calculateN4Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'regular_mail',
      rentFrequency: 'monthly',
    });
    expect(result.deemedServiceDate).toBe('2026-09-06'); // +5 days
    expect(result.earliestValidTerminationDate).toBe('2026-09-20');
  });

  it('weekly tenancy uses the shorter minimum notice period', () => {
    const result = calculateN4Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'weekly',
    });
    expect(result.minimumNoticeDays).toBe(7);
    expect(result.earliestValidTerminationDate).toBe('2026-09-08');
  });

  it('service near month end rolls the termination date into the next month correctly', () => {
    const result = calculateN4Dates({
      intendedServiceDate: '2026-09-28',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'monthly',
    });
    expect(result.earliestValidTerminationDate).toBe('2026-10-12');
  });

  it('service on December 31 rolls correctly across the year boundary', () => {
    const result = calculateN4Dates({
      intendedServiceDate: '2026-12-31',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'monthly',
    });
    expect(result.earliestValidTerminationDate).toBe('2027-01-14');
  });

  it('service in a leap-year February computes correctly', () => {
    const result = calculateN4Dates({
      intendedServiceDate: '2028-02-20',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'monthly',
    });
    // Feb 20 + 14 days crosses Feb 29 (2028 is a leap year) into March.
    expect(result.earliestValidTerminationDate).toBe('2028-03-05');
  });

  it('email without consent on file is blocked', () => {
    const result = calculateN4Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'email',
      rentFrequency: 'monthly',
      hasEmailConsentOnFile: false,
    });
    expect(result.serviceAllowed).toBe(false);
    expect(result.serviceDenyReason).toBeTruthy();
  });

  it('email with consent on file is allowed', () => {
    const result = calculateN4Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'email',
      rentFrequency: 'monthly',
      hasEmailConsentOnFile: true,
    });
    expect(result.serviceAllowed).toBe(true);
  });

  it('every result carries an explanation the UI can render (spec section 50)', () => {
    const result = calculateN4Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'monthly',
    });
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.explanation.map((e) => e.label)).toContain('Earliest permitted termination date');
  });
});
