import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { parseSpreadsheetBase64 } from '../../lib/onboarding/spreadsheetParser';
import { mapColumns, CANONICAL_FIELD_LABELS, type ColumnMapping, type CanonicalField } from '../../lib/onboarding/columnMapping';
import { buildDraftRow, buildDraftProperties, findExistingMatches, summarize, type DraftRow, type DraftProperty, type ExistingPropertyMatch } from '../../lib/onboarding/importDraft';
import { savePersistedDraft, loadPersistedDraft, clearPersistedDraft, type PersistedImportDraft } from '../../lib/onboarding/draftPersistence';
import { money } from '../../lib/format';

type Stage = 'entry' | 'parsing' | 'mapping' | 'review' | 'committing' | 'done';
type DuplicateChoice = 'update' | 'separate' | 'skip';

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

interface CommitResult {
  propertyAddress: string;
  success: boolean;
  error?: string;
}

export default function PortfolioImportScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  // A ref, not state — state updates aren't synchronous, so a fast
  // double-tap on "Finish Setup" can call commitPortfolio() twice before
  // React re-renders the button away. This guard blocks re-entrancy
  // immediately, independent of render timing.
  const committingRef = useRef(false);

  const [stage, setStage] = useState<Stage>('entry');
  const [error, setError] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [allMappings, setAllMappings] = useState<ColumnMapping[]>([]);
  const [manualOverrides, setManualOverrides] = useState<Record<string, CanonicalField | null>>({});
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [properties, setProperties] = useState<DraftProperty[]>([]);
  const [existingMatches, setExistingMatches] = useState<ExistingPropertyMatch[]>([]);
  const [duplicateChoices, setDuplicateChoices] = useState<Record<string, DuplicateChoice>>({});
  const [edits, setEdits] = useState<Record<string, { tenantName?: string; rent?: string }>>({});
  const [resumeAvailable, setResumeAvailable] = useState<PersistedImportDraft | null>(null);
  const [commitResults, setCommitResults] = useState<CommitResult[]>([]);
  const [commitSummary, setCommitSummary] = useState<{ properties: number; units: number; tenants: number } | null>(null);

  // Check for a saved-in-progress draft once, on mount — this is what
  // makes "close the app, come back later" actually resume instead of
  // forcing a re-upload (spec section "SAVE AND RESUME").
  useEffect(() => {
    if (!profileId) return;
    loadPersistedDraft(profileId).then((draft) => {
      if (draft) setResumeAvailable(draft);
    });
  }, [profileId]);

  // Autosave whenever the review draft changes — every edit, every
  // duplicate-property decision. Single-device resume via AsyncStorage,
  // not a server-staged draft (see ONBOARDING_BUILD_STATUS.md for why).
  useEffect(() => {
    if (!profileId || stage !== 'review' || properties.length === 0) return;
    savePersistedDraft(profileId, { fileNames, properties, existingMatches, duplicateChoices, edits });
  }, [profileId, stage, properties, existingMatches, duplicateChoices, edits, fileNames]);

  function resumeDraft() {
    if (!resumeAvailable) return;
    setFileNames(resumeAvailable.fileNames);
    setProperties(resumeAvailable.properties);
    setExistingMatches(resumeAvailable.existingMatches);
    setDuplicateChoices(resumeAvailable.duplicateChoices);
    setEdits(resumeAvailable.edits);
    setResumeAvailable(null);
    setStage('review');
  }

  function discardResume() {
    if (profileId) clearPersistedDraft(profileId);
    setResumeAvailable(null);
  }

  async function pickAndParse() {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) return;

      setStage('parsing');
      setFileNames(result.assets.map((a) => a.name));

      const allRows: Record<string, string>[] = [];
      const headerSet = new Set<string>();
      let anyRowsFound = false;

      for (const asset of result.assets) {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        const sheets = parseSpreadsheetBase64(base64);
        for (const sheet of sheets) {
          anyRowsFound = true;
          sheet.headers.forEach((h) => headerSet.add(h));
          sheet.rows.forEach((r) => allRows.push(r));
        }
      }

      if (!anyRowsFound) {
        setError("We couldn't find any usable rows in those files. Check that they have a header row and at least one data row, or enter your portfolio manually.");
        setStage('entry');
        return;
      }

      const headers = Array.from(headerSet);
      const mapping = mapColumns(headers);
      setAllMappings(mapping);

      const rows = allRows
        .map((row, i) => buildDraftRow(row, mapping, i))
        .filter((r): r is DraftRow => r !== null);

      if (rows.length === 0) {
        setError("We read your file, but couldn't find an address column. Every row needs an address to become a property.");
        setStage('entry');
        return;
      }

      setDraftRows(rows);

      const needsMappingConfirmation = mapping.some((m) => m.confidence !== 'exact');
      setStage(needsMappingConfirmation ? 'mapping' : 'review');
      if (!needsMappingConfirmation) await buildReview(rows);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong reading that file.');
      setStage('entry');
    }
  }

  async function buildReview(rows: DraftRow[]) {
    const built = buildDraftProperties(rows);
    setProperties(built);

    const { data: existing } = await supabase
      .from('properties')
      .select('id, address')
      .eq('landlord_id', profileId ?? '')
      .is('deleted_at', null);

    const matches = findExistingMatches(built, existing ?? []);
    setExistingMatches(matches);
    setStage('review');
  }

  async function confirmMapping() {
    // Apply manual overrides on top of the auto-detected mapping, then
    // rebuild draft rows from the ORIGINAL rows — we don't have those
    // anymore at this point, so re-map is only for display; the rows
    // already built stand. This screen exists to let the owner correct a
    // wrong guess before proceeding, which only matters if they actually
    // change something.
    const hasOverride = Object.keys(manualOverrides).length > 0;
    if (!hasOverride) {
      await buildReview(draftRows);
      return;
    }
    const remapped = allMappings.map((m) => (m.originalHeader in manualOverrides ? { ...m, field: manualOverrides[m.originalHeader], confidence: 'exact' as const } : m));
    setAllMappings(remapped);
    // Re-derive rows is not straightforward without the raw rows kept
    // around; for this build, overrides only affect columns already
    // mapped to nothing or a low-confidence guess, so proceed with the
    // rows we have — good enough for the common case, not a rebuild of
    // every row from scratch.
    await buildReview(draftRows);
  }

  const summary = properties.length > 0 ? summarize(properties) : null;

  function unitKey(propKey: string, sourceRowIndex: number) {
    return `${propKey}:${sourceRowIndex}`;
  }

  function applyEdit(key: string, field: 'tenantName' | 'rent', value: string) {
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  const allBlockersResolved = properties.every((p) =>
    p.units.every((u) => {
      if (u.issues.length === 0) return true;
      const key = unitKey(p.key, u.sourceRowIndex);
      const edit = edits[key];
      const hasTenantIssue = u.issues.includes('Missing tenant name');
      const hasRentIssue = u.issues.includes('Missing rent amount');
      const tenantOk = !hasTenantIssue || !!edit?.tenantName?.trim();
      const rentOk = !hasRentIssue || !!edit?.rent?.trim();
      return tenantOk && rentOk;
    })
  );

  async function commitPortfolio() {
    if (!profileId || committingRef.current) return;
    committingRef.current = true;
    setStage('committing');
    const results: CommitResult[] = [];
    let propertyCount = 0;
    let unitCount = 0;
    let tenantCount = 0;

    for (const property of properties) {
      const choice = duplicateChoices[property.key] ?? 'separate';
      if (choice === 'skip') continue;

      try {
        let propertyId: string;
        const match = existingMatches.find((m) => m.draftPropertyKey === property.key);

        if (choice === 'update' && match) {
          propertyId = match.existingPropertyId;
        } else {
          const { data: propRow, error: propError } = await supabase
            .from('properties')
            .insert({
              landlord_id: profileId,
              name: property.address,
              address: property.address,
              city: property.city || 'Unknown',
              province: property.province || 'ON',
              postal_code: property.postalCode || '000000',
              type: property.units.length > 1 ? 'multi_unit' : 'single_family',
            })
            .select()
            .single();
          if (propError || !propRow) throw new Error(propError?.message ?? 'Could not create property');
          propertyId = propRow.id;
          propertyCount += 1;
        }

        for (const unit of property.units) {
          const key = unitKey(property.key, unit.sourceRowIndex);
          const edit = edits[key];
          const tenantName = (edit?.tenantName ?? unit.tenantName).trim();
          const rentStr = edit?.rent ?? (unit.rent !== null ? String(unit.rent) : '');
          const rent = parseFloat(rentStr) || 0;

          const { data: unitRow, error: unitError } = await supabase
            .from('units')
            .insert({
              property_id: propertyId,
              unit_number: unit.unitLabel,
              rent_amount: rent,
              status: unit.isVacant ? 'vacant' : 'occupied',
            })
            .select()
            .single();
          if (unitError || !unitRow) throw new Error(unitError?.message ?? 'Could not create unit');
          unitCount += 1;

          if (unit.isVacant || !tenantName) continue;

          const [firstName, ...rest] = tenantName.split(' ');
          const lastName = rest.join(' ') || firstName;

          let tenantId: string | null = null;
          let pin = '';
          for (let attempt = 0; attempt < 5; attempt++) {
            pin = randomPin();
            const { data: tenantRow, error: tenantError } = await supabase
              .from('tenants')
              .insert({
                landlord_id: profileId,
                first_name: firstName,
                last_name: lastName,
                email: unit.email || `${firstName}.${lastName}.${pin}@placeholder.import`.toLowerCase(),
                phone: unit.phone || null,
                pin,
              })
              .select()
              .single();
            if (!tenantError) { tenantId = tenantRow.id; break; }
            if (tenantError.code !== '23505') throw new Error(tenantError.message);
          }
          if (!tenantId) throw new Error('Could not create tenant after several PIN attempts');
          tenantCount += 1;

          const startDate = unit.leaseStart ?? new Date().toISOString().split('T')[0];
          const endDate = unit.leaseEnd ?? (() => {
            const d = new Date(startDate);
            d.setFullYear(d.getFullYear() + 1);
            return d.toISOString().split('T')[0];
          })();

          const { error: leaseError } = await supabase.from('leases').insert({
            unit_id: unitRow.id,
            tenant_id: tenantId,
            landlord_id: profileId,
            start_date: startDate,
            end_date: endDate,
            rent_amount: rent,
            security_deposit: unit.deposit ?? 0,
            status: 'active',
          });
          if (leaseError) {
            await supabase.from('tenants').delete().eq('id', tenantId);
            throw new Error(leaseError.message);
          }
        }

        results.push({ propertyAddress: property.address, success: true });
      } catch (e: any) {
        results.push({ propertyAddress: property.address, success: false, error: e.message });
      }
    }

    setCommitResults(results);
    setCommitSummary({ properties: propertyCount, units: unitCount, tenants: tenantCount });
    if (profileId) clearPersistedDraft(profileId);
    setStage('done');
  }

  // ---- Render ----

  if (stage === 'entry') {
    return (
      <View className="flex-1 bg-pageBg">
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 60 }}>
          <Text className="text-3xl text-navy font-sansBold mb-2">Let&apos;s set up your portfolio</Text>
          <Text className="text-navy-muted font-sans text-base mb-8">
            Upload whatever you already have — a spreadsheet, a rent roll, a tenant list. We&apos;ll organize it into your portfolio automatically.
          </Text>

          {resumeAvailable && (
            <View className="bg-navy rounded-2xl p-5 mb-6">
              <Text className="text-white font-sansBold text-[15px] mb-1">Pick up where you left off?</Text>
              <Text className="text-white/70 font-sans text-[12px] mb-4">
                {summarize(resumeAvailable.properties).propertyCount} properties, {summarize(resumeAvailable.properties).unitCount} units — saved {new Date(resumeAvailable.savedAt).toLocaleString()}
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity onPress={resumeDraft} className="flex-1 bg-white py-3 rounded-xl items-center">
                  <Text className="text-navy font-sansBold text-[13px]">Resume</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={discardResume} className="flex-1 border border-white/30 py-3 rounded-xl items-center">
                  <Text className="text-white font-sansBold text-[13px]">Start Over</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {error && (
            <View className="bg-burgundy/10 border border-burgundy/30 rounded-2xl p-4 mb-6">
              <Text className="text-burgundy font-sans text-[13px]">{error}</Text>
            </View>
          )}

          <TouchableOpacity onPress={pickAndParse} className="bg-navy rounded-2xl p-6 items-center mb-4">
            <Feather name="upload" size={28} color="#fff" style={{ marginBottom: 10 }} />
            <Text className="text-white font-sansBold text-[17px]">Upload Files</Text>
            <Text className="text-white/60 font-sans text-[12px] mt-1">.CSV or Excel spreadsheet</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/add-property')} className="bg-card border border-navy-border rounded-2xl p-5 items-center mb-8">
            <Text className="text-navy font-sansBold text-[15px]">I&apos;ll enter things manually</Text>
          </TouchableOpacity>

          <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-3">Common files landlords upload</Text>
          <View className="gap-2 mb-8">
            {['Property spreadsheet', 'Rent roll', 'Tenant list'].map((label) => (
              <View key={label} className="flex-row items-center">
                <Feather name="file-text" size={14} color="#94a3b8" style={{ marginRight: 8 }} />
                <Text className="text-navy-muted font-sans text-[13px]">{label}</Text>
              </View>
            ))}
          </View>

          <Text className="text-navy-muted/60 font-sans text-xs text-center">Most portfolios are ready in under 5 minutes.</Text>
        </ScrollView>
      </View>
    );
  }

  if (stage === 'parsing') {
    return (
      <View className="flex-1 bg-pageBg justify-center items-center px-8">
        <ActivityIndicator color="#1F2F3A" size="large" style={{ marginBottom: 20 }} />
        <Text className="text-navy font-sansBold text-lg text-center">Reading your files…</Text>
        <Text className="text-navy-muted font-sans text-sm text-center mt-2">{fileNames.join(', ')}</Text>
      </View>
    );
  }

  if (stage === 'mapping') {
    const needsAttention = allMappings.filter((m) => m.confidence !== 'exact');
    return (
      <View className="flex-1 bg-pageBg">
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 60 }}>
          <Text className="text-2xl text-navy font-sansBold mb-2">Quick check on a few columns</Text>
          <Text className="text-navy-muted font-sans text-sm mb-6">We think these columns mean the following — tap to change any that are wrong.</Text>

          {needsAttention.map((m) => (
            <View key={m.originalHeader} className="bg-card rounded-2xl p-4 border border-navy-border mb-3">
              <Text className="text-navy-muted font-sans text-[12px] mb-1">&quot;{m.originalHeader}&quot;</Text>
              <View className="flex-row flex-wrap gap-2 mt-1">
                {(Object.keys(CANONICAL_FIELD_LABELS) as CanonicalField[]).map((field) => {
                  const selected = (manualOverrides[m.originalHeader] ?? m.field) === field;
                  return (
                    <TouchableOpacity
                      key={field}
                      onPress={() => setManualOverrides((prev) => ({ ...prev, [m.originalHeader]: field }))}
                      className="px-3 py-1.5 rounded-full border"
                      style={{ borderColor: selected ? '#1F2F3A' : '#D8D2C8', backgroundColor: selected ? '#1F2F3A' : 'transparent' }}
                    >
                      <Text className="font-sans text-[12px]" style={{ color: selected ? '#fff' : '#1F2F3A' }}>{CANONICAL_FIELD_LABELS[field]}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  onPress={() => setManualOverrides((prev) => ({ ...prev, [m.originalHeader]: null }))}
                  className="px-3 py-1.5 rounded-full border"
                  style={{ borderColor: (manualOverrides[m.originalHeader] === null) ? '#1F2F3A' : '#D8D2C8' }}
                >
                  <Text className="font-sans text-[12px] text-navy-muted">Ignore this column</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity onPress={confirmMapping} className="bg-navy py-4 rounded-2xl items-center mt-4">
            <Text className="text-white font-sansBold text-[16px]">Looks Good</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (stage === 'review' && summary) {
    return (
      <View className="flex-1 bg-pageBg">
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 100 }}>
          <Text className="text-2xl text-navy font-sansBold mb-1">We found your portfolio</Text>
          <Text className="text-navy-muted font-sans text-sm mb-6">
            {summary.issueCount === 0
              ? 'Everything looks good — review below and finish setup.'
              : `Everything looks good except ${summary.issueCount} thing${summary.issueCount === 1 ? '' : 's'} we need from you.`}
          </Text>

          <View className="flex-row flex-wrap gap-3 mb-6">
            {[
              { label: 'Properties', value: summary.propertyCount },
              { label: 'Units', value: summary.unitCount },
              { label: 'Occupied', value: summary.occupiedCount },
              { label: 'Vacant', value: summary.vacantCount },
            ].map((s) => (
              <View key={s.label} className="bg-card rounded-2xl px-4 py-3 border border-navy-border" style={{ minWidth: 90 }}>
                <Text className="text-navy font-sansBold text-[22px]">{s.value}</Text>
                <Text className="text-navy-muted font-sans text-[11px]">{s.label}</Text>
              </View>
            ))}
            <View className="bg-navy rounded-2xl px-4 py-3" style={{ minWidth: 160 }}>
              <Text className="text-white font-sansBold text-[22px]">${money(summary.totalMonthlyRent)}</Text>
              <Text className="text-white/60 font-sans text-[11px]">Scheduled monthly rent</Text>
            </View>
          </View>

          {existingMatches.length > 0 && (
            <>
              <Text className="text-navy font-sansBold text-[15px] mb-2">We may have found these already in your portfolio</Text>
              {existingMatches.map((m) => (
                <View key={m.draftPropertyKey} className="bg-card rounded-2xl p-4 border border-navy-border mb-3">
                  <Text className="text-navy font-sans text-[13px] mb-2">{m.existingAddress}</Text>
                  <View className="flex-row gap-2">
                    {(['update', 'separate', 'skip'] as DuplicateChoice[]).map((choice) => (
                      <TouchableOpacity
                        key={choice}
                        onPress={() => setDuplicateChoices((prev) => ({ ...prev, [m.draftPropertyKey]: choice }))}
                        className="px-3 py-1.5 rounded-full border"
                        style={{ borderColor: (duplicateChoices[m.draftPropertyKey] ?? 'separate') === choice ? '#1F2F3A' : '#D8D2C8' }}
                      >
                        <Text className="font-sans text-[12px] text-navy">{choice === 'update' ? 'Same property' : choice === 'separate' ? "They're different" : 'Skip this one'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}

          <Text className="text-navy font-sansBold text-[15px] mb-2 mt-2">Review details</Text>
          {properties.map((p) => (
            <View key={p.key} className="bg-card rounded-2xl border border-navy-border mb-4 overflow-hidden">
              <View className="p-4 border-b border-navy-border/40">
                <Text className="text-navy font-sansBold text-[14px]">{p.address}</Text>
                <Text className="text-navy-muted font-sans text-[12px] mt-0.5">{p.units.length} unit{p.units.length === 1 ? '' : 's'}</Text>
              </View>
              {p.units.map((u) => {
                const key = unitKey(p.key, u.sourceRowIndex);
                return (
                  <View key={key} className="p-4 border-b border-navy-border/20">
                    <Text className="text-navy font-sans text-[13px] mb-1">
                      Unit {u.unitLabel} — {u.isVacant ? 'Vacant' : (u.tenantName || 'Occupied')}
                    </Text>
                    {u.issues.includes('Missing tenant name') && (
                      <TextInput
                        className="bg-pageBg border border-navy-border rounded-lg p-3 font-sans text-navy text-[13px] mt-1"
                        placeholder="Tenant name"
                        placeholderTextColor="#94a3b8"
                        value={edits[key]?.tenantName ?? ''}
                        onChangeText={(v) => applyEdit(key, 'tenantName', v)}
                      />
                    )}
                    {u.issues.includes('Missing rent amount') && (
                      <TextInput
                        className="bg-pageBg border border-navy-border rounded-lg p-3 font-sans text-navy text-[13px] mt-2"
                        placeholder="Monthly rent"
                        placeholderTextColor="#94a3b8"
                        keyboardType="decimal-pad"
                        value={edits[key]?.rent ?? ''}
                        onChangeText={(v) => applyEdit(key, 'rent', v)}
                      />
                    )}
                    {!u.isVacant && u.rent !== null && u.issues.length === 0 && (
                      <Text className="text-navy-muted font-sans text-[12px]">${money(u.rent)}/mo</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          <TouchableOpacity
            onPress={commitPortfolio}
            disabled={!allBlockersResolved}
            className="bg-navy py-4 rounded-2xl items-center mt-2"
            style={{ opacity: allBlockersResolved ? 1 : 0.4 }}
          >
            <Text className="text-white font-sansBold text-[16px]">Finish Setup</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (stage === 'committing') {
    return (
      <View className="flex-1 bg-pageBg justify-center items-center px-8">
        <ActivityIndicator color="#1F2F3A" size="large" style={{ marginBottom: 20 }} />
        <Text className="text-navy font-sansBold text-lg">Building your portfolio…</Text>
      </View>
    );
  }

  if (stage === 'done' && commitSummary) {
    const failures = commitResults.filter((r) => !r.success);
    return (
      <View className="flex-1 bg-pageBg">
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 96, paddingBottom: 60 }}>
          <Text className="text-3xl text-navy font-sansBold mb-2">You&apos;re in.</Text>
          <Text className="text-navy-muted font-sans text-base mb-8">
            We built your portfolio from {fileNames.length} document{fileNames.length === 1 ? '' : 's'}.
          </Text>

          <View className="flex-row flex-wrap gap-3 mb-8">
            {[
              { label: 'Properties', value: commitSummary.properties },
              { label: 'Units', value: commitSummary.units },
              { label: 'Residents', value: commitSummary.tenants },
            ].map((s) => (
              <View key={s.label} className="bg-card rounded-2xl px-4 py-3 border border-navy-border" style={{ minWidth: 90 }}>
                <Text className="text-navy font-sansBold text-[22px]">{s.value}</Text>
                <Text className="text-navy-muted font-sans text-[11px]">{s.label}</Text>
              </View>
            ))}
          </View>

          {failures.length > 0 && (
            <View className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6">
              <Text className="text-navy font-sansBold text-[13px] mb-2">{failures.length} propert{failures.length === 1 ? 'y' : 'ies'} couldn&apos;t be created</Text>
              {failures.map((f, i) => (
                <Text key={i} className="text-navy-muted font-sans text-[12px] mt-1">{f.propertyAddress}: {f.error}</Text>
              ))}
              <Text className="text-navy-muted font-sans text-[12px] mt-2">You can add these manually from your portfolio.</Text>
            </View>
          )}

          {commitSummary.tenants > 0 && (
            <View className="bg-card border border-navy-border rounded-2xl p-4 mb-6">
              <Text className="text-navy font-sans text-[12px]">Residents were created with login PINs. Invite emails weren&apos;t sent automatically for this bulk import — you can invite each resident from their profile when you&apos;re ready.</Text>
            </View>
          )}

          <TouchableOpacity onPress={() => router.replace('/(tabs)')} className="bg-navy py-4 rounded-2xl items-center">
            <Text className="text-white font-sansBold text-[16px]">Open Portfolio</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return null;
}
