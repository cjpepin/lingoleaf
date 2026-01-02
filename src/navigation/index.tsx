/**
 * Root navigation
 * Bottom tabs with stack navigation for Reader
 */

import React, { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from './types';
import { useAuthStore } from '@/state/useAuthStore';
import { colors } from '@/theme';
import { hasReadingHistory } from '@/supabase/queries';

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
  const { user } = useAuthStore();
  const [initialTab, setInitialTab] = useState<keyof TabParamList | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      try {
        const hasHistory = await hasReadingHistory(user.id);
        if (!cancelled) setInitialTab(hasHistory ? 'History' : 'Library');
      } catch {
        if (!cancelled) setInitialTab('Library');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!initialTab) return null;

  return (
    <Tab.Navigator
      key={initialTab}
      initialRouteName={initialTab}
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
          title: 'LinguaLeaf',
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="book-open" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="clock" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Study"
        component={StudyScreen}
        options={{
          title: 'Study Words',
          tabBarLabel: 'Study',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="bookmark" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return null; // TODO: Add splash screen
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
          presentation: 'card',
        }}
      >
        {!user ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Reader"
              component={ReaderScreen}
              options={{
                title: '',
                headerBackTitle: 'Library',
              }}
            />
            <Stack.Screen
              name="BookDetails"
              component={BookDetailsScreen}
              options={{
                title: 'Book',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            <Stack.Screen
              name="Admin"
              component={AdminScreen}
              options={{ title: 'Admin Panel' }}
            />
            <Stack.Screen
              name="Flashcards"
              component={FlashcardsScreen}
              options={{ title: 'Flashcards' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

