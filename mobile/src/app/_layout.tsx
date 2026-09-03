import { Stack, useRouter, useSegments, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme, Linking, View, Text, TouchableOpacity } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import AnimatedSplash from '../components/AnimatedSplash';

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

  // Swap the static native splash for the animated brand moment as soon as
  // JS takes over, rather than leaving the plain logo up for however long
  // fonts/auth take to resolve. splashAnimDone tracks whether the fixed
  // animation sequence has played through; the overlay stays up until both
  // that AND the real app (fonts + role resolved) are ready, whichever is
  // longer, so it never gets cut off early on a slow network.
  const [splashAnimDone, setSplashAnimDone] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

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

  // Real readiness: fonts + the auth/role check have both resolved (either
  // to a usable role or a definitive error). The overlay stays up until
  // this AND the animation's own fixed sequence are both done.
  const appReady = !isLoading && fontsLoaded && (role !== null || !!roleError);
  const showSplashOverlay = !splashAnimDone || !appReady;

  if (!isLoading && fontsLoaded && roleError) {
    return (
      <>
        <View className="flex-1 bg-pageBg justify-center items-center px-8">
          <Text className="text-navy font-sansBold text-xl mb-2 text-center">Couldn&apos;t verify your account</Text>
          <Text className="text-navy-muted font-sans text-center mb-6">
            Check your connection and try again. Nothing has been changed.
          </Text>
          <TouchableOpacity onPress={() => refreshRole()} className="bg-navy px-6 py-4 rounded-2xl">
            <Text className="text-white font-sansBold">Try Again</Text>
          </TouchableOpacity>
        </View>
        {showSplashOverlay && <AnimatedSplash onFinish={() => setSplashAnimDone(true)} />}
      </>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack>
      {showSplashOverlay && <AnimatedSplash onFinish={() => setSplashAnimDone(true)} />}
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
