import { mapColumns, normalizeHeader, normalizeAddress, normalizeUnit } from '../columnMapping';

describe('normalizeHeader', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeHeader('Monthly Rent ($)')).toBe('monthly rent');
    expect(normalizeHeader('Tenant_Name')).toBe('tenant name');
  });
});

describe('mapColumns', () => {
  it('maps exact synonyms with high confidence', () => {
    const result = mapColumns(['Address', 'Unit', 'Tenant Name', 'Rent']);
    expect(result.map((r) => r.field)).toEqual(['address', 'unit', 'tenant_name', 'rent']);
    expect(result.every((r) => r.confidence === 'exact')).toBe(true);
  });

  it('maps exact synonyms the spec calls out even when phrased unusually', () => {
    const result = mapColumns(['Monthly Amount', 'Resident']);
    expect(result[0].field).toBe('rent');
    expect(result[1].field).toBe('tenant_name');
  });

  it('guesses a partial match instead of leaving it unmapped', () => {
    const result = mapColumns(['Monthly Rent Amount', 'Tenant Full Name']);
    expect(result[0]).toMatchObject({ field: 'rent', confidence: 'guess' });
    expect(result[1]).toMatchObject({ field: 'tenant_name', confidence: 'guess' });
  });

  it('leaves genuinely unknown columns unmapped rather than guessing wrong', () => {
    const result = mapColumns(['Notes', 'Internal Ref Code']);
    expect(result.every((r) => r.field === null)).toBe(true);
  });
});

describe('normalizeAddress', () => {
  it('treats common street-suffix variants as equal, per spec examples', () => {
    const a = normalizeAddress('1577 Purser St');
    const b = normalizeAddress('1577 Purser Street');
    const c = normalizeAddress('1577 PURSER STREET');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe('normalizeUnit', () => {
  it('treats "Unit 2", "#2", "Apt 2" as equal', () => {
    expect(normalizeUnit('Unit 2')).toBe(normalizeUnit('#2'));
    expect(normalizeUnit('Apt 2')).toBe(normalizeUnit('2'));
  });
});
