import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

export type PlatformNotification = {
  id: string;
  title: string;
  body: string;
  type: 'payment' | 'maintenance' | 'reminder' | 'document';
  time: string;
  read: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

const SAMPLE_NOTIFICATIONS: PlatformNotification[] = [
  {
    id: 'n1',
    title: 'Rent Payment Received',
    body: 'Sarah Jenkins paid $2,450.00 for Unit 4B via Apple Pay.',
    type: 'payment',
    time: new Date(Date.now() - 1000 * 60 * 20).toISOString(), // 20 mins ago
    read: false,
  },
  {
    id: 'n2',
    title: 'Emergency Maintenance Ticket',
    body: 'Ticket #104 (Kitchen sink leak) triaged as HIGH URGENCY and dispatched.',
    type: 'maintenance',
    time: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    read: false,
  },
  {
    id: 'n3',
    title: 'Upcoming Rent Reminder',
    body: 'Monthly rent invoices for 500 King St W will process in 3 days.',
    type: 'reminder',
    time: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    read: true,
  },
  {
    id: 'n4',
    title: 'Lease Agreement Vaulted',
    body: 'Ontario Standard Lease 2026 for Unit 2A saved to Property Vault.',
    type: 'document',
    time: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    read: true,
  },
];

export default function NotificationCenterModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border max-h-[85%]">
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-navy/5 items-center justify-center mr-3">
                <MaterialIcons name="notifications-active" size={22} color="#0F1C28" />
              </View>
              <View>
                <Text className="text-[22px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
                  Notification Center
                </Text>
                <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                  Real-time rent, maintenance & vault alerts
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border"
            >
              <MaterialIcons name="close" size={18} color="#0F1C28" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {SAMPLE_NOTIFICATIONS.map((notif) => (
              <View
                key={notif.id}
                className={`p-4 rounded-[20px] border mb-3 flex-row items-start ${
                  notif.read ? 'bg-white border-navy-border/60' : 'bg-navy/5 border-navy/20'
                }`}
              >
                <View className={`w-10 h-10 rounded-[14px] items-center justify-center mr-3 ${
                  notif.type === 'payment'
                    ? 'bg-emerald-500/10'
                    : notif.type === 'maintenance'
                    ? 'bg-red-500/10'
                    : notif.type === 'reminder'
                    ? 'bg-amber-500/10'
                    : 'bg-purple-500/10'
                }`}>
                  <MaterialIcons
                    name={
                      notif.type === 'payment'
                        ? 'attach-money'
                        : notif.type === 'maintenance'
                        ? 'build'
                        : notif.type === 'reminder'
                        ? 'event'
                        : 'description'
                    }
                    size={20}
                    color={
                      notif.type === 'payment'
                        ? '#059669'
                        : notif.type === 'maintenance'
                        ? '#DC2626'
                        : notif.type === 'reminder'
                        ? '#D97706'
                        : '#7C3AED'
                    }
                  />
                </View>

                <View className="flex-1">
                  <View className="flex-row justify-between items-center mb-0.5">
                    <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                      {notif.title}
                    </Text>
                    <Text className="text-[11px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                      {format(new Date(notif.time), 'h:mm a')}
                    </Text>
                  </View>

                  <Text className="text-[13px] text-navy-muted leading-relaxed" style={{ fontFamily: 'DMSans_400Regular' }}>
                    {notif.body}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            className="bg-navy py-3.5 rounded-[16px] items-center mt-3"
          >
            <Text className="text-white text-[14px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
              Dismiss Notification Hub
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
