import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money, monthDay } from '../../lib/format';
import { MonthlyRevenueChart } from '../../components/MonthlyRevenueChart';
import { IncomeExpenseBar } from '../../components/IncomeExpenseBar';
import { calculateArrears, type PaymentLedgerRow } from '../../lib/ltb/arrearsEngine';
import ScreenHeader from '../../components/ScreenHeader';
import { Ring, Donut, CountUp, GrowBar, LegendRow } from '../../components/ui/Charts';

const EXPENSE_COLORS: Record<string, string> = {
  repairs: '#1F2F3A', maintenance: '#1F2F3A', utilities: '#0E7490', insurance: '#B8860B', taxes: '#6B7280',
  property_tax: '#6B7280', management: '#7C3AED', mortgage: '#475569', other: '#94A3B8',
};
const titleCase = (s: string) => s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const PAYMENT_METHODS = [
  { value: 'etransfer', label: 'E-Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

interface LeaseOption {
  id: string;
  tenant_id: string;
  rent_amount: number | null;
  tenants: { first_name: string | null; last_name: string | null } | null;
}

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'partial';

interface PaymentRow {
  id: string;
  amount: number;
  status: PaymentStatus;
  due_date: string;
  paid_at: string | null;
  tenants: { first_name: string | null; last_name: string | null } | null;
  leases: { units: { properties: { id: string; name: string | null; address: string | null } | null } | null } | null;
}

interface UnitInfo {
  rent_amount: number | null;
  leases: { status: string | null; rent_amount: number | null }[];
}
interface PropertyRow {
  id: string;
  name: string | null;
  address: string | null;
  units: UnitInfo[];
}
interface LedgerEntry {
  property_id: string;
  amount: number;
  category?: string | null;
  date?: string | null;
}

function monthYearLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function tenantName(t: { first_name: string | null; last_name: string | null } | null) {
  return `${t?.first_name ?? ''} ${t?.last_name ?? ''}`.trim() || 'Tenant';
}

function propertyOf(entry: PaymentRow) {
  const p = entry.leases?.units?.properties;
  return { id: p?.id ?? 'unknown', label: p?.name ?? p?.address ?? 'Unknown Property' };
}

// Grouped by property, not a single flat list — a flat list of "who paid
// what when" stops being scannable once there's more than a couple of
// properties, since entries from different buildings interleave with no
// way to tell them apart at a glance.
function groupPaymentsByProperty(paid: PaymentRow[]) {
  const groups = new Map<string, { id: string; label: string; entries: PaymentRow[] }>();
  for (const entry of paid) {
    const { id, label } = propertyOf(entry);
    if (!groups.has(id)) groups.set(id, { id, label, entries: [] });
    groups.get(id)!.entries.push(entry);
  }
  return Array.from(groups.values()).sort((a, b) => {
    const aLatest = a.entries[0]?.paid_at ?? a.entries[0]?.due_date ?? '';
    const bLatest = b.entries[0]?.paid_at ?? b.entries[0]?.due_date ?? '';
    return bLatest.localeCompare(aLatest);
  });
}

function expectedRentFor(units: UnitInfo[]) {
  return units.reduce((sum, u) => {
    const active = u.leases?.find((l) => l.status === 'active') ?? u.leases?.[0] ?? null;
    return sum + Number(active?.rent_amount ?? u.rent_amount ?? 0);
  }, 0);
}

export default function OwnerPaymentsScreen() {
  const { profileId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [expenses, setExpenses] = useState<LedgerEntry[]>([]);
  const [income, setIncome] = useState<LedgerEntry[]>([]);
  const [leaseOptions, setLeaseOptions] = useState<LeaseOption[]>([]);

  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('etransfer');
  const [payNotes, setPayNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [confirmPaidEntry, setConfirmPaidEntry] = useState<PaymentRow | null>(null);
  const [confirmPaidDate, setConfirmPaidDate] = useState('');
  const [showAllPayments, setShowAllPayments] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!profileId) return;
    try {
      const [{ data: paymentData }, { data: propData }, { data: expData }, { data: incData }, { data: leaseData }] = await Promise.all([
        supabase
          .from('payments')
          .select(`
            id, amount, status, due_date, paid_at,
            tenants ( first_name, last_name ),
            leases ( units ( properties ( id, name, address ) ) )
          `)
          .eq('landlord_id', profileId)
          .order('due_date', { ascending: false }),
        supabase
          .from('properties')
          .select(`id, name, address, units ( rent_amount, leases ( status, rent_amount ) )`)
          .eq('landlord_id', profileId),
        supabase.from('expenses').select('property_id, amount, category, date').eq('landlord_id', profileId),
        supabase.from('income').select('property_id, amount').eq('landlord_id', profileId),
        supabase.from('leases').select('id, tenant_id, rent_amount, tenants ( first_name, last_name )').eq('landlord_id', profileId),
      ]);

      // Supabase's default (ungenerated) client types every nested embed as
      // an array regardless of FK cardinality; leases->tenants is verified
      // to-one (units->leases is genuinely to-many, left as an array).
      setPayments((paymentData || []) as unknown as PaymentRow[]);
      setProperties((propData || []) as unknown as PropertyRow[]);
      setExpenses((expData || []) as LedgerEntry[]);
      setIncome((incData || []) as LedgerEntry[]);
      setLeaseOptions((leaseData || []) as unknown as LeaseOption[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  function openMarkPaidConfirm(entry: PaymentRow) {
    if (markingPaidId) return;
    setConfirmPaidEntry(entry);
    setConfirmPaidDate(new Date().toISOString().split('T')[0]);
  }

  // Takes the actual collection date instead of always stamping "now" —
  // an outstanding balance is very often cleared days or weeks after it
  // was reported (e.g. folded into a later month's payment), and silently
  // dating it today misattributes the money to whatever month it happens
  // to get marked in, not the month it was actually received.
  const markAsPaid = async () => {
    if (!confirmPaidEntry || markingPaidId) return;
    const paymentId = confirmPaidEntry.id;
    setMarkingPaidId(paymentId);
    try {
      const { data: updated, error } = await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: new Date(confirmPaidDate).toISOString() })
        .eq('id', paymentId)
        .select('lease_id')
        .single();

      if (error) throw error;
      setConfirmPaidEntry(null);
      await fetchAll();
      if (updated?.lease_id) checkN4VoidEligibility(updated.lease_id);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setMarkingPaidId(null);
    }
  };

  function openRecordPayment() {
    setSelectedLeaseId(leaseOptions[0]?.id ?? null);
    setPayAmount(leaseOptions[0]?.rent_amount ? String(leaseOptions[0].rent_amount) : '');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMethod('etransfer');
    setPayNotes('');
    setShowRecordPayment(true);
  }

  function selectLease(leaseId: string) {
    setSelectedLeaseId(leaseId);
    const lease = leaseOptions.find((l) => l.id === leaseId);
    if (lease?.rent_amount) setPayAmount(String(lease.rent_amount));
  }

  async function recordPayment() {
    const lease = leaseOptions.find((l) => l.id === selectedLeaseId);
    const amount = Number(payAmount);
    if (!lease || !amount || amount <= 0 || !profileId) return;

    // Prefilled amount/date make it very easy to record the same rent
    // period twice without meaning to (re-opening this modal, forgetting
    // it was already done). Don't block a genuine second payment for the
    // same period — just make sure it's a deliberate choice, not a slip.
    const { data: existing } = await supabase
      .from('payments')
      .select('id, amount, payment_method')
      .eq('lease_id', lease.id)
      .eq('due_date', payDate);

    if (existing && existing.length > 0) {
      const name = `${lease.tenants?.first_name ?? ''} ${lease.tenants?.last_name ?? ''}`.trim() || 'This resident';
      const priorTotal = existing.reduce((sum, p) => sum + Number(p.amount), 0);
      Alert.alert(
        'Already recorded for this date',
        `${name} already has ${existing.length === 1 ? 'a payment' : `${existing.length} payments`} totalling $${priorTotal.toFixed(2)} recorded for ${payDate}. Record this one too?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Record Anyway', style: 'destructive', onPress: () => doInsertPayment(lease, amount) },
        ]
      );
      return;
    }

    doInsertPayment(lease, amount);
  }

  async function doInsertPayment(lease: LeaseOption, amount: number) {
    setSavingPayment(true);
    const { error } = await supabase.from('payments').insert({
      lease_id: lease.id,
      tenant_id: lease.tenant_id,
      landlord_id: profileId,
      amount,
      due_date: payDate,
      paid_at: new Date(payDate).toISOString(),
      status: 'paid',
      payment_method: payMethod,
      recorded_manually: true,
      notes: payNotes.trim() || null,
    });
    setSavingPayment(false);
    if (error) {
      Alert.alert('Could not record payment', error.message);
      return;
    }
    setShowRecordPayment(false);
    fetchAll();
    checkN4VoidEligibility(lease.id);
  }

  // Spec section 17 — the app should notice when a payment resolves an
  // active N4, not leave it to the landlord to remember to check. This
  // only surfaces a prompt; marking void still requires explicit
  // confirmation on the notice's own screen (never automatic).
  async function checkN4VoidEligibility(leaseId: string) {
    const { data: notice } = await supabase
      .from('ltb_notices')
      .select('id, snapshot')
      .eq('lease_id', leaseId)
      .eq('form_code', 'N4')
      .eq('status', 'WAITING_PERIOD')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!notice) return;

    const { data: rows } = await supabase
      .from('payments')
      .select('id, amount, due_date, status, classification')
      .eq('lease_id', leaseId);
    const arrears = calculateArrears((rows || []) as PaymentLedgerRow[]);

    if (arrears.totalOwing <= 0) {
      const tenantName = Array.isArray(notice.snapshot?.tenant_names) ? notice.snapshot.tenant_names.join(', ') : 'this tenant';
      Alert.alert(
        'This may resolve an active N4',
        `${tenantName}'s rent ledger now shows $0 owing. There's an active N4 notice waiting on this tenancy — review it to confirm and mark it void/resolved.`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Review Notice', onPress: () => router.push(`/(tabs)/ltb/notice/${notice.id}` as any) },
        ]
      );
    }
  }

  if (loading) return <View className="flex-1 bg-pageBg justify-center items-center"><ActivityIndicator color="#1F2F3A" /></View>;

  // 'partial' records are historical facts (some money already came in
  // against them) — they belong in Recent Payments, not "Needs Action",
  // whose only control (Mark Paid) sets paid_at to right now. Doing that to
  // a partial record silently rewrites when/how much was actually paid.
  // A partial shortfall gets its own separate 'pending' record for the
  // remaining balance instead, which correctly does show up as an action.
  const unpaid = payments.filter((r) => r.status === 'pending' || r.status === 'overdue');
  const paid = payments.filter((r) => r.status === 'paid' || r.status === 'partial');
  const expectedMonthlyRent = properties.reduce((sum, p) => sum + expectedRentFor(p.units), 0);
  // UTC accessors on both sides — paid_at is stored as a UTC-midnight
  // timestamp for date-only values, so comparing it against local-timezone
  // month/year rolls it back a day west of UTC. Also compares year, not
  // just month (the previous check would wrongly match August of any year).
  const now = new Date();
  const collectedThisMonth = paid
    .filter((p) => {
      if (!p.paid_at) return false;
      const d = new Date(p.paid_at);
      return d.getUTCMonth() === now.getUTCMonth() && d.getUTCFullYear() === now.getUTCFullYear();
    })
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const outstanding = unpaid.reduce((s, r) => s + Number(r.amount), 0);
  const collectionRate = expectedMonthlyRent > 0 ? Math.min(1, collectedThisMonth / expectedMonthlyRent) : 0;

  // On time = paid within 5 days of the due date, over the last 6 months.
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString();
  const recentPaid = paid.filter((p) => p.paid_at && p.due_date >= sixMonthsAgo.slice(0, 10));
  const onTime = recentPaid.filter((p) => new Date(p.paid_at!).getTime() <= new Date(p.due_date).getTime() + 5 * 86400000).length;
  const onTimeRate = recentPaid.length ? onTime / recentPaid.length : 0;

  // This calendar year: rent in, expenses out, by category.
  const yearStart = `${now.getUTCFullYear()}-01-01`;
  const rentYtd = paid.filter((p) => (p.paid_at ?? '') >= yearStart).reduce((s, p) => s + Number(p.amount), 0);
  const expYtdRows = expenses.filter((e) => (e.date ?? '') >= yearStart);
  const expYtd = expYtdRows.reduce((s, e) => s + Number(e.amount), 0);
  const netYtd = rentYtd - expYtd;
  const byCategory = Array.from(
    expYtdRows.reduce((m, e) => m.set(e.category || 'other', (m.get(e.category || 'other') ?? 0) + Number(e.amount)), new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);
  const donutSegments = [
    { value: Math.max(0, netYtd), color: '#0A7A52' },
    ...byCategory.map(([cat, amt]) => ({ value: amt, color: EXPENSE_COLORS[cat] ?? '#94A3B8' })),
  ];

  // Net per building, all time, ranked.
  const propNet = properties.map((p) => {
    const rent = payments.filter((pay) => pay.status === 'paid' && pay.leases?.units?.properties?.id === p.id).reduce((s, pay) => s + Number(pay.amount), 0);
    const other = income.filter((i) => i.property_id === p.id).reduce((s, i) => s + Number(i.amount), 0);
    const exp = expenses.filter((e) => e.property_id === p.id).reduce((s, e) => s + Number(e.amount), 0);
    return { p, net: rent + other - exp };
  }).sort((a, b) => b.net - a.net);
  const maxNet = Math.max(1, ...propNet.map((x) => Math.abs(x.net)));

  return (
    <View className="flex-1 bg-pageBg">
      <ScreenHeader
        title="Money"
        subtitle={`${monthYearLabel(now)} · ${paid.length} payment${paid.length === 1 ? '' : 's'} on record`}
        right={
          <TouchableOpacity
            onPress={openRecordPayment}
            disabled={leaseOptions.length === 0}
            className="h-11 px-4 bg-navy rounded-full flex-row items-center"
            style={{ opacity: leaseOptions.length === 0 ? 0.4 : 1 }}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text className="text-white font-sansBold text-[13px] ml-1.5">Record payment</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 120 }}>
        {/* This month at a glance */}
        <View className="bg-navy rounded-[28px] p-5 mb-4">
          <View className="flex-row items-center">
            <Ring value={collectionRate} size={124} stroke={12} color="#E8B4BC" track="rgba(255,255,255,0.12)">
              <Text className="text-white font-sansBold text-[26px]">{Math.round(collectionRate * 100)}%</Text>
              <Text className="text-white/50 font-sans text-[10px] uppercase tracking-widest">collected</Text>
            </Ring>
            <View className="flex-1 ml-5">
              <Text className="text-white/50 font-sans text-[11px] uppercase tracking-widest">In this month</Text>
              <CountUp value={collectedThisMonth} prefix="$" className="text-white font-sansBold text-[28px]" />
              <Text className="text-white/50 font-sans text-[12px] mb-3">of ${money(expectedMonthlyRent).replace('.00', '')} expected</Text>
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: outstanding > 0 ? '#F59E0B' : '#34D399' }} />
                <Text className="text-white font-sansBold text-[13px]">
                  {outstanding > 0 ? `$${money(outstanding).replace('.00', '')} still owing` : 'Nothing owing'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick numbers */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-card rounded-[22px] p-4 border border-navy/5 shadow-sm">
            <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Paid on time</Text>
            <Text className="text-navy font-sansBold text-[22px] mt-1">{recentPaid.length ? `${Math.round(onTimeRate * 100)}%` : '—'}</Text>
            <View className="mt-2"><GrowBar value={onTimeRate} color="#0A7A52" height={6} /></View>
            <Text className="text-navy-muted font-sans text-[11px] mt-2 opacity-60">last 6 months</Text>
          </View>
          <View className="flex-1 bg-card rounded-[22px] p-4 border border-navy/5 shadow-sm">
            <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Net this year</Text>
            <CountUp value={netYtd} prefix={netYtd < 0 ? '-$' : '$'} className="text-navy font-sansBold text-[22px] mt-1" style={{ color: netYtd < 0 ? '#8B2030' : '#1F2F3A' }} />
            <Text className="text-navy-muted font-sans text-[11px] mt-2 opacity-60">${money(rentYtd).replace('.00', '')} in · ${money(expYtd).replace('.00', '')} out</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/rent-collection')}
          className="bg-card border border-navy/5 rounded-[22px] p-4 flex-row items-center mb-6 shadow-sm"
        >
          <View className="w-10 h-10 rounded-full bg-navy/5 items-center justify-center mr-3">
            <Feather name="send" size={16} color="#1F2F3A" />
          </View>
          <View className="flex-1">
            <Text className="text-navy font-sansBold text-[14px]">Rent reminders</Text>
            <Text className="text-navy-muted font-sans text-[12px] opacity-70">Send or check reminders to residents</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.3 }} />
        </TouchableOpacity>

        <Text className="text-[20px] text-navy font-sansBold mb-4">Needs action</Text>
        {unpaid.length === 0 ? (
          <View className="bg-card rounded-[22px] p-5 mb-6 border border-navy/5 flex-row items-center">
            <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: 'rgba(10,122,82,0.1)' }}>
              <Feather name="check" size={18} color="#0A7A52" />
            </View>
            <Text className="text-navy font-sansBold text-[14px] flex-1">All rent is paid up.</Text>
          </View>
        ) : (
          unpaid.map((entry) => (
            <View key={entry.id} className="bg-card p-5 rounded-[20px] mb-5 border border-navy-border shadow-sm flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-navy font-sansBold text-[17px] mb-1.5">{tenantName(entry.tenants)}</Text>
                <Text className="text-navy-muted font-sans text-[15px]">Due: {monthDay(entry.due_date)}</Text>
                {daysSince(entry.due_date) >= 21 && (
                  <Text className="text-burgundy font-sans text-[12px] mt-0.5">
                    Outstanding {daysSince(entry.due_date)} days — check it&apos;s not already been paid another way
                  </Text>
                )}
                <Text className="text-burgundy font-sansBold text-[17px] mt-1.5">${money(entry.amount)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => openMarkPaidConfirm(entry)}
                disabled={markingPaidId !== null}
                className="bg-navy px-4 py-2.5 rounded-xl"
                style={{ opacity: markingPaidId !== null && markingPaidId !== entry.id ? 0.4 : 1, minWidth: 96, alignItems: 'center' }}
              >
                {markingPaidId === entry.id ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-white font-sansBold">Mark Paid</Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          onPress={() => setShowAllPayments(true)}
          disabled={paid.length === 0}
          className="bg-card rounded-[22px] p-4 mb-6 border border-navy/5 shadow-sm flex-row items-center"
        >
          <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: 'rgba(10,122,82,0.1)' }}>
            <Feather name="list" size={16} color="#0A7A52" />
          </View>
          <View className="flex-1">
            <Text className="text-navy font-sansBold text-[14px]">Recent payments</Text>
            <Text className="text-navy-muted font-sans text-[12px] opacity-70">
              {paid.length ? `Last: ${tenantName(paid[0].tenants)} · $${money(paid[0].amount).replace('.00', '')} · ${monthDay(paid[0].paid_at || paid[0].due_date)}` : 'No payments recorded yet'}
            </Text>
          </View>
          <View className="bg-navy/5 px-2.5 py-1 rounded-full mr-2"><Text className="text-navy font-sansBold text-[12px]">{paid.length}</Text></View>
          <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.3 }} />
        </TouchableOpacity>

        <MonthlyRevenueChart payments={paid} />

        {/* Where the money went this year */}
        {rentYtd + expYtd > 0 && (
          <View className="bg-card rounded-[24px] p-5 mb-8 border border-navy/5 shadow-sm">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-4">Where the money went · {now.getUTCFullYear()}</Text>
            <View className="flex-row items-center">
              <Donut segments={donutSegments} size={132} stroke={16}>
                <Text className="text-navy font-sansBold text-[18px]">{rentYtd > 0 ? `${Math.round((Math.max(0, netYtd) / rentYtd) * 100)}%` : '—'}</Text>
                <Text className="text-navy-muted font-sans text-[10px] uppercase tracking-widest">kept</Text>
              </Donut>
              <View className="flex-1 ml-5">
                <LegendRow color="#0A7A52" label="You kept" value={`$${money(Math.max(0, netYtd)).replace('.00', '')}`} />
                {byCategory.slice(0, 4).map(([cat, amt]) => (
                  <LegendRow key={cat} color={EXPENSE_COLORS[cat] ?? '#94A3B8'} label={titleCase(cat)} value={`$${money(amt).replace('.00', '')}`} />
                ))}
              </View>
            </View>
          </View>
        )}

        {propNet.length > 0 && (
          <View className="bg-card rounded-[24px] p-5 mb-8 border border-navy/5 shadow-sm">
            <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-4">Best performing buildings · net all time</Text>
            {propNet.slice(0, 6).map(({ p, net }, i) => (
              <TouchableOpacity key={p.id} onPress={() => router.push(`/property/${p.id}`)} className="mb-3">
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-navy font-sansBold text-[13px] flex-1 pr-3" numberOfLines={1}>{p.name || p.address}</Text>
                  <Text className="font-sansBold text-[13px]" style={{ color: net < 0 ? '#8B2030' : '#0A7A52' }}>{net < 0 ? '-' : ''}${money(Math.abs(net)).replace('.00', '')}</Text>
                </View>
                <GrowBar value={Math.abs(net) / maxNet} color={net < 0 ? '#8B2030' : '#1F2F3A'} height={7} delay={i * 70} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text className="text-[20px] text-navy font-sansBold mb-4">By building</Text>
        {properties.length === 0 ? (
          <Text className="text-navy-muted font-sans">No properties yet.</Text>
        ) : (
          properties.map((p) => {
            const propExpected = expectedRentFor(p.units);
            // Real rent lives in payments, not the separate (unused) income
            // table — nothing in the app ever writes to income, so relying
            // on it alone silently shows $0 regardless of rent actually
            // collected for this property.
            const propRent = payments
              .filter((pay) => pay.status === 'paid' && pay.leases?.units?.properties?.id === p.id)
              .reduce((s, pay) => s + Number(pay.amount), 0);
            const propOtherIncome = income.filter((i) => i.property_id === p.id).reduce((s, i) => s + Number(i.amount), 0);
            const propIncome = propRent + propOtherIncome;
            const propExpenses = expenses.filter((e) => e.property_id === p.id).reduce((s, e) => s + Number(e.amount), 0);
            const net = propIncome - propExpenses;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => router.push(`/property/${p.id}`)}
                className="bg-card p-5 rounded-[20px] mb-4 border border-navy-border shadow-sm"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-navy font-sansBold text-[16px] flex-1 pr-3" numberOfLines={1}>{p.name || p.address}</Text>
                  <Feather name="chevron-right" size={18} color="#1F2F3A" style={{ opacity: 0.3 }} />
                </View>
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Expected</Text>
                    <Text className="text-navy font-sansBold text-[15px] mt-0.5">${money(propExpected)}/mo</Text>
                  </View>
                  <View>
                    <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Income</Text>
                    <Text className="text-emerald-700 font-sansBold text-[15px] mt-0.5">${money(propIncome)}</Text>
                  </View>
                  <View>
                    <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Expenses</Text>
                    <Text className="text-burgundy font-sansBold text-[15px] mt-0.5">${money(propExpenses)}</Text>
                  </View>
                  <View>
                    <Text className="text-navy-muted font-sans text-[11px] uppercase tracking-wide">Net</Text>
                    <Text className="text-navy font-sansBold text-[15px] mt-0.5">${money(net)}</Text>
                  </View>
                </View>

                <IncomeExpenseBar income={propIncome} expenses={propExpenses} />

                {propIncome + propExpenses > 0 && (
                  <View className="flex-row items-center gap-4 mt-2.5">
                    <View className="flex-row items-center gap-1.5">
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669' }} />
                      <Text className="text-navy-muted font-sans text-[11px]">
                        {Math.round((propIncome / (propIncome + propExpenses)) * 100)}% income
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8B2030' }} />
                      <Text className="text-navy-muted font-sans text-[11px]">
                        {Math.round((propExpenses / (propIncome + propExpenses)) * 100)}% expenses
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showRecordPayment} animationType="slide" transparent onRequestClose={() => setShowRecordPayment(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-card rounded-t-[28px] p-6" style={{ maxHeight: '85%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="text-navy font-sansBold text-[19px] mb-5">Record Payment</Text>

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Resident</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {leaseOptions.map((l) => {
                  const name = `${l.tenants?.first_name ?? ''} ${l.tenants?.last_name ?? ''}`.trim() || 'Resident';
                  const selected = selectedLeaseId === l.id;
                  return (
                    <TouchableOpacity
                      key={l.id}
                      onPress={() => selectLease(l.id)}
                      className="px-3 py-1.5 rounded-full border"
                      style={{ borderColor: selected ? '#1F2F3A' : '#D8D2C8', backgroundColor: selected ? '#1F2F3A' : 'transparent' }}
                    >
                      <Text className="font-sansBold text-[12px]" style={{ color: selected ? '#FFFFFF' : '#333333' }}>{name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Amount</Text>
              <TextInput
                className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                value={payAmount}
                onChangeText={setPayAmount}
              />

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Date Paid</Text>
              <TextInput
                className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-4"
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                value={payDate}
                onChangeText={setPayDate}
              />

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Method</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {PAYMENT_METHODS.map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    onPress={() => setPayMethod(m.value)}
                    className="px-3 py-1.5 rounded-full border"
                    style={{ borderColor: payMethod === m.value ? '#1F2F3A' : '#D8D2C8', backgroundColor: payMethod === m.value ? '#1F2F3A' : 'transparent' }}
                  >
                    <Text className="font-sansBold text-[12px]" style={{ color: payMethod === m.value ? '#FFFFFF' : '#333333' }}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">Notes (optional)</Text>
              <TextInput
                className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-6"
                placeholder="e.g. e-transfer reference"
                placeholderTextColor="#94a3b8"
                value={payNotes}
                onChangeText={setPayNotes}
              />

              <View className="flex-row gap-3 mb-2">
                <TouchableOpacity onPress={() => setShowRecordPayment(false)} className="flex-1 py-4 rounded-xl items-center border border-navy-border">
                  <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={recordPayment}
                  disabled={savingPayment || !selectedLeaseId || !payAmount}
                  className="flex-1 bg-navy py-4 rounded-xl items-center"
                  style={{ opacity: !selectedLeaseId || !payAmount ? 0.5 : 1 }}
                >
                  <Text className="text-white font-sansBold text-[15px]">{savingPayment ? 'Saving...' : 'Save Payment'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!confirmPaidEntry} animationType="slide" transparent onRequestClose={() => setConfirmPaidEntry(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-card rounded-t-[28px] p-6" style={{ maxHeight: '85%' }}>
            {confirmPaidEntry && (
              <>
                <Text className="text-navy font-sansBold text-[19px] mb-2">Mark as Paid</Text>
                <Text className="text-navy-muted font-sans text-[14px] mb-5">
                  {tenantName(confirmPaidEntry.tenants)} · ${money(confirmPaidEntry.amount)} · due {monthDay(confirmPaidEntry.due_date)}
                </Text>

                <Text className="text-navy-muted font-sansBold text-[11px] uppercase tracking-wide mb-2">
                  When was this actually paid?
                </Text>
                <TextInput
                  className="bg-pageBg border border-navy-border rounded-xl p-4 font-sans text-navy mb-2"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={confirmPaidDate}
                  onChangeText={setConfirmPaidDate}
                />
                <Text className="text-navy-muted font-sans text-[12px] mb-6">
                  If this was folded into a later payment, use that date — not today — so it counts toward the right month.
                </Text>

                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => setConfirmPaidEntry(null)} className="flex-1 py-4 rounded-xl items-center border border-navy-border">
                    <Text className="text-navy-muted font-sansBold text-[15px]">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={markAsPaid}
                    disabled={markingPaidId !== null || !confirmPaidDate}
                    className="flex-1 bg-navy py-4 rounded-xl items-center"
                    style={{ opacity: !confirmPaidDate ? 0.5 : 1 }}
                  >
                    <Text className="text-white font-sansBold text-[15px]">{markingPaidId ? 'Saving...' : 'Confirm'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={showAllPayments} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAllPayments(false)}>
        <View className="flex-1 bg-pageBg">
          <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
            <View>
              <Text className="text-navy font-sansBold text-[24px]">Recent payments</Text>
              <Text className="text-navy-muted font-sans text-[13px] opacity-70">{paid.length} payments, grouped by building</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAllPayments(false)} className="w-10 h-10 rounded-full bg-navy/5 items-center justify-center">
              <Feather name="x" size={18} color="#1F2F3A" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        {paid.length === 0 ? (
          <Text className="text-navy-muted font-sans mb-10">No payments recorded yet.</Text>
        ) : (
          groupPaymentsByProperty(paid).map((group) => {
            const isExpanded = expandedProperty === group.id;
            const visible = isExpanded ? group.entries : group.entries.slice(0, 3);
            const hiddenCount = group.entries.length - visible.length;
            return (
              <View key={group.id} className="mb-6">
                <Text className="text-navy-muted font-sansBold text-[12px] uppercase tracking-wide mb-3 ml-1">{group.label}</Text>
                {visible.map((entry) => (
                  <View key={entry.id} className="bg-card p-5 rounded-[20px] mb-3 border border-navy-border shadow-sm flex-row items-center justify-between opacity-80">
                    <View>
                      <Text className="text-navy font-sansBold text-[17px] mb-1.5">{tenantName(entry.tenants)}</Text>
                      <Text className="text-navy-muted font-sans text-[15px]">Paid: {monthDay(entry.paid_at || entry.due_date)}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-navy font-sansBold text-[17px] mb-1.5">+${money(entry.amount)}</Text>
                      <View
                        className="px-2.5 py-1.5 rounded-full mt-1"
                        style={{ backgroundColor: entry.status === 'partial' ? 'rgba(217,119,6,0.1)' : 'rgba(5,150,105,0.1)' }}
                      >
                        <Text className="font-sansBold text-[12px]" style={{ color: entry.status === 'partial' ? '#D97706' : '#059669' }}>
                          {entry.status === 'partial' ? 'PARTIAL' : 'PAID'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
                {hiddenCount > 0 && (
                  <TouchableOpacity onPress={() => setExpandedProperty(group.id)} className="items-center py-2">
                    <Text className="text-navy-muted font-sansBold text-[13px]">Show {hiddenCount} more</Text>
                  </TouchableOpacity>
                )}
                {isExpanded && group.entries.length > 3 && (
                  <TouchableOpacity onPress={() => setExpandedProperty(null)} className="items-center py-2">
                    <Text className="text-navy-muted font-sansBold text-[13px]">Show less</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
