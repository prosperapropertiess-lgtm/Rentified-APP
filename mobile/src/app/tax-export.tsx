import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TaxExportScreen() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const taxSummary = {
    taxYear: '2026',
    grossRentalIncome: 148200.0,
    deductions: {
      propertyTaxes: 14200.0,
      repairsMaintenance: 6450.0,
      insurance: 3800.0,
      utilities: 4200.0,
      managementFees: 0.0,
    },
    netRentalIncome: 119550.0,
  };

  const handleExportPDF = async () => {
    setExporting(true);
    await new Promise((res) => setTimeout(res, 900));
    setExporting(false);
    Alert.alert(
      'T776 Tax Export Ready 📄',
      `Official CRA Statement of Real Estate Rentals (T776) report for ${taxSummary.taxYear} exported to your document vault.`
    );
  };

  return (
    <View className="flex-1 bg-pageBg relative">
      <ScrollView className="flex-1 z-10 px-6 pt-16 pb-28" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-white border border-navy-border items-center justify-center">
            <MaterialIcons name="arrow-back" size={20} color="#0F1C28" />
          </TouchableOpacity>
          <View>
            <Text className="text-[11px] text-navy-muted uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              CRA Income Tax Compliance
            </Text>
            <Text className="text-[30px] text-navy leading-tight" style={{ fontFamily: 'Cormorant_300Light' }}>
              T776 Tax Export
            </Text>
          </View>
        </View>

        {/* Financial Summary Card */}
        <View className="bg-navy rounded-[28px] p-6 border border-navy/80 shadow-card mb-6 overflow-hidden">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-white/60 text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: 'DMSans_700Bold' }}>
              Net Rental Income ({taxSummary.taxYear})
            </Text>
            <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
              <Text className="text-emerald-400 text-[11px] font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>
                CRA Form T776
              </Text>
            </View>
          </View>

          <Text className="text-white text-[44px] font-light mb-4" style={{ fontFamily: 'Cormorant_300Light' }}>
            ${taxSummary.netRentalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>

          <View className="flex-row justify-between items-center pt-4 border-t border-white/10">
            <View>
              <Text className="text-white/50 text-[11px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                Gross Income
              </Text>
              <Text className="text-white text-[16px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                ${taxSummary.grossRentalIncome.toLocaleString()}
              </Text>
            </View>

            <View className="items-end">
              <Text className="text-white/50 text-[11px] uppercase" style={{ fontFamily: 'DMSans_700Bold' }}>
                Total Deductions
              </Text>
              <Text className="text-emerald-400 text-[16px] font-bold mt-0.5" style={{ fontFamily: 'DMSans_700Bold' }}>
                -${(taxSummary.grossRentalIncome - taxSummary.netRentalIncome).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Deductions Breakdown */}
        <Text className="text-[13px] text-navy-muted uppercase tracking-[0.08em] mb-3 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>
          Schedule of Rental Expenses
        </Text>

        <View className="bg-white rounded-[24px] p-5 border border-navy-border shadow-card mb-6">
          <View className="flex-row justify-between items-center py-2.5 border-b border-navy-border/50">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Property Taxes</Text>
            <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>${taxSummary.deductions.propertyTaxes.toLocaleString()}</Text>
          </View>

          <View className="flex-row justify-between items-center py-2.5 border-b border-navy-border/50">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Repairs & Maintenance</Text>
            <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>${taxSummary.deductions.repairsMaintenance.toLocaleString()}</Text>
          </View>

          <View className="flex-row justify-between items-center py-2.5 border-b border-navy-border/50">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Property Insurance</Text>
            <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>${taxSummary.deductions.insurance.toLocaleString()}</Text>
          </View>

          <View className="flex-row justify-between items-center py-2.5 border-b border-navy-border/50">
            <Text className="text-[13px] text-navy-muted" style={{ fontFamily: 'DMSans_400Regular' }}>Landlord Utilities</Text>
            <Text className="text-[15px] text-navy font-bold" style={{ fontFamily: 'DMSans_700Bold' }}>${taxSummary.deductions.utilities.toLocaleString()}</Text>
          </View>

          <TouchableOpacity
            onPress={handleExportPDF}
            disabled={exporting}
            className="bg-navy py-4 rounded-[16px] items-center shadow-sm flex-row justify-center mt-4"
          >
            <MaterialIcons name="picture-as-pdf" size={18} color="#FFFFFF" />
            <Text className="text-white text-[15px] font-bold ml-2" style={{ fontFamily: 'DMSans_700Bold' }}>
              {exporting ? 'Generating Report...' : 'Export Official T776 CRA Tax Report'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
