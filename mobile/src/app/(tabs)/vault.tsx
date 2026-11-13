import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { monthDay } from '../../lib/format';
import { pickPhotos, uploadImages } from '../../lib/media';
import ScreenHeader from '../../components/ScreenHeader';

// Every property gets the same folders. `key` is what's stored in documents.type,
// so files filed from the older Documents screen land in the right folder too.
const FOLDERS: { key: string; label: string; icon: keyof typeof Feather.glyphMap; color: string; hint: string }[] = [
  { key: 'property', label: 'Ownership & title', icon: 'key', color: '#1F2F3A', hint: 'Deed, purchase papers, survey' },
  { key: 'leases_tenancy', label: 'Leases & tenancy', icon: 'file-text', color: '#8B2030', hint: 'Signed leases, renewals, applications' },
  { key: 'inspections_safety', label: 'Inspections', icon: 'clipboard', color: '#0E7490', hint: 'Move-in, move-out, safety checks' },
  { key: 'insurance', label: 'Insurance', icon: 'shield', color: '#B8860B', hint: 'Policy, renewals, claims' },
  { key: 'utilities_tax', label: 'Tax & utilities', icon: 'percent', color: '#475569', hint: 'Property tax, water, hydro, gas' },
  { key: 'maintenance', label: 'Repairs & invoices', icon: 'tool', color: '#B45309', hint: 'Work orders and receipts' },
  { key: 'projects', label: 'Projects & permits', icon: 'layers', color: '#7C3AED', hint: 'Quotes, permits, drawings' },
  { key: 'appliances_warranties', label: 'Warranties & manuals', icon: 'cpu', color: '#0A7A52', hint: 'Appliances and equipment' },
  { key: 'financial', label: 'Statements', icon: 'bar-chart-2', color: '#1F5FA6', hint: 'Owner statements, T776' },
  { key: 'photos', label: 'Photos', icon: 'image', color: '#C2410C', hint: 'Condition and listing photos' },
  { key: 'communications', label: 'Letters & notices', icon: 'mail', color: '#64748B', hint: 'Notices and letters sent' },
  { key: 'other', label: 'Other', icon: 'folder', color: '#94A3B8', hint: 'Anything else' },
];
const daysUntil = (d: string) => (new Date(d).getTime() - Date.now()) / 86400000;
const folderOf = (type: string | null) => FOLDERS.find((f) => f.key === type) ?? FOLDERS[FOLDERS.length - 1];

interface Doc { id: string; name: string; type: string | null; url: string; created_at: string; property_id: string | null; expiration_date: string | null }
interface Prop { id: string; name: string | null; address: string | null }

export default function VaultScreen() {
  const { profileId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [propertyId, setPropertyId] = useState<string | 'all' | 'general'>('all');
  const [folder, setFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<{ kind: 'file'; asset: DocumentPicker.DocumentPickerAsset } | { kind: 'photos'; uris: string[] } | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadProp, setUploadProp] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from('documents').select('id, name, type, url, created_at, property_id, expiration_date').eq('landlord_id', profileId).or('is_current.is.null,is_current.eq.true').order('created_at', { ascending: false }),
      supabase.from('properties').select('id, name, address').eq('landlord_id', profileId).is('deleted_at', null),
    ]);
    setDocs((d ?? []) as Doc[]);
    setProps((p ?? []) as Prop[]);
    setLoading(false);
  }, [profileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const inScope = docs.filter((d) => propertyId === 'all' ? true : propertyId === 'general' ? !d.property_id : d.property_id === propertyId);
  const q = search.trim().toLowerCase();
  const searched = q ? inScope.filter((d) => d.name.toLowerCase().includes(q)) : null;
  const inFolder = folder ? inScope.filter((d) => folderOf(d.type).key === folder) : [];
  const expiring = docs.filter((d) => d.expiration_date && daysUntil(d.expiration_date) <= 45);
  const currentFolder = FOLDERS.find((f) => f.key === folder);
  const scopeLabel = propertyId === 'all' ? 'All properties' : propertyId === 'general' ? 'General' : props.find((p) => p.id === propertyId)?.name || props.find((p) => p.id === propertyId)?.address || '';

  async function open(doc: Doc) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.url, 3600);
    if (error || !data?.signedUrl) return Alert.alert('Could not open', error?.message ?? 'Try again.');
    Linking.openURL(data.signedUrl);
  }

  function startUpload() {
    Alert.alert('Add to ' + (currentFolder?.label ?? 'Vault'), undefined, [
      { text: 'Take photo', onPress: async () => { const uris = await pickPhotos('camera'); if (uris.length) begin({ kind: 'photos', uris }); } },
      { text: 'Photo library', onPress: async () => { const uris = await pickPhotos('library'); if (uris.length) begin({ kind: 'photos', uris }); } },
      { text: 'Files (PDF, documents)', onPress: async () => {
        const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (!r.canceled && r.assets?.[0]) begin({ kind: 'file', asset: r.assets[0] });
      } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function begin(p: NonNullable<typeof pending>) {
    setPending(p);
    setUploadName(p.kind === 'file' ? p.asset.name.replace(/\.[^/.]+$/, '') : `${currentFolder?.label ?? 'Photo'} ${new Date().toISOString().slice(0, 10)}`);
    setUploadProp(propertyId === 'all' || propertyId === 'general' ? null : propertyId);
  }

  async function upload() {
    if (!pending || !profileId || !uploadName.trim() || uploading) return;
    setUploading(true);
    try {
      const type = folder ?? (pending.kind === 'photos' ? 'photos' : 'other');
      const base = { landlord_id: profileId, type, signed: false, property_id: uploadProp };
      if (pending.kind === 'file') {
        const ext = pending.asset.name.split('.').pop() || 'pdf';
        const path = `${profileId}/${Date.now()}-${uploadName.trim().replace(/[^a-zA-Z0-9-_ ]/g, '')}.${ext}`;
        const b64 = await FileSystem.readAsStringAsync(pending.asset.uri, { encoding: 'base64' });
        const { error } = await supabase.storage.from('documents').upload(path, decode(b64), { contentType: pending.asset.mimeType || 'application/octet-stream' });
        if (error) throw error;
        const { error: ie } = await supabase.from('documents').insert({ ...base, name: uploadName.trim(), url: path });
        if (ie) throw ie;
      } else {
        const paths = await uploadImages(profileId, pending.uris);
        const { error } = await supabase.from('documents').insert(paths.map((path, i) => ({ ...base, name: paths.length > 1 ? `${uploadName.trim()} (${i + 1})` : uploadName.trim(), url: path })));
        if (error) throw error;
      }
      setPending(null);
      load();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  }

  function fileMenu(doc: Doc) {
    Alert.alert(doc.name, undefined, [
      { text: 'Open', onPress: () => open(doc) },
      { text: 'Move to folder…', onPress: () => Alert.alert('Move to', undefined, [
        ...FOLDERS.slice(0, 8).map((f) => ({ text: f.label, onPress: async () => { await supabase.from('documents').update({ type: f.key }).eq('id', doc.id); load(); } })),
        { text: 'More…', onPress: () => Alert.alert('Move to', undefined, [
          ...FOLDERS.slice(8).map((f) => ({ text: f.label, onPress: async () => { await supabase.from('documents').update({ type: f.key }).eq('id', doc.id); load(); } })),
          { text: 'Cancel', style: 'cancel' as const },
        ]) },
        { text: 'Cancel', style: 'cancel' as const },
      ]) },
      { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Delete this file?', 'This can’t be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.storage.from('documents').remove([doc.url]);
          await supabase.from('documents').delete().eq('id', doc.id);
          load();
        } },
      ]) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View className="flex-1 bg-pageBg">
      <ScreenHeader
        title={currentFolder ? currentFolder.label : 'Vault'}
        subtitle={currentFolder ? `${scopeLabel} · ${inFolder.length} file${inFolder.length === 1 ? '' : 's'}` : `${docs.length} file${docs.length === 1 ? '' : 's'} · every property, same folders`}
        right={
          <View className="flex-row gap-2">
            {currentFolder && (
              <TouchableOpacity onPress={() => setFolder(null)} className="h-11 px-4 bg-card border border-navy/10 rounded-full flex-row items-center">
                <Feather name="arrow-left" size={15} color="#1F2F3A" />
                <Text className="text-navy font-sansBold text-[13px] ml-1.5">Folders</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={startUpload} className="h-11 px-4 bg-navy rounded-full flex-row items-center">
              <Feather name="upload" size={15} color="#FFFFFF" />
              <Text className="text-white font-sansBold text-[13px] ml-1.5">Add</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Property switcher */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingBottom: 12 }}>
        {[{ id: 'all', label: 'All' }, ...props.map((p) => ({ id: p.id, label: p.name || p.address || 'Property' })), { id: 'general', label: 'General' }].map((p) => {
          const on = propertyId === p.id;
          return (
            <TouchableOpacity key={p.id} onPress={() => setPropertyId(p.id as any)} className="px-4 py-2 rounded-full border" style={{ borderColor: on ? '#1F2F3A' : '#D8D2C8', backgroundColor: on ? '#1F2F3A' : '#FFFFFF' }}>
              <Text className="font-sansBold text-[12px]" style={{ color: on ? '#FFFFFF' : '#1F2F3A' }} numberOfLines={1}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#1F2F3A" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
          {!folder && (
            <View className="flex-row items-center bg-card rounded-2xl px-4 py-3 mb-4 border border-navy/5">
              <Feather name="search" size={16} color="#94a3b8" />
              <TextInput className="flex-1 ml-2.5 font-sans text-navy" placeholder="Search every file" placeholderTextColor="#94a3b8" value={search} onChangeText={setSearch} />
            </View>
          )}

          {!folder && !searched && expiring.length > 0 && (
            <View className="rounded-[20px] p-4 mb-4 flex-row items-center" style={{ backgroundColor: 'rgba(180,83,9,0.08)', borderWidth: 1, borderColor: 'rgba(180,83,9,0.2)' }}>
              <Feather name="alert-circle" size={18} color="#B45309" />
              <Text className="font-sansBold text-[13px] ml-2.5 flex-1" style={{ color: '#92400E' }}>
                {expiring.length} document{expiring.length === 1 ? '' : 's'} expiring soon: {expiring.slice(0, 2).map((d) => d.name).join(', ')}
              </Text>
            </View>
          )}

          {searched ? (
            <FileList docs={searched} props={props} onPress={open} onLong={fileMenu} empty="No files match." />
          ) : folder ? (
            <FileList docs={inFolder} props={props} onPress={open} onLong={fileMenu} empty={`Nothing in ${currentFolder?.label} yet. Tap Add to upload.`} />
          ) : (
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              {FOLDERS.map((f) => {
                const count = inScope.filter((d) => folderOf(d.type).key === f.key).length;
                return (
                  <View key={f.key} style={{ width: '50%', padding: 6 }}>
                    <TouchableOpacity onPress={() => setFolder(f.key)} className="bg-card rounded-[22px] p-4 border border-navy/5 shadow-sm active:opacity-80" style={{ minHeight: 128 }}>
                      <View className="flex-row items-center justify-between mb-3">
                        <View className="w-10 h-10 rounded-2xl items-center justify-center" style={{ backgroundColor: `${f.color}16` }}>
                          <Feather name={f.icon} size={18} color={f.color} />
                        </View>
                        <Text className="font-sansBold text-[18px]" style={{ color: count ? '#1F2F3A' : 'rgba(31,47,58,0.2)' }}>{count}</Text>
                      </View>
                      <Text className="text-navy font-sansBold text-[14px]" numberOfLines={1}>{f.label}</Text>
                      <Text className="text-navy-muted font-sans text-[11px] opacity-60 mt-0.5" numberOfLines={2}>{f.hint}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={!!pending} transparent animationType="slide" onRequestClose={() => setPending(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setPending(null)} />
          <View className="bg-card rounded-t-[28px] p-6">
            <Text className="text-navy font-sansBold text-[20px] mb-1">Save to {currentFolder?.label ?? (pending?.kind === 'photos' ? 'Photos' : 'Other')}</Text>
            <Text className="text-navy-muted font-sans text-[13px] mb-4">{pending?.kind === 'photos' ? `${pending.uris.length} photo${pending.uris.length === 1 ? '' : 's'}` : pending?.asset.name}</Text>
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Name</Text>
            <TextInput className="bg-pageBg border border-navy-border rounded-xl px-4 py-3.5 font-sans text-navy mb-4" value={uploadName} onChangeText={setUploadName} />
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Property</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {[{ id: null as string | null, label: 'General' }, ...props.map((p) => ({ id: p.id as string | null, label: p.name || p.address || 'Property' }))].map((p) => {
                const on = uploadProp === p.id;
                return (
                  <TouchableOpacity key={p.id ?? 'general'} onPress={() => setUploadProp(p.id)} className="px-3.5 py-2 rounded-full border" style={{ borderColor: on ? '#1F2F3A' : '#D8D2C8', backgroundColor: on ? '#1F2F3A' : 'transparent' }}>
                    <Text className="font-sansBold text-[12px]" style={{ color: on ? '#FFFFFF' : '#1F2F3A' }}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={upload} disabled={uploading || !uploadName.trim()} className="bg-navy rounded-2xl py-4 items-center mb-2" style={{ opacity: uploadName.trim() ? 1 : 0.5 }}>
              {uploading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-sansBold text-[15px]">Upload</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FileList({ docs, props, onPress, onLong, empty }: { docs: Doc[]; props: Prop[]; onPress: (d: Doc) => void; onLong: (d: Doc) => void; empty: string }) {
  if (!docs.length) {
    return (
      <View className="bg-card rounded-[24px] p-8 items-center border border-navy/5">
        <Feather name="folder" size={26} color="#1F2F3A" style={{ opacity: 0.2 }} />
        <Text className="text-navy-muted font-sans text-[13px] text-center mt-3">{empty}</Text>
      </View>
    );
  }
  return (
    <View className="bg-card rounded-[24px] border border-navy/5 overflow-hidden">
      {docs.map((d, i) => {
        const f = folderOf(d.type);
        const ext = (d.url.split('.').pop() || '').toUpperCase().slice(0, 4);
        const prop = props.find((p) => p.id === d.property_id);
        return (
          <TouchableOpacity key={d.id} onPress={() => onPress(d)} onLongPress={() => onLong(d)} className={`flex-row items-center px-4 py-3.5 ${i ? 'border-t border-navy/5' : ''}`}>
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: `${f.color}14` }}>
              <Text className="font-sansBold text-[9px]" style={{ color: f.color }}>{ext || 'FILE'}</Text>
            </View>
            <View className="flex-1 pr-2">
              <Text className="text-navy font-sansBold text-[14px]" numberOfLines={1}>{d.name}</Text>
              <Text className="text-navy-muted font-sans text-[11px] opacity-60" numberOfLines={1}>{prop ? `${prop.name || prop.address} · ` : ''}{monthDay(d.created_at)}</Text>
            </View>
            <TouchableOpacity onPress={() => onLong(d)} hitSlop={10}><Feather name="more-horizontal" size={18} color="#1F2F3A" style={{ opacity: 0.35 }} /></TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
