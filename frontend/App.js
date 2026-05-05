import React, { useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

import MainScreen from "./screens/MainScreen";
import HistoryScreen from "./screens/HistoryScreen";
import TipsScreen from "./screens/TipsScreen";
import ResourcesScreen from "./screens/ResourcesScreen";
import ReportScreen from "./screens/ReportScreen";
import AccountScreen from "./screens/AccountScreen";
import LoginScreen from "./screens/LoginScreen";
import SplashScreen from "./screens/SplashScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();


const TABS = [
  { name: "Home",      icon: "shield-checkmark-outline", component: MainScreen,      label: "Check"     },
  { name: "History",   icon: "time-outline",             component: HistoryScreen,   label: "History"   },
  { name: "Tips",      icon: "bulb-outline",             component: TipsScreen,      label: "Tips"      },
  { name: "Resources", icon: "book-outline",             component: ResourcesScreen, label: "Resources" },
  { name: "Report",    icon: "call-outline",             component: ReportScreen,    label: "Report"    },
];

function AppTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: theme.background }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.subtext,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
        tabBarIcon: ({ color }) => {
          const tab = TABS.find(t => t.name === route.name);
          return <Ionicons name={tab.icon} size={22} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: theme.isDark ? "#1a0a3e" : "#ede9fe",
          borderTopWidth: 0,
          borderRadius: 32,
          marginHorizontal: 12,
          marginBottom: 20,
          height: 72,
          paddingTop: 10,
          paddingBottom: 10,
          position: "absolute",
          elevation: 16,
          shadowColor: "#000",
          shadowOpacity: 0.5,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
        },
      })}
    >
      {TABS.map(({ name, component, label }) => (
        <Tab.Screen key={name} name={name} component={component} options={{ tabBarLabel: label }} />
      ))}
    </Tab.Navigator>
  );
}

function AppStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="Tabs" component={AppTabs} />
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{
          animation: "slide_from_right",
          presentation: "transparentModal",
          contentStyle: { backgroundColor: theme.background, marginLeft: "14%", borderTopLeftRadius: 24, overflow: "hidden" },
        }}
      />
    </Stack.Navigator>
  );
}

function AppRoot() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [splashDone, setSplashDone] = useState(false);

  const navTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: theme.background, card: theme.background },
  };

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      <AppStack />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <SafeAreaProvider>
            <AppRoot />
          </SafeAreaProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
