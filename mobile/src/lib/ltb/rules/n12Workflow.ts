import type { NoticeWorkflow } from '../workflow';
import type { ValidationItem, CalendarDate, ServiceMethod } from '../types';
import { calculateN12Dates, type N12Reason } from './n12';
import { todayCalendarDate } from '../dateEngine';

export type CompensationMethod = 'one_months_rent' | 'alternate_unit' | 'other';

export const COMPENSATION_METHOD_LABELS: Record<CompensationMethod, string> = {
  one_months_rent: "One month's rent",
  alternate_unit: 'Alternate unit offered',
  other: 'Other',
};

export interface N12WorkflowInput {
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  landlordName: string;
  reason: N12Reason;
  personMovingIn: string;
  relationship: string; // required when reason === 'qualifying_family_member'
  intendedOccupancyDetails: string;
  propertySaleDetails: string; // relevant when reason === 'purchaser_use'
  agreementOfPurchaseAndSaleReference: string; // required when reason === 'purchaser_use'
  declarationConfirmed: boolean;
  compensationMethod: CompensationMethod | null;
  compensationDetails: string;
  serviceMethod: ServiceMethod;
  intendedServiceDate: CalendarDate;
  rentFrequency: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'yearly';
  hasEmailConsentOnFile?: boolean;
}

function validateN12(input: N12WorkflowInput): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (input.tenantNames.length === 0) {
    items.push({ level: 'BLOCKER', code: 'MISSING_TENANT_NAME', message: 'At least one tenant name is required.' });
  }
  if (!input.propertyAddress?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_ADDRESS', message: 'Property address is incomplete.' });
  }
  if (!input.personMovingIn?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_PERSON_MOVING_IN', message: 'Who is moving in is required.' });
  }
  if (!input.intendedOccupancyDetails?.trim() || input.intendedOccupancyDetails.trim().length < 15) {
    items.push({ level: 'BLOCKER', code: 'MISSING_OCCUPANCY_DETAILS', message: 'Intended occupancy details are required (e.g. how long, why this unit specifically).' });
  }
  if (input.reason === 'qualifying_family_member' && !input.relationship?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_RELATIONSHIP', message: 'Relationship to the landlord is required for a qualifying family member.' });
  }
  if (input.reason === 'purchaser_use') {
    if (!input.propertySaleDetails?.trim()) {
      items.push({ level: 'BLOCKER', code: 'MISSING_SALE_DETAILS', message: 'Property sale details are required for purchaser use.' });
    }
    if (!input.agreementOfPurchaseAndSaleReference?.trim()) {
      items.push({ level: 'BLOCKER', code: 'MISSING_APS_REFERENCE', message: 'Agreement of Purchase and Sale reference/metadata is required for purchaser use.' });
    }
  }
  if (!input.declarationConfirmed) {
    items.push({ level: 'BLOCKER', code: 'DECLARATION_NOT_CONFIRMED', message: 'The required good-faith declaration has not been confirmed — this cannot be marked Ready to Serve without it.' });
  }
  if (!input.compensationMethod) {
    items.push({ level: 'BLOCKER', code: 'MISSING_COMPENSATION', message: 'Compensation is mandatory for this ground — select how it will be provided.' });
  } else if (input.compensationMethod === 'other' && !input.compensationDetails?.trim()) {
    items.push({ level: 'BLOCKER', code: 'MISSING_COMPENSATION_DETAILS', message: 'Describe the compensation being provided.' });
  }

  const methodResult = calculateN12Dates({
    intendedServiceDate: input.intendedServiceDate,
    serviceMethod: input.serviceMethod,
    rentFrequency: input.rentFrequency,
    hasEmailConsentOnFile: input.hasEmailConsentOnFile,
  });
  if (!methodResult.serviceAllowed) {
    items.push({ level: 'BLOCKER', code: 'SERVICE_METHOD_NOT_ALLOWED', message: methodResult.serviceDenyReason ?? 'This service method is not allowed for N12.' });
  }
  if (input.intendedServiceDate < todayCalendarDate()) {
    items.push({ level: 'WARNING', code: 'SERVICE_DATE_IN_PAST', message: 'Intended service date is in the past — confirm this reflects reality.' });
  }

  items.push({ level: 'INFO', code: 'PERIOD_ALIGNMENT_REMINDER', message: 'The termination date must align with the end of a rental period or the end of the term — this system does not calculate that boundary. Confirm it manually before serving.' });
  items.push({ level: 'INFO', code: 'RULES_VERIFIED', message: 'Notice period (60 days, all tenancy frequencies) and compensation (one month\'s rent or an acceptable alternate unit) were verified against tribunalsontario.ca on 2026-08-31.' });

  return items;
}

export const N12Workflow: NoticeWorkflow<N12WorkflowInput, ReturnType<typeof calculateN12Dates>> = {
  formCode: 'N12',
  validate: validateN12,
  calculateDates: (input) =>
    calculateN12Dates({
      intendedServiceDate: input.intendedServiceDate,
      serviceMethod: input.serviceMethod,
      rentFrequency: input.rentFrequency,
      hasEmailConsentOnFile: input.hasEmailConsentOnFile,
    }),
  buildDocumentData: (input, dates) => ({
    formCode: 'N12',
    tenantNames: input.tenantNames,
    propertyAddress: input.propertyAddress,
    unitNumber: input.unitNumber,
    landlordName: input.landlordName,
    reason: input.reason,
    personMovingIn: input.personMovingIn,
    relationship: input.relationship,
    compensationMethod: input.compensationMethod,
    dates,
  }),
  determineNextActions: (status) => {
    switch (status) {
      case 'DRAFT': return ['Complete required information, including the good-faith declaration and compensation'];
      case 'READY_FOR_REVIEW': return ['Review and mark Ready to Serve'];
      case 'READY_TO_SERVE': return ['Serve the notice, then record service'];
      case 'SERVED': return ['Record actual service to start the notice period'];
      case 'WAITING_PERIOD': return ['Wait for the termination date, then prepare an L2 application if the tenant has not left'];
      default: return [];
    }
  },
};
