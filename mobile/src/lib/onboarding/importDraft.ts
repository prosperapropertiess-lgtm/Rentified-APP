// Import draft builder — spec sections "IMPORT DRAFT ARCHITECTURE" and
// "MISSING INFORMATION ENGINE", scoped to structured spreadsheet/CSV
// import only (no AI/LLM extraction in this build — see
// ONBOARDING_BUILD_STATUS.md). Nothing here writes to real tables; it
// only builds an in-memory draft the owner reviews before commit.

import type { ColumnMapping } from './columnMapping';
import { normalizeAddress, normalizeUnit } from './columnMapping';

export interface DraftRow {
  sourceRowIndex: number;
  address: string;
  unit: string;
  tenantName: string;
  email: string;
  phone: string;
  rent: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  deposit: number | null;
  statusRaw: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface DraftUnit {
  unitLabel: string;
  tenantName: string;
  email: string;
  phone: string;
  rent: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  deposit: number | null;
  isVacant: boolean;
  sourceRowIndex: number;
  issues: string[];
}

export interface DraftProperty {
  key: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  units: DraftUnit[];
}

function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Best-effort only — genuinely ambiguous for DD/MM vs MM/DD input, and
// relies on JS Date parsing as a fallback for anything not ISO or
// slash-separated. Not a substitute for a real date-parsing library.
function parseDateLoose(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  }
  return null;
}

/** Turns one raw spreadsheet row + its column mapping into a normalized
 * DraftRow. Returns null if the row has no address at all — an address-
 * less row can't be placed anywhere and is dropped with a caller-visible
 * count, not silently merged into whatever property came before it. */
export function buildDraftRow(row: Record<string, string>, mapping: ColumnMapping[], sourceRowIndex: number): DraftRow | null {
  const get = (field: string) => {
    const m = mapping.find((c) => c.field === field);
    return m ? (row[m.originalHeader] ?? '').trim() : '';
  };

  const address = get('address');
  if (!address) return null;

  return {
    sourceRowIndex,
    address,
    unit: get('unit'),
    tenantName: get('tenant_name'),
    email: get('email'),
    phone: get('phone'),
    rent: parseMoney(get('rent')),
    leaseStart: parseDateLoose(get('lease_start')),
    leaseEnd: parseDateLoose(get('lease_end')),
    deposit: parseMoney(get('deposit')),
    statusRaw: get('status'),
    city: get('city'),
    province: get('province'),
    postalCode: get('postal_code'),
  };
}

function looksVacant(row: DraftRow): boolean {
  if (/vacant/i.test(row.statusRaw)) return true;
  if (/occupied/i.test(row.statusRaw)) return false;
  return !row.tenantName && (row.rent === null || row.rent === 0);
}

/** Groups draft rows into properties (by normalized address) and units
 * (by normalized unit label within a property), computing per-unit
 * missing-field issues. A property with no explicit unit column becomes
 * a single implicit unit. */
export function buildDraftProperties(rows: DraftRow[]): DraftProperty[] {
  const propertyMap = new Map<string, DraftProperty>();

  for (const row of rows) {
    const propKey = normalizeAddress(row.address);
    let property = propertyMap.get(propKey);
    if (!property) {
      property = { key: propKey, address: row.address, city: row.city, province: row.province, postalCode: row.postalCode, units: [] };
      propertyMap.set(propKey, property);
    } else {
      // Fill in city/province/postal from a later row if the first row
      // that created this property didn't have them.
      property.city ||= row.city;
      property.province ||= row.province;
      property.postalCode ||= row.postalCode;
    }

    const vacant = looksVacant(row);
    const issues: string[] = [];
    if (!vacant) {
      if (!row.tenantName) issues.push('Missing tenant name');
      if (row.rent === null) issues.push('Missing rent amount');
    }

    property.units.push({
      unitLabel: row.unit || '1',
      tenantName: row.tenantName,
      email: row.email,
      phone: row.phone,
      rent: row.rent,
      leaseStart: row.leaseStart,
      leaseEnd: row.leaseEnd,
      deposit: row.deposit,
      isVacant: vacant,
      sourceRowIndex: row.sourceRowIndex,
      issues,
    });
  }

  return Array.from(propertyMap.values());
}

export interface ExistingPropertyMatch {
  draftPropertyKey: string;
  existingPropertyId: string;
  existingAddress: string;
}

/** Compares draft properties against a landlord's real existing
 * properties by normalized address — used to ask "is this the same
 * property?" rather than silently creating a duplicate. */
export function findExistingMatches(draftProperties: DraftProperty[], existing: { id: string; address: string }[]): ExistingPropertyMatch[] {
  const matches: ExistingPropertyMatch[] = [];
  for (const draft of draftProperties) {
    const hit = existing.find((e) => normalizeAddress(e.address) === draft.key);
    if (hit) matches.push({ draftPropertyKey: draft.key, existingPropertyId: hit.id, existingAddress: hit.address });
  }
  return matches;
}

export function summarize(properties: DraftProperty[]) {
  const units = properties.flatMap((p) => p.units);
  const occupied = units.filter((u) => !u.isVacant);
  const totalRent = occupied.reduce((sum, u) => sum + (u.rent ?? 0), 0);
  const issueCount = units.reduce((sum, u) => sum + u.issues.length, 0);
  return {
    propertyCount: properties.length,
    unitCount: units.length,
    occupiedCount: occupied.length,
    vacantCount: units.length - occupied.length,
    totalMonthlyRent: totalRent,
    issueCount,
  };
}

// Also re-exported here so callers don't need to import from two files
// for the common case.
export { normalizeUnit };
