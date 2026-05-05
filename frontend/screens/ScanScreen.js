import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import QRScreen from "./QRScreen";
import ProfileCheckScreen from "./ProfileCheckScreen";

export default function ScanScreen() {
  const { theme } = useTheme();
  const [tab, setTab] = useState("qr");
  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Toggle */}
      <View style={styles.toggleWrap}>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, tab === "qr" && { backgroundColor: theme.accent }]}
            onPress={() => setTab("qr")}
          >
            <Text style={[styles.toggleText, { color: tab === "qr" ? "#fff" : theme.subtext }]}>
              ⬛ QR Scanner
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, tab === "profile" && { backgroundColor: theme.accent }]}
            onPress={() => setTab("profile")}
          >
            <Text style={[styles.toggleText, { color: tab === "profile" ? "#fff" : theme.subtext }]}>
              👤 Profile Check
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === "qr" ? <QRScreen embedded /> : <ProfileCheckScreen embedded />}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  toggleWrap: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: theme.background,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleText: { fontWeight: "700", fontSize: 13 },
});
