import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/SkeletonLoader';

type MaintenanceTicket = {
  id: string;
  title: string;
  category: 'plumbing' | 'hvac' | 'electrical' | 'appliance' | 'lock_key' | 'other';
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'submitted' | 'scheduled' | 'in_progress' | 'resolved';
  description: string;
  created_at: string;
  unit_name?: string;
};

export default function TenantMaintenanceScreen() {
  const { session } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal & AI Triage State
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'plumbing' | 'hvac' | 'electrical' | 'appliance' | 'lock_key' | 'other'>('plumbing');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Real-time AI Triage Helper
  const getAiUrgency = (text: string, selectedCat: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('water') || lower.includes('burst') || lower.includes('flood') || lower.includes('fire') || lower.includes('no heat') || lower.includes('gas')) {
      return { priority: 'emergency' as const, label: 'CRITICAL EMERGENCY 🔴', trade: 'Emergency Service Team', eta: '< 60 Minutes' };
    }
    if (lower.includes('leak') || lower.includes('broken') || lower.includes('spark') || lower.includes('fridge') || lower.includes('lockout')) {
      return { priority: 'high' as const, label: 'HIGH URGENCY 🟠', trade: 'Specialized Contractor', eta: 'Same-Day Dispatch' };
    }
    return { priority: 'medium' as const, label: 'ROUTINE REQUEST 🔵', trade: 'Property Technician', eta: '1 - 2 Business Days' };
  };

  const currentAiTriage = getAiUrgency(`${title} ${description}`, category);

  const fetchTickets = useCallback(async () => {
    try {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, unit_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (tenant) {
        const { data: ticketData } = await supabase
          .from('maintenance_requests')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        setTickets(ticketData || []);
      }
    } catch (e) {
      console.error('Error fetching maintenance tickets:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchTickets();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleCreateTicket = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please summarize the maintenance issue.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please provide a brief description.');
      return;
    }

    try {
      setSubmitting(true);

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, unit_id')
        .eq('user_id', session?.user?.id)
        .maybeSingle();

      const { error } = await supabase.from('maintenance_requests').insert({
        tenant_id: tenant?.id,
        unit_id: tenant?.unit_id,
        title: title.trim(),
        category,
        priority: currentAiTriage.priority,
        status: 'submitted',
        description: description.trim(),
      });

      if (error) {
        Alert.alert('Submission Error', error.message);
      } else {
        Alert.alert(
          'Ticket Created',
          `Your ticket "${title}" has been triaged as ${currentAiTriage.label}. Landlord & contractors have been notified!`
        );
        setModalVisible(false);
        setTitle('');
        setDescription('');
        fetchTickets();
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
        <Skeleton width="100%" height={120} borderRadius={20} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={100} borderRadius={20} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={100} borderRadius={20} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-pageBg relative">
      {/* Background Ambient Glow */}
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
              Tenant Portal
            </Text>
            <Text className="text-[34px] text-navy" style={{ fontFamily: 'Cormorant_300Light' }}>
              Maintenance
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="bg-navy px-4 py-2.5 rounded-[12px] flex-row items-center shadow-sm"
          >
            <MaterialIcons name="build" size={16} color="#FFFFFF" />
            <Text className="text-white text-[13px] ml-1.5 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              New Ticket
            </Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 mt-6">
          {/* AI Urgent Banner */}
          <View className="bg-purple-900/90 rounded-[24px] p-6 border border-purple-700/50 shadow-card mb-6 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center mb-1">
                <MaterialIcons name="auto-awesome" size={18} color="#C084FC" />
                <Text className="text-purple-200 text-[12px] uppercase font-bold ml-1.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  AI Triage & Emergency Dispatch
                </Text>
              </View>
              <Text className="text-white text-[16px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                Instant Issue Assessment
              </Text>
              <Text className="text-purple-200/80 text-[12px] mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                Submit repair issues for instant AI severity rating & contractor auto-notification.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              className="bg-white px-4 py-2.5 rounded-[14px]"
            >
              <Text className="text-purple-950 font-bold text-[13px]" style={{ fontFamily: 'DMSans_700Bold' }}>
                Report Issue
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ticket List */}
          <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
            Your Maintenance Tickets ({tickets.length})
          </Text>

          {tickets.length === 0 ? (
            <View className="bg-white rounded-[24px] p-8 border border-navy-border items-center justify-center shadow-card">
              <View className="w-12 h-12 rounded-full bg-emerald-500/10 items-center justify-center mb-3">
                <MaterialIcons name="check-circle-outline" size={28} color="#059669" />
              </View>
              <Text className="text-[18px] text-navy font-bold mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                No active tickets
              </Text>
              <Text className="text-[13px] text-navy-muted text-center mb-5" style={{ fontFamily: 'DMSans_400Regular' }}>
                All appliances, heating, and plumbing systems in your unit are operating smoothly.
              </Text>

              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                className="bg-navy px-5 py-2.5 rounded-[12px] flex-row items-center"
              >
                <MaterialIcons name="add" size={18} color="#FFFFFF" />
                <Text className="text-white text-[13px] ml-1 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Submit Maintenance Request
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            tickets.map((ticket) => (
              <View
                key={ticket.id}
                className="bg-white rounded-[20px] p-5 border border-navy-border shadow-card mb-4"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-[17px] text-navy font-bold flex-1 mr-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                    {ticket.title}
                  </Text>

                  <View className={`px-2.5 py-1 rounded-full ${
                    ticket.priority === 'emergency' ? 'bg-red-500/10 border border-red-500/30' : 'bg-navy/5 border border-navy-border'
                  }`}>
                    <Text className={`text-[10px] uppercase font-bold ${
                      ticket.priority === 'emergency' ? 'text-red-600' : 'text-navy-muted'
                    }`} style={{ fontFamily: 'DMSans_700Bold' }}>
                      {ticket.priority}
                    </Text>
                  </View>
                </View>

                <Text className="text-[13px] text-navy-muted mb-3" style={{ fontFamily: 'DMSans_400Regular' }}>
                  {ticket.description}
                </Text>

                <View className="flex-row items-center justify-between pt-3 border-t border-navy-border/60">
                  <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                    Reported {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                  </Text>

                  <View className="flex-row items-center bg-purple-500/10 px-3 py-1 rounded-full">
                    <MaterialIcons name="hourglass-empty" size={14} color="#7C3AED" />
                    <Text className="text-[11px] text-purple-700 font-bold ml-1 capitalize" style={{ fontFamily: 'DMSans_700Bold' }}>
                      {ticket.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* AI Triage & Ticket Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[28px] p-6 border-t border-navy-border">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[24px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                Report Maintenance Issue
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border">
                <MaterialIcons name="close" size={18} color="#0F1C28" />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[500px]" showsVerticalScrollIndicator={false}>
              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Issue Title *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Kitchen sink pipe leaking water"
                className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-4"
              />

              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Category
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {(['plumbing', 'hvac', 'electrical', 'appliance', 'lock_key', 'other'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full border ${
                      category === cat ? 'bg-purple-600 border-purple-600' : 'bg-pageBg border-navy-border'
                    }`}
                  >
                    <Text className={`text-[12px] capitalize ${category === cat ? 'text-white font-bold' : 'text-navy-muted'}`}>
                      {cat.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                Description *
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe what happened and where the issue is located..."
                multiline
                numberOfLines={3}
                className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-4"
              />

              {/* Real-time AI Triage Preview Box */}
              <View className="bg-purple-500/10 border border-purple-500/30 rounded-[18px] p-4 mb-6">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <MaterialIcons name="auto-awesome" size={16} color="#7C3AED" />
                    <Text className="text-[12px] text-purple-900 font-bold ml-1.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                      AI Triage Assessment
                    </Text>
                  </View>
                  <Text className="text-[11px] text-purple-800 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                    {currentAiTriage.label}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between pt-2 border-t border-purple-500/20">
                  <Text className="text-[12px] text-purple-900/80" style={{ fontFamily: 'DMSans_400Regular' }}>
                    Dispatched Trade: <Text className="font-bold">{currentAiTriage.trade}</Text>
                  </Text>
                  <Text className="text-[12px] text-purple-900/80" style={{ fontFamily: 'DMSans_400Regular' }}>
                    ETA: <Text className="font-bold">{currentAiTriage.eta}</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCreateTicket}
                disabled={submitting}
                className="bg-navy py-4 rounded-[16px] items-center shadow-sm mb-4"
              >
                <Text className="text-white text-[16px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  {submitting ? 'Triaging Ticket...' : 'Dispatch Maintenance Ticket'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
