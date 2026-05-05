import React from "react"; // eslint-disable-line
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLang } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { languages } from "../utils/translations";

export default function LanguageSelector() {
  const { lang, changeLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.bar}>
      <Text style={styles.barLabel}>🌐</Text>
      {languages.map((l) => (
        <TouchableOpacity
          key={l.code}
          style={[styles.btn, lang === l.code && styles.btnActive]}
          onPress={() => changeLang(l.code)}
        >
          <Text style={[styles.label, lang === l.code && styles.labelActive]}>
            {l.label}
          </Text>
        </TouchableOpacity>
      ))}
      <View style={styles.divider} />
      <TouchableOpacity style={styles.themeBtn} onPress={toggleTheme}>
        <Text style={styles.themeIcon}>{theme.isDark ? "☀️" : "🌙"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    barLabel: {
      fontSize: 14,
      marginRight: 4,
    },
    btn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    btnActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentBg,
    },
    label: {
      color: theme.subtext,
      fontSize: 11,
      fontWeight: "bold",
    },
    labelActive: {
      color: theme.accent,
    },
    divider: {
      width: 1,
      height: 18,
      backgroundColor: theme.border,
      marginHorizontal: 2,
    },
    themeBtn: {
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    themeIcon: {
      fontSize: 14,
    },
  });
