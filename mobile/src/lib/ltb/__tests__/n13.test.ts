import { calculateN13Dates } from '../rules/n13';
import { N13Workflow, type N13WorkflowInput } from '../rules/n13Workflow';
import { hasBlockers } from '../workflow';

describe('N13 date calculation — mechanics (values still NEEDS_REVIEW)', () => {
  it('adds 120 days minimum notice for a monthly tenancy, hand-delivered', () => {
    const result = calculateN13Dates({
      intendedServiceDate: '2026-09-01',
      serviceMethod: 'hand_to_tenant',
      rentFrequency: 'monthly',
    });
    expect(result.earliestValidTerminationDate).toBe('2026-12-30');
  });
});

function baseInput(overrides: Partial<N13WorkflowInput> = {}): N13WorkflowInput {
  return {
    tenantNames: ['Jane Tenant'],
    propertyAddress: '123 Main St',
    unitNumber: '2',
    landlordName: 'Tina Landlord',
    reason: 'renovation_repair',
    projectDescription: 'Full kitchen and bathroom rebuild requiring the unit to be empty for the duration.',
    permitRequired: true,
    permitNumber: 'PB-2026-00123',
    contractor: 'Acme Contracting',
    expectedStart: '2026-11-01',
    expectedCompletion: '2027-02-01',
    vacantPossessionRequired: true,
    unitsInComplex: 12,
    rightOfFirstRefusalOffered: true,
    orderedByLawToDemolishOrRepair: false,
    isMobileHomeOrLandLeaseOwner: false,
    compensationDetails: '',
    serviceMethod: 'hand_to_tenant',
    intendedServiceDate: '2026-09-01',
    rentFrequency: 'monthly',
    ...overrides,
  };
}

describe('N13 validation', () => {
  it('blocks when a permit is required but no permit number is given', () => {
    const items = N13Workflow.validate(baseInput({ permitRequired: true, permitNumber: '' }));
    expect(hasBlockers(items)).toBe(true);
    expect(items.some((i) => i.code === 'MISSING_PERMIT_NUMBER')).toBe(true);
  });

  it('warns (does not block) when vacant possession is not confirmed', () => {
    const items = N13Workflow.validate(baseInput({ vacantPossessionRequired: false }));
    const item = items.find((i) => i.code === 'VACANCY_NOT_CONFIRMED');
    expect(item?.level).toBe('WARNING');
  });

  it('passes with no blockers when all mandatory fields are complete', () => {
    const items = N13Workflow.validate(baseInput());
    expect(hasBlockers(items)).toBe(false);
  });
});
