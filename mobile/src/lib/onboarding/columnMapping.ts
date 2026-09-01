// Header normalization + synonym mapping for spreadsheet import — spec
// section "EXCEL / CSV IMPORT". No AI here (deliberately, per the current
// build scope) — this is a deterministic synonym dictionary, not a guess
// from a model. Columns that don't match anything known are left
// unmapped and shown to the owner to assign by hand rather than silently
// dropped or wrongly guessed.

export type CanonicalField =
  | 'address' | 'city' | 'province' | 'postal_code' | 'unit'
  | 'tenant_name' | 'email' | 'phone' | 'rent' | 'lease_start' | 'lease_end'
  | 'deposit' | 'status';

export const CANONICAL_FIELD_LABELS: Record<CanonicalField, string> = {
  address: 'Property Address',
  city: 'City',
  province: 'Province',
  postal_code: 'Postal Code',
  unit: 'Unit',
  tenant_name: 'Tenant Name',
  email: 'Email',
  phone: 'Phone',
  rent: 'Monthly Rent',
  lease_start: 'Lease Start',
  lease_end: 'Lease End',
  deposit: 'Deposit',
  status: 'Occupancy Status',
};

// Each canonical field's known synonyms, normalized (lowercase, no
// punctuation). Ordered roughly by how commonly landlords use them.
const SYNONYMS: Record<CanonicalField, string[]> = {
  address: ['address', 'property', 'property address', 'street address', 'street', 'location'],
  city: ['city', 'town', 'municipality'],
  province: ['province', 'state'],
  postal_code: ['postal code', 'postalcode', 'zip', 'zip code', 'zipcode'],
  unit: ['unit', 'unit number', 'unit no', 'apt', 'apartment', 'suite'],
  tenant_name: ['tenant', 'tenant name', 'resident', 'resident name', 'name', 'occupant', 'leaseholder'],
  email: ['email', 'email address', 'tenant email'],
  phone: ['phone', 'phone number', 'tenant phone', 'mobile', 'cell'],
  rent: ['rent', 'monthly rent', 'rent amount', 'monthly amount', 'amount'],
  lease_start: ['lease start', 'start date', 'move in', 'move in date', 'movein date', 'lease start date'],
  lease_end: ['lease end', 'end date', 'move out', 'move out date', 'lease expiry', 'lease end date'],
  deposit: ['deposit', 'security deposit', 'damage deposit'],
  status: ['status', 'occupancy', 'occupied', 'occupancy status', 'balance'],
};

export function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[_\-.#]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ColumnMapping {
  originalHeader: string;
  field: CanonicalField | null;
  confidence: 'exact' | 'guess' | 'none';
}

/** Deterministic mapping only — exact synonym match, or a "guess" when the
 * normalized header contains (or is contained by) a synonym. Anything
 * else is left unmapped for the owner to assign manually. */
export function mapColumns(headers: string[]): ColumnMapping[] {
  return headers.map((originalHeader) => {
    const normalized = normalizeHeader(originalHeader);
    if (!normalized) return { originalHeader, field: null, confidence: 'none' };

    for (const field of Object.keys(SYNONYMS) as CanonicalField[]) {
      if (SYNONYMS[field].includes(normalized)) {
        return { originalHeader, field, confidence: 'exact' };
      }
    }
    for (const field of Object.keys(SYNONYMS) as CanonicalField[]) {
      const hit = SYNONYMS[field].some((syn) => normalized.includes(syn) || syn.includes(normalized));
      if (hit) return { originalHeader, field, confidence: 'guess' };
    }
    return { originalHeader, field: null, confidence: 'none' };
  });
}

/** Light address normalization for duplicate/grouping comparisons — not a
 * real geocoding/address-validation service, just enough to catch the
 * common "St" vs "Street", casing, and punctuation variance from spec
 * section "ADDRESS NORMALIZATION". Do not use this for anything legal. */
export function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUnit(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bunit\b/g, '')
    .replace(/\bapt\b/g, '')
    .replace(/\bsuite\b/g, '')
    .replace(/[#.]/g, '')
    .trim();
}
