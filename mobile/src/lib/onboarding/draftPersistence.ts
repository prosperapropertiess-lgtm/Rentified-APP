// Local persistence for the portfolio-import draft — spec section "SAVE
// AND RESUME": close the app, lose connection, come back, resume. This
// is a single-device resume (AsyncStorage, already used elsewhere in
// this app for the Supabase session) rather than a server-staged draft
// that would also survive switching devices — a real, documented scope
// reduction, not a silent gap. See ONBOARDING_BUILD_STATUS.md.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DraftProperty, ExistingPropertyMatch } from './importDraft';

const VERSION = 1;
const keyFor = (landlordId: string) => `onboarding_import_draft_v${VERSION}_${landlordId}`;

export interface PersistedImportDraft {
  savedAt: string;
  fileNames: string[];
  properties: DraftProperty[];
  existingMatches: ExistingPropertyMatch[];
  duplicateChoices: Record<string, 'update' | 'separate' | 'skip'>;
  edits: Record<string, { tenantName?: string; rent?: string }>;
}

export async function savePersistedDraft(landlordId: string, draft: Omit<PersistedImportDraft, 'savedAt'>): Promise<void> {
  const payload: PersistedImportDraft = { ...draft, savedAt: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(keyFor(landlordId), JSON.stringify(payload));
  } catch {
    // Best-effort — losing the autosave shouldn't crash the import flow,
    // it just means resume won't have this checkpoint.
  }
}

export async function loadPersistedDraft(landlordId: string): Promise<PersistedImportDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(landlordId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.properties)) return null;
    return parsed as PersistedImportDraft;
  } catch {
    return null;
  }
}

export async function clearPersistedDraft(landlordId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(landlordId));
  } catch {
    // Nothing to do — a leftover draft just means the resume prompt
    // shows again next time, not a correctness problem.
  }
}
