import { Stack, useRouter, useSegments, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme, Linking, View, Text, TouchableOpacity } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

import { useFonts } from 'expo-font';
import { Cormorant_300Light, Cormorant_400Regular } from '@expo-google-fonts/cormorant';
import { DMSans_400Regular, DMSans_700Bold } from '@expo-google-fonts/dm-sans';

import '../global.css';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, isLoading, role, roleError, refreshRole } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    Cormorant_300Light,
    Cormorant_400Regular,
    DMSans_400Regular,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    const handleUrl = async (url: string) => {
      const fragment = url.split('#')[1];
      if (!fragment) return;
      const params = Object.fromEntries(new URLSearchParams(fragment));
      if (params.access_token && params.refresh_token) {
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (params.type === 'invite' || params.type === 'recovery') {
          router.replace('/(auth)/set-password');
        }
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (isLoading || !fontsLoaded) return;
    // roleError means the lookup genuinely failed (network/DB), not that
    // this is a brand-new user — don't route anywhere until it's resolved,
    // and make sure the splash screen doesn't hide on nothing (render
    // below shows a real retry screen instead).
    if (roleError) { SplashScreen.hideAsync(); return; }
    if (role === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inSetPassword = segments[1] === 'set-password';
    const inOnboarding = segments[0] === '(onboarding)';
    // The portfolio-import step runs AFTER account creation (role is no
    // longer 'new_user' by then) — exempt it from the "kick non-new-users
    // out of onboarding" rule below, the same way set-password is exempted.
    const inPortfolioImport = segments[1] === 'import';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/role-select');
    } else if (session) {
      if (role === 'new_user' && !inOnboarding) {
        router.replace('/(onboarding)/landlord');
      } else if (role !== 'new_user' && (inAuthGroup || inOnboarding) && !inSetPassword && !inPortfolioImport) {
        router.replace('/(tabs)');
      } else {
        SplashScreen.hideAsync();
      }
    } else {
      SplashScreen.hideAsync();
    }
  }, [session, isLoading, fontsLoaded, segments, router, role, roleError]);

  if (!isLoading && fontsLoaded && roleError) {
    return (
      <View className="flex-1 bg-pageBg justify-center items-center px-8">
        <Text className="text-navy font-sansBold text-xl mb-2 text-center">Couldn&apos;t verify your account</Text>
        <Text className="text-navy-muted font-sans text-center mb-6">
          Check your connection and try again. Nothing has been changed.
        </Text>
        <TouchableOpacity onPress={() => refreshRole()} className="bg-navy px-6 py-4 rounded-2xl">
          <Text className="text-white font-sansBold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
