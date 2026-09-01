import type { NoticeWorkflow } from '../workflow';
import type { ValidationItem, CalendarDate } from '../types';
import { calculateN1 } from './n1';
import { todayCalendarDate } from '../dateEngine';

export interface N1WorkflowInput {
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  landlordName: string;
  currentRent: number;
  proposedRent: number;
  lastIncreaseEffectiveDateOrTenancyStart: CalendarDate;
  intendedServiceDate: CalendarDate;
  anotherIncreaseAlreadyScheduled: boolean;
}

function validateN1(input: N1WorkflowInput): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (input.tenantNames.length === 0) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANT_NAME', message: 'At least one tenant name is required.' });
  }
  if (!input.propertyAddress?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_ADDRESS', message: 'Property address is incomplete.' });
  }
  if (!input.proposedRent || input.proposedRent <= input.currentRent) {
    items.push({ level: 'BLOCKER', code: 'PROPOSED_RENT_NOT_INCREASE', message: 'Proposed rent must be greater than the current rent.' });
  }
  if (!input.lastIncreaseEffectiveDateOrTenancyStart) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANCY_START', message: 'Tenancy start / last increase date is required to check eligibility.' });
  }

  const calc = calculateN1({
    intendedServiceDate: input.intendedServiceDate,
    lastIncreaseEffectiveDateOrTenancyStart: input.lastIncreaseEffectiveDateOrTenancyStart,
    currentRent: input.currentRent,
    proposedRent: input.proposedRent,
  });

  if (!calc.isEligibleYet) {
    items.push({ level: 'BLOCKER', code: 'TOO_EARLY', message: `This increase appears too early — not eligible until ${calc.eligibilityDate} under the configured rule.` });
  }
  if (calc.exceedsGuideline) {
    items.push({ level: 'WARNING', code: 'EXCEEDS_GUIDELINE', message: `Proposed increase (${calc.proposedIncreasePercent}%) exceeds the configured guideline (${calc.guidelinePercent}%). An above-guideline increase may need additional approval (N10/L5) — review before proceeding.` });
  }
  if (input.anotherIncreaseAlreadyScheduled) {
    items.push({ level: 'BLOCKER', code: 'ANOTHER_SCHEDULED', message: 'Another rent increase is already scheduled for this tenancy.' });
  }
  if (input.intendedServiceDate < todayCalendarDate()) {
    items.push({ level: 'WARNING', code: 'SERVICE_DATE_IN_PAST', message: 'Intended service date is in the past — confirm this reflects reality.' });
  }

  items.push({ level: 'INFO', code: 'RULES_VERIFIED', message: `Notice period (90 days), 12-month spacing, and the ${calc.guidelinePercent}% guideline were verified against tribunalsontario.ca on 2026-08-31. The guideline changes every year — re-check each January.` });

  return items;
}

export const N1Workflow: NoticeWorkflow<N1WorkflowInput, ReturnType<typeof calculateN1>> = {
  formCode: 'N1',
  validate: validateN1,
  calculateDates: (input) =>
    calculateN1({
      intendedServiceDate: input.intendedServiceDate,
      lastIncreaseEffectiveDateOrTenancyStart: input.lastIncreaseEffectiveDateOrTenancyStart,
      currentRent: input.currentRent,
      proposedRent: input.proposedRent,
    }),
  buildDocumentData: (input, dates) => ({
    formCode: 'N1',
    tenantNames: input.tenantNames,
    propertyAddress: input.propertyAddress,
    unitNumber: input.unitNumber,
    landlordName: input.landlordName,
    currentRent: input.currentRent,
    proposedRent: input.proposedRent,
    dates,
  }),
  determineNextActions: (status) => {
    switch (status) {
      case 'DRAFT': return ['Complete required information'];
      case 'READY_FOR_REVIEW': return ['Review and mark Ready to Serve'];
      case 'READY_TO_SERVE': return ['Serve the notice, then record service'];
      case 'SERVED': return ['Record actual service to start the waiting period'];
      case 'WAITING_PERIOD': return ['Wait for the effective date, then confirm and apply the increase'];
      default: return [];
    }
  },
};
