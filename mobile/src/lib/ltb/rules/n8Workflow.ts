import type { NoticeWorkflow } from '../workflow';
import type { ValidationItem, CalendarDate, ServiceMethod } from '../types';
import { calculateN8Dates, type N8Reason } from './n8';
import { todayCalendarDate } from '../dateEngine';
import { countLatePeriods, type ChronologyEntry } from '../paymentChronology';

export interface N8WorkflowInput {
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  landlordName: string;
  reason: N8Reason;
  groundsDescription: string;
  chronology: ChronologyEntry[]; // only meaningful when reason === 'persistent_late_payment'
  noOtherRehabTenantOverFourYears: boolean; // only meaningful when reason === 'rehab_therapeutic_period_ended'
  serviceMethod: ServiceMethod;
  intendedServiceDate: CalendarDate;
  rentFrequency: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'yearly';
  hasEmailConsentOnFile?: boolean;
}

function validateN8(input: N8WorkflowInput): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (input.tenantNames.length === 0) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANT_NAME', message: 'At least one tenant name is required.' });
  }
  if (!input.propertyAddress?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_ADDRESS', message: 'Property address is incomplete.' });
  }
  if (!input.groundsDescription?.trim() || input.groundsDescription.trim().length < 20) {
    items.push({ level: 'BLOCKER', code: 'MISSING_GROUNDS', message: 'Describe the specific grounds for this N8 — a short explanation is required, this system will not conclude the legal threshold is met on its own.' });
  }

  // The official form's Reason 5 (rehab/therapeutic) is only available if
  // no other tenant receiving rehab/therapeutic services has lived in the
  // complex for more than 4 years — verified 2026-08-31.
  if (input.reason === 'rehab_therapeutic_period_ended' && !input.noOtherRehabTenantOverFourYears) {
    items.push({ level: 'BLOCKER', code: 'REHAB_FOUR_YEAR_CONDITION_NOT_MET', message: 'This ground only applies if no other tenant receiving rehabilitative/therapeutic services has lived in the complex for more than 4 years — confirm this before proceeding.' });
  }

  if (input.reason === 'persistent_late_payment') {
    const lateCount = countLatePeriods(input.chronology);
    if (lateCount === 0) {
      items.push({ level: 'WARNING', code: 'NO_LATE_HISTORY_FOUND', message: 'No late, partial, or unpaid periods were found in the recorded payment history — review whether the ledger reflects the real payment pattern before proceeding.' });
    } else if (lateCount < 3) {
      items.push({ level: 'WARNING', code: 'LIMITED_LATE_HISTORY', message: `Only ${lateCount} late/partial/unpaid period(s) found in the recorded history — "persistent" is a legal judgment call, not something this system determines. Confirm this meets the actual legal threshold.` });
    }
  }

  const methodResult = calculateN8Dates({
    intendedServiceDate: input.intendedServiceDate,
    serviceMethod: input.serviceMethod,
    rentFrequency: input.rentFrequency,
    hasEmailConsentOnFile: input.hasEmailConsentOnFile,
  });
  if (!methodResult.serviceAllowed) {
    items.push({ level: 'BLOCKER', code: 'SERVICE_METHOD_NOT_ALLOWED', message: methodResult.serviceDenyReason ?? 'This service method is not allowed for N8.' });
  }
  if (input.intendedServiceDate < todayCalendarDate()) {
    items.push({ level: 'WARNING', code: 'SERVICE_DATE_IN_PAST', message: 'Intended service date is in the past — confirm this reflects reality.' });
  }

  items.push({ level: 'INFO', code: 'PERIOD_ALIGNMENT_REMINDER', message: 'The termination date must align with the end of a rental period or the end of the term — this system does not calculate that boundary. Confirm it manually before serving.' });
  items.push({ level: 'INFO', code: 'RULES_VERIFIED', message: 'Notice period and all five grounds were verified against tribunalsontario.ca on 2026-08-31.' });

  return items;
}

export const N8Workflow: NoticeWorkflow<N8WorkflowInput, ReturnType<typeof calculateN8Dates>> = {
  formCode: 'N8',
  validate: validateN8,
  calculateDates: (input) =>
    calculateN8Dates({
      intendedServiceDate: input.intendedServiceDate,
      serviceMethod: input.serviceMethod,
      rentFrequency: input.rentFrequency,
      hasEmailConsentOnFile: input.hasEmailConsentOnFile,
    }),
  buildDocumentData: (input, dates) => ({
    formCode: 'N8',
    tenantNames: input.tenantNames,
    propertyAddress: input.propertyAddress,
    unitNumber: input.unitNumber,
    landlordName: input.landlordName,
    reason: input.reason,
    groundsDescription: input.groundsDescription,
    dates,
  }),
  determineNextActions: (status) => {
    switch (status) {
      case 'DRAFT': return ['Complete required information'];
      case 'READY_FOR_REVIEW': return ['Review and mark Ready to Serve'];
      case 'READY_TO_SERVE': return ['Serve the notice, then record service'];
      case 'SERVED': return ['Record actual service to start the notice period'];
      case 'WAITING_PERIOD': return ['Wait for the termination date, then prepare an L2 application if the tenant has not left'];
      default: return [];
    }
  },
};
