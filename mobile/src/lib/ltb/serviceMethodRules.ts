// ServiceMethodRule — determines whether a service method is currently
// permitted for a given form, and how many extra days it adds before a
// document is "deemed" served.
//
// NEEDS_REVIEW: every extraDays/allowed value below is best-available
// knowledge, not a live-verified figure. Confirm against the current LTB
// Rules of Procedure before relying on this for a real notice.

import type { ServiceMethod, ServiceMethodRuleResult } from './types';

export const SERVICE_METHOD_LABELS: Record<ServiceMethod, string> = {
  hand_to_tenant: 'Hand directly to the tenant',
  adult_in_unit: 'Give to an adult person in the unit',
  mailbox_or_mail_slot: 'Leave in the mailbox / mail delivery location',
  under_door: 'Slide under the door / through a mail slot',
  regular_mail: 'Regular mail',
  courier: 'Courier',
  email: 'Email (only where legally permitted and consent exists)',
  ltb_portal: 'Tribunals Ontario Portal (only where applicable/consented)',
};

interface ServiceMethodRuleInput {
  method: ServiceMethod;
  formCode: string;
  hasEmailConsentOnFile?: boolean;
  hasPortalConsentOnFile?: boolean;
}

export function evaluateServiceMethod({ method, hasEmailConsentOnFile, hasPortalConsentOnFile }: ServiceMethodRuleInput): ServiceMethodRuleResult {
  switch (method) {
    case 'hand_to_tenant':
      return { allowed: true, extraDays: 0, proofRequired: true };
    case 'adult_in_unit':
      // NEEDS_REVIEW: some LTB service rules deem this served the next day
      // rather than same-day, since it wasn't handed to the tenant directly.
      return { allowed: true, extraDays: 1, proofRequired: true };
    case 'mailbox_or_mail_slot':
      return { allowed: true, extraDays: 1, proofRequired: true };
    case 'under_door':
      return { allowed: true, extraDays: 1, proofRequired: true };
    case 'regular_mail':
      // NEEDS_REVIEW: commonly cited as 5 days for regular mail — confirm
      // current figure, and whether it's calendar or business days.
      return { allowed: true, extraDays: 5, proofRequired: true };
    case 'courier':
      return { allowed: true, extraDays: 1, proofRequired: true };
    case 'email':
      if (!hasEmailConsentOnFile) {
        return { allowed: false, reason: 'Email service requires the tenant’s consent on file for this tenancy.', extraDays: 0, proofRequired: true };
      }
      return { allowed: true, extraDays: 0, proofRequired: true };
    case 'ltb_portal':
      if (!hasPortalConsentOnFile) {
        return { allowed: false, reason: 'Tribunals Ontario Portal service requires consent/eligibility on file.', extraDays: 0, proofRequired: false };
      }
      return { allowed: true, extraDays: 0, proofRequired: false };
    default:
      return { allowed: false, reason: 'Unknown service method.', extraDays: 0, proofRequired: true };
  }
}
