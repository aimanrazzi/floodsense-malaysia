import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLang } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { translations } from "../utils/translations";

export default function ReportScreen() {
  const { lang } = useLang();
  const t = translations[lang] || translations.en;
  const { theme } = useTheme();

  const styles = makeStyles(theme);

  const reportOptions = [
    {
      icon: "🚔",
      title: t.reportPDRMTitle,
      description: t.reportPDRMDesc,
      action: t.reportPDRMAction,
      url: "https://ccid.rmp.gov.my",
      color: theme.accent,
      urgent: false,
    },
    {
      icon: "📞",
      title: t.reportNSRCTitle,
      description: t.reportNSRCDesc,
      action: t.reportNSRCAction,
      url: "tel:997",
      color: theme.danger,
      urgent: true,
    },
    {
      icon: "🏦",
      title: t.reportBankTitle,
      description: t.reportBankDesc,
      action: t.reportBankAction,
      url: "tel:1300885465",
      color: theme.warning,
      urgent: true,
    },
    {
      icon: "🌐",
      title: t.reportMCMCTitle,
      description: t.reportMCMCDesc,
      action: t.reportMCMCAction,
      url: "https://aduan.mcmc.gov.my",
      color: theme.safe,
      urgent: false,
    },
    {
      icon: "💬",
      title: t.reportWATitle,
      description: t.reportWADesc,
      action: t.reportWAAction,
      url: "https://faq.whatsapp.com/2286952358121083",
      color: theme.subtext,
      urgent: false,
    },
  ];

  const open = (url) => Linking.openURL(url);

  return (
    <LinearGradient colors={theme.backgroundGradient} style={{ flex: 1 }}>
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t.reportTitle}</Text>
        <Text style={styles.subtitle}>{t.reportSubtitle}</Text>

        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>{t.emergencyBanner}</Text>
        </View>

        {reportOptions.map((item, index) => (
          <View key={index} style={[styles.card, item.urgent && styles.urgentCard]}>
            <View style={styles.cardTop}>
              <Text style={styles.icon}>{item.icon}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc}>{item.description}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: item.color }]}
              onPress={() => open(item.url)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>{item.action}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: {
    padding: 20,
    paddingBottom: 110,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.text,
    marginBottom: 6,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: theme.subtext,
    marginBottom: 16,
  },
  emergencyBanner: {
    backgroundColor: theme.danger + "22",
    borderColor: theme.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  emergencyText: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: "bold",
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  urgentCard: {
    borderColor: theme.danger + "55",
  },
  cardTop: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  icon: {
    fontSize: 28,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: theme.text,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: theme.subtext,
    lineHeight: 20,
  },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
});
