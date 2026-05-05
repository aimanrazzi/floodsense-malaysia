import React, { useState, useRef, useEffect } from "react"; // eslint-disable-line
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useLang } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { translations } from "../utils/translations";

import { securePost } from "../utils/api";

let profileIcon = null;
try { profileIcon = require("../assets/profile_icon.png"); } catch {}

export default function ProfileCheckScreen({ embedded = false }) {
  const { lang } = useLang();
  const t = translations[lang] || translations.en;
  const { theme } = useTheme();
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scoreAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (result) {
      Animated.timing(scoreAnim, {
        toValue: result.score,
        duration: 800,
        useNativeDriver: false,
      }).start();
    } else {
      scoreAnim.setValue(0);
    }
  }, [result]);

  const styles = makeStyles(theme);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Permission to access photos is required.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.3,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!picked.canceled) {
      setImage(picked.assets[0]);
      setResult(null);
      setError(null);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is required.");
      return;
    }
    const taken = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.3,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!taken.canceled) {
      setImage(taken.assets[0]);
      setResult(null);
      setError(null);
    }
  };

  const checkProfile = async () => {
    if (!image) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await securePost("/check-profile", { image: image.base64, lang });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not connect to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  const getStatusColor = (status) => {
    if (status === "SAFE") return theme.safe;
    if (status === "SUSPICIOUS") return theme.warning;
    return theme.danger;
  };

  const Wrap = embedded ? View : SafeAreaView;

  return (
    <Wrap style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t.profileTitle}</Text>
        <Text style={styles.subtitle}>{t.profileSubtitle}</Text>

        {/* Image preview */}
        {image ? (
          <View style={styles.imageBox}>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeBtn} onPress={reset}>
              <Text style={styles.removeBtnText}>✕ Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadBox}>
            {profileIcon
              ? <Image source={profileIcon} style={styles.uploadIcon} resizeMode="contain" />
              : <Text style={{ fontSize: 56, marginBottom: 12 }}>👤</Text>
            }
            <Text style={styles.uploadText}>{t.profileSubtitle}</Text>
            <View style={styles.imageButtonRow}>
              <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                <Text style={styles.imageButtonText} numberOfLines={1} adjustsFontSizeToFit>{t.uploadPhoto}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
                <Text style={styles.imageButtonText} numberOfLines={1} adjustsFontSizeToFit>{t.takePhoto}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Check button */}
        {image && !result && (
          <TouchableOpacity
            style={[styles.checkButtonWrap, loading && { opacity: 0.5 }]}
            onPress={checkProfile}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#818cf8", "#6366f1", "#4f46e5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.checkButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.checkButtonText} numberOfLines={1} adjustsFontSizeToFit>🔍 {t.checkProfileBtn}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Result */}
        {result && (
          <View style={styles.resultCard}>
            <LinearGradient
              colors={
                result.status === "SAFE"
                  ? ["#16a34a", "#22c55e"]
                  : result.status === "SUSPICIOUS"
                  ? ["#b45309", "#f59e0b"]
                  : ["#991b1b", "#ef4444"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.statusBanner}
            >
              <Text style={styles.statusBannerText}>
                {result.status === "SAFE" ? `✅ ${t.looksGenuine}` : result.status === "SUSPICIOUS" ? `⚠️ ${t.suspicious}` : `🚨 ${t.likelyFake}`}
              </Text>
            </LinearGradient>

            {/* Animated score bar */}
            <Text style={styles.scoreLabel}>{t.suspicionScore}: <Text style={{ color: getStatusColor(result.status), fontWeight: "bold" }}>{result.score}/100</Text></Text>
            <View style={styles.scoreBarBg}>
              <Animated.View style={[styles.scoreBarFill, {
                width: scoreAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
                backgroundColor: getStatusColor(result.status),
              }]} />
            </View>

            {/* Analysis */}
            <Text style={styles.sectionLabel}>{t.whatWeFound}</Text>
            {result.findings && result.findings.length > 0 ? (
              <View style={styles.findingsList}>
                {result.findings.map((f, i) => (
                  <View key={i} style={styles.findingRow}>
                    <Text style={styles.findingBullet}>•</Text>
                    <Text style={styles.findingText}>{f}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.reasonText}>{result.reason}</Text>
            )}

            {/* Flags */}
            <View style={styles.flagsRow}>
              <View style={[styles.flagBox, { borderColor: result.ai_generated ? theme.danger : theme.border }]}>
                <Text style={styles.flagIcon}>{result.ai_generated ? "🤖" : "✅"}</Text>
                <Text style={[styles.flagText, { color: result.ai_generated ? theme.danger : theme.safe }]}>
                  {result.ai_generated ? t.aiGenerated : t.notAiGenerated}
                </Text>
              </View>
              <View style={[styles.flagBox, { borderColor: result.looks_like_stock ? theme.warning : theme.border }]}>
                <Text style={styles.flagIcon}>{result.looks_like_stock ? "📸" : "✅"}</Text>
                <Text style={[styles.flagText, { color: result.looks_like_stock ? theme.warning : theme.safe }]}>
                  {result.looks_like_stock ? t.stockPhoto : t.notStockPhoto}
                </Text>
              </View>
            </View>

            {/* Identified person from reverse image search */}
            {result.person_name && (
              <View style={styles.handleBox}>
                <Text style={styles.handleLabel}>{t.personIdentified}</Text>
                <Text style={styles.handleValue}>{result.person_name}</Text>
                {result.person_type ? <Text style={styles.handleType}>{result.person_type}</Text> : null}
              </View>
            )}

            {/* Detected social media handle from image */}
            {!result.person_name && result.detected_handle && (
              <View style={styles.handleBox}>
                <Text style={styles.handleLabel}>
                  {result.detected_platform ? `${result.detected_platform} Account Detected` : "Social Media Account Detected"}
                </Text>
                <Text style={styles.handleValue}>{result.detected_handle}</Text>
              </View>
            )}

            {/* Impersonation warning */}
            {result.impersonation_warning && (
              <View style={styles.impersonationBox}>
                <Text style={styles.impersonationTitle}>⚠️ {t.impersonationRisk}</Text>
                <Text style={styles.impersonationText}>{result.impersonation_warning}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.resetButton} onPress={reset}>
              <Text style={styles.resetButtonText}>{t.checkAnotherPhoto}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </Wrap>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  scroll: { padding: 20, paddingBottom: 110 },
  title: { fontSize: 28, fontWeight: "900", color: theme.text, marginTop: 10, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: theme.subtext, marginBottom: 20, lineHeight: 22 },
  uploadBox: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderStyle: "dashed",
    padding: 36,
    alignItems: "center",
    marginBottom: 16,
  },
  uploadIcon: { width: 80, height: 80, marginBottom: 12 },
  uploadText: { color: theme.subtext, fontSize: 14, marginBottom: 16, textAlign: "center" },
  imageButtonRow: { flexDirection: "row", gap: 10 },
  imageButton: {
    backgroundColor: theme.background,
    borderWidth: 1.5,
    borderColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  imageButtonText: { color: theme.accent, fontSize: 13, fontWeight: "600" },
  imageBox: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
    alignItems: "center",
    backgroundColor: theme.surface,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  imagePreview: { width: 180, height: 180, borderRadius: 90 },
  removeBtn: { marginTop: 10, padding: 8 },
  removeBtnText: { color: theme.danger, fontSize: 13 },
  checkButtonWrap: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  checkButton: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  checkButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16, letterSpacing: 0.5 },
  statusBanner: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  statusBannerText: { color: "#fff", fontWeight: "bold", fontSize: 17 },
  errorBox: {
    backgroundColor: theme.danger + "22",
    borderColor: theme.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  errorText: { color: theme.danger, fontSize: 14 },
  resultCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  statusText: { fontWeight: "bold", fontSize: 16 },
  scoreLabel: { color: theme.subtext, fontSize: 13, marginBottom: 8 },
  scoreBarBg: {
    backgroundColor: theme.border,
    borderRadius: 999,
    height: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  scoreBarFill: { height: "100%", borderRadius: 999 },
  sectionLabel: { color: theme.subtext, fontSize: 12, marginBottom: 6 },
  reasonText: { color: theme.text, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  findingsList: { marginBottom: 16 },
  findingRow: { flexDirection: "row", marginBottom: 6 },
  findingBullet: { color: theme.accent, fontSize: 14, marginRight: 8, lineHeight: 22 },
  findingText: { color: theme.text, fontSize: 14, lineHeight: 22, flex: 1 },
  flagsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  flagBox: {
    flex: 1,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  flagIcon: { fontSize: 22 },
  flagText: { fontSize: 12, fontWeight: "bold", textAlign: "center" },
  resetButton: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  resetButtonText: { color: theme.subtext, fontSize: 14 },
  handleBox: {
    backgroundColor: theme.accentBg,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  handleLabel: {
    color: theme.subtext,
    fontSize: 11,
    marginBottom: 4,
  },
  handleValue: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: "bold",
  },
  handleType: {
    color: theme.subtext,
    fontSize: 12,
    marginTop: 2,
  },
  impersonationBox: {
    backgroundColor: theme.warning + "18",
    borderWidth: 1,
    borderColor: theme.warning,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  impersonationTitle: {
    color: theme.warning,
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 6,
  },
  impersonationText: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 20,
  },
});
