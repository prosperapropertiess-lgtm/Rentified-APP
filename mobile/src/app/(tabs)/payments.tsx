import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/SkeletonLoader';
import StatusChip from '../../components/StatusChip';
import MarkPaidModal from '../../components/modals/MarkPaidModal';
import SendReminderModal from '../../components/modals/SendReminderModal';
import { rentService } from '../../services/rentService';

// ---------------------------------------------------------------------------
// TYPES (Data Model Specification #6)
// ---------------------------------------------------------------------------
export type PaymentStatus = 'paid' | 'due_today' | 'overdue';
export type PaymentMethodType = 'Stripe' | 'e-Transfer';

export type TenantCollectionItem = {
  id: string;
  propertyId: string;
  unit: string;
  name: string;
  email: string;
  phone: string;
  monthlyRent: number;
  dueDay: number;
  status: PaymentStatus;
  paidDate?: string | null;
  paymentMethod?: PaymentMethodType | null;
  stripePaymentId?: string | null;
  lastReminderSentAt?: string | null;
  reminderMethod?: 'SMS' | 'Email' | null;
};

export type PropertyCollectionItem = {
  id: string;
  name: string;
  address: string;
  totalMonthlyRent: number;
  amountCollected: number;
  amountOutstanding: number;
  totalTenantsCount: number;
  tenantsPaidCount: number;
  tenantsOutstandingCount: number;
  tenants: TenantCollectionItem[];
};

// ---------------------------------------------------------------------------
// MOCK COLLECTION DATA SEED
// ---------------------------------------------------------------------------
const NOW_TS = Date.now();
const INITIAL_PROPERTIES_DATA: PropertyCollectionItem[] = [
  {
    id: 'prop-1',
    name: 'King Street West Condos',
    address: '500 King St W, Toronto, ON',
    totalMonthlyRent: 7350,
    amountCollected: 4900,
    amountOutstanding: 2450,
    totalTenantsCount: 3,
    tenantsPaidCount: 2,
    tenantsOutstandingCount: 1,
    tenants: [
      {
        id: 't-101',
        propertyId: 'prop-1',
        unit: 'Unit 4B',
        name: 'Sarah Jenkins',
        email: 'sarah.j@example.com',
        phone: '+1 (416) 555-0192',
        monthlyRent: 2450,
        dueDay: 1,
        status: 'overdue',
        paidDate: null,
        lastReminderSentAt: new Date(NOW_TS - 1000 * 60 * 120).toISOString(),
        reminderMethod: 'SMS',
      },
      {
        id: 't-102',
        propertyId: 'prop-1',
        unit: 'Unit 3A',
        name: 'Michael Chang',
        email: 'm.chang@example.com',
        phone: '+1 (416) 555-0144',
        monthlyRent: 2450,
        dueDay: 1,
        status: 'paid',
        paidDate: new Date(NOW_TS - 1000 * 60 * 60 * 5).toISOString(),
        paymentMethod: 'Stripe',
        stripePaymentId: 'ch_3N8x92KLS9104A',
      },
      {
        id: 't-103',
        propertyId: 'prop-1',
        unit: 'Unit 5C',
        name: 'Elena Rostova',
        email: 'elena.r@example.com',
        phone: '+1 (416) 555-0188',
        monthlyRent: 2450,
        dueDay: 1,
        status: 'paid',
        paidDate: new Date(NOW_TS - 1000 * 60 * 60 * 2).toISOString(),
        paymentMethod: 'e-Transfer',
      },
    ],
  },
  {
    id: 'prop-2',
    name: 'Yorkville Heights',
    address: '120 Yorkville Ave, Toronto, ON',
    totalMonthlyRent: 7500,
    amountCollected: 5050,
    amountOutstanding: 2450,
    totalTenantsCount: 2,
    tenantsPaidCount: 1,
    tenantsOutstandingCount: 1,
    tenants: [
      {
        id: 't-201',
        propertyId: 'prop-2',
        unit: 'Penthouse 2',
        name: 'David Sterling',
        email: 'david.s@example.com',
        phone: '+1 (416) 555-0811',
        monthlyRent: 5050,
        dueDay: 1,
        status: 'paid',
        paidDate: new Date(NOW_TS - 1000 * 60 * 60 * 1).toISOString(),
        paymentMethod: 'Stripe',
        stripePaymentId: 'ch_4P9y10MSS7721B',
      },
      {
        id: 't-202',
        propertyId: 'prop-2',
        unit: 'Unit 12A',
        name: 'Sophia Williams',
        email: 'sophia.w@example.com',
        phone: '+1 (416) 555-0922',
        monthlyRent: 2450,
        dueDay: 1,
        status: 'due_today',
        paidDate: null,
        lastReminderSentAt: null,
      },
    ],
  },
];

export default function RentCollectionScreen() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<PropertyCollectionItem[]>(INITIAL_PROPERTIES_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail Property Sheet State
  const [selectedProperty, setSelectedProperty] = useState<PropertyCollectionItem | null>(null);

  // Modals State
  const [markPaidTenant, setMarkPaidTenant] = useState<TenantCollectionItem | null>(null);
  const [reminderTenant, setReminderTenant] = useState<TenantCollectionItem | null>(null);
  const [historyTenant, setHistoryTenant] = useState<TenantCollectionItem | null>(null);

  const fetchCollectionData = useCallback(async () => {
    try {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      await rentService.fetchCollectionSummary(session.user.id);
    } catch (e) {
      console.error('Error loading collection data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchCollectionData();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchCollectionData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCollectionData();
  };

  // Metrics from Service Domain
  const {
    totalRentDue,
    totalCollected,
    outstandingBalance,
    overdueTenantsCount,
    paymentsReceivedTodayCount,
  } = rentService.calculateMetrics(properties);

  const handleConfirmMarkAsPaid = async (method: PaymentMethodType) => {
    if (!markPaidTenant) return;

    const updatedProps = rentService.markAsPaid(properties, markPaidTenant, method);
    setProperties(updatedProps);

    if (selectedProperty) {
      const updatedSelected = updatedProps.find((p) => p.id === selectedProperty.id);
      if (updatedSelected) setSelectedProperty(updatedSelected);
    }

    Alert.alert(
      'Rent Confirmed',
      `Successfully recorded $${markPaidTenant.monthlyRent.toLocaleString()} rent from ${markPaidTenant.name} via ${method}.`
    );
    setMarkPaidTenant(null);
  };

  const handleSendReminder = async () => {
    if (!reminderTenant) return;

    const updatedProps = rentService.sendReminder(properties, reminderTenant);
    setProperties(updatedProps);

    if (selectedProperty) {
      const updatedSelected = updatedProps.find((p) => p.id === selectedProperty.id);
      if (updatedSelected) setSelectedProperty(updatedSelected);
    }

    Alert.alert('Reminder Delivered', `SMS Rent Reminder sent to ${reminderTenant.phone}.`);
    setReminderTenant(null);
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-pageBg p-6 pt-16">
        <Skeleton width={180} height={36} borderRadius={12} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={160} borderRadius={24} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={120} borderRadius={20} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={120} borderRadius={20} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-pageBg relative">
      {/* Background Ambient Glow */}
      <View
        className="absolute w-[450px] h-[450px] rounded-full"
        style={{ top: -100, right: -120, zIndex: 0, backgroundColor: 'rgba(5, 150, 105, 0.04)' }}
      />

      <ScrollView
        className="flex-1 z-10"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F1C28" />}
      >
        {/* Header */}
        <View className="px-6 pt-16 pb-4 border-b border-navy-border flex-row items-center justify-between">
          <View>
            <Text className="text-[12px] text-navy-muted uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              Rent Collection Engine
            </Text>
            <Text className="text-[34px] text-navy leading-tight" style={{ fontFamily: 'Cormorant_300Light' }}>
              Collection Hub
            </Text>
          </View>

          <TouchableOpacity
            onPress={() =>
              Alert.alert('Simulate Stripe Charge', 'Simulating incoming Stripe webhook charge for Unit 4B...', [
                {
                  text: 'Process $2,450 Charge',
                  onPress: () => {
                    const sampleTenant = properties[0]?.tenants[0];
                    if (sampleTenant) {
                      setMarkPaidTenant(sampleTenant);
                    }
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
            className="bg-emerald-600 px-3.5 py-2.5 rounded-[14px] flex-row items-center shadow-sm"
          >
            <MaterialIcons name="bolt" size={16} color="#FFFFFF" />
            <Text className="text-white text-[12px] ml-1 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              Live Stripe
            </Text>
          </TouchableOpacity>
        </View>

        {/* DASHBOARD COLLECTION METRICS SUMMARY */}
        <View className="px-6 mt-6">
          <View className="bg-navy rounded-[28px] p-6 border border-navy/80 shadow-card mb-6 overflow-hidden">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-white/60 text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
                Monthly Rent Portfolio Status
              </Text>

              <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                <Text className="text-emerald-400 text-[11px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  {((totalCollected / (totalRentDue || 1)) * 100).toFixed(0)}% Collected
                </Text>
              </View>
            </View>

            {/* Collection Progress Bar */}
            <View className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-6">
              <View
                className="h-full bg-emerald-400 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, Number(((totalCollected / (totalRentDue || 1)) * 100).toFixed(0))))}%` as any }}
              />
            </View>

            <View className="flex-row justify-between mb-6">
              <View>
                <Text className="text-white/50 text-[11px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Collected
                </Text>
                <Text className="text-emerald-400 text-[26px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  ${totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>

              <View className="items-end">
                <Text className="text-white/50 text-[11px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Outstanding
                </Text>
                <Text className="text-rose-400 text-[26px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  ${outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* 3-Column Metrics Grid */}
            <View className="flex-row justify-between pt-4 border-t border-white/10">
              <View className="items-center flex-1">
                <Text className="text-white/50 text-[10px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Total Rent Due
                </Text>
                <Text className="text-white text-[15px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  ${totalRentDue.toLocaleString()}
                </Text>
              </View>

              <View className="w-[1px] bg-white/10" />

              <View className="items-center flex-1">
                <Text className="text-white/50 text-[10px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Overdue
                </Text>
                <Text className="text-rose-400 text-[15px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  {overdueTenantsCount} Tenants
                </Text>
              </View>

              <View className="w-[1px] bg-white/10" />

              <View className="items-center flex-1">
                <Text className="text-white/50 text-[10px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Paid Today
                </Text>
                <Text className="text-emerald-400 text-[15px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  {paymentsReceivedTodayCount} Payments
                </Text>
              </View>
            </View>
          </View>

          {/* PROPERTIES COLLECTION ROSTER */}
          <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
            Properties Rent Collection Breakdown ({properties.length})
          </Text>

          {properties.map((prop) => {
            const collectionPercent = Number(((prop.amountCollected / (prop.totalMonthlyRent || 1)) * 100).toFixed(0));

            return (
              <TouchableOpacity
                key={prop.id}
                onPress={() => setSelectedProperty(prop)}
                className="bg-white rounded-[24px] p-5 border border-navy-border shadow-card mb-4"
                activeOpacity={0.85}
              >
                <View className="flex-row justify-between items-start mb-1">
                  <View className="flex-1 mr-2">
                    <Text className="text-[19px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                      {prop.name}
                    </Text>
                    <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                      📍 {prop.address}
                    </Text>
                  </View>

                  <View className="flex-row items-center">
                    <View className="bg-navy/5 px-3 py-1 rounded-full border border-navy-border mr-1.5">
                      <Text className="text-[11px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                        {collectionPercent}% Paid
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
                  </View>
                </View>

                {/* Progress Bar per property */}
                <View className="h-1.5 bg-pageBg rounded-full overflow-hidden my-3">
                  <View className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, collectionPercent))}%` as any }} />
                </View>

                {/* Financial Totals */}
                <View className="flex-row justify-between items-center pt-2 border-t border-navy-border/60">
                  <View>
                    <Text className="text-[11px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                      Collected: <Text className="font-bold text-emerald-700">${prop.amountCollected.toLocaleString()}</Text>
                    </Text>
                  </View>

                  <View>
                    <Text className="text-[11px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                      Outstanding: <Text className="font-bold text-rose-600">${prop.amountOutstanding.toLocaleString()}</Text>
                    </Text>
                  </View>

                  <View className="flex-row items-center">
                    <MaterialIcons name="people" size={14} color="#0F1C28" />
                    <Text className="text-[11px] text-navy font-bold ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                      {prop.tenantsPaidCount}/{prop.totalTenantsCount} Paid
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* PROPERTY DETAIL MODAL */}
      {selectedProperty && (
        <Modal visible={!!selectedProperty} animationType="slide" transparent>
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border max-h-[85%]">
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className="text-[11px] text-navy-muted uppercase tracking-[0.1em]" style={{ fontFamily: 'DMSans_700Bold' }}>
                    Tenant Roster & Payment Status
                  </Text>
                  <Text className="text-[24px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                    {selectedProperty.name}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedProperty(null)}
                  className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border"
                >
                  <MaterialIcons name="close" size={18} color="#0F1C28" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-2">
                {selectedProperty.tenants.map((tenant) => {
                  const isPaid = tenant.status === 'paid';
                  const isOverdue = tenant.status === 'overdue';
                  const paidDateObj = tenant.paidDate ? new Date(tenant.paidDate) : new Date();

                  return (
                    <View
                      key={tenant.id}
                      className={`p-5 rounded-[22px] border mb-4 shadow-card ${
                        isPaid
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : isOverdue
                          ? 'bg-rose-500/5 border-rose-500/20'
                          : 'bg-amber-500/5 border-amber-500/20'
                      }`}
                    >
                      {/* Top Row: Tenant Info & Status Badge */}
                      <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1 mr-2">
                          <Text className="text-[18px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                            {tenant.name}
                          </Text>
                          <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                            {tenant.unit} • Due 1st of month
                          </Text>
                        </View>

                        {/* Standardized Status Chip Component */}
                        <StatusChip status={tenant.status} />
                      </View>

                      {/* Rent & Paid Timestamp Info */}
                      <View className="flex-row justify-between items-center my-3 py-2 border-y border-navy-border/40">
                        <View>
                          <Text className="text-[11px] text-navy-muted uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                            Monthly Rent
                          </Text>
                          <Text className="text-[20px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                            ${tenant.monthlyRent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>

                        <View className="items-end">
                          <Text className="text-[11px] text-navy-muted uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                            {isPaid ? 'Payment Log' : 'Reminder Status'}
                          </Text>

                          {isPaid ? (
                            <Text className="text-[12px] text-emerald-700 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                              Paid {format(paidDateObj, 'MMM d, h:mm a')} ({tenant.paymentMethod})
                            </Text>
                          ) : tenant.lastReminderSentAt ? (
                            <Text className="text-[12px] text-purple-700 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                              Reminder sent {formatDistanceToNow(new Date(tenant.lastReminderSentAt))} ago
                            </Text>
                          ) : (
                            <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                              No reminders sent
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Action Buttons */}
                      <View className="flex-row gap-2 mt-1">
                        {!isPaid && (
                          <TouchableOpacity
                            onPress={() => setReminderTenant(tenant)}
                            className="flex-1 bg-purple-600 py-2.5 rounded-[12px] items-center flex-row justify-center shadow-sm"
                          >
                            <MaterialIcons name="send" size={14} color="#FFFFFF" />
                            <Text className="text-white text-[12px] font-bold ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                              Send Reminder
                            </Text>
                          </TouchableOpacity>
                        )}

                        {!isPaid ? (
                          <TouchableOpacity
                            onPress={() => setMarkPaidTenant(tenant)}
                            className="flex-1 bg-emerald-600 py-2.5 rounded-[12px] items-center flex-row justify-center shadow-sm"
                          >
                            <MaterialIcons name="check-circle" size={14} color="#FFFFFF" />
                            <Text className="text-white text-[12px] font-bold ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                              Mark as Paid
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => setHistoryTenant(tenant)}
                            className="flex-1 bg-navy py-2.5 rounded-[12px] items-center flex-row justify-center shadow-sm"
                          >
                            <MaterialIcons name="history" size={14} color="#FFFFFF" />
                            <Text className="text-white text-[12px] font-bold ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                              Payment History
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* EXTRACTED MODAL COMPONENTS */}
      <MarkPaidModal
        visible={!!markPaidTenant}
        tenant={markPaidTenant}
        onClose={() => setMarkPaidTenant(null)}
        onConfirm={handleConfirmMarkAsPaid}
      />

      <SendReminderModal
        visible={!!reminderTenant}
        tenant={reminderTenant}
        onClose={() => setReminderTenant(null)}
        onSend={handleSendReminder}
      />

      {/* PAYMENT HISTORY SHEET */}
      {historyTenant && (
        <Modal visible={!!historyTenant} animationType="slide" transparent>
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border max-h-[75%]">
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className="text-[11px] text-navy-muted uppercase tracking-[0.1em]" style={{ fontFamily: 'DMSans_700Bold' }}>
                    12-Month Payment History
                  </Text>
                  <Text className="text-[22px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                    {historyTenant.name} ({historyTenant.unit})
                  </Text>
                </View>

                <TouchableOpacity onPress={() => setHistoryTenant(null)} className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border">
                  <MaterialIcons name="close" size={18} color="#0F1C28" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {[
                  { month: 'August 2026', date: 'Aug 1, 2026', amount: historyTenant.monthlyRent, method: historyTenant.paymentMethod || 'Stripe' },
                  { month: 'July 2026', date: 'Jul 1, 2026', amount: historyTenant.monthlyRent, method: 'Stripe' },
                  { month: 'June 2026', date: 'Jun 1, 2026', amount: historyTenant.monthlyRent, method: 'e-Transfer' },
                ].map((record, i) => (
                  <View key={i} className="bg-pageBg rounded-[18px] p-4 border border-navy-border mb-3 flex-row justify-between items-center">
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-[12px] bg-emerald-500/10 items-center justify-center mr-3">
                        <MaterialIcons name="check-circle" size={20} color="#059669" />
                      </View>
                      <View>
                        <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>{record.month}</Text>
                        <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Paid {record.date} • {record.method}</Text>
                      </View>
                    </View>

                    <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                      ${record.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
