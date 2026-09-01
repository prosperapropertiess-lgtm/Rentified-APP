// Draft/placeholder document layouts — NOT official Tribunals Ontario
// forms. See README.md in this folder. Every page carries a visible
// watermark saying so; this is deliberate, not a styling choice to remove.

import { money } from '../../format';
import { formatCalendarDateHuman } from '../dateEngine';
import type { ArrearsResult } from '../types';

const BASE_STYLE = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1F2F3A; padding: 32px; }
  .watermark { background: #FEF3C7; border: 2px solid #D97706; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-weight: bold; color: #92400E; font-size: 13px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #D8D2C8; padding-bottom: 4px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; font-size: 13px; border-bottom: 1px solid #eee; }
  th { color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
  .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid #1F2F3A; border-bottom: none; }
  .field { margin-bottom: 6px; font-size: 13px; }
  .field strong { display: inline-block; min-width: 140px; color: #64748b; font-weight: normal; }
  .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee; padding-top: 12px; }
`;

function watermark() {
  return `<div class="watermark">DRAFT — NOT AN OFFICIAL LTB FORM — DO NOT SERVE THIS DOCUMENT. Prepared for internal review only, pending verification against current Tribunals Ontario sources.</div>`;
}

function legalFooter() {
  return `<div class="footer">This document assists with preparation, calculations, and recordkeeping. It does not provide legal advice or guarantee acceptance by the Landlord and Tenant Board.</div>`;
}

export interface N4DocumentData {
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  postalCode: string | null;
  arrears: ArrearsResult;
  serviceMethod: string;
  intendedServiceDate: string;
  deemedServiceDate: string;
  terminationDate: string;
  rulesVersion: string;
}

export function buildN4Html(data: N4DocumentData): string {
  const rows = data.arrears.periods
    .map((p) => `<tr><td>${p.periodLabel}</td><td>$${money(p.rentCharged)}</td><td>$${money(p.rentPaid)}</td><td>$${money(p.balance)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>N4 — Notice to End a Tenancy Early for Non-payment of Rent</h1>
    <div class="meta">Rules version used: ${data.rulesVersion} (NEEDS_REVIEW — not verified against a live source)</div>

    <h2>Landlord</h2>
    <div class="field"><strong>Name</strong>${data.landlordName}</div>

    <h2>Tenant(s)</h2>
    ${data.tenantNames.map((n) => `<div class="field"><strong>Name</strong>${n}</div>`).join('')}

    <h2>Rental Unit</h2>
    <div class="field"><strong>Address</strong>${data.propertyAddress}</div>
    ${data.unitNumber ? `<div class="field"><strong>Unit</strong>${data.unitNumber}</div>` : ''}
    ${data.postalCode ? `<div class="field"><strong>Postal Code</strong>${data.postalCode}</div>` : ''}

    <h2>Rent Arrears</h2>
    <table>
      <tr><th>Period</th><th>Charged</th><th>Paid</th><th>Balance</th></tr>
      ${rows}
      <tr class="total-row"><td colspan="3">TOTAL RENT OWING</td><td>$${money(data.arrears.totalOwing)}</td></tr>
    </table>

    <h2>Service</h2>
    <div class="field"><strong>Intended method</strong>${data.serviceMethod}</div>
    <div class="field"><strong>Intended date</strong>${formatCalendarDateHuman(data.intendedServiceDate)}</div>
    <div class="field"><strong>Deemed service date</strong>${formatCalendarDateHuman(data.deemedServiceDate)}</div>

    <h2>Termination Date</h2>
    <div class="field"><strong>Earliest valid date</strong>${formatCalendarDateHuman(data.terminationDate)}</div>

    ${legalFooter()}
  </body></html>`;
}

export interface N5IncidentDoc {
  occurredAt: string;
  location: string | null;
  description: string;
  witnesses: string | null;
  policeReportNumber: string | null;
}

export interface N5DocumentData {
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  reason: string;
  incidents: N5IncidentDoc[];
  isSubsequentNotice: boolean;
  serviceMethod: string;
  intendedServiceDate: string;
  deemedServiceDate: string;
  terminationDate: string;
  cureDeadline: string | null;
  rulesVersion: string;
}

export function buildN5Html(data: N5DocumentData): string {
  const incidentRows = data.incidents
    .map((i) => `<div class="field" style="margin-bottom:14px;"><strong>${formatCalendarDateHuman(i.occurredAt)}${i.location ? ` — ${i.location}` : ''}</strong><br/>${i.description}${i.witnesses ? `<br/><em>Witnesses: ${i.witnesses}</em>` : ''}${i.policeReportNumber ? `<br/><em>Police report #: ${i.policeReportNumber}</em>` : ''}</div>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>N5 — Notice to End a Tenancy For Interference, Damage or Overcrowding</h1>
    <div class="meta">${data.isSubsequentNotice ? 'Subsequent notice' : 'First notice'} for this tenancy · Rules version: ${data.rulesVersion} — notice periods verified against tribunalsontario.ca 2026-08-31</div>

    <h2>Landlord</h2>
    <div class="field"><strong>Name</strong>${data.landlordName}</div>

    <h2>Tenant(s)</h2>
    ${data.tenantNames.map((n) => `<div class="field"><strong>Name</strong>${n}</div>`).join('')}

    <h2>Rental Unit</h2>
    <div class="field"><strong>Address</strong>${data.propertyAddress}</div>
    ${data.unitNumber ? `<div class="field"><strong>Unit</strong>${data.unitNumber}</div>` : ''}

    <h2>Reason</h2>
    <div class="field">${data.reason.replace(/_/g, ' ')}</div>

    <h2>Incident Chronology</h2>
    ${incidentRows || '<div class="field">No incidents recorded.</div>'}

    <h2>Service</h2>
    <div class="field"><strong>Intended method</strong>${data.serviceMethod}</div>
    <div class="field"><strong>Intended date</strong>${formatCalendarDateHuman(data.intendedServiceDate)}</div>
    <div class="field"><strong>Deemed service date</strong>${formatCalendarDateHuman(data.deemedServiceDate)}</div>

    <h2>Termination Date</h2>
    <div class="field"><strong>Earliest valid date</strong>${formatCalendarDateHuman(data.terminationDate)}</div>
    ${data.cureDeadline ? `<div class="field"><strong>Monitoring period ends</strong>${formatCalendarDateHuman(data.cureDeadline)}</div>` : ''}

    ${legalFooter()}
  </body></html>`;
}

export interface N1DocumentData {
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  currentRent: number;
  proposedRent: number;
  proposedIncreasePercent: number;
  guidelinePercent: number;
  intendedServiceDate: string;
  earliestEffectiveDate: string;
  rulesVersion: string;
}

export function buildN1Html(data: N1DocumentData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>N1 — Notice of Rent Increase</h1>
    <div class="meta">Rules version used: ${data.rulesVersion} — notice period and guideline % verified against tribunalsontario.ca 2026-08-31; the guideline changes annually and must be re-checked each January</div>

    <h2>Landlord</h2>
    <div class="field"><strong>Name</strong>${data.landlordName}</div>

    <h2>Tenant(s)</h2>
    ${data.tenantNames.map((n) => `<div class="field"><strong>Name</strong>${n}</div>`).join('')}

    <h2>Rental Unit</h2>
    <div class="field"><strong>Address</strong>${data.propertyAddress}</div>
    ${data.unitNumber ? `<div class="field"><strong>Unit</strong>${data.unitNumber}</div>` : ''}

    <h2>Rent Increase</h2>
    <div class="field"><strong>Current rent</strong>$${money(data.currentRent)}</div>
    <div class="field"><strong>Proposed new rent</strong>$${money(data.proposedRent)}</div>
    <div class="field"><strong>Increase</strong>${data.proposedIncreasePercent}% (2026 guideline: ${data.guidelinePercent}% — verified 2026-08-31)</div>

    <h2>Notice</h2>
    <div class="field"><strong>Intended date</strong>${formatCalendarDateHuman(data.intendedServiceDate)}</div>
    <div class="field"><strong>Earliest effective date</strong>${formatCalendarDateHuman(data.earliestEffectiveDate)}</div>

    ${legalFooter()}
  </body></html>`;
}

export interface N8DocumentData {
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  reasonLabel: string;
  groundsDescription: string;
  chronologySummary: string | null;
  serviceMethod: string;
  intendedServiceDate: string;
  deemedServiceDate: string;
  terminationDate: string;
  rulesVersion: string;
}

export function buildN8Html(data: N8DocumentData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>N8 — Notice to End Tenancy at End of Term / Persistent Late Payment</h1>
    <div class="meta">Rules version used: ${data.rulesVersion} — notice period verified against tribunalsontario.ca 2026-08-31; service-method extra-day rules still NEEDS_REVIEW</div>

    <h2>Landlord</h2>
    <div class="field"><strong>Name</strong>${data.landlordName}</div>

    <h2>Tenant(s)</h2>
    ${data.tenantNames.map((n) => `<div class="field"><strong>Name</strong>${n}</div>`).join('')}

    <h2>Rental Unit</h2>
    <div class="field"><strong>Address</strong>${data.propertyAddress}</div>
    ${data.unitNumber ? `<div class="field"><strong>Unit</strong>${data.unitNumber}</div>` : ''}

    <h2>Reason</h2>
    <div class="field"><strong>Ground</strong>${data.reasonLabel}</div>
    <div class="field">${data.groundsDescription}</div>
    ${data.chronologySummary ? `<div class="field"><strong>Payment history</strong>${data.chronologySummary}</div>` : ''}

    <h2>Service</h2>
    <div class="field"><strong>Intended method</strong>${data.serviceMethod}</div>
    <div class="field"><strong>Intended date</strong>${formatCalendarDateHuman(data.intendedServiceDate)}</div>
    <div class="field"><strong>Deemed service date</strong>${formatCalendarDateHuman(data.deemedServiceDate)}</div>

    <h2>Termination Date</h2>
    <div class="field"><strong>Earliest valid date</strong>${formatCalendarDateHuman(data.terminationDate)}</div>
    <div class="field">Must align with the end of a rental period/term — confirm manually.</div>

    ${legalFooter()}
  </body></html>`;
}

export interface N12DocumentData {
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  reasonLabel: string;
  personMovingIn: string;
  relationship: string | null;
  occupancyDetails: string;
  saleDetails: string | null;
  apsReference: string | null;
  compensationMethodLabel: string;
  compensationDetails: string | null;
  serviceMethod: string;
  intendedServiceDate: string;
  deemedServiceDate: string;
  terminationDate: string;
  rulesVersion: string;
}

export function buildN12Html(data: N12DocumentData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>N12 — Notice to End Tenancy Because the Landlord, a Purchaser or a Family Member Requires the Unit</h1>
    <div class="meta">Rules version used: ${data.rulesVersion} — notice period and compensation verified against tribunalsontario.ca 2026-08-31</div>

    <h2>Landlord</h2>
    <div class="field"><strong>Name</strong>${data.landlordName}</div>

    <h2>Tenant(s)</h2>
    ${data.tenantNames.map((n) => `<div class="field"><strong>Name</strong>${n}</div>`).join('')}

    <h2>Rental Unit</h2>
    <div class="field"><strong>Address</strong>${data.propertyAddress}</div>
    ${data.unitNumber ? `<div class="field"><strong>Unit</strong>${data.unitNumber}</div>` : ''}

    <h2>Reason</h2>
    <div class="field"><strong>Ground</strong>${data.reasonLabel}</div>
    <div class="field"><strong>Person moving in</strong>${data.personMovingIn}</div>
    ${data.relationship ? `<div class="field"><strong>Relationship</strong>${data.relationship}</div>` : ''}
    <div class="field"><strong>Occupancy details</strong>${data.occupancyDetails}</div>
    ${data.saleDetails ? `<div class="field"><strong>Sale details</strong>${data.saleDetails}</div>` : ''}
    ${data.apsReference ? `<div class="field"><strong>Agreement of Purchase and Sale ref.</strong>${data.apsReference}</div>` : ''}

    <h2>Compensation</h2>
    <div class="field"><strong>Method</strong>${data.compensationMethodLabel}</div>
    ${data.compensationDetails ? `<div class="field"><strong>Details</strong>${data.compensationDetails}</div>` : ''}

    <h2>Service</h2>
    <div class="field"><strong>Intended method</strong>${data.serviceMethod}</div>
    <div class="field"><strong>Intended date</strong>${formatCalendarDateHuman(data.intendedServiceDate)}</div>
    <div class="field"><strong>Deemed service date</strong>${formatCalendarDateHuman(data.deemedServiceDate)}</div>

    <h2>Termination Date</h2>
    <div class="field"><strong>Earliest valid date</strong>${formatCalendarDateHuman(data.terminationDate)}</div>
    <div class="field">Must align with the end of a rental period/term — confirm manually.</div>

    ${legalFooter()}
  </body></html>`;
}

export interface N13DocumentData {
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  reasonLabel: string;
  projectDescription: string;
  permitNumber: string | null;
  expectedStart: string | null;
  expectedCompletion: string | null;
  vacantPossessionRequired: boolean;
  rightOfFirstRefusalOffered: boolean;
  compensationDescription: string;
  compensationDetails: string | null;
  serviceMethod: string;
  intendedServiceDate: string;
  deemedServiceDate: string;
  terminationDate: string;
  rulesVersion: string;
}

export function buildN13Html(data: N13DocumentData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>N13 — Notice to End Tenancy Because the Landlord Wants to Demolish, Repair or Convert the Rental Unit</h1>
    <div class="meta">Rules version used: ${data.rulesVersion} — notice period and compensation verified against tribunalsontario.ca 2026-08-31</div>

    <h2>Landlord</h2>
    <div class="field"><strong>Name</strong>${data.landlordName}</div>

    <h2>Tenant(s)</h2>
    ${data.tenantNames.map((n) => `<div class="field"><strong>Name</strong>${n}</div>`).join('')}

    <h2>Rental Unit</h2>
    <div class="field"><strong>Address</strong>${data.propertyAddress}</div>
    ${data.unitNumber ? `<div class="field"><strong>Unit</strong>${data.unitNumber}</div>` : ''}

    <h2>Reason</h2>
    <div class="field"><strong>Ground</strong>${data.reasonLabel}</div>
    <div class="field"><strong>Project description</strong>${data.projectDescription}</div>
    ${data.permitNumber ? `<div class="field"><strong>Permit number</strong>${data.permitNumber}</div>` : ''}
    ${data.expectedStart ? `<div class="field"><strong>Expected start</strong>${formatCalendarDateHuman(data.expectedStart)}</div>` : ''}
    ${data.expectedCompletion ? `<div class="field"><strong>Expected completion</strong>${formatCalendarDateHuman(data.expectedCompletion)}</div>` : ''}
    <div class="field"><strong>Vacant possession required</strong>${data.vacantPossessionRequired ? 'Yes' : 'No'}</div>
    <div class="field"><strong>Right of first refusal offered</strong>${data.rightOfFirstRefusalOffered ? 'Yes' : 'No'}</div>

    <h2>Compensation</h2>
    <div class="field"><strong>Amount owed</strong>${data.compensationDescription}</div>
    ${data.compensationDetails ? `<div class="field"><strong>Notes</strong>${data.compensationDetails}</div>` : ''}

    <h2>Service</h2>
    <div class="field"><strong>Intended method</strong>${data.serviceMethod}</div>
    <div class="field"><strong>Intended date</strong>${formatCalendarDateHuman(data.intendedServiceDate)}</div>
    <div class="field"><strong>Deemed service date</strong>${formatCalendarDateHuman(data.deemedServiceDate)}</div>

    <h2>Termination Date</h2>
    <div class="field"><strong>Earliest valid date</strong>${formatCalendarDateHuman(data.terminationDate)}</div>
    <div class="field">Must align with the end of a rental period/term, and cannot be earlier than the end of a fixed term — confirm manually.</div>

    ${legalFooter()}
  </body></html>`;
}

export interface N6N7IncidentDoc {
  occurredAt: string;
  location: string | null;
  description: string;
}

export interface N6DocumentData {
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  reasonLabel: string;
  isSubsequentNotice: boolean;
  incidents: N6N7IncidentDoc[];
  serviceMethod: string;
  intendedServiceDate: string;
  deemedServiceDate: string;
  terminationDate: string;
  rulesVersion: string;
}

export function buildN6Html(data: N6DocumentData): string {
  const incidentRows = data.incidents
    .map((i) => `<div class="field" style="margin-bottom:14px;"><strong>${formatCalendarDateHuman(i.occurredAt)}${i.location ? ` — ${i.location}` : ''}</strong><br/>${i.description}</div>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>N6 — Notice to End Tenancy for Illegal Acts or Misrepresenting Income</h1>
    <div class="meta">${data.isSubsequentNotice ? 'Subsequent notice' : 'First notice'} for this tenancy · Rules version: ${data.rulesVersion} — notice periods verified against tribunalsontario.ca 2026-08-31</div>

    <h2>Landlord</h2>
    <div class="field"><strong>Name</strong>${data.landlordName}</div>

    <h2>Tenant(s)</h2>
    ${data.tenantNames.map((n) => `<div class="field"><strong>Name</strong>${n}</div>`).join('')}

    <h2>Rental Unit</h2>
    <div class="field"><strong>Address</strong>${data.propertyAddress}</div>
    ${data.unitNumber ? `<div class="field"><strong>Unit</strong>${data.unitNumber}</div>` : ''}

    <h2>Reason</h2>
    <div class="field">${data.reasonLabel}</div>

    <h2>Details</h2>
    ${incidentRows || '<div class="field">No details recorded.</div>'}

    <h2>Service</h2>
    <div class="field"><strong>Intended method</strong>${data.serviceMethod}</div>
    <div class="field"><strong>Intended date</strong>${formatCalendarDateHuman(data.intendedServiceDate)}</div>
    <div class="field"><strong>Deemed service date</strong>${formatCalendarDateHuman(data.deemedServiceDate)}</div>

    <h2>Termination Date</h2>
    <div class="field"><strong>Earliest valid date</strong>${formatCalendarDateHuman(data.terminationDate)}</div>

    ${legalFooter()}
  </body></html>`;
}

export interface N7DocumentData {
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  reasonLabel: string;
  incidents: N6N7IncidentDoc[];
  serviceMethod: string;
  intendedServiceDate: string;
  deemedServiceDate: string;
  terminationDate: string;
  rulesVersion: string;
}

export function buildN7Html(data: N7DocumentData): string {
  const incidentRows = data.incidents
    .map((i) => `<div class="field" style="margin-bottom:14px;"><strong>${formatCalendarDateHuman(i.occurredAt)}${i.location ? ` — ${i.location}` : ''}</strong><br/>${i.description}</div>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>N7 — Notice to End Tenancy for Causing Serious Problems</h1>
    <div class="meta">Rules version used: ${data.rulesVersion} — notice period verified against tribunalsontario.ca 2026-08-31</div>

    <h2>Landlord</h2>
    <div class="field"><strong>Name</strong>${data.landlordName}</div>

    <h2>Tenant(s)</h2>
    ${data.tenantNames.map((n) => `<div class="field"><strong>Name</strong>${n}</div>`).join('')}

    <h2>Rental Unit</h2>
    <div class="field"><strong>Address</strong>${data.propertyAddress}</div>
    ${data.unitNumber ? `<div class="field"><strong>Unit</strong>${data.unitNumber}</div>` : ''}

    <h2>Reason</h2>
    <div class="field">${data.reasonLabel}</div>

    <h2>Incident Chronology</h2>
    ${incidentRows || '<div class="field">No incidents recorded.</div>'}

    <h2>Service</h2>
    <div class="field"><strong>Intended method</strong>${data.serviceMethod}</div>
    <div class="field"><strong>Intended date</strong>${formatCalendarDateHuman(data.intendedServiceDate)}</div>
    <div class="field"><strong>Deemed service date</strong>${formatCalendarDateHuman(data.deemedServiceDate)}</div>

    <h2>Termination Date</h2>
    <div class="field"><strong>Earliest valid date</strong>${formatCalendarDateHuman(data.terminationDate)}</div>

    ${legalFooter()}
  </body></html>`;
}

export interface N11DocumentData {
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  unitNumber: string | null;
  agreementSignedDate: string;
  agreedTerminationDate: string;
  rulesVersion: string;
}

export function buildN11Html(data: N11DocumentData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>N11 — Agreement to End the Tenancy</h1>
    <div class="meta">This is a mutual agreement, not a unilateral notice — no minimum notice period applies.</div>

    <h2>Landlord</h2>
    <div class="field"><strong>Name</strong>${data.landlordName}</div>

    <h2>Tenant(s)</h2>
    ${data.tenantNames.map((n) => `<div class="field"><strong>Name</strong>${n}</div>`).join('')}

    <h2>Rental Unit</h2>
    <div class="field"><strong>Address</strong>${data.propertyAddress}</div>
    ${data.unitNumber ? `<div class="field"><strong>Unit</strong>${data.unitNumber}</div>` : ''}

    <h2>Agreement</h2>
    <div class="field"><strong>Signed</strong>${formatCalendarDateHuman(data.agreementSignedDate)}</div>
    <div class="field"><strong>Agreed termination date</strong>${formatCalendarDateHuman(data.agreedTerminationDate)}</div>
    <div class="field">Both parties confirm this agreement was entered into voluntarily, and was not required as a condition of the tenancy.</div>

    ${legalFooter()}
  </body></html>`;
}

export interface CertificateOfServiceData {
  formCode: string;
  propertyAddress: string;
  unitNumber: string | null;
  tenantNames: string[];
  servedAt: string;
  methodUsed: string;
  servedBy: string | null;
  receivedBy: string | null;
  notes: string | null;
}

export function buildCertificateOfServiceHtml(data: CertificateOfServiceData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>
    ${watermark()}
    <h1>Certificate of Service</h1>
    <div class="meta">For: ${data.formCode}</div>

    <h2>Document Served</h2>
    <div class="field"><strong>Form</strong>${data.formCode}</div>
    <div class="field"><strong>Address</strong>${data.propertyAddress}${data.unitNumber ? ` · Unit ${data.unitNumber}` : ''}</div>
    <div class="field"><strong>Tenant(s)</strong>${data.tenantNames.join(', ')}</div>

    <h2>Service Details</h2>
    <div class="field"><strong>Date served</strong>${formatCalendarDateHuman(data.servedAt)}</div>
    <div class="field"><strong>Method</strong>${data.methodUsed}</div>
    ${data.servedBy ? `<div class="field"><strong>Served by</strong>${data.servedBy}</div>` : ''}
    ${data.receivedBy ? `<div class="field"><strong>Received by</strong>${data.receivedBy}</div>` : ''}
    ${data.notes ? `<div class="field"><strong>Notes</strong>${data.notes}</div>` : ''}

    <h2>Declaration</h2>
    <div class="field">I certify that I served the above document as described above. (Review required declarations/signature requirements for the current official Certificate of Service before relying on this record.)</div>

    ${legalFooter()}
  </body></html>`;
}
