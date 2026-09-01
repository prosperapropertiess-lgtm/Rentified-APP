import { calculateBalance, isEligibleForReminder } from '../balanceState';

// Anchor "today" so DUE_TODAY/OVERDUE/NOT_DUE tests are deterministic
// regardless of when this suite runs.
beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00Z'));
});
afterAll(() => {
  jest.useRealTimers();
});

describe('calculateBalance', () => {
  it('is PAID when nothing is owing', () => {
    const result = calculateBalance([{ id: '1', amount: 1500, due_date: '2026-09-01', status: 'paid', classification: 'RENT', paid_at: '2026-09-01T00:00:00Z' }]);
    expect(result.state).toBe('PAID');
    expect(result.totalOwing).toBe(0);
  });

  it('is PARTIAL with the correct remaining balance (collected + remainder rows, per this app\'s real payment pattern)', () => {
    const result = calculateBalance([
      { id: '1', amount: 1200, due_date: '2026-09-01', status: 'partial', classification: 'RENT', paid_at: null },
      { id: '2', amount: 800, due_date: '2026-09-01', status: 'pending', classification: 'RENT', paid_at: null },
    ]);
    expect(result.state).toBe('PARTIAL');
    expect(result.totalOwing).toBe(800);
    expect(result.totalPaid).toBe(1200);
  });

  it('is OVERDUE when due date is in the past and unpaid', () => {
    const result = calculateBalance([{ id: '1', amount: 1500, due_date: '2026-09-01', status: 'pending', classification: 'RENT', paid_at: null }]);
    expect(result.state).toBe('OVERDUE');
    expect(result.totalOwing).toBe(1500);
  });

  it('is DUE_TODAY when the due date is today and unpaid', () => {
    const result = calculateBalance([{ id: '1', amount: 1500, due_date: '2026-09-15', status: 'pending', classification: 'RENT', paid_at: null }]);
    expect(result.state).toBe('DUE_TODAY');
  });

  it('is NOT_DUE when due date is in the future and unpaid', () => {
    const result = calculateBalance([{ id: '1', amount: 1500, due_date: '2026-10-01', status: 'pending', classification: 'RENT', paid_at: null }]);
    expect(result.state).toBe('NOT_DUE');
  });

  it('excludes non-rent classifications from the balance', () => {
    const result = calculateBalance([
      { id: '1', amount: 1500, due_date: '2026-09-01', status: 'paid', classification: 'RENT', paid_at: '2026-09-01T00:00:00Z' },
      { id: '2', amount: 200, due_date: '2026-09-01', status: 'pending', classification: 'DAMAGE', paid_at: null },
    ]);
    expect(result.state).toBe('PAID');
    expect(result.totalOwing).toBe(0);
  });
});

describe('isEligibleForReminder', () => {
  it('flags OUTSTANDING, OVERDUE, PARTIAL, and DUE_TODAY as eligible', () => {
    expect(isEligibleForReminder('OVERDUE')).toBe(true);
    expect(isEligibleForReminder('PARTIAL')).toBe(true);
    expect(isEligibleForReminder('DUE_TODAY')).toBe(true);
    expect(isEligibleForReminder('OUTSTANDING')).toBe(true);
  });

  it('does not flag PAID or NOT_DUE as eligible', () => {
    expect(isEligibleForReminder('PAID')).toBe(false);
    expect(isEligibleForReminder('NOT_DUE')).toBe(false);
  });
});
