import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../lib/format';

// Module 2B — Document Vault (spec B). `type` is the existing free-text
// category column (kept, not renamed, so old rows and the tenant screen's
// grouping keep working); `subtype`/`property_id`/`unit_id`/`vendor`/
// `asset_id`/`work_order_id`/`amount`/`document_date`/`expiration_date`/
// `tags`/`notes`/`supersedes_id`/`is_current` are new. No AI
// auto-categorization (spec 2B.2) — no AI/document-parsing infrastructure
// exists anywhere in this app, same gap as every other AI-dependent spec
// section; a document with no category is surfaced honestly in "Needs
// Attention" instead of being silently misfiled or faked into a category.

interface DocumentRow {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  url: string;
  signed: boolean;
  created_at: string;
  property_id: string | null;
  unit_id: string | null;
  vendor: string | null;
  amount: number | null;
  document_date: string | null;
  expiration_date: string | null;
  tags: string[] | null;
  notes: string | null;
  supersedes_id: string | null;
  is_current: boolean;
  work_order_id: string | null;
  properties: { name: string | null; address: string | null } | null;
  units: { unit_number: string | null } | null;
}

interface PropertyOption { id: string; name: string | null; address: string | null }
interface UnitOption { id: string; unit_number: string | null }
interface LeaseFlagRow { id: string; unit_id: string; tenants: { first_name: string | null; last_name: string | null } | null; units: { unit_number: string | null; properties: { name: string | null; address: string | null } | null } | null }
interface WorkOrderFlagRow { id: string; title: string; status: string }

const CATEGORIES = [
  { value: 'leases_tenancy', label: 'Leases & Tenancy' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'financial', label: 'Financial' },
  { value: 'property', label: 'Property' },
  { value: 'inspections_safety', label: 'Inspections & Safety' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'utilities_tax', label: 'Utilities / Tax' },
  { value: 'communications', label: 'Communications' },
  { value: 'appliances_warranties', label: 'Appliances & Warranties' },
  { value: 'other', label: 'Other' },
];

function categoryLabel(type: string | null) {
  if (!type) return 'Uncategorized';
  return CATEGORIES.find((c) => c.value === type)?.label ?? type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function daysUntil(dateStr: string) {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function DocumentsScreen() {
  const { role, profileId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [missingLeaseDocs, setMissingLeaseDocs] = useState<LeaseFlagRow[]>([]);
  const [missingInvoiceWorkOrders, setMissingInvoiceWorkOrders] = useState<WorkOrderFlagRow[]>([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [docPropertyId, setDocPropertyId] = useState<string | null>(null);
  const [docUnitId, setDocUnitId] = useState<string | null>(null);
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [tags, setTags] = useState('');
  const [replacesExisting, setReplacesExisting] = useState(false);
  const [supersedesId, setSupersedesId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadingRef = React.useRef(false);

  const fetchDocuments = useCallback(async () => {
    if (!profileId) return;
    try {
      const column = role === 'tenant' ? 'tenant_id' : 'landlord_id';
      const { data } = await supabase
        .from('documents')
        .select('id, name, type, subtype, url, signed, created_at, property_id, unit_id, vendor, amount, document_date, expiration_date, tags, notes, supersedes_id, is_current, work_order_id, properties ( name, address ), units ( unit_number )')
        .eq(column, profileId)
        .order('created_at', { ascending: false });

      setDocuments((data || []) as unknown as DocumentRow[]);

      if (role !== 'tenant') {
        const { data: props } = await supabase.from('properties').select('id, name, address').eq('landlord_id', profileId);
        setProperties((props ?? []) as PropertyOption[]);

        const { data: leases } = await supabase
          .from('leases')
          .select('id, unit_id, tenants ( first_name, last_name ), units ( unit_number, properties ( name, address ) )')
          .eq('landlord_id', profileId)
          .eq('status', 'active');
        const docLeaseIds = new Set((data || []).map((d: any) => d.lease_id).filter(Boolean));
        setMissingLeaseDocs(((leases ?? []) as unknown as (LeaseFlagRow & { id: string })[]).filter((l) => !docLeaseIds.has(l.id)));

        const { data: workOrders } = await supabase
          .from('maintenance_requests')
          .select('id, title, status')
          .eq('landlord_id', profileId)
          .in('status', ['resolved', 'closed']);
        const docWorkOrderIds = new Set((data || []).map((d: any) => d.work_order_id).filter(Boolean));
        setMissingInvoiceWorkOrders(((workOrders ?? []) as WorkOrderFlagRow[]).filter((w) => !docWorkOrderIds.has(w.id)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profileId, role]);

  useFocusEffect(useCallback(() => { fetchDocuments(); }, [fetchDocuments]));

  useFocusEffect(useCallback(() => {
    if (!docPropertyId) { setUnits([]); return; }
    supabase.from('units').select('id, unit_number').eq('property_id', docPropertyId).then(({ data }) => setUnits((data ?? []) as UnitOption[]));
  }, [docPropertyId]));

  const openDocument = async (doc: DocumentRow) => {
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.url, 3600);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not generate a link for this document.');
      await Linking.openURL(data.signedUrl);
    } catch (err: any) {
      Alert.alert('Unable to open document', err.message);
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPendingFile(asset);
    setDocName(asset.name.replace(/\.[^/.]+$/, ''));
    setDocCategory(null);
    setShowDetails(false);
    setDocPropertyId(null);
    setDocUnitId(null);
    setVendor('');
    setAmount('');
    setDocumentDate('');
    setExpirationDate('');
    setTags('');
    setReplacesExisting(false);
    setSupersedesId(null);
  };

  const uploadDocument = async () => {
    if (!pendingFile || !profileId || !docName.trim() || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(pendingFile.uri, { encoding: 'base64' });
      const ext = pendingFile.name.split('.').pop() || 'pdf';
      const path = `${profileId}/${Date.now()}-${docName.trim().replace(/[^a-zA-Z0-9-_ ]/g, '')}.${ext}`;

      // A failed/unsupported upload never blocks storage of the metadata
      // (spec 2B.7) — but here storage itself failing means there's
      // nothing to file, so this one case does have to stop.
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, decode(base64), { contentType: pendingFile.mimeType || 'application/octet-stream' });
      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await supabase.from('documents').insert({
        landlord_id: profileId,
        name: docName.trim(),
        type: docCategory,
        url: path,
        signed: false,
        property_id: docPropertyId,
        unit_id: docUnitId,
        vendor: vendor.trim() || null,
        amount: amount ? Number(amount) : null,
        document_date: documentDate || null,
        expiration_date: expirationDate || null,
        tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
        supersedes_id: replacesExisting ? supersedesId : null,
      }).select().single();
      if (insertError) throw insertError;

      if (replacesExisting && supersedesId && inserted) {
        await supabase.from('documents').update({ is_current: false }).eq('id', supersedesId);
      }

      setPendingFile(null);
      setDocName('');
      fetchDocuments();
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploading(false);
      uploadingRef.current = false;
    }
  };

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  const uncategorized = documents.filter((d) => !d.type);
  const expiringSoon = documents.filter((d) => d.expiration_date && daysUntil(d.expiration_date) >= -30 && daysUntil(d.expiration_date) <= 30);
  const needsAttentionCount = uncategorized.length + expiringSoon.length + missingLeaseDocs.length + missingInvoiceWorkOrders.length;

  const q = search.trim().toLowerCase();
  const filtered = documents.filter((d) => {
    if (categoryFilter && d.type !== categoryFilter) return false;
    if (!q) return true;
    const haystack = [d.name, categoryLabel(d.type), d.subtype, d.vendor, d.properties?.name, d.properties?.address, ...(d.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });

  const groups = Array.from(new Set(filtered.map((d) => d.type)));
  const recent = [...documents].slice(0, 5);

  return (
    <ScrollView className="flex-1 bg-pageBg" contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}>
      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-[40px] text-navy font-sansBold">Documents</Text>
        {role !== 'tenant' && (
          <TouchableOpacity onPress={pickFile} className="w-12 h-12 bg-navy rounded-full items-center justify-center shadow-md">
            <Feather name="upload" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {role !== 'tenant' && (
        <>
          <View className="bg-card border border-navy-border rounded-2xl px-4 mb-4 flex-row items-center">
            <Feather name="search" size={16} color="#94a3b8" />
            <TextInput
              className="flex-1 py-3.5 px-3 font-sans text-navy"
              value={search}
              onChangeText={setSearch}
              placeholder="Search documents, vendors, tags..."
              placeholderTextColor="#94a3b8"
            />
          </View>

          {needsAttentionCount > 0 && (
            <View className="mb-6">
              <Text className="text-navy font-sansBold text-[16px] mb-3">Needs Attention ({needsAttentionCount})</Text>
              {uncategorized.length > 0 && (
                <View className="bg-card rounded-2xl p-4 border border-amber-300 mb-2">
                  <Text className="text-navy font-sansBold text-[13px]">{uncategorized.length} document{uncategorized.length === 1 ? '' : 's'} need categorization</Text>
                </View>
              )}
              {expiringSoon.map((d) => (
                <View key={d.id} className="bg-card rounded-2xl p-4 border border-amber-300 mb-2">
                  <Text className="text-navy font-sansBold text-[13px]">{d.name} {daysUntil(d.expiration_date!) < 0 ? 'has expired' : `expires in ${daysUntil(d.expiration_date!)} days`}</Text>
                </View>
              ))}
              {missingLeaseDocs.map((l) => (
                <View key={l.id} className="bg-card rounded-2xl p-4 border border-amber-300 mb-2">
                  <Text className="text-navy font-sansBold text-[13px]">
                    Missing lease document — {(l.tenants?.first_name ?? '')} {(l.tenants?.last_name ?? '')} ({l.units?.properties?.name ?? l.units?.properties?.address ?? ''}{l.units?.unit_number ? ` · Unit ${l.units.unit_number}` : ''})
                  </Text>
                </View>
              ))}
              {missingInvoiceWorkOrders.map((w) => (
                <View key={w.id} className="bg-card rounded-2xl p-4 border border-amber-300 mb-2">
                  <Text className="text-navy font-sansBold text-[13px]">Missing invoice — {w.title}</Text>
                </View>
              ))}
            </View>
          )}

          {recent.length > 0 && !q && !categoryFilter && (
            <View className="mb-6">
              <Text className="text-navy font-sansBold text-[16px] mb-3">Recent</Text>
              {recent.map((d) => <DocCard key={d.id} d={d} onPress={() => openDocument(d)} />)}
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity onPress={() => setCategoryFilter(null)} className="px-4 py-2 rounded-full border" style={{ borderColor: !categoryFilter ? '#1F2F3A' : '#D8D2C8', backgroundColor: !categoryFilter ? '#1F2F3A' : '#FFFFFF' }}>
              <Text className="font-sansBold text-[12px]" style={{ color: !categoryFilter ? '#FFFFFF' : '#333333' }}>All</Text>
            </TouchableOpacity>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c.value} onPress={() => setCategoryFilter(c.value)} className="px-4 py-2 rounded-full border" style={{ borderColor: categoryFilter === c.value ? '#1F2F3A' : '#D8D2C8', backgroundColor: categoryFilter === c.value ? '#1F2F3A' : '#FFFFFF' }}>
                <Text className="font-sansBold text-[12px]" style={{ color: categoryFilter === c.value ? '#FFFFFF' : '#333333' }}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {filtered.length === 0 ? (
        <View className="bg-card rounded-[24px] p-8 items-center border border-navy-border">
          <Feather name="file-text" size={32} color="#1F2F3A" style={{ opacity: 0.2, marginBottom: 12 }} />
          <Text className="text-navy-muted font-sans text-center">{documents.length === 0 ? 'No documents yet.' : 'No documents match.'}</Text>
        </View>
      ) : (
        groups.map((type) => {
          const docsInGroup = filtered.filter((d) => d.type === type);
          return (
            <View key={type ?? 'uncategorized'} className="mb-8">
              <Text className="text-navy font-sansBold text-[18px] mb-4">{categoryLabel(type)}</Text>
              <View className="bg-card rounded-[20px] border border-navy-border overflow-hidden shadow-sm">
                {docsInGroup.map((doc, index) => (
                  <View key={doc.id} className={index !== docsInGroup.length - 1 ? 'border-b border-navy-border' : ''}>
                    <DocCard d={doc} onPress={() => openDocument(doc)} plain />
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}

      <Modal visible={!!pendingFile} animationType="slide" transparent onRequestClose={() => setPendingFile(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <ScrollView className="bg-card rounded-t-[28px]" contentContainerStyle={{ padding: 24 }} style={{ maxHeight: '88%' }}>
            <Text className="text-navy font-sansBold text-[19px] mb-1">Upload Document</Text>
            {!!pendingFile && <Text className="text-navy-muted font-sans text-[13px] mb-5" numberOfLines={1}>{pendingFile.name}</Text>}

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Document Name</Text>
            <TextInput
              className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
              value={docName}
              onChangeText={setDocName}
              placeholder="e.g. Lease Agreement"
              placeholderTextColor="#94a3b8"
            />

            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Category</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setDocCategory(c.value)}
                  className="px-3 py-1.5 rounded-full border"
                  style={{ borderColor: docCategory === c.value ? '#1F2F3A' : '#D8D2C8', backgroundColor: docCategory === c.value ? '#1F2F3A' : 'transparent' }}
                >
                  <Text className="font-sansBold text-[12px]" style={{ color: docCategory === c.value ? '#FFFFFF' : '#333333' }}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!docCategory && <Text className="text-navy-muted font-sans text-[11px] mb-4">No category selected — this will be saved and flagged under Needs Attention so nothing gets lost.</Text>}
            {!!docCategory && <View className="mb-4" />}

            <TouchableOpacity onPress={() => setShowDetails((s) => !s)} className="flex-row items-center mb-4">
              <Feather name={showDetails ? 'chevron-up' : 'chevron-down'} size={16} color="#1F2F3A" />
              <Text className="text-navy font-sansBold text-[13px] ml-1">{showDetails ? 'Hide details' : 'Add details (property, vendor, dates, tags)'}</Text>
            </TouchableOpacity>

            {showDetails && (
              <>
                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Property</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8 }}>
                  <TouchableOpacity onPress={() => { setDocPropertyId(null); setDocUnitId(null); }} className="px-3.5 py-2 rounded-full border" style={{ borderColor: !docPropertyId ? '#1F2F3A' : '#D8D2C8', backgroundColor: !docPropertyId ? '#1F2F3A' : '#FFFFFF' }}>
                    <Text className="font-sansBold text-[12px]" style={{ color: !docPropertyId ? '#FFFFFF' : '#333333' }}>None</Text>
                  </TouchableOpacity>
                  {properties.map((p) => (
                    <TouchableOpacity key={p.id} onPress={() => { setDocPropertyId(p.id); setDocUnitId(null); }} className="px-3.5 py-2 rounded-full border" style={{ borderColor: docPropertyId === p.id ? '#1F2F3A' : '#D8D2C8', backgroundColor: docPropertyId === p.id ? '#1F2F3A' : '#FFFFFF' }}>
                      <Text className="font-sansBold text-[12px]" style={{ color: docPropertyId === p.id ? '#FFFFFF' : '#333333' }}>{p.name || p.address}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {units.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8 }}>
                    <TouchableOpacity onPress={() => setDocUnitId(null)} className="px-3.5 py-2 rounded-full border" style={{ borderColor: !docUnitId ? '#1F2F3A' : '#D8D2C8', backgroundColor: !docUnitId ? '#1F2F3A' : '#FFFFFF' }}>
                      <Text className="font-sansBold text-[12px]" style={{ color: !docUnitId ? '#FFFFFF' : '#333333' }}>Whole property</Text>
                    </TouchableOpacity>
                    {units.map((u) => (
                      <TouchableOpacity key={u.id} onPress={() => setDocUnitId(u.id)} className="px-3.5 py-2 rounded-full border" style={{ borderColor: docUnitId === u.id ? '#1F2F3A' : '#D8D2C8', backgroundColor: docUnitId === u.id ? '#1F2F3A' : '#FFFFFF' }}>
                        <Text className="font-sansBold text-[12px]" style={{ color: docUnitId === u.id ? '#FFFFFF' : '#333333' }}>Unit {u.unit_number}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <View className="flex-row gap-3 mb-3">
                  <View className="flex-1">
                    <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Vendor</Text>
                    <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy" value={vendor} onChangeText={setVendor} placeholder="Optional" placeholderTextColor="#94a3b8" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Amount</Text>
                    <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy" value={amount} onChangeText={setAmount} placeholder="Optional" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" />
                  </View>
                </View>

                <View className="flex-row gap-3 mb-3">
                  <View className="flex-1">
                    <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Document date</Text>
                    <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy" value={documentDate} onChangeText={setDocumentDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Expires</Text>
                    <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy" value={expirationDate} onChangeText={setExpirationDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                  </View>
                </View>

                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Tags (comma-separated)</Text>
                <TextInput className="bg-pageBg border border-navy-border rounded-xl p-3.5 font-sans text-navy mb-3" value={tags} onChangeText={setTags} placeholder="e.g. unit 2, 2026" placeholderTextColor="#94a3b8" />

                <View className="flex-row items-center justify-between bg-pageBg rounded-xl p-3.5 mb-4">
                  <Text className="text-navy font-sans text-[13px] flex-1 pr-3">This replaces an existing document (keeps the old one as superseded, not deleted)</Text>
                  <Switch value={replacesExisting} onValueChange={setReplacesExisting} trackColor={{ true: '#1F2F3A' }} />
                </View>

                {replacesExisting && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
                    {documents.filter((d) => d.is_current).map((d) => (
                      <TouchableOpacity key={d.id} onPress={() => setSupersedesId(d.id)} className="px-3.5 py-2 rounded-full border" style={{ borderColor: supersedesId === d.id ? '#1F2F3A' : '#D8D2C8', backgroundColor: supersedesId === d.id ? '#1F2F3A' : '#FFFFFF' }}>
                        <Text className="font-sansBold text-[12px]" style={{ color: supersedesId === d.id ? '#FFFFFF' : '#333333' }} numberOfLines={1}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setPendingFile(null)} className="flex-1 py-4 rounded-xl items-center border border-navy-border">
                <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={uploadDocument} disabled={uploading || !docName.trim()} className="flex-1 bg-navy py-4 rounded-xl items-center" style={{ opacity: !docName.trim() ? 0.5 : 1 }}>
                <Text className="text-white font-sansBold text-[15px]">{uploading ? 'Uploading...' : 'Upload'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function DocCard({ d, onPress, plain }: { d: DocumentRow; onPress: () => void; plain?: boolean }) {
  const content = (
    <View className={`p-5 flex-row items-center justify-between ${plain ? '' : 'bg-card rounded-[20px] border border-navy-border mb-3'}`}>
      <View className="flex-row items-center flex-1 pr-3">
        <View className="w-11 h-11 bg-pageBg rounded-xl items-center justify-center mr-4">
          <Feather name="file-text" size={18} color="#1F2F3A" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center flex-wrap">
            <Text className="text-navy font-sansBold text-[15px]" numberOfLines={1}>{d.name}</Text>
            {!d.is_current && (
              <View className="ml-2 px-2 py-0.5 rounded-full bg-slate-100">
                <Text className="text-navy-muted font-sansBold text-[9px] uppercase">Superseded</Text>
              </View>
            )}
          </View>
          <Text className="text-navy-muted font-sans text-[13px] mt-0.5">
            {[new Date(d.created_at).toLocaleDateString(), d.vendor, d.amount != null ? `$${money(d.amount)}` : null, d.properties?.name ?? d.properties?.address].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      <Feather name="download" size={18} color="#1F2F3A" style={{ opacity: 0.5 }} />
    </View>
  );
  return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
}
