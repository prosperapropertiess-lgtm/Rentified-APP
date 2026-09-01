// Ontario LTB Notice & Legal Workflow Engine — shared domain types.
// Pure types/logic only in src/lib/ltb/** — no UI imports here, per the
// spec's "rules engine must be independent of UI components" requirement.

export type CalendarDate = string; // always 'YYYY-MM-DD', never a Date with implied time-of-day

export type ServiceMethod =
  | 'hand_to_tenant'
  | 'adult_in_unit'
  | 'mailbox_or_mail_slot'
  | 'under_door'
  | 'regular_mail'
  | 'courier'
  | 'email'
  | 'ltb_portal';

export type NoticeStatus =
  | 'DRAFT'
  | 'NEEDS_INFORMATION'
  | 'READY_FOR_REVIEW'
  | 'READY_TO_SERVE'
  | 'SERVED'
  | 'WAITING_PERIOD'
  | 'CURE_PERIOD'
  | 'VOID'
  | 'RESOLVED'
  | 'ELIGIBLE_FOR_APPLICATION'
  | 'APPLICATION_DRAFT'
  | 'APPLICATION_READY'
  | 'APPLICATION_FILED'
  | 'HEARING_SCHEDULED'
  | 'ORDER_RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

export type ValidationLevel = 'INFO' | 'WARNING' | 'BLOCKER';

export interface ValidationItem {
  level: ValidationLevel;
  code: string;
  message: string;
}

export interface RentFrequency {
  kind: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'yearly';
}

// A resolved legal rule, as pulled from ltb_rule_versions — see the shape
// example in the spec (section 2). needsReview mirrors the DB column: any
// rule built tonight defaults to true until a human verifies it against a
// live Tribunals Ontario source.
export interface LTBRule {
  ruleId: string;
  formCode: string;
  jurisdiction: 'ON';
  version: string;
  effectiveFrom: CalendarDate;
  effectiveTo: CalendarDate | null;
  sourceName?: string;
  sourceUrl?: string;
  lastVerifiedAt?: string | null;
  needsReview: boolean;
  description: string;
  logic: Record<string, unknown>;
}

export interface DateCalculationExplanation {
  label: string;
  value: string;
}

export interface DateCalculationResult {
  deemedServiceDate: CalendarDate;
  minimumNoticeDays: number;
  earliestValidTerminationDate: CalendarDate;
  ruleId: string;
  ruleVersion: string;
  needsReview: boolean;
  explanation: DateCalculationExplanation[];
}

export interface ServiceMethodRuleResult {
  allowed: boolean;
  reason?: string;
  extraDays: number; // days added to service date to get deemed service date
  proofRequired: boolean;
}

// Only amounts legally considered "rent" for N4 purposes should be summed
// into arrears — see spec section 10.
export type LedgerLineClassification =
  | 'RENT'
  | 'PARKING_AS_RENT'
  | 'OTHER_RECURRING_RENT'
  | 'UTILITY'
  | 'DAMAGE'
  | 'NSF'
  | 'FEE'
  | 'OTHER';

export interface RentPeriodBreakdown {
  periodLabel: string; // 'January 2026'
  periodStart: CalendarDate;
  periodEnd: CalendarDate;
  rentCharged: number;
  rentPaid: number;
  balance: number;
}

export interface ArrearsResult {
  periods: RentPeriodBreakdown[];
  totalOwing: number;
  manuallyAdjusted: boolean;
  adjustmentReason?: string;
  computedAt: string;
}
