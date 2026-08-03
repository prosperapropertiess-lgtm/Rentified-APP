import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function LandlordSetup() {
  const router = useRouter();
  const { session, refreshRole } = useAuth();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'Please enter your first and last name.');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'No active session found.');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase.from('landlords').insert({
        user_id: session.user.id,
        email: session.user.email,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null
      });

      if (error) throw error;

      // Refresh the role context which will automatically redirect them to tabs
      await refreshRole();
      
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to create profile.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-pageBg" 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        
        {/* Header */}
        <View className="flex-row items-center pt-16 pb-4 px-6">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-white items-center justify-center border border-navy-border shadow-sm">
            <MaterialIcons name="arrow-back" size={20} color="#0F1C28" />
          </TouchableOpacity>
        </View>

        <View className="px-6 mt-4 flex-1">
          <Text className="text-[36px] text-navy leading-tight tracking-[-0.02em] mb-2" style={{ fontFamily: 'Cormorant_300Light' }}>
            Property Owner
          </Text>
          <Text className="text-[17px] text-navy-muted leading-relaxed mb-10" style={{ fontFamily: 'DMSans_400Regular' }}>
            Let&apos;s get your profile set up so you can start managing properties.
          </Text>

          {/* Form */}
          <View>
            <View className="mb-5">
              <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                First Name
              </Text>
              <TextInput
                className="w-full bg-white h-[56px] rounded-[16px] px-5 border border-navy-border text-[16px] text-navy"
                style={{ fontFamily: 'DMSans_400Regular' }}
                placeholder="Ebin"
                placeholderTextColor="rgba(15,28,40,0.3)"
                value={firstName}
                onChangeText={setFirstName}
                autoCorrect={false}
                autoFocus={true}
              />
            </View>

            <View className="mb-5">
              <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Last Name
              </Text>
              <TextInput
                className="w-full bg-white h-[56px] rounded-[16px] px-5 border border-navy-border text-[16px] text-navy"
                style={{ fontFamily: 'DMSans_400Regular' }}
                placeholder="Jaison"
                placeholderTextColor="rgba(15,28,40,0.3)"
                value={lastName}
                onChangeText={setLastName}
                autoCorrect={false}
              />
            </View>

            <View className="mb-5">
              <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Phone Number <Text className="text-navy-muted/50 text-[11px]">(Optional)</Text>
              </Text>
              <TextInput
                className="w-full bg-white h-[56px] rounded-[16px] px-5 border border-navy-border text-[16px] text-navy"
                style={{ fontFamily: 'DMSans_400Regular' }}
                placeholder="(555) 000-0000"
                placeholderTextColor="rgba(15,28,40,0.3)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>
        
        {/* Footer */}
        <View className="p-6 pb-12 bg-pageBg">
          <TouchableOpacity 
            className="w-full h-[56px] rounded-[16px] bg-navy items-center justify-center"
            style={{ opacity: loading ? 0.7 : 1 }}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text className="text-white text-[17px]" style={{ fontFamily: 'DMSans_700Bold' }}>
              {loading ? 'Setting up...' : 'Continue to Dashboard'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
