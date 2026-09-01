import { mapColumns } from '../columnMapping';
import { buildDraftRow, buildDraftProperties, findExistingMatches, summarize, type DraftRow } from '../importDraft';

function rowsToDrafts(headers: string[], rawRows: Record<string, string>[]): DraftRow[] {
  const mapping = mapColumns(headers);
  return rawRows
    .map((row, i) => buildDraftRow(row, mapping, i))
    .filter((r): r is DraftRow => r !== null);
}

describe('buildDraftRow', () => {
  it('drops rows with no address rather than guessing where they belong', () => {
    const drafts = rowsToDrafts(
      ['Address', 'Tenant Name', 'Rent'],
      [{ Address: '', 'Tenant Name': 'John Smith', Rent: '1850' }]
    );
    expect(drafts).toHaveLength(0);
  });

  it('parses money and slash dates', () => {
    const [row] = rowsToDrafts(
      ['Address', 'Rent', 'Lease Start'],
      [{ Address: '1577 Purser St', Rent: '$1,850.00', 'Lease Start': '4/1/2026' }]
    );
    expect(row.rent).toBe(1850);
    expect(row.leaseStart).toBe('2026-04-01');
  });
});

describe('buildDraftProperties', () => {
  it('groups rows into one property with multiple units by normalized address', () => {
    const drafts = rowsToDrafts(
      ['Address', 'Unit', 'Tenant', 'Rent'],
      [
        { Address: '1577 Purser Street', Unit: '1', Tenant: 'Alice', Rent: '1500' },
        { Address: '1577 Purser St', Unit: '2', Tenant: 'Bob', Rent: '1600' },
      ]
    );
    const properties = buildDraftProperties(drafts);
    expect(properties).toHaveLength(1);
    expect(properties[0].units).toHaveLength(2);
  });

  it('flags a missing rent/tenant name only for rows that look occupied', () => {
    const drafts = rowsToDrafts(
      ['Address', 'Unit', 'Tenant', 'Rent', 'Status'],
      [
        { Address: '1 Main St', Unit: '1', Tenant: '', Rent: '', Status: 'Vacant' },
        { Address: '1 Main St', Unit: '2', Tenant: '', Rent: '', Status: '' },
      ]
    );
    const [property] = buildDraftProperties(drafts);
    expect(property.units[0].isVacant).toBe(true);
    expect(property.units[0].issues).toHaveLength(0);
    expect(property.units[1].isVacant).toBe(true); // no tenant + no rent => treated vacant even without explicit status
  });

  it('flags an occupied-looking row missing required fields', () => {
    const drafts = rowsToDrafts(
      ['Address', 'Tenant', 'Rent'],
      [{ Address: '1 Main St', Tenant: '', Rent: '1500' }]
    );
    const [property] = buildDraftProperties(drafts);
    expect(property.units[0].isVacant).toBe(false);
    expect(property.units[0].issues).toContain('Missing tenant name');
  });
});

describe('findExistingMatches', () => {
  it('matches a draft property against an existing one by normalized address', () => {
    const drafts = rowsToDrafts(['Address', 'Tenant', 'Rent'], [{ Address: '1577 Purser Street', Tenant: 'Alice', Rent: '1500' }]);
    const properties = buildDraftProperties(drafts);
    const matches = findExistingMatches(properties, [{ id: 'existing-1', address: '1577 Purser St' }]);
    expect(matches).toHaveLength(1);
    expect(matches[0].existingPropertyId).toBe('existing-1');
  });
});

describe('summarize', () => {
  it('counts properties, units, occupancy, and total scheduled rent', () => {
    const drafts = rowsToDrafts(
      ['Address', 'Unit', 'Tenant', 'Rent'],
      [
        { Address: '1 Main St', Unit: '1', Tenant: 'Alice', Rent: '1500' },
        { Address: '1 Main St', Unit: '2', Tenant: '', Rent: '' },
        { Address: '2 Oak Ave', Unit: '', Tenant: 'Bob', Rent: '1700' },
      ]
    );
    const properties = buildDraftProperties(drafts);
    const summary = summarize(properties);
    expect(summary.propertyCount).toBe(2);
    expect(summary.unitCount).toBe(3);
    expect(summary.occupiedCount).toBe(2);
    expect(summary.vacantCount).toBe(1);
    expect(summary.totalMonthlyRent).toBe(3200);
  });
});
