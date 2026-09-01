import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function TenantMaintenanceScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const fetchRequests = React.useCallback(async () => {
    if (!user) return;
    try {
      const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
      if (!tenant) return;

      const { data } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      setRequests(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setTimeout(() => fetchRequests(), 0);
  }, [fetchRequests]);

  const submitRequest = async () => {
    if (!title || !description) {
      Alert.alert("Required", "Please provide a title and description.");
      return;
    }
    if (!user) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: tenant } = await supabase.from('tenants').select('id, landlord_id').eq('user_id', user.id).single();
      if (!tenant) {
        throw new Error("Could not find tenant profile for this user.");
      }

      // maintenance_requests has no property_id column, and tenants has no
      // unit_id — the unit lives on the lease. Must be the tenant's real
      // ACTIVE lease (not just any lease they've ever had) — a server-side
      // trigger now independently re-verifies this same active-lease
      // resolution before allowing the insert (spec C's "never trust
      // client-supplied relationships"), so this has to match it exactly
      // or a tenant with lease history would get wrongly rejected.
      const { data: lease } = await supabase
        .from('leases')
        .select('unit_id')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase.from('maintenance_requests').insert({
        tenant_id: tenant.id,
        landlord_id: tenant.landlord_id,
        unit_id: lease?.unit_id ?? null,
        title,
        description,
        // 'pending' isn't a valid status — the real check constraint only
        // allows open/in_progress/scheduled/resolved/closed.
        status: 'open',
        // priority is NOT NULL in the database; the tenant doesn't set
        // this, so default to medium until the owner (or AI triage) sets
        // it explicitly.
        priority: 'medium'
      });
      if (error) throw error;
      
      setTitle('');
      setDescription('');
      setTimeout(() => fetchRequests(), 0);
      Alert.alert("Success", "Maintenance request submitted!");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  return (
    <View className="flex-1 bg-pageBg">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        
        <Text className="text-[40px] text-navy font-sansBold mb-6">Repairs</Text>

        {/* New Request Form */}
        <View className="bg-card p-6 rounded-[24px] mb-8 border border-navy-border shadow-sm">
          <Text className="text-navy font-sansBold text-[19px] mb-4">Request Maintenance</Text>
          
          <TextInput
            className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
            placeholder="What's the issue?"
            placeholderTextColor="#8B95A1"
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4 min-h-[100px]"
            placeholder="Describe the problem in detail..."
            placeholderTextColor="#8B95A1"
            multiline
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
          
          <TouchableOpacity 
            className="bg-navy w-full py-4 rounded-xl items-center flex-row justify-center"
            onPress={submitRequest}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Feather name="tool" size={18} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-sansBold text-[17px] ml-2">Submit Request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Past Requests */}
        <Text className="text-[24px] text-navy font-sansBold mb-4">Past Requests</Text>
        
        {requests.length === 0 ? (
          <Text className="text-navy-muted font-sans">No maintenance requests found.</Text>
        ) : (
          requests.map(req => (
            <View key={req.id} className="bg-card p-5 rounded-[20px] mb-4 border border-navy-border shadow-sm">
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-navy font-sansBold text-[17px] flex-1 mr-4">{req.title}</Text>
                <View className="bg-pageBg px-3 py-1 rounded-full border border-navy-border">
                  <Text className="text-navy font-sans text-[12px] capitalize">{req.status}</Text>
                </View>
              </View>
              <Text className="text-navy-muted font-sans text-[14px] leading-relaxed mb-3">
                {req.description}
              </Text>
              <Text className="text-navy/50 font-sans text-[12px]">
                Reported {new Date(req.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}

      </ScrollView>
    </View>
  );
}
