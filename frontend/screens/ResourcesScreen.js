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

export default function ResourcesScreen() {
  const { lang } = useLang();
  const t = translations[lang] || translations.en;
  const { theme } = useTheme();

  const styles = makeStyles(theme);

  const resources = [
    {
      name: "Semak Mule",
      description: t.semakMuleDesc,
      url: "https://semakmule.rmp.gov.my",
      tag: "PDRM",
      color: theme.accent,
    },
    {
      name: "NSRC – National Scam Response Centre",
      description: t.nsrcDesc,
      url: "https://nfcc.jpm.gov.my/index.php/en/about-nsrc",
      tag: "KPDNHEP",
      color: theme.warning,
    },
    {
      name: "CCID Scam Portal",
      description: t.ccidDesc,
      url: "https://ccid.rmp.gov.my/semakmule",
      tag: "PDRM",
      color: theme.accent,
    },
    {
      name: "BNM BNMTELELINK",
      description: t.bnmDesc,
      url: "https://www.bnm.gov.my/contact-us",
      tag: "BNM",
      color: theme.safe,
    },
    {
      name: "MCMC Aduan",
      description: t.mcmcDesc,
      url: "https://aduan.mcmc.gov.my",
      tag: "MCMC",
      color: theme.danger,
    },
  ];

  const open = (url) => Linking.openURL(url);

  return (
    <LinearGradient colors={theme.backgroundGradient} style={{ flex: 1 }}>
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t.govResources}</Text>
        <Text style={styles.subtitle}>{t.resourcesSubtitle}</Text>

        {resources.map((item, index) => (
          <TouchableOpacity key={index} style={styles.card} onPress={() => open(item.url)} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{item.name}</Text>
              <View style={[styles.tag, { backgroundColor: item.color + "22", borderColor: item.color }]}>
                <Text style={[styles.tagText, { color: item.color }]}>{item.tag}</Text>
              </View>
            </View>
            <Text style={styles.cardDesc}>{item.description}</Text>
            <Text style={styles.cardUrl}>{item.url}</Text>
          </TouchableOpacity>
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
    marginBottom: 24,
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "bold",
    color: theme.text,
    flex: 1,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  cardDesc: {
    fontSize: 13,
    color: theme.subtext,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardUrl: {
    fontSize: 12,
    color: theme.accent,
  },
});
