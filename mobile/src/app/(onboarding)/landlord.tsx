import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const { width, height } = Dimensions.get('window');

const ONBOARDING_STEPS = [
  {
    title: "See Everything.\nMiss Nothing.",
    description: "Rent status, maintenance requests, lease dates, and every document — one dashboard, updated in real time. No more piecing it together from texts and spreadsheets.",
    icon: "visibility",
    color: "#8B2030" // Burgundy
  },
  {
    title: "We Catch What\nYou'd Miss",
    description: "Rent reminders send themselves. Appliance service dates track themselves. Legal notices are built in and done right. You stay ahead without carrying it all in your head.",
    icon: "shield",
    color: "#1F2F3A" // Navy
  },
  {
    title: "Your Whole Portfolio,\nIn Your Pocket",
    description: "Collect rent, message residents, and handle maintenance requests from wherever you are. Property management that fits your life instead of running it.",
    icon: "phone-iphone",
    color: "#8B2030"
  },
  {
    title: "Welcome to\nRentified.",
    description: "Let's create your owner profile.",
    icon: "person",
    color: "#1F2F3A"
  }
];

export default function LandlordSetup() {
  const router = useRouter();
  const { session, refreshRole } = useAuth();
  
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const currentStep = Math.round(offsetX / width);
    if (currentStep !== step) setStep(currentStep);
  };

  const handleNext = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      scrollRef.current?.scrollTo({ x: (step + 1) * width, animated: true });
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'Please enter your first and last name.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert('Required', 'Please set a 4-digit PIN — this is how you\'ll sign in from now on.');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'No active session found.');
      return;
    }

    try {
      setLoading(true);
      // pin has a unique DB constraint as the backstop — don't silently
      // swap the PIN they chose on collision, ask them to pick a different one.
      const { error } = await supabase.from('landlords').insert({
        user_id: session.user.id,
        email: session.user.email,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        pin,
      });

      if (error?.code === '23505') {
        setLoading(false);
        Alert.alert('PIN already in use', 'That PIN is taken — please choose a different 4-digit PIN.');
        return;
      }
      if (error) throw error;
      // Navigate BEFORE refreshing the role — the root layout's global
      // redirect guard reacts to role changes, and if role flips to
      // 'owner' while segments still point at /(onboarding)/landlord (not
      // yet /import), the guard reads that as "onboarding's done" and
      // force-redirects straight to /(tabs), skipping the import screen
      // entirely. Navigating first means segments already say /import by
      // the time the guard sees the new role, so its exemption for this
      // route actually applies.
      router.replace('/(onboarding)/import');
      await refreshRole();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to create profile.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-pageBg" 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background Decor */}
      <View className="absolute -top-[100px] -right-[50px] w-[300px] h-[300px] rounded-full bg-burgundy/5" />
      <View className="absolute top-[30%] -left-[100px] w-[200px] h-[200px] rounded-full bg-navy/5" />

      {/* Header */}
      <View className="flex-row items-center pt-16 pb-4 px-6 justify-between z-10">
        <View className="flex-row items-center gap-4">
          <TouchableOpacity 
            onPress={async () => {
              if (step > 0) {
                setStep(step - 1);
                scrollRef.current?.scrollTo({ x: (step - 1) * width, animated: true });
              } else {
                await supabase.auth.signOut();
                router.replace('/(auth)/role-select');
              }
            }} 
            className="w-10 h-10 rounded-full bg-white items-center justify-center border border-navy/10 shadow-sm"
          >
            <MaterialIcons name={step > 0 ? "arrow-back" : "close"} size={20} color="#0F1C28" />
          </TouchableOpacity>
          <Image 
            source={require('../../../assets/images/logo-glow.png')} 
            style={{ width: 140, height: 40 }}
            resizeMode="contain"
          />
        </View>
        <View className="flex-row space-x-2">
          {ONBOARDING_STEPS.map((_, i) => (
            <View 
              key={i} 
              className={`h-2 rounded-full ${i === step ? 'w-6 bg-navy' : 'w-2 bg-navy/20'}`} 
            />
          ))}
        </View>
      </View>

      <ScrollView 
        ref={scrollRef}
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
      >
        {ONBOARDING_STEPS.map((item, index) => (
          <View key={index} style={{ width }} className="flex-1 px-6 justify-center">
            
            <View className="w-20 h-20 rounded-3xl items-center justify-center mb-8 shadow-sm" style={{ backgroundColor: item.color + '15' }}>
              <MaterialIcons name={item.icon as any} size={40} color={item.color} />
            </View>

            <Text className="text-[44px] text-navy leading-tight tracking-[-0.02em] mb-4" style={{ fontFamily: 'DMSans_700Bold' }}>
              {item.title}
            </Text>
            
            <Text className="text-[18px] text-navy-muted leading-relaxed mb-10" style={{ fontFamily: 'DMSans_400Regular' }}>
              {item.description}
            </Text>

            {/* Profile Form on Last Step */}
            {index === 3 && (
              <View className="space-y-4 w-full pb-20">
                <View>
                  <Text className="text-[12px] text-navy/60 uppercase tracking-[0.1em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>First Name</Text>
                  <TextInput
                    className="w-full bg-white h-[60px] rounded-[16px] px-5 border border-navy/10 shadow-sm text-[16px] text-navy"
                    style={{ fontFamily: 'DMSans_400Regular' }}
                    placeholder="Ebin"
                    placeholderTextColor="rgba(15,28,40,0.3)"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCorrect={false}
                  />
                </View>

                <View>
                  <Text className="text-[12px] text-navy/60 uppercase tracking-[0.1em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>Last Name</Text>
                  <TextInput
                    className="w-full bg-white h-[60px] rounded-[16px] px-5 border border-navy/10 shadow-sm text-[16px] text-navy"
                    style={{ fontFamily: 'DMSans_400Regular' }}
                    placeholder="Jaison"
                    placeholderTextColor="rgba(15,28,40,0.3)"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCorrect={false}
                  />
                </View>

                <View>
                  <Text className="text-[12px] text-navy/60 uppercase tracking-[0.1em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>Phone (Optional)</Text>
                  <TextInput
                    className="w-full bg-white h-[60px] rounded-[16px] px-5 border border-navy/10 shadow-sm text-[16px] text-navy"
                    style={{ fontFamily: 'DMSans_400Regular' }}
                    placeholder="(555) 000-0000"
                    placeholderTextColor="rgba(15,28,40,0.3)"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <View>
                  <Text className="text-[12px] text-navy/60 uppercase tracking-[0.1em] mb-2 ml-1" style={{ fontFamily: 'DMSans_700Bold' }}>Choose a 4-digit PIN</Text>
                  <TextInput
                    className="w-full bg-white h-[60px] rounded-[16px] px-5 border border-navy/10 shadow-sm text-[20px] text-navy tracking-[8px]"
                    style={{ fontFamily: 'DMSans_700Bold' }}
                    placeholder="••••"
                    placeholderTextColor="rgba(15,28,40,0.3)"
                    value={pin}
                    onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                  />
                  <Text className="text-[12px] text-navy/50 mt-2 ml-1" style={{ fontFamily: 'DMSans_400Regular' }}>
                    This is how you&apos;ll sign in from now on — no password needed.
                  </Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      
      {/* Footer Pinned */}
      <View className="absolute bottom-0 w-full p-6 pb-12">
        <TouchableOpacity 
          className="w-full h-[60px] rounded-[16px] items-center justify-center shadow-lg shadow-burgundy/30"
          style={{ backgroundColor: '#8B2030', opacity: loading ? 0.7 : 1 }}
          onPress={handleNext}
          disabled={loading}
        >
          <Text className="text-white text-[17px] tracking-wide" style={{ fontFamily: 'DMSans_700Bold' }}>
            {loading ? 'Creating Profile...' : (step === 3 ? 'Go to Dashboard' : 'Continue')}
          </Text>
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}
