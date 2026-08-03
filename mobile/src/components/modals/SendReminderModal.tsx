import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TenantCollectionItem } from '../../app/(tabs)/payments';

type Props = {
  visible: boolean;
  tenant: TenantCollectionItem | null;
  onClose: () => void;
  onSend: () => Promise<void>;
};

export default function SendReminderModal({ visible, tenant, onClose, onSend }: Props) {
  const [sending, setSending] = useState(false);

  if (!tenant) return null;

  const handleSend = async () => {
    try {
      setSending(true);
      await onSend();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-[22px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
              Send Friendly Rent Reminder
            </Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border">
              <MaterialIcons name="close" size={18} color="#0F1C28" />
            </TouchableOpacity>
          </View>

          <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'DMSans_700Bold' }}>
            Automated Message Preview
          </Text>

          <View className="bg-purple-500/10 border border-purple-500/20 rounded-[18px] p-4 mb-6">
            <Text className="text-[14px] text-purple-950 leading-relaxed" style={{ fontFamily: 'DMSans_400Regular' }}>
              {`Hi ${tenant.name}! Friendly reminder from Prospera Properties that rent of $${tenant.monthlyRent.toLocaleString()} for ${tenant.unit} is due today. You can pay via Apple Pay in your tenant portal or e-Transfer to payments@rentified.ca. Thank you!`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={sending}
            className="bg-purple-600 py-4 rounded-[16px] items-center shadow-sm flex-row justify-center mb-2"
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="send" size={18} color="#FFFFFF" />
                <Text className="text-white text-[16px] font-bold ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Deliver SMS Reminder to {tenant.phone}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
