/**
 * Root navigation
 * Bottom tabs with stack navigation for Reader
 */

import React, { useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from './types';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useTranslation } from '@/i18n/useTranslation';
import { colors } from '@/theme';
import { AppLoadingSplash } from '@/components/AppLoadingSplash';
import { AuthErrorScreen } from '@/components/AuthErrorScreen';

// Screens
import AuthScreen from '@/screens/AuthScreen';
import LibraryScreen from '@/screens/LibraryScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import ReaderScreen from '@/screens/ReaderScreen';
import StudyScreen from '@/screens/StudyScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import AdminScreen from '@/screens/AdminScreen';
import FlashcardsScreen from '@/screens/FlashcardsScreen';
import BookDetailsScreen from '@/screens/BookDetailsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const t = useTranslation();
  return (
    <Tab.Navigator
      initialRouteName="Library"
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
          title: t('nav.history'),
          tabBarLabel: t('nav.history'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="clock" size={size} color={color} />
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
            <Feather name="bookmark" size={size} color={color} />
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
  const t = useTranslation();

  useEffect(() => {
    if (user) loadSettings(user.id);
  }, [user, loadSettings]);

  if (loading) {
    return <AppLoadingSplash />;
  }

  if (authError && !user) {
    return <AuthErrorScreen />;
  }

  return (
    <NavigationContainer>
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
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('nav.settings') }} />
        <Stack.Screen name="Admin" component={AdminScreen} options={{ title: t('nav.adminPanel') }} />
        <Stack.Screen name="Flashcards" component={FlashcardsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

