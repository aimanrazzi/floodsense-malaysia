import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLang } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { translations } from "../utils/translations";

export default function TipsScreen() {
  const { lang } = useLang();
  const t = translations[lang] || translations.en;
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(null);

  const styles = makeStyles(theme);

  const categories = [
    {
      title: t.tipPhishingTitle,
      color: theme.danger,
      tips: [
        t.tipPhishing1,
        t.tipPhishing2,
        t.tipPhishing3,
        t.tipPhishing4,
      ],
    },
    {
      title: t.tipJobTitle,
      color: theme.warning,
      tips: [
        t.tipJob1,
        t.tipJob2,
        t.tipJob3,
        t.tipJob4,
      ],
    },
    {
      title: t.tipFinancialTitle,
      color: theme.accent,
      tips: [
        t.tipFinancial1,
        t.tipFinancial2,
        t.tipFinancial3,
        t.tipFinancial4,
      ],
    },
    {
      title: t.tipRomanceTitle,
      color: "#ec4899",
      tips: [
        t.tipRomance1,
        t.tipRomance2,
        t.tipRomance3,
        t.tipRomance4,
      ],
    },
    {
      title: t.tipShoppingTitle,
      color: theme.safe,
      tips: [
        t.tipShopping1,
        t.tipShopping2,
        t.tipShopping3,
        t.tipShopping4,
      ],
    },
    {
      title: t.tipProtectTitle,
      color: theme.subtext,
      tips: [
        t.tipProtect1,
        t.tipProtect2,
        t.tipProtect3,
        t.tipProtect4,
        t.tipProtect5,
      ],
    },
  ];

  return (
    <LinearGradient colors={theme.backgroundGradient} style={{ flex: 1 }}>
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t.scamAwareness}</Text>
        <Text style={styles.subtitle}>{t.tipsSubtitle}</Text>

        {categories.map((cat, index) => (
          <View key={index} style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => setExpanded(expanded === index ? null : index)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardTitle}>{cat.title}</Text>
              <Text style={styles.chevron}>{expanded === index ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {expanded === index && (
              <View style={styles.tipsContainer}>
                {cat.tips.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <View style={[styles.dot, { backgroundColor: cat.color }]} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={styles.hotlineBox}>
          <Text style={styles.hotlineTitle}>{t.emergencyHotlines}</Text>
          <Text style={styles.hotlineItem}>{t.hotlineNSRC} <Text style={styles.hotlineNumber}>997</Text></Text>
          <Text style={styles.hotlineItem}>{t.hotlinePDRM} <Text style={styles.hotlineNumber}>999</Text></Text>
          <Text style={styles.hotlineItem}>{t.hotlineBNM} <Text style={styles.hotlineNumber}>1300 88 5465</Text></Text>
        </View>
      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  scroll: { padding: 20, paddingBottom: 110 },
  title: { fontSize: 24, fontWeight: "bold", color: theme.text, marginTop: 10, marginBottom: 6 },
  subtitle: { fontSize: 14, color: theme.subtext, marginBottom: 20, lineHeight: 20 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: theme.text },
  chevron: { color: theme.subtext, fontSize: 12 },
  tipsContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  tipRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  tipText: { color: theme.subtext, fontSize: 13, lineHeight: 20, flex: 1 },
  hotlineBox: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.danger + "55",
    marginTop: 4,
  },
  hotlineTitle: { fontSize: 15, fontWeight: "bold", color: theme.text, marginBottom: 12 },
  hotlineItem: { fontSize: 14, color: theme.subtext, marginBottom: 6 },
  hotlineNumber: { color: theme.danger, fontWeight: "bold" },
});
