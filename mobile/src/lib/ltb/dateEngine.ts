// LegalDateEngine — calendar-date-safe arithmetic for Ontario LTB workflows.
//
// Every legal date in this module is a plain 'YYYY-MM-DD' string, never a
// bare `new Date(...)`. All arithmetic below is done with Date.UTC() and
// getUTC* accessors exclusively — this app already hit a real production
// bug this session (Rentified_App/mobile, payments module, Aug 2026) where
// comparing a UTC-midnight-anchored date with local Date methods rolled it
// back a day west of UTC. Legal deadlines are exactly the kind of value
// where that class of bug is unacceptable — do not "fix" this file by
// swapping in local Date methods for convenience.

import type { CalendarDate } from './types';

export function isValidCalendarDate(s: string): s is CalendarDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUTCDate(date: CalendarDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTCDate(dt: Date): CalendarDate {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local calendar date "today" — the one place local time is actually
 * correct, since this answers "what day is it right now for this person,"
 * not "what calendar date did a stored UTC timestamp represent." */
export function todayCalendarDate(): CalendarDate {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const dt = toUTCDate(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUTCDate(dt);
}

/** Adds calendar months, clamping to the last real day of the target month
 * (Jan 31 + 1 month = Feb 28/29, never overflows into March). */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const [y, m, d] = date.split('-').map(Number);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDayOfTargetMonth);
  return fromUTCDate(new Date(Date.UTC(targetYear, targetMonth, clampedDay)));
}

export function compareDates(a: CalendarDate, b: CalendarDate): -1 | 0 | 1 {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isWeekend(date: CalendarDate): boolean {
  const day = toUTCDate(date).getUTCDay();
  return day === 0 || day === 6;
}

// NEEDS_REVIEW: Ontario statutory holidays relevant to LTB service/notice
// calculations — this list was populated from general knowledge, not a
// live check against a current official Ontario government source. Verify
// before relying on it for a real notice, and extend/regenerate for years
// beyond 2027.
export const ONTARIO_STATUTORY_HOLIDAYS_NEEDS_REVIEW: CalendarDate[] = [
  '2026-01-01', '2026-02-16', '2026-04-03', '2026-05-18', '2026-07-01',
  '2026-08-03', '2026-09-07', '2026-10-12', '2026-12-25', '2026-12-26',
  '2027-01-01', '2027-02-15', '2027-03-26', '2027-05-24', '2027-07-01',
  '2027-08-02', '2027-09-06', '2027-10-11', '2027-12-25', '2027-12-27',
];

export function isOntarioStatutoryHoliday(date: CalendarDate): boolean {
  return ONTARIO_STATUTORY_HOLIDAYS_NEEDS_REVIEW.includes(date);
}

export function isBusinessDay(date: CalendarDate): boolean {
  return !isWeekend(date) && !isOntarioStatutoryHoliday(date);
}

export function nextBusinessDay(date: CalendarDate): CalendarDate {
  let d = addDays(date, 1);
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}

export function formatCalendarDateHuman(date: CalendarDate): string {
  const dt = toUTCDate(date);
  return dt.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
