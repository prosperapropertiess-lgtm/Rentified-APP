import type { NoticeWorkflow } from '../workflow';
import type { ValidationItem, ServiceMethod, ArrearsResult } from '../types';
import { calculateN4Dates } from './n4';
import { todayCalendarDate } from '../dateEngine';

export interface N4WorkflowInput {
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  postalCode: string | null;
  landlordName: string;
  arrears: ArrearsResult;
  intendedServiceDate: string;
  serviceMethod: ServiceMethod | null;
  rentFrequency: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'yearly';
}

function validateN4(input: N4WorkflowInput): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (input.tenantNames.length === 0 || input.tenantNames.some((n) => !n.trim())) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANT_NAME', message: 'At least one complete tenant name is required.' });
  }
  if (!input.propertyAddress?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_ADDRESS', message: 'Property address is incomplete.' });
  }
  if (!input.postalCode?.trim()) {
    items.push({ level: 'WARNING', code: 'MISSING_POSTAL_CODE', message: 'Postal code is missing — official forms typically require it.' });
  }
  if (input.arrears.totalOwing <= 0) {
    items.push({ level: 'BLOCKER', code: 'NO_ARREARS', message: 'Calculated rent owing is $0 — an N4 cannot be issued when no rent is overdue.' });
  }
  if (input.arrears.manuallyAdjusted && !input.arrears.adjustmentReason) {
    items.push({ level: 'BLOCKER', code: 'UNEXPLAINED_OVERRIDE', message: 'Arrears were manually adjusted but no explanation was recorded.' });
  }
  if (!input.serviceMethod) {
    items.push({ level: 'WARNING', code: 'NO_SERVICE_METHOD', message: 'Service method not selected yet.' });
  }
  if (input.intendedServiceDate < todayCalendarDate()) {
    items.push({ level: 'WARNING', code: 'SERVICE_DATE_IN_PAST', message: 'Intended service date is in the past — confirm this reflects when it was/will be served.' });
  }

  items.push({ level: 'INFO', code: 'NEEDS_REVIEW_RULES', message: 'This notice uses rule values marked NEEDS_REVIEW — verify against Tribunals Ontario before serving.' });

  return items;
}

export const N4Workflow: NoticeWorkflow<N4WorkflowInput, ReturnType<typeof calculateN4Dates>> = {
  formCode: 'N4',
  validate: validateN4,
  calculateDates: (input) =>
    calculateN4Dates({
      intendedServiceDate: input.intendedServiceDate,
      serviceMethod: input.serviceMethod ?? 'hand_to_tenant',
      rentFrequency: input.rentFrequency,
    }),
  buildDocumentData: (input, dates) => ({
    formCode: 'N4',
    tenantNames: input.tenantNames,
    propertyAddress: input.propertyAddress,
    unitNumber: input.unitNumber,
    postalCode: input.postalCode,
    landlordName: input.landlordName,
    arrears: input.arrears,
    dates,
  }),
  determineNextActions: (status) => {
    switch (status) {
      case 'DRAFT': return ['Complete required information', 'Select service method'];
      case 'READY_FOR_REVIEW': return ['Review and mark Ready to Serve'];
      case 'READY_TO_SERVE': return ['Serve the notice, then record service'];
      case 'SERVED': return ['Record actual service to start the waiting period'];
      case 'WAITING_PERIOD': return ['Monitor rent ledger for payment'];
      case 'ELIGIBLE_FOR_APPLICATION': return ['Prepare L1 application'];
      default: return [];
    }
  },
};
