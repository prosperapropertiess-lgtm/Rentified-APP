import { calculateN8Dates } from '../rules/n8';
import { buildPaymentChronology, countLatePeriods } from '../paymentChronology';
import { N8Workflow, type N8WorkflowInput } from '../rules/n8Workflow';
import { hasBlockers } from '../workflow';

describe('N8 date calculation — mechanics (values still NEEDS_REVIEW)', () => {
  it('adds 60 days minimum notice for a monthly tenancy, hand-delivered', () => {
    const result = calculateN8Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'monthly',
    });
    expect(result.deemedServiceDate).toBe('2026-09-01');
    expect(result.earliestValidTerminationDate).toBe('2026-10-31');
  });

  it('adds mail service extra days before the 60-day count', () => {
    const result = calculateN8Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'regular_mail',
      rentFrequency: 'monthly',
    });
    // regular_mail adds 5 deemed-service days per serviceMethodRules.ts
    expect(result.deemedServiceDate).toBe('2026-09-06');
    expect(result.earliestValidTerminationDate).toBe('2026-11-05');
  });

  it('uses the shorter weekly-tenancy notice period', () => {
    const result = calculateN8Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'weekly',
    });
    expect(result.minimumNoticeDays).toBe(28);
  });
});

describe('payment chronology classification', () => {
  const rows = [
    { amount: 1700, due_date: '2026-05-01', status: 'paid', paid_at: '2026-04-30T00:00:00Z', classification: 'RENT' },
    { amount: 1700, due_date: '2026-06-01', status: 'paid', paid_at: '2026-06-05T00:00:00Z', classification: 'RENT' },
    { amount: 1700, due_date: '2026-07-01', status: 'partial', paid_at: null, classification: 'RENT' },
    { amount: 1700, due_date: '2026-08-01', status: 'pending', paid_at: null, classification: 'RENT' },
    { amount: 50, due_date: '2026-08-01', status: 'paid', paid_at: '2026-08-01T00:00:00Z', classification: 'FEE' },
  ];

  it('classifies each rent-eligible period and excludes non-rent classifications', () => {
    const entries = buildPaymentChronology(rows);
    expect(entries).toHaveLength(4);
    expect(entries.map((e) => e.status)).toEqual(['on_time', 'late', 'partially_late', 'unpaid']);
  });

  it('counts late/partial/unpaid periods without concluding a legal threshold', () => {
    const entries = buildPaymentChronology(rows);
    expect(countLatePeriods(entries)).toBe(3);
  });
});

function baseN8Input(overrides: Partial<N8WorkflowInput> = {}): N8WorkflowInput {
  return {
    tenantNames: ['Jane Tenant'],
    propertyAddress: '123 Main St',
    unitNumber: '2',
    landlordName: 'Tina Landlord',
    reason: 'persistent_late_payment',
    groundsDescription: 'Rent was paid more than 5 days late in each of the last 4 months, as shown in the ledger.',
    chronology: [],
    noOtherRehabTenantOverFourYears: false,
    serviceMethod: 'hand_to_tenant',
    intendedServiceDate: '2026-09-01',
    rentFrequency: 'monthly',
    ...overrides,
  };
}

describe('N8 grounds — five reasons per the official form (verified 2026-08-31)', () => {
  it('does not require the payment chronology for a non-late-payment ground', () => {
    const items = N8Workflow.validate(baseN8Input({ reason: 'employment_conditioned_unit_ended', chronology: [] }));
    expect(items.some((i) => i.code === 'NO_LATE_HISTORY_FOUND')).toBe(false);
  });

  it('blocks the rehab/therapeutic ground unless the 4-year condition is confirmed', () => {
    const items = N8Workflow.validate(baseN8Input({ reason: 'rehab_therapeutic_period_ended', noOtherRehabTenantOverFourYears: false }));
    expect(hasBlockers(items)).toBe(true);
    expect(items.some((i) => i.code === 'REHAB_FOUR_YEAR_CONDITION_NOT_MET')).toBe(true);
  });

  it('passes the rehab/therapeutic ground once the 4-year condition is confirmed', () => {
    const items = N8Workflow.validate(baseN8Input({ reason: 'rehab_therapeutic_period_ended', noOtherRehabTenantOverFourYears: true }));
    expect(items.some((i) => i.code === 'REHAB_FOUR_YEAR_CONDITION_NOT_MET')).toBe(false);
  });
});
