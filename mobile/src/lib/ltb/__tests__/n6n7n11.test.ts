import { calculateN6Dates } from '../rules/n6';
import { calculateN7Dates } from '../rules/n7';
import { calculateN11Dates } from '../rules/n11';
import { N6Workflow, type N6WorkflowInput } from '../rules/n6Workflow';
import { N7Workflow, type N7WorkflowInput } from '../rules/n7Workflow';
import { N11Workflow, type N11WorkflowInput } from '../rules/n11Workflow';
import { hasBlockers } from '../workflow';

describe('N6 date calculation', () => {
  it('uses a flat 10-day period for Reason 1 regardless of subsequent-notice flag', () => {
    const a = calculateN6Dates({ reason: 'drug_related_illegal_act', intendedServiceDate: '2026-09-01', serviceMethod: 'hand_to_tenant', isSubsequentNotice: false });
    const b = calculateN6Dates({ reason: 'drug_related_illegal_act', intendedServiceDate: '2026-09-01', serviceMethod: 'hand_to_tenant', isSubsequentNotice: true });
    expect(a.minimumNoticeDays).toBe(10);
    expect(b.minimumNoticeDays).toBe(10);
    expect(a.earliestValidTerminationDate).toBe(b.earliestValidTerminationDate);
  });

  it('uses 20 days for a first Reason 2/3 notice and 14 for a subsequent one', () => {
    const first = calculateN6Dates({ reason: 'other_illegal_act', intendedServiceDate: '2026-09-01', serviceMethod: 'hand_to_tenant', isSubsequentNotice: false });
    const second = calculateN6Dates({ reason: 'other_illegal_act', intendedServiceDate: '2026-09-01', serviceMethod: 'hand_to_tenant', isSubsequentNotice: true });
    expect(first.minimumNoticeDays).toBe(20);
    expect(second.minimumNoticeDays).toBe(14);
  });
});

describe('N7 date calculation', () => {
  it('is a flat 10 days for every reason', () => {
    const result = calculateN7Dates({ intendedServiceDate: '2026-09-01', serviceMethod: 'hand_to_tenant' });
    expect(result.minimumNoticeDays).toBe(10);
    expect(result.earliestValidTerminationDate).toBe('2026-09-11');
  });
});

describe('N11 date calculation', () => {
  it('has no minimum period — the termination date is exactly what was agreed', () => {
    const result = calculateN11Dates({ agreementSignedDate: '2026-09-01', agreedTerminationDate: '2026-09-05' });
    expect(result.minimumNoticeDays).toBe(0);
    expect(result.earliestValidTerminationDate).toBe('2026-09-05');
  });
});

function baseN6Input(overrides: Partial<N6WorkflowInput> = {}): N6WorkflowInput {
  return {
    tenantNames: ['Jane Tenant'], propertyAddress: '1 Main St', unitNumber: null, landlordName: 'Tina Landlord',
    reason: 'other_illegal_act', incidents: [{ occurredAt: '2026-08-01', location: null, description: 'Detailed incident description here.' }],
    isSubsequentNotice: false, serviceMethod: 'hand_to_tenant', intendedServiceDate: '2026-09-01',
    ...overrides,
  };
}

function baseN7Input(overrides: Partial<N7WorkflowInput> = {}): N7WorkflowInput {
  return {
    tenantNames: ['Jane Tenant'], propertyAddress: '1 Main St', unitNumber: null, landlordName: 'Tina Landlord',
    reason: 'wilful_damage', incidents: [{ occurredAt: '2026-08-01', location: null, description: 'Detailed incident description here.' }],
    landlordAlsoLivesInBuilding: false, serviceMethod: 'hand_to_tenant', intendedServiceDate: '2026-09-01',
    ...overrides,
  };
}

function baseN11Input(overrides: Partial<N11WorkflowInput> = {}): N11WorkflowInput {
  return {
    tenantNames: ['Jane Tenant'], propertyAddress: '1 Main St', unitNumber: null, landlordName: 'Tina Landlord',
    agreementSignedDate: '2026-09-01', agreedTerminationDate: '2026-09-15',
    tenantSignedVoluntarily: true, isTenancyStart: false,
    ...overrides,
  };
}

describe('N6 workflow validation', () => {
  it('requires at least one described incident', () => {
    const items = N6Workflow.validate(baseN6Input({ incidents: [] }));
    expect(hasBlockers(items)).toBe(true);
  });
});

describe('N7 workflow validation', () => {
  it('blocks Reason 4 unless the landlord also lives in the building', () => {
    const items = N7Workflow.validate(baseN7Input({ reason: 'small_building_interference', landlordAlsoLivesInBuilding: false }));
    expect(hasBlockers(items)).toBe(true);
    expect(items.some((i) => i.code === 'REASON_4_CONDITION_NOT_MET')).toBe(true);
  });

  it('passes Reason 4 once confirmed', () => {
    const items = N7Workflow.validate(baseN7Input({ reason: 'small_building_interference', landlordAlsoLivesInBuilding: true }));
    expect(items.some((i) => i.code === 'REASON_4_CONDITION_NOT_MET')).toBe(false);
  });
});

describe('N11 workflow validation', () => {
  it('blocks if voluntariness is not confirmed', () => {
    const items = N11Workflow.validate(baseN11Input({ tenantSignedVoluntarily: false }));
    expect(hasBlockers(items)).toBe(true);
  });

  it('blocks if signed at the start of the tenancy for a later date', () => {
    const items = N11Workflow.validate(baseN11Input({ isTenancyStart: true }));
    expect(hasBlockers(items)).toBe(true);
    expect(items.some((i) => i.code === 'SIGNED_AT_TENANCY_START')).toBe(true);
  });

  it('passes with a valid voluntary mid-tenancy agreement', () => {
    const items = N11Workflow.validate(baseN11Input());
    expect(hasBlockers(items)).toBe(false);
  });
});
