import type { NoticeWorkflow } from '../workflow';
import type { ValidationItem, CalendarDate, ServiceMethod } from '../types';
import { calculateN13Dates, calculateN13Compensation, type N13Reason } from './n13';
import { todayCalendarDate } from '../dateEngine';

export interface N13WorkflowInput {
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  landlordName: string;
  reason: N13Reason;
  projectDescription: string;
  permitRequired: boolean;
  permitNumber: string; // required when permitRequired
  contractor: string;
  expectedStart: CalendarDate | '';
  expectedCompletion: CalendarDate | '';
  vacantPossessionRequired: boolean;
  unitsInComplex: number | null;
  // Simplification: treated as a proxy for "tenant plans to move back in"
  // for the compensation calculation below — offering the right and the
  // tenant actually planning to use it are legally distinct, but this
  // system doesn't yet collect the tenant's separate intention.
  rightOfFirstRefusalOffered: boolean;
  orderedByLawToDemolishOrRepair: boolean;
  isMobileHomeOrLandLeaseOwner: boolean;
  compensationDetails: string;
  serviceMethod: ServiceMethod;
  intendedServiceDate: CalendarDate;
  rentFrequency: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'yearly';
  hasEmailConsentOnFile?: boolean;
}

export function estimateRepairPeriodMonths(start: CalendarDate | '', completion: CalendarDate | ''): number | null {
  if (!start || !completion) return null;
  const startDate = new Date(`${start}T00:00:00Z`);
  const completionDate = new Date(`${completion}T00:00:00Z`);
  const days = (completionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 0) return null;
  return Math.round((days / 30) * 10) / 10;
}

function validateN13(input: N13WorkflowInput): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (input.tenantNames.length === 0) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANT_NAME', message: 'At least one tenant name is required.' });
  }
  if (!input.propertyAddress?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_ADDRESS', message: 'Property address is incomplete.' });
  }
  if (!input.projectDescription?.trim() || input.projectDescription.trim().length < 15) {
    items.push({ level: 'BLOCKER', code: 'MISSING_PROJECT_DESCRIPTION', message: 'Describe the project (what work, why vacancy is required) — required.' });
  }
  if (input.permitRequired && !input.permitNumber?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_PERMIT_NUMBER', message: 'A permit was marked as required but no permit number was entered.' });
  }
  if (!input.vacantPossessionRequired) {
    items.push({ level: 'WARNING', code: 'VACANCY_NOT_CONFIRMED', message: 'Vacant possession was not marked as required — N13 generally only applies when the work genuinely requires the unit to be empty. Confirm this is the right notice.' });
  }
  if (input.reason === 'renovation_repair' && !input.rightOfFirstRefusalOffered) {
    items.push({ level: 'WARNING', code: 'RIGHT_OF_FIRST_REFUSAL_REMINDER', message: 'For a repair/renovation reason, the tenant may have a right to move back in when the work is done — confirm the current rule and whether this was offered.' });
  }
  if (!input.expectedStart) {
    items.push({ level: 'WARNING', code: 'MISSING_EXPECTED_START', message: 'Expected start date is not set.' });
  }

  const methodResult = calculateN13Dates({
    intendedServiceDate: input.intendedServiceDate,
    serviceMethod: input.serviceMethod,
    rentFrequency: input.rentFrequency,
    hasEmailConsentOnFile: input.hasEmailConsentOnFile,
    isMobileHomeOrLandLeaseOwner: input.isMobileHomeOrLandLeaseOwner,
  });
  if (!methodResult.serviceAllowed) {
    items.push({ level: 'BLOCKER', code: 'SERVICE_METHOD_NOT_ALLOWED', message: methodResult.serviceDenyReason ?? 'This service method is not allowed for N13.' });
  }
  if (input.intendedServiceDate < todayCalendarDate()) {
    items.push({ level: 'WARNING', code: 'SERVICE_DATE_IN_PAST', message: 'Intended service date is in the past — confirm this reflects reality.' });
  }

  const compensation = calculateN13Compensation({
    reason: input.reason,
    unitsInComplex: input.unitsInComplex,
    tenantPlansToMoveBackIn: input.reason === 'renovation_repair' && input.rightOfFirstRefusalOffered,
    orderedByLawToDemolishOrRepair: input.orderedByLawToDemolishOrRepair,
    isMobileHomeOrLandLeaseOwner: input.isMobileHomeOrLandLeaseOwner,
    repairPeriodMonths: estimateRepairPeriodMonths(input.expectedStart, input.expectedCompletion),
  });
  if (input.unitsInComplex === null) {
    items.push({ level: 'WARNING', code: 'MISSING_UNITS_IN_COMPLEX', message: 'Number of units in the complex is needed to calculate the exact compensation owed (the threshold is 5 units).' });
  }
  items.push({ level: compensation.required ? 'WARNING' : 'INFO', code: 'COMPENSATION_CALCULATED', message: `Compensation: ${compensation.description}` });

  items.push({ level: 'INFO', code: 'PERIOD_ALIGNMENT_REMINDER', message: 'The termination date must align with the end of a rental period or the end of the term, and cannot be earlier than the end of a fixed term — this system does not calculate that boundary. Confirm it manually before serving.' });
  items.push({ level: 'INFO', code: 'RULES_VERIFIED', message: 'Notice period and compensation rules were verified against tribunalsontario.ca on 2026-08-31.' });

  return items;
}

export const N13Workflow: NoticeWorkflow<N13WorkflowInput, ReturnType<typeof calculateN13Dates>> = {
  formCode: 'N13',
  validate: validateN13,
  calculateDates: (input) =>
    calculateN13Dates({
      intendedServiceDate: input.intendedServiceDate,
      serviceMethod: input.serviceMethod,
      rentFrequency: input.rentFrequency,
      hasEmailConsentOnFile: input.hasEmailConsentOnFile,
      isMobileHomeOrLandLeaseOwner: input.isMobileHomeOrLandLeaseOwner,
    }),
  buildDocumentData: (input, dates) => ({
    formCode: 'N13',
    tenantNames: input.tenantNames,
    propertyAddress: input.propertyAddress,
    unitNumber: input.unitNumber,
    landlordName: input.landlordName,
    reason: input.reason,
    projectDescription: input.projectDescription,
    compensation: calculateN13Compensation({
      reason: input.reason,
      unitsInComplex: input.unitsInComplex,
      tenantPlansToMoveBackIn: input.reason === 'renovation_repair' && input.rightOfFirstRefusalOffered,
      orderedByLawToDemolishOrRepair: input.orderedByLawToDemolishOrRepair,
      isMobileHomeOrLandLeaseOwner: input.isMobileHomeOrLandLeaseOwner,
      repairPeriodMonths: estimateRepairPeriodMonths(input.expectedStart, input.expectedCompletion),
    }),
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
