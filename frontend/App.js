import React, { useState, useEffect, useRef } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { BACKEND_URL } from "./config";
import FloodMapScreen    from "./screens/HomeScreen";
import AlertDetailScreen from "./screens/AlertDetailScreen";
import EvacuationScreen  from "./screens/EvacuationScreen";
import RescueScreen      from "./screens/RescueScreen";
import RescuerScreen     from "./screens/RescuerScreen";
import LoginScreen       from "./screens/LoginScreen";
import SplashScreen      from "./screens/SplashScreen";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications() {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("flood-alerts", {
      name: "Flood Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1B6CA8",
    });
  }
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// FloodSense tab bar colours
const TAB_ACTIVE   = "#1B6CA8";
const TAB_INACTIVE = "#4A6F8A";
const TAB_BG       = "#0A1E35";

const TABS = [
  { name: "FloodMap", icon: "water-outline",       component: FloodMapScreen, label: "Live Map" },
  { name: "Rescuer",  icon: "people-circle-outline", component: RescuerScreen,  label: "Rescue"   },
];

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarIcon: ({ color }) => {
          const tab = TABS.find((t) => t.name === route.name);
          return <Ionicons name={tab.icon} size={22} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopWidth: 1,
          borderTopColor: "#1E3A5F",
          borderRadius: 28,
          marginHorizontal: 12,
          marginBottom: 20,
          height: 68,
          paddingTop: 10,
          paddingBottom: 10,
          position: "absolute",
          elevation: 16,
          shadowColor: "#000",
          shadowOpacity: 0.6,
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
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A1628" },
      }}
    >
      {/* Bottom tab root */}
      <Stack.Screen name="Tabs" component={AppTabs} />

      {/* Modal-style stack screens */}
      <Stack.Screen
        name="AlertDetail"
        component={AlertDetailScreen}
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="Evacuation"
        component={EvacuationScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="Rescue"
        component={RescueScreen}
        options={{ animation: "slide_from_bottom" }}
      />
    </Stack.Navigator>
  );
}

function AppRoot() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const notifListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications().then((token) => {
      if (!token) return;
      fetch(`${BACKEND_URL}/api/push/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    });

    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      Notifications.removeNotificationSubscription(notifListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [user]);

  const navTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: "#0A1628", card: "#0A1628" },
  };

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0A1628" }}>
        <ActivityIndicator size="large" color="#1B6CA8" />
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
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <SafeAreaProvider>
            <AppRoot />
          </SafeAreaProvider>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
