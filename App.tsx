import 'react-native-gesture-handler';
import React, { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';

// ── Prevent the native splash from auto-hiding so we control the transition ──
// This eliminates the white flash between native splash and our JS animation.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or not supported on this device — safe to ignore.
});

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  const onLayout = useCallback(async () => {
    // Root <View> has rendered. Hide the native splash now.
    // Our AnimatedSplashScreen (same dark #0A0818 background) takes over instantly.
    await SplashScreen.hideAsync();
  }, []);

  if (!splashDone) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0818' }} onLayout={onLayout}>
        <StatusBar style="light" backgroundColor="#0A0818" />
        <AnimatedSplashScreen onFinish={() => setSplashDone(true)} />
      </View>
    );
  }

  return (
    // Dark bg = no white flash while React Navigation first renders
    <View style={{ flex: 1, backgroundColor: '#0A0818' }}>
      <StatusBar style="light" backgroundColor="#0A0818" />
      <AppNavigator />
    </View>
  );
}
