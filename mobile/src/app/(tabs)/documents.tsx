import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface DocumentRow {
  id: string;
  name: string;
  type: string;
  url: string;
  signed: boolean;
  created_at: string;
}

function groupLabel(type: string) {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function DocumentsScreen() {
  const { role, profileId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const fetchDocuments = useCallback(async () => {
    if (!profileId) return;
    try {
      const column = role === 'tenant' ? 'tenant_id' : 'landlord_id';
      const { data } = await supabase
        .from('documents')
        .select('id, name, type, url, signed, created_at')
        .eq(column, profileId)
        .order('created_at', { ascending: false });

      setDocuments((data || []) as DocumentRow[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profileId, role]);

  useEffect(() => { setTimeout(() => fetchDocuments(), 0); }, [fetchDocuments]);

  const openDocument = async (doc: DocumentRow) => {
    try {
      const supported = await Linking.canOpenURL(doc.url);
      if (!supported) throw new Error('This document link cannot be opened.');
      await Linking.openURL(doc.url);
    } catch (err: any) {
      Alert.alert('Unable to open document', err.message);
    }
  };

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  const groups = Array.from(new Set(documents.map((d) => d.type)));

  return (
    <ScrollView className="flex-1 bg-pageBg" contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}>
      <Text className="text-[40px] text-navy font-sansBold mb-8">Documents</Text>

      {documents.length === 0 ? (
        <View className="bg-card rounded-[24px] p-8 items-center border border-navy-border">
          <Feather name="file-text" size={32} color="#1F2F3A" style={{ opacity: 0.2, marginBottom: 12 }} />
          <Text className="text-navy-muted font-sans text-center">No documents yet.</Text>
        </View>
      ) : (
        groups.map((type) => {
          const docsInGroup = documents.filter((d) => d.type === type);
          return (
            <View key={type} className="mb-8">
              <Text className="text-navy font-sansBold text-[18px] mb-4">{groupLabel(type)}</Text>
              <View className="bg-card rounded-[20px] border border-navy-border overflow-hidden shadow-sm">
                {docsInGroup.map((doc, index) => (
                  <TouchableOpacity
                    key={doc.id}
                    onPress={() => openDocument(doc)}
                    className={`p-5 flex-row items-center justify-between ${index !== docsInGroup.length - 1 ? 'border-b border-navy-border' : ''}`}
                  >
                    <View className="flex-row items-center flex-1 pr-3">
                      <View className="w-11 h-11 bg-pageBg rounded-xl items-center justify-center mr-4">
                        <Feather name="file-text" size={18} color="#1F2F3A" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-navy font-sansBold text-[15px]" numberOfLines={1}>{doc.name}</Text>
                        <Text className="text-navy-muted font-sans text-[13px] mt-0.5">
                          {new Date(doc.created_at).toLocaleDateString()}{doc.signed ? ' · Signed' : ''}
                        </Text>
                      </View>
                    </View>
                    <Feather name="download" size={18} color="#1F2F3A" style={{ opacity: 0.5 }} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
