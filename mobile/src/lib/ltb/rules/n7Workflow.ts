import type { NoticeWorkflow } from '../workflow';
import type { ValidationItem, CalendarDate, ServiceMethod } from '../types';
import { calculateN7Dates, type N7Reason } from './n7';
import { todayCalendarDate } from '../dateEngine';

export interface N7Incident {
  occurredAt: string;
  location: string | null;
  description: string;
}

export interface N7WorkflowInput {
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  landlordName: string;
  reason: N7Reason;
  incidents: N7Incident[];
  landlordAlsoLivesInBuilding: boolean; // only meaningful for small_building_interference
  serviceMethod: ServiceMethod;
  intendedServiceDate: CalendarDate;
  hasEmailConsentOnFile?: boolean;
}

function validateN7(input: N7WorkflowInput): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (input.tenantNames.length === 0) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANT_NAME', message: 'At least one tenant name is required.' });
  }
  if (!input.propertyAddress?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_ADDRESS', message: 'Property address is incomplete.' });
  }
  if (input.incidents.length === 0 || !input.incidents.some((i) => i.description?.trim())) {
    items.push({ level: 'BLOCKER', code: 'MISSING_INCIDENT_DETAILS', message: 'Describe at least one specific incident with a date and details — required for this notice.' });
  }
  // VERIFIED 2026-08-31: Reason 4 only applies "if you and I live in the
  // same building that has 3 or fewer residential units."
  if (input.reason === 'small_building_interference' && !input.landlordAlsoLivesInBuilding) {
    items.push({ level: 'BLOCKER', code: 'REASON_4_CONDITION_NOT_MET', message: 'This ground only applies to a building of 3 or fewer units where the landlord also lives — confirm this before proceeding.' });
  }

  const methodResult = calculateN7Dates({
    intendedServiceDate: input.intendedServiceDate,
    serviceMethod: input.serviceMethod,
    hasEmailConsentOnFile: input.hasEmailConsentOnFile,
  });
  if (!methodResult.serviceAllowed) {
    items.push({ level: 'BLOCKER', code: 'SERVICE_METHOD_NOT_ALLOWED', message: methodResult.serviceDenyReason ?? 'This service method is not allowed for N7.' });
  }
  if (input.intendedServiceDate < todayCalendarDate()) {
    items.push({ level: 'WARNING', code: 'SERVICE_DATE_IN_PAST', message: 'Intended service date is in the past — confirm this reflects reality.' });
  }

  items.push({ level: 'INFO', code: 'RULES_VERIFIED', message: 'Notice period (10 days, flat) was verified against tribunalsontario.ca on 2026-08-31.' });

  return items;
}

export const N7Workflow: NoticeWorkflow<N7WorkflowInput, ReturnType<typeof calculateN7Dates>> = {
  formCode: 'N7',
  validate: validateN7,
  calculateDates: (input) =>
    calculateN7Dates({
      intendedServiceDate: input.intendedServiceDate,
      serviceMethod: input.serviceMethod,
      hasEmailConsentOnFile: input.hasEmailConsentOnFile,
    }),
  buildDocumentData: (input, dates) => ({
    formCode: 'N7',
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
      case 'DRAFT': return ['Add incident details'];
      case 'READY_FOR_REVIEW': return ['Review and mark Ready to Serve'];
      case 'READY_TO_SERVE': return ['Serve the notice, then record service'];
      case 'SERVED': return ['Record actual service to start the notice period'];
      case 'WAITING_PERIOD': return ['Wait for the termination date, then prepare an L2 application if the tenant has not left'];
      default: return [];
    }
  },
};
