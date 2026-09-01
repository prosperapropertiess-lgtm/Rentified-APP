import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function TenantSetup() {
  const router = useRouter();
  const { session, refreshRole } = useAuth();
  
  const [inviteCode, setInviteCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'Please fill out your first and last name.');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'No active session found.');
      return;
    }

    try {
      setLoading(true);
      
      let tenantId: string | null = null;

      if (inviteCode.trim()) {
        // Look up tenant by invite token
        const { data: tenant, error: searchError } = await supabase
          .from('tenants')
          .select('id')
          .eq('invite_token', inviteCode.trim())
          .maybeSingle();

        if (searchError) throw searchError;
        if (tenant) tenantId = tenant.id;
      }

      if (tenantId) {
        // Claim existing invited tenant record
        const { error: updateError } = await supabase
          .from('tenants')
          .update({
            user_id: session.user.id,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim() || null,
            invite_accepted: true,
          })
          .eq('id', tenantId);

        if (updateError) throw updateError;
      } else {
        // No invite code: nothing to link to. A tenant row requires a real
        // landlord_id (FK), so without an invite there's no valid landlord
        // to attach to — surface this instead of inserting a fake link.
        throw new Error('An invite code from your landlord is required to set up your account.');
      }

      // Refresh role to transition to tenant dashboard
      await refreshRole();
      
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to complete tenant setup.');
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
            Tenant Setup
          </Text>
          <Text className="text-[17px] text-navy-muted leading-relaxed mb-8" style={{ fontFamily: 'DMSans_400Regular' }}>
            Set up your profile to link with your rental property.
          </Text>

          {/* Form */}
          <View>
            <View className="mb-5">
              <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Invite Token
              </Text>
              <TextInput
                className="w-full bg-white h-[56px] rounded-[16px] px-5 border border-navy-border text-[16px] text-navy font-bold"
                style={{ fontFamily: 'DMSans_700Bold' }}
                placeholder="Paste code from landlord"
                placeholderTextColor="rgba(15,28,40,0.3)"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            <View className="h-[1px] w-full bg-navy-border/50 mb-5" />

            <View className="flex-row justify-between mb-5">
              <View className="w-[48%]">
                <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                  First Name
                </Text>
                <TextInput
                  className="w-full bg-white h-[56px] rounded-[16px] px-5 border border-navy-border text-[16px] text-navy"
                  style={{ fontFamily: 'DMSans_400Regular' }}
                  placeholder="Jane"
                  placeholderTextColor="rgba(15,28,40,0.3)"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCorrect={false}
                  autoFocus={true}
                />
              </View>

              <View className="w-[48%]">
                <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Last Name
                </Text>
                <TextInput
                  className="w-full bg-white h-[56px] rounded-[16px] px-5 border border-navy-border text-[16px] text-navy"
                  style={{ fontFamily: 'DMSans_400Regular' }}
                  placeholder="Smith"
                  placeholderTextColor="rgba(15,28,40,0.3)"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCorrect={false}
                />
              </View>
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
            className="w-full h-[56px] rounded-[16px] bg-[#1D4ED8] items-center justify-center shadow-sm"
            style={{ opacity: loading ? 0.7 : 1 }}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text className="text-white text-[17px]" style={{ fontFamily: 'DMSans_700Bold' }}>
              {loading ? 'Completing Setup...' : 'Complete Setup'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
