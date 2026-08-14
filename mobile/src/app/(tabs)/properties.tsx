import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/SkeletonLoader';

type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  type: string;
  image_url: string | null;
  created_at?: string;
};

// Canadian / North American Sample Address Suggestions Database
const ADDRESS_SUGGESTIONS = [
  { street: '500 King St W', city: 'Toronto', province: 'ON', postal: 'M5V 2T6' },
  { street: '120 Main St N', city: 'Markham', province: 'ON', postal: 'L3P 1Y1' },
  { street: '75 Yonge St', city: 'Toronto', province: 'ON', postal: 'M5E 1J8' },
  { street: '350 Bay St', city: 'Toronto', province: 'ON', postal: 'M5H 2S6' },
  { street: '1000 Sherbrooke St W', city: 'Montreal', province: 'QC', postal: 'H3A 3G4' },
  { street: '888 Robson St', city: 'Vancouver', province: 'BC', postal: 'V6Z 2E7' },
  { street: '200 8 Ave SW', city: 'Calgary', province: 'AB', postal: 'T2P 1B5' },
];

export default function PropertiesScreen() {
  const router = useRouter();
  const { session, role, setRole } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Property Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Toronto');
  const [province, setProvince] = useState('ON');
  const [postalCode, setPostalCode] = useState('M5V 2T6');
  const [type, setType] = useState<'multi_family' | 'single_family' | 'condo' | 'commercial'>('multi_family');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete Suggestions State
  const [filteredSuggestions, setFilteredSuggestions] = useState<typeof ADDRESS_SUGGESTIONS>([]);

  // Selected Detail Modal State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const fetchProperties = useCallback(async () => {
    try {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('landlord_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error.message);
      } else {
        setProperties(data || []);
      }
    } catch (error) {
      console.error('Unexpected error fetching properties:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchProperties();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchProperties]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProperties();
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    if (text.length >= 2) {
      const matches = ADDRESS_SUGGESTIONS.filter((s) =>
        s.street.toLowerCase().includes(text.toLowerCase()) || s.city.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredSuggestions(matches);
    } else {
      setFilteredSuggestions([]);
    }
  };

  const selectSuggestion = (s: (typeof ADDRESS_SUGGESTIONS)[0]) => {
    setAddress(s.street);
    setCity(s.city);
    setProvince(s.province);
    setPostalCode(s.postal);
    setFilteredSuggestions([]);
    if (!name) {
      setName(`${s.street} Building`);
    }
  };

  const handleCreateProperty = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a property name.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Missing Address', 'Please enter a street address.');
      return;
    }

    try {
      setSubmitting(true);
      // landlords.id = auth.users.id in Prospera schema
      const landlordId = session?.user?.id || null;

      const { data, error } = await supabase
        .from('properties')
        .insert({
          landlord_id: landlordId,
          name: name.trim(),
          address: address.trim(),
          city: city.trim() || 'Toronto',
          province: province.trim() || 'ON',
          postal_code: postalCode.trim() || 'M5V 2T6',
          type,
          image_url: imageUrl.trim() || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Error Creating Property', error.message);
      } else {
        Alert.alert('Property Registered', `"${name}" has been added to your portfolio.`);
        setModalVisible(false);
        setName('');
        setAddress('');
        setImageUrl('');
        setFilteredSuggestions([]);
        if (data) {
          setProperties((prev) => [data, ...prev]);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-pageBg p-6 pt-16">
        <Skeleton width={180} height={36} borderRadius={12} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={160} borderRadius={20} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={160} borderRadius={20} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={160} borderRadius={20} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-pageBg relative">
      {/* Background Glow */}
      <View
        className="absolute w-[450px] h-[450px] rounded-full"
        style={{ top: -100, right: -120, zIndex: 0, backgroundColor: 'rgba(15, 28, 40, 0.04)' }}
      />

      <ScrollView
        className="flex-1 z-10"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F1C28" />}
      >
        {/* Header with Role Testing Switcher */}
        <View className="px-6 pt-16 pb-4 flex-row justify-between items-end border-b border-navy-border/50">
          <View>
            <View className="flex-row items-center mb-1">
              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.12em] mr-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                Portfolio
              </Text>
              <TouchableOpacity
                onPress={() => setRole(role === 'landlord' ? 'tenant' : 'landlord')}
                className="bg-navy/10 px-2.5 py-0.5 rounded-full border border-navy/20"
              >
                <Text className="text-[10px] text-navy font-bold uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  {role === 'landlord' ? '⚡ Landlord Mode' : '🔑 Tenant Mode'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text className="text-[34px] text-navy leading-tight" style={{ fontFamily: 'Cormorant_300Light' }}>
              Buildings ({properties.length})
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="bg-navy px-4 py-2.5 rounded-[14px] flex-row items-center shadow-sm"
          >
            <MaterialIcons name="add" size={18} color="#FFFFFF" />
            <Text className="text-white text-[13px] ml-1 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              Add Building
            </Text>
          </TouchableOpacity>
        </View>

        {/* Property Grid / Roster */}
        <View className="px-6 mt-6">
          {properties.length === 0 ? (
            <View className="bg-white rounded-[24px] p-8 border border-navy-border items-center justify-center shadow-card">
              <View className="w-14 h-14 rounded-full bg-navy/5 items-center justify-center mb-3">
                <MaterialIcons name="apartment" size={30} color="#0F1C28" />
              </View>
              <Text className="text-[18px] text-navy font-bold mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                No Properties Registered
              </Text>
              <Text className="text-[13px] text-navy-muted text-center mb-5" style={{ fontFamily: 'DMSans_400Regular' }}>
                Add your multi-family buildings or rental condos with Google address autocomplete.
              </Text>

              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                className="bg-navy px-6 py-3 rounded-[14px] flex-row items-center"
              >
                <MaterialIcons name="add-business" size={18} color="#FFFFFF" />
                <Text className="text-white text-[14px] ml-2 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Register First Property
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            properties.map((property) => (
              <TouchableOpacity
                key={property.id}
                onPress={() => setSelectedProperty(property)}
                className="bg-white rounded-[24px] border border-navy-border mb-5 shadow-card overflow-hidden"
                activeOpacity={0.85}
              >
                {/* Property Cover Image */}
                <View className="h-44 bg-navy/5 relative">
                  {property.image_url ? (
                    <Image source={{ uri: property.image_url }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <View className="w-full h-full items-center justify-center bg-navy">
                      <MaterialIcons name="apartment" size={40} color="rgba(255,255,255,0.4)" />
                    </View>
                  )}

                  {/* Badge Overlay */}
                  <View className="absolute top-3 right-3 bg-black/70 px-3 py-1 rounded-full flex-row items-center">
                    <View className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
                    <Text className="text-white text-[11px] font-bold uppercase tracking-wider" style={{ fontFamily: 'DMSans_700Bold' }}>
                      {property.type ? property.type.replace('_', ' ') : 'Multi Family'}
                    </Text>
                  </View>
                </View>

                {/* Property Details */}
                <View className="p-5">
                  <View className="flex-row justify-between items-start mb-1">
                    <Text className="text-[20px] text-navy font-bold flex-1 mr-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                      {property.name}
                    </Text>
                    <MaterialIcons name="chevron-right" size={22} color="rgba(15,28,40,0.3)" />
                  </View>

                  <Text className="text-[13px] text-navy-muted mb-3" style={{ fontFamily: 'DMSans_400Regular' }}>
                    📍 {property.address}, {property.city}, {property.province} {property.postal_code}
                  </Text>

                  {/* Property Health Summary Pill (#2 Specification) */}
                  <TouchableOpacity
                    onPress={() => router.push('/property-health')}
                    className="bg-emerald-500/10 p-3 rounded-[16px] border border-emerald-500/20 mb-3 flex-row justify-between items-center"
                  >
                    <View className="flex-row items-center">
                      <MaterialIcons name="favorite" size={16} color="#059669" />
                      <Text className="text-[12px] text-emerald-800 font-bold ml-1.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                        Health: 92/100 🟢
                      </Text>
                    </View>
                    <Text className="text-[11px] text-emerald-700 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                      Next: HVAC Filter (18d)
                    </Text>
                  </TouchableOpacity>

                  <View className="flex-row items-center justify-between pt-3 border-t border-navy-border/60">
                    <View className="flex-row items-center">
                      <MaterialIcons name="pie-chart" size={16} color="#059669" />
                      <Text className="text-[12px] text-emerald-700 font-bold ml-1.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                        100% Occupied
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push('/(tabs)/documents')}
                      className="flex-row items-center bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20"
                    >
                      <MaterialIcons name="folder-open" size={14} color="#7C3AED" />
                      <Text className="text-[11px] text-purple-700 font-bold ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                        Open Vault 📁
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Property Modal with Google Autocomplete */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[24px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                Add New Property
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setFilteredSuggestions([]);
                }}
                className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border"
              >
                <MaterialIcons name="close" size={18} color="#0F1C28" />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[520px]" showsVerticalScrollIndicator={false}>
              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Building / Property Name *
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. King Street West Condos"
                className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-4"
              />

              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Street Address (Google Autocomplete) *
              </Text>
              <TextInput
                value={address}
                onChangeText={handleAddressChange}
                placeholder="Start typing (e.g. 500 King St...)"
                className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-1"
              />

              {/* Google Autocomplete Suggestions Dropdown */}
              {filteredSuggestions.length > 0 && (
                <View className="bg-white border border-navy-border rounded-[16px] mb-4 overflow-hidden shadow-card">
                  {filteredSuggestions.map((s, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => selectSuggestion(s)}
                      className="p-3.5 border-b border-navy-border/50 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center">
                        <MaterialIcons name="location-on" size={18} color="#0F1C28" />
                        <View className="ml-2">
                          <Text className="text-[14px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                            {s.street}
                          </Text>
                          <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                            {s.city}, {s.province} {s.postal}
                          </Text>
                        </View>
                      </View>
                      <MaterialIcons name="north-west" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View className="flex-row gap-3 my-4">
                <View className="flex-1">
                  <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                    City
                  </Text>
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy"
                  />
                </View>

                <View className="w-20">
                  <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                    Province
                  </Text>
                  <TextInput
                    value={province}
                    onChangeText={setProvince}
                    className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy"
                  />
                </View>

                <View className="w-28">
                  <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                    Postal Code
                  </Text>
                  <TextInput
                    value={postalCode}
                    onChangeText={setPostalCode}
                    className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy"
                  />
                </View>
              </View>

              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Property Category
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {(['multi_family', 'single_family', 'condo', 'commercial'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    className={`px-3.5 py-2 rounded-full border ${
                      type === t ? 'bg-navy border-navy' : 'bg-pageBg border-navy-border'
                    }`}
                  >
                    <Text className={`text-[12px] capitalize ${type === t ? 'text-white font-bold' : 'text-navy-muted'}`}>
                      {t.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Cover Image URL (Optional)
              </Text>
              <TextInput
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://images.unsplash.com/photo..."
                className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-6"
              />

              <TouchableOpacity
                onPress={handleCreateProperty}
                disabled={submitting}
                className="bg-navy py-4 rounded-[16px] items-center shadow-sm mb-4"
              >
                <Text className="text-white text-[16px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  {submitting ? 'Saving Property...' : 'Save Property to Portfolio'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Property Detail Sheet */}
      {selectedProperty && (
        <Modal visible={!!selectedProperty} animationType="slide" transparent>
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border max-h-[80%]">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-[24px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                  {selectedProperty.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedProperty(null)}
                  className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border"
                >
                  <MaterialIcons name="close" size={18} color="#0F1C28" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Image
                  source={{ uri: selectedProperty.image_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80' }}
                  className="w-full h-44 rounded-[20px] mb-4"
                  resizeMode="cover"
                />

                <Text className="text-[14px] text-navy-muted mb-6" style={{ fontFamily: 'DMSans_400Regular' }}>
                  📍 {selectedProperty.address}, {selectedProperty.city}, {selectedProperty.province} {selectedProperty.postal_code}
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedProperty(null);
                    router.push('/(tabs)/documents');
                  }}
                  className="bg-navy py-4 rounded-[16px] items-center flex-row justify-center mb-3"
                >
                  <MaterialIcons name="folder" size={20} color="#FFFFFF" />
                  <Text className="text-white text-[15px] font-bold ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                    Open Building Documents Vault 📁
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
