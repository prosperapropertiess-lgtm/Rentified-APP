import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/SkeletonLoader';

type Property = {
  id: string;
  name: string;
};

type DocumentItem = {
  id: string;
  title: string;
  category: 'lease' | 'insurance' | 'tax' | 'receipt' | 'other';
  property_id: string;
  file_url: string;
  created_at: string;
  properties?: { name: string };
};

export default function LandlordDocumentsScreen() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Upload Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'lease' | 'insurance' | 'tax' | 'receipt' | 'other'>('lease');
  const [newPropertyId, setNewPropertyId] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session?.user) return;
    try {
      setLoading(true);

      // Fetch Landlord ID
      const { data: landlord } = await supabase
        .from('landlords')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (landlord) {
        // Fetch properties for filter
        const { data: propsData } = await supabase
          .from('properties')
          .select('id, name')
          .eq('landlord_id', landlord.id)
          .order('name');

        setProperties(propsData || []);
        if (propsData && propsData.length > 0 && !newPropertyId) {
          setNewPropertyId(propsData[0].id);
        }

        // Fetch documents
        const { data: docsData } = await supabase
          .from('documents')
          .select('*, properties(name)')
          .eq('landlord_id', landlord.id)
          .order('created_at', { ascending: false });

        setDocuments(docsData || []);
      }
    } catch (e) {
      console.error('Error fetching documents data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, newPropertyId]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchData();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleUploadDocument = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a document title.');
      return;
    }
    if (!newPropertyId) {
      Alert.alert('Missing Property', 'Please select a property.');
      return;
    }

    try {
      setUploading(true);

      const { data: landlord } = await supabase
        .from('landlords')
        .select('id')
        .eq('user_id', session?.user?.id)
        .maybeSingle();

      if (!landlord) {
        Alert.alert('Error', 'Landlord profile not found.');
        return;
      }

      const { error } = await supabase.from('documents').insert({
        landlord_id: landlord.id,
        property_id: newPropertyId,
        title: newTitle.trim(),
        category: newCategory,
        file_url: newFileUrl.trim() || 'https://rentified.ca/sample-lease.pdf',
      });

      if (error) {
        Alert.alert('Upload Error', error.message);
      } else {
        Alert.alert('Document Saved', `"${newTitle}" has been archived to your property vault.`);
        setModalVisible(false);
        setNewTitle('');
        setNewFileUrl('');
        fetchData();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesProperty = selectedPropertyId === 'all' || doc.property_id === selectedPropertyId;
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    return matchesProperty && matchesCategory;
  });

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-pageBg p-6 pt-16">
        <Skeleton width={180} height={36} borderRadius={12} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={70} borderRadius={16} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={100} borderRadius={20} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={100} borderRadius={20} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={100} borderRadius={20} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-pageBg relative">
      {/* Background Orbs */}
      <View
        className="absolute w-[450px] h-[450px] rounded-full"
        style={{ top: -100, right: -120, zIndex: 0, backgroundColor: 'rgba(124, 58, 237, 0.05)' }}
      />

      <ScrollView
        className="flex-1 z-10"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F1C28" />}
      >
        {/* Header */}
        <View className="px-6 pt-16 pb-4 bg-pageBg/90 border-b border-navy-border flex-row items-center justify-between">
          <View>
            <Text className="text-[12px] text-navy-muted uppercase tracking-[0.1em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              Property Vault
            </Text>
            <Text className="text-[32px] text-navy" style={{ fontFamily: 'Cormorant_300Light' }}>
              Documents & Leases
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="bg-navy px-4 py-2.5 rounded-[12px] flex-row items-center shadow-sm"
          >
            <MaterialIcons name="add" size={18} color="#FFFFFF" />
            <Text className="text-white text-[13px] ml-1 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              Upload
            </Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 mt-6">
          {/* Property Selector Pills */}
          <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'DMSans_700Bold' }}>
            Filter By Property
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-row">
            <TouchableOpacity
              onPress={() => setSelectedPropertyId('all')}
              className={`px-4 py-2 rounded-full mr-2 border ${
                selectedPropertyId === 'all' ? 'bg-navy border-navy' : 'bg-white border-navy-border'
              }`}
            >
              <Text
                className={`text-[13px] ${selectedPropertyId === 'all' ? 'text-white font-bold' : 'text-navy-muted'}`}
                style={{ fontFamily: selectedPropertyId === 'all' ? 'DMSans_700Bold' : 'DMSans_500Medium' }}
              >
                All Buildings ({documents.length})
              </Text>
            </TouchableOpacity>

            {properties.map((prop) => {
              const count = documents.filter((d) => d.property_id === prop.id).length;
              const isSelected = selectedPropertyId === prop.id;

              return (
                <TouchableOpacity
                  key={prop.id}
                  onPress={() => setSelectedPropertyId(prop.id)}
                  className={`px-4 py-2 rounded-full mr-2 border ${
                    isSelected ? 'bg-navy border-navy' : 'bg-white border-navy-border'
                  }`}
                >
                  <Text
                    className={`text-[13px] ${isSelected ? 'text-white font-bold' : 'text-navy-muted'}`}
                    style={{ fontFamily: isSelected ? 'DMSans_700Bold' : 'DMSans_500Medium' }}
                  >
                    {prop.name} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Category Filter Pills */}
          <View className="flex-row items-center mb-6">
            {(['all', 'lease', 'insurance', 'tax', 'receipt', 'other'] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full mr-2 border ${
                  selectedCategory === cat ? 'bg-navy/10 border-navy' : 'bg-white border-navy-border'
                }`}
              >
                <Text
                  className={`text-[11px] capitalize ${selectedCategory === cat ? 'text-navy font-bold' : 'text-navy-muted'}`}
                  style={{ fontFamily: selectedCategory === cat ? 'DMSans_700Bold' : 'DMSans_500Medium' }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Document List */}
          {filteredDocs.length === 0 ? (
            <View className="bg-white rounded-[20px] p-8 border border-navy-border items-center justify-center">
              <View className="w-12 h-12 rounded-full bg-purple-500/10 items-center justify-center mb-3">
                <MaterialIcons name="folder-open" size={26} color="#7C3AED" />
              </View>
              <Text className="text-[17px] text-navy font-bold mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                No documents in vault
              </Text>
              <Text className="text-[13px] text-navy-muted text-center mb-4" style={{ fontFamily: 'DMSans_400Regular' }}>
                Store leases, deeds, insurance policies, and tax receipts organized per property.
              </Text>

              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                className="bg-navy px-5 py-2.5 rounded-[12px] flex-row items-center"
              >
                <MaterialIcons name="cloud-upload" size={18} color="#FFFFFF" />
                <Text className="text-white text-[13px] ml-1.5 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Upload First Document
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredDocs.map((doc) => (
              <View
                key={doc.id}
                className="bg-white rounded-[20px] p-5 border border-navy-border shadow-card mb-3.5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1 pr-2">
                  <View className="w-11 h-11 rounded-[14px] bg-purple-500/10 items-center justify-center mr-3">
                    <MaterialIcons
                      name={
                        doc.category === 'lease'
                          ? 'description'
                          : doc.category === 'insurance'
                          ? 'security'
                          : doc.category === 'tax'
                          ? 'account-balance'
                          : 'folder'
                      }
                      size={22}
                      color="#7C3AED"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                      {doc.title}
                    </Text>
                    <Text className="text-[12px] text-navy-muted mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                      {doc.properties?.name || 'General'} • {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center">
                  <View className="bg-purple-500/10 px-2.5 py-1 rounded-full mr-2">
                    <Text className="text-[10px] text-[#7C3AED] font-bold uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                      {doc.category}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => Alert.alert('Document Vault', `Opening "${doc.title}"...`)}
                    className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border"
                  >
                    <MaterialIcons name="arrow-downward" size={16} color="#0F1C28" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Upload Document Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[28px] p-6 border-t border-navy-border">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-[22px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                Upload Property Document
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border">
                <MaterialIcons name="close" size={18} color="#0F1C28" />
              </TouchableOpacity>
            </View>

            <Text className="text-[12px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              Document Title *
            </Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. Unit 4B Lease Agreement 2026"
              className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-4"
            />

            <Text className="text-[12px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              Select Property *
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-row">
              {properties.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setNewPropertyId(p.id)}
                  className={`px-4 py-2 rounded-full mr-2 border ${
                    newPropertyId === p.id ? 'bg-navy border-navy' : 'bg-pageBg border-navy-border'
                  }`}
                >
                  <Text className={`text-[13px] ${newPropertyId === p.id ? 'text-white font-bold' : 'text-navy-muted'}`}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-[12px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              Document Category
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(['lease', 'insurance', 'tax', 'receipt', 'other'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setNewCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full border ${
                    newCategory === cat ? 'bg-purple-600 border-purple-600' : 'bg-pageBg border-navy-border'
                  }`}
                >
                  <Text className={`text-[12px] capitalize ${newCategory === cat ? 'text-white font-bold' : 'text-navy-muted'}`}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-[12px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              Document File URL (Optional)
            </Text>
            <TextInput
              value={newFileUrl}
              onChangeText={setNewFileUrl}
              placeholder="https://rentified.ca/documents/lease.pdf"
              className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-6"
            />

            <TouchableOpacity
              onPress={handleUploadDocument}
              disabled={uploading}
              className="bg-navy py-4 rounded-[16px] items-center shadow-sm"
            >
              <Text className="text-white text-[16px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                {uploading ? 'Archiving Document...' : 'Save to Property Vault'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
