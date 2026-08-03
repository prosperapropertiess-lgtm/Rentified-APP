import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/SkeletonLoader';

// ---------------------------------------------------------------------------
// TYPES (Property Health Data Model Specification #9)
// ---------------------------------------------------------------------------
export type HealthScoreLevel = 'excellent' | 'attention' | 'critical';

export type MajorSystem = {
  id: string;
  name: string;
  category: 'hvac' | 'plumbing' | 'electrical' | 'structure' | 'safety' | 'appliance';
  status: 'operational' | 'service_due' | 'needs_replacement';
  installDate: string;
  lastServiceDate: string;
  intervalMonths: number;
  nextDueDate: string;
  notes: string;
  estimatedCost?: number;
};

export type MaintenanceTaskItem = {
  id: string;
  systemName: string;
  taskTitle: string;
  dueDate: string;
  completedDate?: string | null;
  status: 'upcoming' | 'completed' | 'overdue';
  cost?: number | null;
  invoiceUrl?: string | null;
  notes?: string | null;
};

export type PropertyHealthRecord = {
  id: string;
  propertyName: string;
  address: string;
  healthScore: number; // 0 - 100
  nextTaskTitle: string;
  nextTaskDays: number;
  aiSummary: string;
  systems: MajorSystem[];
  tasks: MaintenanceTaskItem[];
};

// ---------------------------------------------------------------------------
// MOCK SAMPLE DATA (Apple Battery Health Aesthetic & 5-Second Insights)
// ---------------------------------------------------------------------------
const SAMPLE_HEALTH_DATA: PropertyHealthRecord[] = [
  {
    id: 'prop-1',
    propertyName: 'King Street West Condos',
    address: '500 King St W, Toronto, ON',
    healthScore: 92,
    nextTaskTitle: 'HVAC Filter Replacement',
    nextTaskDays: 18,
    aiSummary:
      'Property is in excellent condition. HVAC filter replacement is due in 18 days. Gutters have not been cleaned in 9 months and should be serviced before fall. All safety inspections are current.',
    systems: [
      {
        id: 'sys-1',
        name: 'HVAC & Air Conditioning',
        category: 'hvac',
        status: 'service_due',
        installDate: '2021-05-15',
        lastServiceDate: '2025-11-10',
        intervalMonths: 6,
        nextDueDate: format(addDays(new Date(), 18), 'yyyy-MM-dd'),
        notes: 'High-efficiency HEPA filter required (Size 20x25x1).',
        estimatedCost: 85,
      },
      {
        id: 'sys-2',
        name: 'Tankless Water Heater',
        category: 'plumbing',
        status: 'operational',
        installDate: '2022-08-01',
        lastServiceDate: '2026-02-15',
        intervalMonths: 12,
        nextDueDate: '2027-02-15',
        notes: 'Annual descaling completed by Master Plumber.',
        estimatedCost: 150,
      },
      {
        id: 'sys-3',
        name: 'Smoke & CO Detectors',
        category: 'safety',
        status: 'operational',
        installDate: '2023-01-10',
        lastServiceDate: '2026-01-10',
        intervalMonths: 12,
        nextDueDate: '2027-01-10',
        notes: '10-year sealed lithium battery sensors tested OK.',
        estimatedCost: 45,
      },
      {
        id: 'sys-4',
        name: 'Roof & Eavestroughs',
        category: 'structure',
        status: 'service_due',
        installDate: '2019-06-20',
        lastServiceDate: '2025-10-01',
        intervalMonths: 12,
        nextDueDate: '2026-10-01',
        notes: 'Schedule gutter flush before fall leaves accumulate.',
        estimatedCost: 220,
      },
    ],
    tasks: [
      {
        id: 't-1',
        systemName: 'HVAC & Air Conditioning',
        taskTitle: 'Replace HVAC HEPA Air Filters',
        dueDate: format(addDays(new Date(), 18), 'MMM d, yyyy'),
        status: 'upcoming',
        notes: 'Filter model: MERV 13 20x25x1',
      },
      {
        id: 't-2',
        systemName: 'Smoke & CO Detectors',
        taskTitle: 'Annual Smoke Alarm Battery Test',
        dueDate: 'Sept 1, 2026',
        status: 'upcoming',
      },
      {
        id: 't-3',
        systemName: 'Roof & Eavestroughs',
        taskTitle: 'Fall Gutter Cleaning & Inspection',
        dueDate: 'Oct 10, 2026',
        status: 'upcoming',
      },
      {
        id: 't-4',
        systemName: 'Plumbing',
        taskTitle: 'Winterize Exterior Faucets & Hose Bibs',
        dueDate: 'Nov 1, 2026',
        status: 'upcoming',
      },
      {
        id: 't-5',
        systemName: 'Tankless Water Heater',
        taskTitle: 'Annual Water Heater Descaling',
        dueDate: 'Feb 15, 2026',
        completedDate: 'Feb 15, 2026',
        status: 'completed',
        cost: 150,
        notes: 'Performed by Apex Plumbing Ltd. Receipt saved.',
      },
    ],
  },
  {
    id: 'prop-2',
    propertyName: 'Yorkville Heights',
    address: '120 Yorkville Ave, Toronto, ON',
    healthScore: 78,
    nextTaskTitle: 'Dryer Vent Lint Cleanout',
    nextTaskDays: 5,
    aiSummary:
      'Property score is 78/100 (Needs Attention). Dryer vent lint cleanout is 5 days overdue. Electrical panel inspection is scheduled for next month.',
    systems: [
      {
        id: 'sys-201',
        name: 'Electric Furnace & Heat Pump',
        category: 'hvac',
        status: 'operational',
        installDate: '2020-03-12',
        lastServiceDate: '2025-12-01',
        intervalMonths: 12,
        nextDueDate: '2026-12-01',
        notes: 'Compressor check passed.',
      },
      {
        id: 'sys-202',
        name: 'Dryer Exhaust Vent',
        category: 'safety',
        status: 'service_due',
        installDate: '2018-09-01',
        lastServiceDate: '2025-05-10',
        intervalMonths: 6,
        nextDueDate: format(addDays(new Date(), -5), 'yyyy-MM-dd'),
        notes: 'Lint blockage reduces dryer efficiency.',
        estimatedCost: 120,
      },
    ],
    tasks: [
      {
        id: 't-201',
        systemName: 'Dryer Exhaust Vent',
        taskTitle: 'Dryer Vent Lint Duct Vacuum',
        dueDate: format(addDays(new Date(), -5), 'MMM d, yyyy'),
        status: 'overdue',
        notes: 'Overdue by 5 days. Call duct specialist.',
      },
    ],
  },
];

export default function PropertyHealthScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [properties, setProperties] = useState<PropertyHealthRecord[]>(SAMPLE_HEALTH_DATA);
  const [selectedPropId, setSelectedPropId] = useState<string>('prop-1');
  const [taskFilter, setTaskFilter] = useState<'upcoming' | 'completed' | 'overdue'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add/Edit Task Modal State
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [newSystemName, setNewSystemName] = useState('HVAC & Air Conditioning');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCost, setNewTaskCost] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  const fetchHealthData = useCallback(async () => {
    try {
      if (!session?.user) {
        setLoading(false);
        return;
      }
    } catch (e) {
      console.error('Error fetching health data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchHealthData();
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchHealthData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHealthData();
  };

  const activeProp = properties.find((p) => p.id === selectedPropId) || properties[0];

  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-500/30', label: 'Excellent 🟢' };
    if (score >= 70) return { bg: 'bg-amber-500', text: 'text-amber-800', border: 'border-amber-500/30', label: 'Needs Attention 🟡' };
    return { bg: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-500/30', label: 'Critical 🔴' };
  };

  const scoreMeta = getScoreColor(activeProp.healthScore);

  const handleMarkTaskComplete = (taskId: string) => {
    Alert.alert('Complete Task', 'Record cost and mark maintenance as completed?', [
      {
        text: 'Confirm Completion',
        onPress: () => {
          setProperties((prevProps) =>
            prevProps.map((p) => {
              if (p.id !== activeProp.id) return p;
              const updatedTasks = p.tasks.map((t) => {
                if (t.id !== taskId) return t;
                return {
                  ...t,
                  status: 'completed' as const,
                  completedDate: format(new Date(), 'MMM d, yyyy'),
                  cost: t.cost || 120,
                };
              });
              return { ...p, healthScore: Math.min(100, p.healthScore + 3), tasks: updatedTasks };
            })
          );
          Alert.alert('Task Archived', 'Maintenance task completed and logged to permanent service history.');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a maintenance task title.');
      return;
    }

    try {
      setSubmittingTask(true);
      await new Promise((res) => setTimeout(res, 600));

      const newTask: MaintenanceTaskItem = {
        id: `t-${Math.random().toString(36).substring(2, 8)}`,
        systemName: newSystemName,
        taskTitle: newTaskTitle.trim(),
        dueDate: format(addDays(new Date(), 14), 'MMM d, yyyy'),
        status: 'upcoming',
        cost: newTaskCost ? Number(newTaskCost) : null,
        notes: newTaskNotes.trim(),
      };

      setProperties((prev) =>
        prev.map((p) => (p.id === activeProp.id ? { ...p, tasks: [newTask, ...p.tasks] } : p))
      );

      Alert.alert('Service Scheduled', `"${newTaskTitle}" added to maintenance timeline.`);
      setTaskModalVisible(false);
      setNewTaskTitle('');
      setNewTaskCost('');
      setNewTaskNotes('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingTask(false);
    }
  };

  const filteredTasks = activeProp.tasks.filter((t) => t.status === taskFilter);

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-pageBg p-6 pt-16">
        <Skeleton width={180} height={36} borderRadius={12} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={180} borderRadius={24} style={{ marginBottom: 16 }} />
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
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-white border border-navy-border items-center justify-center">
              <MaterialIcons name="arrow-back" size={20} color="#0F1C28" />
            </TouchableOpacity>
            <View>
              <Text className="text-[11px] text-navy-muted uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
                System Telemetry
              </Text>
              <Text className="text-[30px] text-navy leading-tight" style={{ fontFamily: 'Cormorant_300Light' }}>
                Property Health
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setTaskModalVisible(true)}
            className="bg-navy px-3.5 py-2.5 rounded-[14px] flex-row items-center shadow-sm"
          >
            <MaterialIcons name="add-task" size={16} color="#FFFFFF" />
            <Text className="text-white text-[12px] ml-1 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              Add Service
            </Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 mt-6">
          {/* Property Selector Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5 flex-row">
            {properties.map((p) => {
              const isSelected = p.id === activeProp.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedPropId(p.id)}
                  className={`px-4 py-2.5 rounded-full mr-2 border flex-row items-center ${
                    isSelected ? 'bg-navy border-navy' : 'bg-white border-navy-border'
                  }`}
                >
                  <Text
                    className={`text-[13px] ${isSelected ? 'text-white font-bold' : 'text-navy-muted'}`}
                    style={{ fontFamily: isSelected ? 'DMSans_700Bold' : 'DMSans_500Medium' }}
                  >
                    {p.propertyName} ({p.healthScore}/100)
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ----------------------------------------------------------------- */}
          {/* APPLE BATTERY HEALTH STYLE HERO CARD (#1 & #6 Specification) */}
          {/* ----------------------------------------------------------------- */}
          <View className="bg-navy rounded-[30px] p-7 border border-navy/80 shadow-card mb-6 overflow-hidden relative">
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1 mr-3">
                <Text className="text-white/60 text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Property Health Capacity
                </Text>
                <Text className="text-white text-[24px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  {activeProp.propertyName}
                </Text>
              </View>

              {/* Health Score Circular Badge */}
              <View className="items-end">
                <View className="flex-row items-baseline">
                  <Text className="text-white text-[48px] font-light" style={{ fontFamily: 'Cormorant_300Light' }}>
                    {activeProp.healthScore}
                  </Text>
                  <Text className="text-white/60 text-[18px] ml-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                    /100
                  </Text>
                </View>

                <View className={`px-3 py-1 rounded-full border ${scoreMeta.border} bg-white/10`}>
                  <Text className="text-white text-[11px] font-bold uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                    {scoreMeta.label}
                  </Text>
                </View>
              </View>
            </View>

            {/* Health Score Gauge Bar */}
            <View className="h-3 bg-white/10 rounded-full overflow-hidden mb-6">
              <View
                className={`h-full rounded-full ${scoreMeta.bg}`}
                style={{ width: `${activeProp.healthScore}%` }}
              />
            </View>

            {/* AI Summary Banner (#6 Specification) */}
            <View className="bg-white/10 rounded-[20px] p-4 border border-white/10">
              <View className="flex-row items-center mb-1.5">
                <MaterialIcons name="auto-awesome" size={16} color="#34D399" />
                <Text className="text-emerald-400 text-[12px] uppercase font-bold ml-1.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                  AI System Health Intelligence
                </Text>
              </View>

              <Text className="text-white/90 text-[13px] leading-relaxed" style={{ fontFamily: 'DMSans_400Regular' }}>
                {activeProp.aiSummary}
              </Text>
            </View>
          </View>

          {/* ----------------------------------------------------------------- */}
          {/* MAJOR BUILDING SYSTEMS (#3 Specification) */}
          {/* ----------------------------------------------------------------- */}
          <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
            Major Building Systems Audit ({activeProp.systems.length})
          </Text>

          {activeProp.systems.map((sys) => {
            const isDue = sys.status === 'service_due';

            return (
              <View
                key={sys.id}
                className="bg-white rounded-[24px] p-5 border border-navy-border shadow-card mb-4"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className={`w-11 h-11 rounded-[14px] items-center justify-center mr-3 ${
                      isDue ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                    }`}>
                      <MaterialIcons
                        name={
                          sys.category === 'hvac'
                            ? 'ac-unit'
                            : sys.category === 'plumbing'
                            ? 'invert-colors'
                            : sys.category === 'safety'
                            ? 'shield'
                            : 'domain'
                        }
                        size={22}
                        color={isDue ? '#D97706' : '#059669'}
                      />
                    </View>

                    <View className="flex-1">
                      <Text className="text-[17px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                        {sys.name}
                      </Text>
                      <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                        Installed {sys.installDate} • Interval: {sys.intervalMonths} Mos
                      </Text>
                    </View>
                  </View>

                  <View className={`px-2.5 py-1 rounded-full border ${
                    isDue ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}>
                    <Text className={`text-[10px] uppercase font-bold ${
                      isDue ? 'text-amber-800' : 'text-emerald-700'
                    }`} style={{ fontFamily: 'DMSans_700Bold' }}>
                      {isDue ? 'Service Due' : 'Operational'}
                    </Text>
                  </View>
                </View>

                {sys.notes && (
                  <Text className="text-[13px] text-navy-muted mb-3 bg-pageBg p-3 rounded-[14px] border border-navy-border/50" style={{ fontFamily: 'DMSans_400Regular' }}>
                    💡 {sys.notes}
                  </Text>
                )}

                <View className="flex-row items-center justify-between pt-2 border-t border-navy-border/60">
                  <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                    Last Service: <Text className="font-bold">{sys.lastServiceDate}</Text>
                  </Text>

                  <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                    Next Due: <Text className="font-bold text-navy">{sys.nextDueDate}</Text>
                  </Text>
                </View>
              </View>
            );
          })}

          {/* ----------------------------------------------------------------- */}
          {/* CHRONOLOGICAL MAINTENANCE TIMELINE (#4 Specification) */}
          {/* ----------------------------------------------------------------- */}
          <View className="flex-row justify-between items-center mt-4 mb-3">
            <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              Maintenance Timeline
            </Text>

            {/* Filter Pills */}
            <View className="flex-row gap-1 bg-white p-1 rounded-full border border-navy-border">
              {(['upcoming', 'completed', 'overdue'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setTaskFilter(f)}
                  className={`px-3 py-1 rounded-full ${
                    taskFilter === f ? 'bg-navy' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-[11px] capitalize ${
                      taskFilter === f ? 'text-white font-bold' : 'text-navy-muted'
                    }`}
                    style={{ fontFamily: taskFilter === f ? 'DMSans_700Bold' : 'DMSans_500Medium' }}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {filteredTasks.length === 0 ? (
            <View className="bg-white rounded-[24px] p-6 border border-navy-border items-center justify-center shadow-card mb-6">
              <MaterialIcons name="event-available" size={32} color="#059669" />
              <Text className="text-[16px] text-navy font-bold mt-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                No {taskFilter} maintenance items
              </Text>
            </View>
          ) : (
            filteredTasks.map((t) => (
              <View
                key={t.id}
                className="bg-white rounded-[22px] p-5 border border-navy-border shadow-card mb-3.5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View className="w-11 h-11 rounded-[14px] bg-purple-500/10 items-center justify-center mr-3.5">
                    <MaterialIcons name="build" size={20} color="#7C3AED" />
                  </View>

                  <View className="flex-1">
                    <Text className="text-[16px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                      {t.taskTitle}
                    </Text>
                    <Text className="text-[12px] text-navy-muted mt-0.5" style={{ fontFamily: 'DMSans_400Regular' }}>
                      {t.systemName} • Due {t.dueDate}
                    </Text>
                  </View>
                </View>

                {t.status === 'upcoming' || t.status === 'overdue' ? (
                  <TouchableOpacity
                    onPress={() => handleMarkTaskComplete(t.id)}
                    className="bg-emerald-600 px-3.5 py-2 rounded-[12px] flex-row items-center"
                  >
                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                    <Text className="text-white text-[12px] font-bold ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
                      Done
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="items-end">
                    <Text className="text-[12px] text-emerald-700 font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                      Completed
                    </Text>
                    <Text className="text-[11px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                      ${t.cost || 0}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ----------------------------------------------------------------- */}
      {/* ADD MAINTENANCE ITEM MODAL (#5 Specification) */}
      {/* ----------------------------------------------------------------- */}
      <Modal visible={taskModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[24px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                Schedule Maintenance Service
              </Text>
              <TouchableOpacity onPress={() => setTaskModalVisible(false)} className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border">
                <MaterialIcons name="close" size={18} color="#0F1C28" />
              </TouchableOpacity>
            </View>

            <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              Service / Task Title *
            </Text>
            <TextInput
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="e.g. Inspect Roof Shingles & Flashing"
              className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-4"
            />

            <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              Target System
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {['HVAC & Air Conditioning', 'Plumbing & Water', 'Roof & Structure', 'Electrical & Safety'].map((sys) => (
                <TouchableOpacity
                  key={sys}
                  onPress={() => setNewSystemName(sys)}
                  className={`px-3 py-1.5 rounded-full border ${
                    newSystemName === sys ? 'bg-navy border-navy' : 'bg-pageBg border-navy-border'
                  }`}
                >
                  <Text className={`text-[12px] ${newSystemName === sys ? 'text-white font-bold' : 'text-navy-muted'}`}>
                    {sys}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              Estimated Service Cost ($)
            </Text>
            <TextInput
              value={newTaskCost}
              onChangeText={setNewTaskCost}
              placeholder="150"
              keyboardType="numeric"
              className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-4"
            />

            <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-1" style={{ fontFamily: 'DMSans_700Bold' }}>
              Notes & Vendor Details
            </Text>
            <TextInput
              value={newTaskNotes}
              onChangeText={setNewTaskNotes}
              placeholder="Contractor contact or specific filter dimensions..."
              className="bg-pageBg border border-navy-border rounded-[14px] p-3.5 text-[15px] text-navy mb-6"
            />

            <TouchableOpacity
              onPress={handleCreateTask}
              disabled={submittingTask}
              className="bg-navy py-4 rounded-[16px] items-center shadow-sm mb-2"
            >
              <Text className="text-white text-[16px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                {submittingTask ? 'Scheduling...' : 'Add to Maintenance Timeline'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
