import { calculateN12Dates } from '../rules/n12';
import { N12Workflow, type N12WorkflowInput } from '../rules/n12Workflow';
import { hasBlockers } from '../workflow';

describe('N12 date calculation — mechanics (values still NEEDS_REVIEW)', () => {
  it('adds 60 days minimum notice for a monthly tenancy, hand-delivered', () => {
    const result = calculateN12Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'monthly',
    });
    expect(result.earliestValidTerminationDate).toBe('2026-10-31');
  });
});

function baseInput(overrides: Partial<N12WorkflowInput> = {}): N12WorkflowInput {
  return {
    tenantNames: ['Jane Tenant'],
    propertyAddress: '123 Main St',
    unitNumber: '2',
    landlordName: 'Tina Landlord',
    reason: 'landlord_use',
    personMovingIn: 'Tina Landlord',
    relationship: '',
    intendedOccupancyDetails: 'Will live there full-time as primary residence.',
    propertySaleDetails: '',
    agreementOfPurchaseAndSaleReference: '',
    declarationConfirmed: true,
    compensationMethod: 'one_months_rent',
    compensationDetails: '',
    serviceMethod: 'hand_to_tenant',
    intendedServiceDate: '2026-09-01',
    rentFrequency: 'monthly',
    ...overrides,
  };
}

describe('N12 validation', () => {
  it('blocks when the good-faith declaration is not confirmed', () => {
    const items = N12Workflow.validate(baseInput({ declarationConfirmed: false }));
    expect(hasBlockers(items)).toBe(true);
    expect(items.some((i) => i.code === 'DECLARATION_NOT_CONFIRMED')).toBe(true);
  });

  it('blocks when compensation method is not selected', () => {
    const items = N12Workflow.validate(baseInput({ compensationMethod: null }));
    expect(hasBlockers(items)).toBe(true);
    expect(items.some((i) => i.code === 'MISSING_COMPENSATION')).toBe(true);
  });

  it('blocks purchaser_use without an APS reference', () => {
    const items = N12Workflow.validate(baseInput({ reason: 'purchaser_use', propertySaleDetails: 'Sale closing Nov 1', agreementOfPurchaseAndSaleReference: '' }));
    expect(items.some((i) => i.code === 'MISSING_APS_REFERENCE')).toBe(true);
  });

  it('blocks qualifying_family_member without a stated relationship', () => {
    const items = N12Workflow.validate(baseInput({ reason: 'qualifying_family_member', relationship: '' }));
    expect(items.some((i) => i.code === 'MISSING_RELATIONSHIP')).toBe(true);
  });

  it('passes with no blockers when all mandatory fields are complete', () => {
    const items = N12Workflow.validate(baseInput());
    expect(hasBlockers(items)).toBe(false);
  });
});
