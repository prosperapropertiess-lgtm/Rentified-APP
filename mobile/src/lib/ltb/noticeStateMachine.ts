// Notice workflow state machine — spec section 8. Every status transition
// is explicit and validated; nothing is inferred from boolean flags like
// isServed/isFiled scattered across the record.

import type { NoticeStatus } from './types';

export const NOTICE_STATUSES: NoticeStatus[] = [
  'DRAFT', 'NEEDS_INFORMATION', 'READY_FOR_REVIEW', 'READY_TO_SERVE', 'SERVED',
  'WAITING_PERIOD', 'CURE_PERIOD', 'VOID', 'RESOLVED', 'ELIGIBLE_FOR_APPLICATION',
  'APPLICATION_DRAFT', 'APPLICATION_READY', 'APPLICATION_FILED', 'HEARING_SCHEDULED',
  'ORDER_RECEIVED', 'CLOSED', 'CANCELLED',
];

// Allowed forward transitions. Any transition not listed here is rejected
// by assertValidTransition — including skipping steps (e.g. DRAFT straight
// to SERVED), which the spec explicitly calls out as a failure mode to
// engineer against (section 47, "skipped steps").
const ALLOWED_TRANSITIONS: Record<NoticeStatus, NoticeStatus[]> = {
  DRAFT: ['NEEDS_INFORMATION', 'READY_FOR_REVIEW', 'CANCELLED'],
  NEEDS_INFORMATION: ['DRAFT', 'READY_FOR_REVIEW', 'CANCELLED'],
  READY_FOR_REVIEW: ['DRAFT', 'READY_TO_SERVE', 'CANCELLED'],
  READY_TO_SERVE: ['SERVED', 'DRAFT', 'CANCELLED'], // back to DRAFT covers "corrected before serving"
  SERVED: ['WAITING_PERIOD', 'CURE_PERIOD', 'VOID'],
  WAITING_PERIOD: ['ELIGIBLE_FOR_APPLICATION', 'VOID', 'RESOLVED'],
  CURE_PERIOD: ['ELIGIBLE_FOR_APPLICATION', 'VOID', 'RESOLVED', 'WAITING_PERIOD'],
  VOID: ['CLOSED'],
  RESOLVED: ['CLOSED'],
  ELIGIBLE_FOR_APPLICATION: ['APPLICATION_DRAFT', 'RESOLVED', 'VOID'],
  APPLICATION_DRAFT: ['APPLICATION_READY', 'CANCELLED'],
  APPLICATION_READY: ['APPLICATION_FILED', 'APPLICATION_DRAFT'],
  APPLICATION_FILED: ['HEARING_SCHEDULED', 'ORDER_RECEIVED'],
  HEARING_SCHEDULED: ['ORDER_RECEIVED'],
  ORDER_RECEIVED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export function getAllowedTransitions(from: NoticeStatus): NoticeStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

export function canTransition(from: NoticeStatus, to: NoticeStatus): boolean {
  return getAllowedTransitions(from).includes(to);
}

export class InvalidNoticeTransitionError extends Error {
  constructor(from: NoticeStatus, to: NoticeStatus) {
    super(`Cannot move a notice from ${from} to ${to} — that transition isn't allowed by the notice workflow.`);
    this.name = 'InvalidNoticeTransitionError';
  }
}

export function assertValidTransition(from: NoticeStatus, to: NoticeStatus): void {
  if (!canTransition(from, to)) throw new InvalidNoticeTransitionError(from, to);
}

// Terminal / non-served states — served notices become effectively
// immutable per spec section 7; these are the states after which the
// notice's core fields (tenant names, rent, dates as generated) must not
// be silently rewritten by an unrelated data edit elsewhere in the app.
export const SERVED_OR_LATER: NoticeStatus[] = [
  'SERVED', 'WAITING_PERIOD', 'CURE_PERIOD', 'VOID', 'RESOLVED', 'ELIGIBLE_FOR_APPLICATION',
  'APPLICATION_DRAFT', 'APPLICATION_READY', 'APPLICATION_FILED', 'HEARING_SCHEDULED',
  'ORDER_RECEIVED', 'CLOSED',
];

export function isServedOrLater(status: NoticeStatus): boolean {
  return SERVED_OR_LATER.includes(status);
}

export const STATUS_LABELS: Record<NoticeStatus, string> = {
  DRAFT: 'Draft',
  NEEDS_INFORMATION: 'Needs Information',
  READY_FOR_REVIEW: 'Ready for Review',
  READY_TO_SERVE: 'Ready to Serve',
  SERVED: 'Served',
  WAITING_PERIOD: 'Waiting Period',
  CURE_PERIOD: 'Monitoring / Cure Period',
  VOID: 'Void',
  RESOLVED: 'Resolved',
  ELIGIBLE_FOR_APPLICATION: 'Eligible for Application',
  APPLICATION_DRAFT: 'Application Draft',
  APPLICATION_READY: 'Application Ready',
  APPLICATION_FILED: 'Application Filed',
  HEARING_SCHEDULED: 'Hearing Scheduled',
  ORDER_RECEIVED: 'Order Received',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
