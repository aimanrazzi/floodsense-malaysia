import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Pressable, Image, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import HomeScreen from "./HomeScreen";
import QRScreen from "./QRScreen";
import ProfileCheckScreen from "./ProfileCheckScreen";
import { BACKEND_URL } from "../config";

const SCAN_TABS = [
  { key: "check",   label: "Check"   },
  { key: "qr",      label: "QR scan" },
  { key: "profile", label: "Profile" },
];

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "ms", label: "MY" },
  { code: "zh", label: "ZH" },
  { code: "ta", label: "TA" },
];

export default function MainScreen({ navigation }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { lang, changeLang } = useLang();
  const [tab, setTab] = useState("check");
  const [langDropdown, setLangDropdown] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const styles = makeStyles(theme);

  // Ping backend on mount to wake it up before user interacts
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`, { method: "GET" })
      .then(() => setServerReady(true))
      .catch(() => setServerReady(false));
  }, []);

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  const currentLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <LinearGradient colors={theme.backgroundGradient} style={{ flex: 1 }}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.appName}>Combat.</Text>
          {!serverReady && <View style={styles.connectingDot} />}
        </View>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.langPill} onPress={() => setLangDropdown(true)}>
            <Text style={styles.langText}>{currentLang.label} ▾</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={toggleTheme}
          >
            <View style={[styles.toggleTrack, theme.isDark && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, theme.isDark && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate("Account")}
          >
            {user?.photoURL
              ? <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
              : <Text style={styles.avatarText}>{initials}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Segment pills */}
      <View style={styles.segmentWrap}>
        {SCAN_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.segBtn, tab === t.key && styles.segBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.segText, tab === t.key && styles.segTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === "check"   && <HomeScreen embedded />}
        {tab === "qr"      && <QRScreen embedded />}
        {tab === "profile" && <ProfileCheckScreen embedded />}
      </View>

      {/* Language dropdown modal */}
      <Modal transparent visible={langDropdown} animationType="fade" onRequestClose={() => setLangDropdown(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setLangDropdown(false)}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Language</Text>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.dropdownItem, lang === l.code && styles.dropdownItemActive]}
                onPress={() => { changeLang(l.code); setLangDropdown(false); }}
              >
                <Text style={[styles.dropdownLabel, lang === l.code && { color: theme.accent }]}>
                  {l.label}
                </Text>
                {lang === l.code && <Text style={{ color: theme.accent }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  connectingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fbbf24" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
  },
  appName: { fontSize: 22, fontWeight: "900", color: theme.text, letterSpacing: -0.5 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  langPill: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  langText: { color: theme.text, fontSize: 13, fontWeight: "600" },
  toggleBtn: { justifyContent: "center", alignItems: "center" },
  toggleTrack: {
    width: 40, height: 22, borderRadius: 11,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleTrackOn: { backgroundColor: "rgba(167,139,250,0.5)" },
  toggleThumb: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
    alignSelf: "flex-start",
  },
  toggleThumbOn: { alignSelf: "flex-end", backgroundColor: "#a78bfa" },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#7c3aed",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  segmentWrap: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  segBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  segBtnActive: {
    backgroundColor: theme.accentBg,
    borderColor: theme.accent,
  },
  segText: { color: theme.subtext, fontWeight: "600", fontSize: 13 },
  segTextActive: { color: theme.accent, fontWeight: "700" },
  modalOverlay: {
    flex: 1, backgroundColor: "#00000066",
    justifyContent: "flex-start", alignItems: "flex-end",
    paddingTop: 100, paddingRight: 20,
  },
  dropdown: {
    backgroundColor: theme.surface,
    borderRadius: 14, borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 8, minWidth: 130,
    shadowColor: "#000", shadowOpacity: 0.4,
    shadowRadius: 10, elevation: 10,
  },
  dropdownTitle: {
    fontSize: 11, fontWeight: "700", color: theme.subtext,
    letterSpacing: 0.5, paddingHorizontal: 16, paddingBottom: 8,
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dropdownItemActive: { backgroundColor: theme.accentBg },
  dropdownLabel: { fontSize: 15, fontWeight: "600", color: theme.text },
});
