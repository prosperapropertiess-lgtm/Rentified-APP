import type { NoticeWorkflow } from '../workflow';
import type { ValidationItem, CalendarDate, ServiceMethod } from '../types';
import { calculateN6Dates, type N6Reason } from './n6';
import { todayCalendarDate } from '../dateEngine';

export interface N6Incident {
  occurredAt: string;
  location: string | null;
  description: string;
}

export interface N6WorkflowInput {
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  landlordName: string;
  reason: N6Reason;
  incidents: N6Incident[];
  isSubsequentNotice: boolean;
  serviceMethod: ServiceMethod;
  intendedServiceDate: CalendarDate;
  hasEmailConsentOnFile?: boolean;
}

function validateN6(input: N6WorkflowInput): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (input.tenantNames.length === 0) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANT_NAME', message: 'At least one tenant name is required.' });
  }
  if (!input.propertyAddress?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_ADDRESS', message: 'Property address is incomplete.' });
  }
  if (input.incidents.length === 0 || !input.incidents.some((i) => i.description?.trim())) {
    items.push({ level: 'BLOCKER', code: 'MISSING_INCIDENT_DETAILS', message: 'Describe at least one specific incident (or the income misrepresentation) with a date and details — required for this notice.' });
  }

  const methodResult = calculateN6Dates({
    reason: input.reason,
    intendedServiceDate: input.intendedServiceDate,
    serviceMethod: input.serviceMethod,
    isSubsequentNotice: input.isSubsequentNotice,
    hasEmailConsentOnFile: input.hasEmailConsentOnFile,
  });
  if (!methodResult.serviceAllowed) {
    items.push({ level: 'BLOCKER', code: 'SERVICE_METHOD_NOT_ALLOWED', message: methodResult.serviceDenyReason ?? 'This service method is not allowed for N6.' });
  }
  if (input.intendedServiceDate < todayCalendarDate()) {
    items.push({ level: 'WARNING', code: 'SERVICE_DATE_IN_PAST', message: 'Intended service date is in the past — confirm this reflects reality.' });
  }
  if (input.reason === 'drug_related_illegal_act' && input.isSubsequentNotice) {
    items.push({ level: 'INFO', code: 'REASON_1_FLAT_PERIOD', message: 'Reason 1 (drug-related) always uses the flat 10-day period — the subsequent-notice flag has no effect for this reason.' });
  }

  items.push({ level: 'INFO', code: 'RULES_VERIFIED', message: 'Notice periods were verified against tribunalsontario.ca on 2026-08-31.' });

  return items;
}

export const N6Workflow: NoticeWorkflow<N6WorkflowInput, ReturnType<typeof calculateN6Dates>> = {
  formCode: 'N6',
  validate: validateN6,
  calculateDates: (input) =>
    calculateN6Dates({
      reason: input.reason,
      intendedServiceDate: input.intendedServiceDate,
      serviceMethod: input.serviceMethod,
      isSubsequentNotice: input.isSubsequentNotice,
      hasEmailConsentOnFile: input.hasEmailConsentOnFile,
    }),
  buildDocumentData: (input, dates) => ({
    formCode: 'N6',
    tenantNames: input.tenantNames,
    propertyAddress: input.propertyAddress,
    unitNumber: input.unitNumber,
    landlordName: input.landlordName,
    reason: input.reason,
    incidents: input.incidents,
    dates,
  }),
  determineNextActions: (status) => {
    switch (status) {
      case 'DRAFT': return ['Add incident/details'];
      case 'READY_FOR_REVIEW': return ['Review and mark Ready to Serve'];
      case 'READY_TO_SERVE': return ['Serve the notice, then record service'];
      case 'SERVED': return ['Record actual service to start the notice period'];
      case 'WAITING_PERIOD': return ['Wait for the termination date, then prepare an L2 application if the tenant has not left'];
      default: return [];
    }
  },
};
