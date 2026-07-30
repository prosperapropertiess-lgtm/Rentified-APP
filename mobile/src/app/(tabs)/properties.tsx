import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// Define the property type based on our database schema
type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  type: string;
  image_url: string | null;
};

export default function PropertiesScreen() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties();
  }, [session]);

  async function fetchProperties() {
    try {
      setLoading(true);
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error.message);
        return;
      }

      setProperties(data || []);
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface pt-12">
      <View className="px-6 mb-6 flex-row justify-between items-center">
        <Text className="text-2xl font-semibold text-primary tracking-tight">Properties</Text>
        <TouchableOpacity className="bg-brand-500 px-4 py-2 rounded-lg">
          <Text className="text-white font-medium text-sm">+ Add New</Text>
        </TouchableOpacity>
      </View>

      <View className="px-6 pb-8">
        {properties.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-xl p-8 items-center shadow-sm">
            <Text className="text-secondary text-base mb-4 text-center">You haven't added any properties yet.</Text>
            <TouchableOpacity className="bg-brand-500 px-6 py-3 rounded-lg">
              <Text className="text-white font-medium">Add Your First Property</Text>
            </TouchableOpacity>
          </View>
        ) : (
          properties.map((property) => (
            <TouchableOpacity 
              key={property.id} 
              className="bg-white border border-slate-200 rounded-xl mb-4 shadow-sm overflow-hidden"
              activeOpacity={0.7}
            >
              {/* Property Image Placeholder */}
              <View className="h-32 bg-slate-100 items-center justify-center">
                {property.image_url ? (
                  <Image source={{ uri: property.image_url }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <Text className="text-secondary text-sm">No Image</Text>
                )}
              </View>

              {/* Property Details */}
              <View className="p-4">
                <Text className="text-lg font-semibold text-primary mb-1">{property.name}</Text>
                <Text className="text-sm text-secondary mb-3">{property.address}, {property.city}</Text>
                
                <View className="flex-row items-center">
                  <View className="bg-slate-100 px-2 py-1 rounded">
                    <Text className="text-xs font-medium text-slate-600 capitalize">
                      {property.type.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
