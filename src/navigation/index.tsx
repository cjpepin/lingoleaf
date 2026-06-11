/**
 * Root navigation
 * Bottom tabs with stack navigation for Reader
 */

import React, { useEffect, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from './types';
import { isWebDemo, webLinkingPrefix } from '@/demo/config';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useTranslation } from '@/i18n/useTranslation';
import { colors } from '@/theme';
import { AppLoadingSplash } from '@/components/AppLoadingSplash';
import { AuthErrorScreen } from '@/components/AuthErrorScreen';
import { SoftPremiumInterstitial } from '@/components/premium/SoftPremiumInterstitial';
import { PremiumBadge } from '@/components/premium/PremiumBadge';

// Screens
import AuthScreen from '@/screens/AuthScreen';
import HomeScreen from '@/screens/HomeScreen';
import LibraryScreen from '@/screens/LibraryScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import ReaderScreen from '@/screens/ReaderScreen';
import StudyScreen from '@/screens/StudyScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import MyProgressScreen from '@/screens/MyProgressScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import AdminScreen from '@/screens/AdminScreen';
import FlashcardsScreen from '@/screens/FlashcardsScreen';
import BookDetailsScreen from '@/screens/BookDetailsScreen';
import AnalyticsDebugScreen from '@/screens/AnalyticsDebugScreen';
import PaywallScreen from '@/screens/PaywallScreen';
import { screen as trackScreen, redactedScreenParams } from '@/analytics/client';
import { usePremium } from '@/premium/PremiumProvider';
import { useAdUpsellStore } from '@/state/useAdUpsellStore';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const webDemoLinking = {
  prefixes: [webLinkingPrefix()],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Library: 'library',
          History: 'history',
          Home: '',
          Study: 'study',
          Profile: 'profile',
        },
      },
      Reader: 'reader/:bookId',
      BookDetails: 'book/:bookId',
      Auth: 'auth',
      Paywall: 'paywall',
      Settings: 'settings',
      MyProgressScreen: 'progress',
      Flashcards: 'flashcards',
    },
  },
};

function MainTabs() {
  const t = useTranslation();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          title: t('app.title'),
          tabBarLabel: t('nav.library'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="book-open" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: t('nav.myBooks'),
          tabBarLabel: t('nav.myBooks'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="bookmark" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('nav.home'),
          tabBarLabel: t('nav.home'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Study"
        component={StudyScreen}
        options={{
          title: t('nav.studyWords'),
          tabBarLabel: t('nav.study'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="layers" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('nav.profile'),
          tabBarLabel: t('nav.profile'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { loading, authError, user } = useAuthStore();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const hydrateAdUpsell = useAdUpsellStore((s) => s.hydrate);
  const { isPremium } = usePremium();
  const t = useTranslation();
  const routeNameRef = useRef<string>('');

  useEffect(() => {
    if (user) loadSettings(user.id);
  }, [user, loadSettings]);

  useEffect(() => {
    void hydrateAdUpsell();
  }, [hydrateAdUpsell]);

  if (loading) {
    return <AppLoadingSplash />;
  }

  if (authError && !user) {
    return <AuthErrorScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={isWebDemo() ? webDemoLinking : undefined}
      onReady={() => {
        const route = navigationRef.getCurrentRoute();
        const routeName = route?.name ?? 'unknown';
        routeNameRef.current = routeName;
        trackScreen(routeName, redactedScreenParams(route?.params));
      }}
      onStateChange={() => {
        const route = navigationRef.getCurrentRoute();
        const nextName = route?.name ?? 'unknown';
        if (routeNameRef.current !== nextName) {
          routeNameRef.current = nextName;
          trackScreen(nextName, redactedScreenParams(route?.params));
        }
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerBackTitleVisible: false,
          presentation: 'card',
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ title: t('nav.account'), presentation: 'modal' }}
        />
        <Stack.Screen
          name="Reader"
          component={ReaderScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BookDetails"
          component={BookDetailsScreen}
          options={{
            title: t('nav.book'),
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{
            title: t('profile.premiumTitle'),
            headerRight: () => (isPremium ? <PremiumBadge /> : null),
          }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('nav.settings') }} />
        <Stack.Screen name="MyProgressScreen" component={MyProgressScreen} options={{ title: t('progress.title') }} />
        {__DEV__ ? (
          <Stack.Screen name="AnalyticsDebug" component={AnalyticsDebugScreen} options={{ title: 'Analytics Debug' }} />
        ) : null}
        <Stack.Screen name="Admin" component={AdminScreen} options={{ title: t('nav.adminPanel') }} />
        <Stack.Screen name="Flashcards" component={FlashcardsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
      <SoftPremiumInterstitial />
    </NavigationContainer>
  );
}
