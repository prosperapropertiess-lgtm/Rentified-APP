import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TenantCollectionItem, PaymentMethodType } from '../../app/(tabs)/payments';

type Props = {
  visible: boolean;
  tenant: TenantCollectionItem | null;
  onClose: () => void;
  onConfirm: (method: PaymentMethodType) => Promise<void>;
};

export default function MarkPaidModal({ visible, tenant, onClose, onConfirm }: Props) {
  const [selectedPayMethod, setSelectedPayMethod] = useState<PaymentMethodType>('e-Transfer');
  const [confirming, setConfirming] = useState(false);

  if (!tenant) return null;

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      await onConfirm(selectedPayMethod);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-[32px] p-6 border-t border-navy-border">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-[22px] text-navy font-bold" style={{ fontFamily: 'Cormorant_400Regular' }}>
              Confirm Rent Receipt
            </Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-pageBg items-center justify-center border border-navy-border">
              <MaterialIcons name="close" size={18} color="#0F1C28" />
            </TouchableOpacity>
          </View>

          <Text className="text-[14px] text-navy leading-relaxed mb-4" style={{ fontFamily: 'DMSans_400Regular' }}>
            Confirm you have received this month&apos;s rent of{' '}
            <Text className="font-bold text-emerald-700">${tenant.monthlyRent.toLocaleString()}</Text> from{' '}
            <Text className="font-bold text-navy">{tenant.name}</Text> ({tenant.unit})?
          </Text>

          <Text className="text-[11px] text-navy-muted uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'DMSans_700Bold' }}>
            Select Payment Channel
          </Text>

          <TouchableOpacity
            onPress={() => setSelectedPayMethod('e-Transfer')}
            className={`p-4 rounded-[18px] border mb-3 flex-row items-center justify-between ${
              selectedPayMethod === 'e-Transfer' ? 'bg-navy/5 border-navy' : 'bg-pageBg border-navy-border'
            }`}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="account-balance" size={22} color="#0F1C28" />
              <View className="ml-3">
                <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Manual Interac e-Transfer 🇨🇦
                </Text>
                <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                  Confirmed via bank transfer / direct deposit
                </Text>
              </View>
            </View>
            {selectedPayMethod === 'e-Transfer' && <MaterialIcons name="check-circle" size={20} color="#0F1C28" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedPayMethod('Stripe')}
            className={`p-4 rounded-[18px] border mb-6 flex-row items-center justify-between ${
              selectedPayMethod === 'Stripe' ? 'bg-navy/5 border-navy' : 'bg-pageBg border-navy-border'
            }`}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="credit-card" size={22} color="#0F1C28" />
              <View className="ml-3">
                <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Stripe Merchant Direct
                </Text>
                <Text className="text-[12px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>
                  Auto-syncs Stripe Payment ID to database
                </Text>
              </View>
            </View>
            {selectedPayMethod === 'Stripe' && <MaterialIcons name="check-circle" size={20} color="#0F1C28" />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={confirming}
            className="bg-emerald-600 py-4 rounded-[16px] items-center shadow-sm flex-row justify-center mb-2"
          >
            {confirming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="verified-user" size={18} color="#FFFFFF" />
                <Text className="text-white text-[16px] font-bold ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
                  Confirm & Mark Paid
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
