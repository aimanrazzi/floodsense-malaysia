import React, { useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, PanResponder, Animated, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function AccountScreen({ navigation }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const styles = makeStyles(theme);

  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 10 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SCREEN_WIDTH * 0.3) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => navigation.goBack());
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <Animated.View style={[{ flex: 1 }, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
      <SafeAreaView style={styles.container}>
        {/* Drag handle */}
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <LinearGradient
            colors={theme.isDark ? ["#1e1b4b", "#111"] : ["#ede9fe", "#fff"]}
            style={styles.header}
          >
            {/* Close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
              <Text style={[styles.closeBtnText, { color: theme.subtext }]}>✕</Text>
            </TouchableOpacity>

            {/* Avatar */}
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.accent }]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>

            <Text style={[styles.name, { color: theme.text }]}>
              {user?.displayName || "User"}
            </Text>
            <Text style={[styles.email, { color: theme.subtext }]}>{user?.email}</Text>
          </LinearGradient>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.subtext }]}>PREFERENCES</Text>
            <TouchableOpacity
              style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={toggleTheme}
            >
              <Text style={styles.rowIcon}>{theme.isDark ? "☀️" : "🌙"}</Text>
              <Text style={[styles.rowLabel, { color: theme.text }]}>
                {theme.isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              </Text>
              <Text style={[styles.rowArrow, { color: theme.subtext }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Account info */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.subtext }]}>ACCOUNT</Text>
            <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.rowIcon}>📧</Text>
              <Text style={[styles.rowLabel, { color: theme.text }]}>{user?.email}</Text>
            </View>
            <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 8 }]}>
              <Text style={styles.rowIcon}>🔐</Text>
              <Text style={[styles.rowLabel, { color: theme.text }]}>
                {user?.providerData?.[0]?.providerId === "google.com"
                  ? "Signed in with Google"
                  : "Signed in with Email"}
              </Text>
            </View>
          </View>

          {/* Sign out */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
              <Text style={styles.signOutText}>🚪  Sign Out</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.version, { color: theme.subtext }]}>ScamShield v1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: theme.border,
    alignSelf: "center", marginTop: 10, marginBottom: 4,
  },
  header: {
    alignItems: "center",
    paddingTop: 20, paddingBottom: 24, paddingHorizontal: 20,
    position: "relative",
  },
  closeBtn: {
    position: "absolute", top: 16, right: 16,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: theme.border,
    alignItems: "center", justifyContent: "center",
  },
  closeBtnText: { fontSize: 14, fontWeight: "700" },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatarInitials: { color: "#fff", fontSize: 28, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "700", marginBottom: 3 },
  email: { fontSize: 13 },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  row: {
    flexDirection: "row", alignItems: "center",
    padding: 14, borderRadius: 12, borderWidth: 1, gap: 12,
  },
  rowIcon: { fontSize: 18, width: 28 },
  rowLabel: { flex: 1, fontSize: 14 },
  rowArrow: { fontSize: 20 },
  signOutBtn: {
    backgroundColor: "#ef444420", borderWidth: 1,
    borderColor: "#ef4444", borderRadius: 12,
    padding: 15, alignItems: "center",
  },
  signOutText: { color: "#ef4444", fontWeight: "700", fontSize: 15 },
  version: { textAlign: "center", fontSize: 12, marginTop: 24, marginBottom: 40 },
});
