import type { NoticeWorkflow } from '../workflow';
import type { ValidationItem, CalendarDate } from '../types';
import { calculateN11Dates } from './n11';
import { todayCalendarDate } from '../dateEngine';

export interface N11WorkflowInput {
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  landlordName: string;
  agreementSignedDate: CalendarDate;
  agreedTerminationDate: CalendarDate;
  tenantSignedVoluntarily: boolean;
  isTenancyStart: boolean; // true if this is being signed at the start of the tenancy
}

function validateN11(input: N11WorkflowInput): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (input.tenantNames.length === 0) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANT_NAME', message: 'At least one tenant name is required.' });
  }
  if (!input.propertyAddress?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_ADDRESS', message: 'Property address is incomplete.' });
  }
  if (!input.agreedTerminationDate) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TERMINATION_DATE', message: 'The date both parties agreed the tenancy will end is required.' });
  }
  if (!input.tenantSignedVoluntarily) {
    items.push({ level: 'BLOCKER', code: 'VOLUNTARINESS_NOT_CONFIRMED', message: 'Confirm the tenant signed this voluntarily — a landlord cannot require a tenant to sign an N11.' });
  }
  if (input.isTenancyStart) {
    items.push({ level: 'BLOCKER', code: 'SIGNED_AT_TENANCY_START', message: 'A landlord cannot require this to be signed at the start of the tenancy for a later date — this notice cannot proceed as entered.' });
  }
  if (input.agreedTerminationDate && input.agreedTerminationDate < todayCalendarDate()) {
    items.push({ level: 'WARNING', code: 'TERMINATION_DATE_IN_PAST', message: 'The agreed termination date is in the past — confirm this reflects reality.' });
  }

  items.push({ level: 'INFO', code: 'NO_MINIMUM_PERIOD', message: 'N11 has no legally-computed minimum notice period — it\'s a mutual agreement on whatever date both parties chose.' });

  return items;
}

export const N11Workflow: NoticeWorkflow<N11WorkflowInput, ReturnType<typeof calculateN11Dates>> = {
  formCode: 'N11',
  validate: validateN11,
  calculateDates: (input) =>
    calculateN11Dates({
      agreementSignedDate: input.agreementSignedDate,
      agreedTerminationDate: input.agreedTerminationDate,
    }),
  buildDocumentData: (input, dates) => ({
    formCode: 'N11',
    tenantNames: input.tenantNames,
    propertyAddress: input.propertyAddress,
    unitNumber: input.unitNumber,
    landlordName: input.landlordName,
    dates,
  }),
  determineNextActions: (status) => {
    switch (status) {
      case 'DRAFT': return ['Confirm both parties have signed'];
      case 'READY_FOR_REVIEW': return ['Review and mark Ready to Serve'];
      case 'READY_TO_SERVE': return ['Record the signing date'];
      case 'SERVED': return ['Record the signing date to confirm the agreement'];
      case 'WAITING_PERIOD': return ['Wait for the agreed termination date'];
      default: return [];
    }
  },
};
