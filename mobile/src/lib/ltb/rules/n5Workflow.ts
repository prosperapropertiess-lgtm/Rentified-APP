import type { NoticeWorkflow } from '../workflow';
import type { ValidationItem, ServiceMethod } from '../types';
import { calculateN5Dates } from './n5';
import { todayCalendarDate, addDays } from '../dateEngine';

export interface N5Incident {
  occurredAt: string;
  location: string | null;
  peopleInvolved: string | null;
  description: string;
  witnesses: string | null;
  policeReportNumber: string | null;
}

export interface N5WorkflowInput {
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  postalCode: string | null;
  landlordName: string;
  reason: 'interference' | 'damage' | 'overcrowding' | 'other';
  incidents: N5Incident[];
  isSubsequentNotice: boolean;
  priorN5ServedDate: string | null;
  intendedServiceDate: string;
  serviceMethod: ServiceMethod | null;
}

function validateN5(input: N5WorkflowInput): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (input.tenantNames.length === 0 || input.tenantNames.some((n) => !n.trim())) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANT_NAME', message: 'At least one complete tenant name is required.' });
  }
  if (!input.propertyAddress?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_ADDRESS', message: 'Property address is incomplete.' });
  }
  if (input.incidents.length === 0) {
    items.push({ level: 'BLOCKER', code: 'NO_INCIDENTS', message: 'At least one incident must be recorded to support this notice.' });
  }
  input.incidents.forEach((inc, i) => {
    if (!inc.description?.trim()) {
      items.push({ level: 'BLOCKER', code: `INCIDENT_${i}_NO_DESCRIPTION`, message: `Incident ${i + 1} is missing a description.` });
    }
    if (!inc.occurredAt) {
      items.push({ level: 'BLOCKER', code: `INCIDENT_${i}_NO_DATE`, message: `Incident ${i + 1} is missing a date.` });
    }
  });
  if (!input.serviceMethod) {
    items.push({ level: 'WARNING', code: 'NO_SERVICE_METHOD', message: 'Service method not selected yet.' });
  }
  if (input.isSubsequentNotice && !input.priorN5ServedDate) {
    items.push({ level: 'WARNING', code: 'SUBSEQUENT_NO_PRIOR_DATE', message: 'Marked as a subsequent notice, but no prior N5 service date was found — double check.' });
  }
  // Verified against the official N5 form (tribunalsontario.ca, fetched
  // 2026-08-31): "A landlord cannot give you a second N5 Notice to End
  // your Tenancy unless at least 7 days have passed since the first N5
  // notice was given."
  if (input.isSubsequentNotice && input.priorN5ServedDate) {
    const earliestAllowed = addDays(input.priorN5ServedDate, 7);
    if (input.intendedServiceDate < earliestAllowed) {
      items.push({ level: 'BLOCKER', code: 'SUBSEQUENT_TOO_SOON', message: `A second N5 cannot be served less than 7 days after the first — earliest allowed is ${earliestAllowed}.` });
    }
  }
  if (input.intendedServiceDate < todayCalendarDate()) {
    items.push({ level: 'WARNING', code: 'SERVICE_DATE_IN_PAST', message: 'Intended service date is in the past — confirm this reflects when it was/will be served.' });
  }

  items.push({ level: 'INFO', code: 'RULES_VERIFIED', message: 'Notice periods (20/14 days) and the 7-day cure period were verified against tribunalsontario.ca on 2026-08-31.' });

  return items;
}

export const N5Workflow: NoticeWorkflow<N5WorkflowInput, ReturnType<typeof calculateN5Dates>> = {
  formCode: 'N5',
  validate: validateN5,
  calculateDates: (input) =>
    calculateN5Dates({
      intendedServiceDate: input.intendedServiceDate,
      serviceMethod: input.serviceMethod ?? 'hand_to_tenant',
      isSubsequentNotice: input.isSubsequentNotice,
    }),
  buildDocumentData: (input, dates) => ({
    formCode: 'N5',
    tenantNames: input.tenantNames,
    propertyAddress: input.propertyAddress,
    unitNumber: input.unitNumber,
    postalCode: input.postalCode,
    landlordName: input.landlordName,
    reason: input.reason,
    incidents: input.incidents,
    dates,
  }),
  determineNextActions: (status) => {
    switch (status) {
      case 'DRAFT': return ['Add incidents', 'Select service method'];
      case 'READY_FOR_REVIEW': return ['Review and mark Ready to Serve'];
      case 'READY_TO_SERVE': return ['Serve the notice, then record service'];
      case 'SERVED': return ['Record actual service to start monitoring'];
      case 'CURE_PERIOD': return ['Monitor for further incidents until the cure deadline'];
      case 'WAITING_PERIOD': return ['Monitor for further incidents'];
      case 'ELIGIBLE_FOR_APPLICATION': return ['Prepare L2 application'];
      default: return [];
    }
  },
};
