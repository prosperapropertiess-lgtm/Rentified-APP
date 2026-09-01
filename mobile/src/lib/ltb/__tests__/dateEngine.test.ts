import { addDays, addMonths, compareDates, isValidCalendarDate, isWeekend, isOntarioStatutoryHoliday, isBusinessDay, nextBusinessDay } from '../dateEngine';

describe('addDays — pure calendar math, no timezone drift', () => {
  it('adds within a month', () => {
    expect(addDays('2026-08-01', 5)).toBe('2026-08-06');
  });

  it('rolls over a month boundary', () => {
    expect(addDays('2026-08-30', 5)).toBe('2026-09-04');
  });

  it('rolls over a year boundary', () => {
    expect(addDays('2026-12-29', 5)).toBe('2027-01-03');
  });

  it('handles February in a leap year (2028)', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('handles February in a non-leap year (2026)', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('supports negative offsets', () => {
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('never shifts a day due to UTC/local timezone conversion — the exact bug class this app hit in production', () => {
    // A naive `new Date('2026-08-01').toLocaleDateString()` in a timezone
    // west of UTC would print July 31. addDays must never do that.
    const result = addDays('2026-08-01', 0);
    expect(result).toBe('2026-08-01');
  });
});

describe('addMonths — clamps to the real last day of the target month', () => {
  it('adds a simple month', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
  });

  it('clamps Jan 31 + 1 month to Feb 28 in a non-leap year', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('clamps Jan 31 + 1 month to Feb 29 in a leap year', () => {
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('rolls over a year boundary', () => {
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
  });

  it('supports negative offsets', () => {
    expect(addMonths('2026-03-15', -1)).toBe('2026-02-15');
  });
});

describe('compareDates', () => {
  it('orders correctly', () => {
    expect(compareDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareDates('2026-01-01', '2026-01-01')).toBe(0);
  });
});

describe('isValidCalendarDate', () => {
  it('accepts real dates', () => {
    expect(isValidCalendarDate('2026-08-31')).toBe(true);
  });
  it('rejects Feb 30 (not a real date, even though the string looks well-formed)', () => {
    expect(isValidCalendarDate('2026-02-30')).toBe(false);
  });
  it('rejects malformed strings', () => {
    expect(isValidCalendarDate('not-a-date')).toBe(false);
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
  });
});

describe('isWeekend / isBusinessDay / nextBusinessDay', () => {
  it('flags a known Saturday and Sunday', () => {
    // 2026-08-29 is a Saturday, 2026-08-30 a Sunday.
    expect(isWeekend('2026-08-29')).toBe(true);
    expect(isWeekend('2026-08-30')).toBe(true);
    expect(isWeekend('2026-08-31')).toBe(false);
  });

  it('flags a configured statutory holiday', () => {
    expect(isOntarioStatutoryHoliday('2026-01-01')).toBe(true);
    expect(isOntarioStatutoryHoliday('2026-01-02')).toBe(false);
  });

  it('a holiday that also falls on a weekday is not a business day', () => {
    // 2026-07-01 (Canada Day) is a Wednesday.
    expect(isBusinessDay('2026-07-01')).toBe(false);
  });

  it('nextBusinessDay skips weekends', () => {
    // Friday 2026-08-28 -> next business day should be Monday 2026-08-31.
    expect(nextBusinessDay('2026-08-28')).toBe('2026-08-31');
  });
});
