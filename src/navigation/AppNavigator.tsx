import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  View,
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../store/authStore';

// Auth Screens
import WelcomeScreen        from '../screens/auth/WelcomeScreen';
import LoginScreen          from '../screens/auth/LoginScreen';
import RegisterScreen       from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Onboarding
import SetupProfileScreen from '../screens/onboarding/SetupProfileScreen';

// Main Screens
import HomeScreen     from '../screens/main/HomeScreen';
import LikesScreen    from '../screens/main/LikesScreen';
import ChatListScreen from '../screens/main/ChatListScreen';
import ChatScreen     from '../screens/main/ChatScreen';
import ProfileScreen  from '../screens/main/ProfileScreen';
import LikeNotification from '../components/LikeNotification';

import {
  RootStackParamList,
  AuthStackParamList,
  OnboardingStackParamList,
  MainTabParamList,
  ChatStackParamList,
} from '../types';

const RootStack    = createNativeStackNavigator<RootStackParamList>();
const AuthStack    = createNativeStackNavigator<AuthStackParamList>();
const OnboardStack = createNativeStackNavigator<OnboardingStackParamList>();
const Tab          = createBottomTabNavigator<MainTabParamList>();
const ChatStack    = createNativeStackNavigator<ChatStackParamList>();

// ─── App Logo Asset ───────────────────────────────────────────────────────────
const SPARK_LOGO = require('../../assets/logo/icon-transparent.png');

// ─── Header Logo (left side) ─────────────────────────────────────────────────
function HeaderLogo() {
  return (
    <View style={styles.headerLogoWrapper}>
      <Image source={SPARK_LOGO} style={styles.headerLogo} resizeMode="contain" />
      <Text style={styles.headerLogoText}>SPARK</Text>
    </View>
  );
}

// ─── Notification Bell (right side) ──────────────────────────────────────────
function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <TouchableOpacity style={styles.bellWrapper} activeOpacity={0.7}>
      <Ionicons name="notifications-outline" size={24} color="#FF4B6E" />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Auth Navigator ───────────────────────────────────────────────────────────
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <AuthStack.Screen name="Welcome"        component={WelcomeScreen} />
      <AuthStack.Screen name="Login"          component={LoginScreen} />
      <AuthStack.Screen name="Register"       component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Onboarding Navigator ─────────────────────────────────────────────────────
function OnboardingNavigator() {
  return (
    <OnboardStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <OnboardStack.Screen name="SetupProfile" component={SetupProfileScreen} />
    </OnboardStack.Navigator>
  );
}

// ─── Chat Stack ───────────────────────────────────────────────────────────────
function ChatNavigator() {
  return (
    <ChatStack.Navigator
      screenOptions={{
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#FF4B6E',
        headerTitleStyle: { fontWeight: '700', color: '#1a1a1a' },
        headerShadowVisible: false,
      }}
    >
      <ChatStack.Screen
        name="MatchList"
        component={ChatListScreen}
        options={{ title: 'Matches' }}
      />
      <ChatStack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({
          title: route.params.otherUser.displayName,
        })}
      />
    </ChatStack.Navigator>
  );
}

// ─── Main Tab Navigator ───────────────────────────────────────────────────────
function MainNavigator() {
  const [notifCount] = useState(0);

  return (
    <View style={{ flex: 1 }}>
    <LikeNotification />
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // ── Header ──────────────────────────────────────────────────────────
        headerShown: true,
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,           // Android: no shadow
          shadowOpacity: 0,       // iOS: no shadow
          borderBottomWidth: 1,
          borderBottomColor: '#f0f0f0',
        },
        headerShadowVisible: false,

        // Logo on the LEFT, bell on the RIGHT — Happn / Tinder pattern
        headerLeft:  () => <HeaderLogo />,
        headerTitle: () => null,          // hide default text title
        headerRight: () => <NotificationBell count={notifCount} />,

        // ── Tab bar ─────────────────────────────────────────────────────────
        tabBarActiveTintColor:   '#FF4B6E',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          backgroundColor: '#fff',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },

        // ── Tab icons ────────────────────────────────────────────────────────
        tabBarIcon: ({ color, focused }) => {
          type IconName = React.ComponentProps<typeof Ionicons>['name'];
          const icons: Record<string, { active: IconName; inactive: IconName }> = {
            Home:    { active: 'location',      inactive: 'location-outline' },
            Likes:   { active: 'heart',         inactive: 'heart-outline' },
            Matches: { active: 'chatbubbles',   inactive: 'chatbubbles-outline' },
            Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
          };
          const set = icons[route.name] ?? {
            active: 'ellipse' as IconName,
            inactive: 'ellipse-outline' as IconName,
          };
          return <Ionicons name={focused ? set.active : set.inactive} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}    options={{ tabBarLabel: 'Nearby' }} />
      <Tab.Screen name="Likes"   component={LikesScreen}   options={{ tabBarLabel: 'Likes' }} />
      <Tab.Screen name="Matches" component={ChatNavigator} options={{ tabBarLabel: 'Matches', headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile', headerShown: false }} />
    </Tab.Navigator>
    </View>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { token, profile, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  // ── Auth store still loading (token check) ────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF4B6E" />
      </View>
    );
  }

  const isAuthenticated   = !!token;
  // Profile is considered complete once the user has a bio (set in onboarding step 2).
  // We also accept hobbies OR lookingFor as a signal, but bio alone is the gate
  // so a partial save still moves the user forward rather than looping onboarding.
  const hasCompletedSetup = !!profile?.bio?.trim();

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : !hasCompletedSetup ? (
          <RootStack.Screen name="Onboarding" component={OnboardingNavigator} options={{ animation: 'fade' }} />
        ) : (
          <RootStack.Screen name="Main" component={MainNavigator} options={{ animation: 'fade' }} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  // ── Header logo ──────────────────────────────────────────────────────────
  headerLogoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    gap: 8,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerLogoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FF4B6E',
    letterSpacing: 3,
  },

  // ── Notification bell ────────────────────────────────────────────────────
  bellWrapper: {
    marginRight: 16,
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF4B6E',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
