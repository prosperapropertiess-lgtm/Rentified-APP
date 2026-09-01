// Shared contract every form's workflow implements — spec section 74.
// N4Workflow, N5Workflow, etc. each implement this instead of one giant
// NoticeService.ts full of form-specific conditionals.

import type { ValidationItem } from './types';

export interface NoticeWorkflow<TInput, TDates> {
  formCode: string;
  validate(input: TInput): ValidationItem[];
  calculateDates(input: TInput): TDates;
  buildDocumentData(input: TInput, dates: TDates): Record<string, unknown>;
  determineNextActions(status: string, context: TInput): string[];
}

export function hasBlockers(items: ValidationItem[]): boolean {
  return items.some((i) => i.level === 'BLOCKER');
}
