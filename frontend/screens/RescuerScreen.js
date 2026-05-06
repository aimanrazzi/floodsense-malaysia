/**
 * RescuerScreen — dashboard for rescue coordinators.
 * Shows all active SOS requests with GPS coordinates and one-tap navigation.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { floodApi } from "../utils/api";

const FS = {
  primary: "#1B6CA8",
  danger:  "#DC2626",
  warning: "#D97706",
  safe:    "#16A34A",
  bg:      "#0A1628",
  surface: "#112240",
  card:    "#1A3A5C",
  text:    "#E8F4FD",
  subtext: "#7FA8C4",
  border:  "#1E3A5F",
};

const SITUATION_ICONS = {
  "Stranded":        "🌊",
  "Medical":         "🏥",
  "Trapped":         "🚧",
  "Need Evacuation": "🚌",
  "Injured":         "🩹",
};

function timeAgo(isoString) {
  if (!isoString) return "Unknown time";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function RescuerScreen({ navigation }) {
  const [cases,      setCases]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const fetchCases = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const data = await floodApi.getRescueCases();
      setCases(data.cases || []);
    } catch {
      setError("Could not load rescue cases. Check server connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    const interval = setInterval(() => fetchCases(), 30000);
    return () => clearInterval(interval);
  }, [fetchCases]);

  const navigate = (c) => {
    const url = c.maps_link ||
      (c.latitude && c.longitude
        ? `https://maps.google.com/?q=${c.latitude},${c.longitude}`
        : null);
    if (url) {
      Linking.openURL(url);
    } else {
      Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(c.district + ", Malaysia")}`);
    }
  };

  const hasGps = (c) => c.latitude != null && c.longitude != null;

  return (
    <LinearGradient colors={["#0A1628","#112240","#0D1F38"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>🗺️ Rescuer Dashboard</Text>
            <Text style={styles.screenSub}>Active SOS requests · auto-refreshes 30s</Text>
          </View>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={FS.primary} />
            <Text style={styles.loadingText}>Loading rescue cases…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => fetchCases()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchCases(true)}
                tintColor={FS.primary}
                colors={[FS.primary]}
              />
            }
          >
            {cases.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>No Active SOS</Text>
                <Text style={styles.emptySub}>All clear — no rescue requests at this time.</Text>
              </View>
            ) : (
              <>
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryText}>
                    {cases.length} active case{cases.length !== 1 ? "s" : ""} ·{" "}
                    {cases.filter(hasGps).length} with GPS
                  </Text>
                </View>

                {cases.map((c, i) => (
                  <View key={c.case_id || i} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.caseIdRow}>
                          <Text style={styles.caseId}>{c.case_id}</Text>
                          <Text style={styles.timeAgo}>{timeAgo(c.timestamp)}</Text>
                        </View>
                        <Text style={styles.district}>{c.district}</Text>
                      </View>
                      <View style={styles.situationBadge}>
                        <Text style={styles.situationIcon}>
                          {SITUATION_ICONS[c.situation] || "🆘"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Situation</Text>
                        <Text style={styles.detailValue}>{c.situation}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>People</Text>
                        <Text style={styles.detailValue}>{c.people_count}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>GPS</Text>
                        <Text style={[styles.detailValue, { color: hasGps(c) ? FS.safe : FS.subtext }]}>
                          {hasGps(c) ? "📡 Yes" : "No"}
                        </Text>
                      </View>
                    </View>

                    {c.notes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesText}>📝 {c.notes}</Text>
                      </View>
                    ) : null}

                    {hasGps(c) && (
                      <Text style={styles.coordsText}>
                        {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}
                      </Text>
                    )}

                    <TouchableOpacity
                      style={[styles.navBtn, hasGps(c) && styles.navBtnGps]}
                      onPress={() => navigate(c)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.navBtnText}>
                        {hasGps(c) ? "🗺️  Navigate to Exact GPS Location" : "🗺️  Navigate to District"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: FS.border,
  },
  backBtn:    { paddingVertical: 4, paddingRight: 4 },
  backText:   { color: FS.primary, fontSize: 14, fontWeight: "700" },
  screenTitle: { fontSize: 16, fontWeight: "900", color: FS.text },
  screenSub:  { fontSize: 10, color: FS.subtext, marginTop: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: FS.subtext, marginTop: 12 },

  errorBox: { margin: 20, padding: 16, backgroundColor: FS.danger + "22", borderRadius: 12, alignItems: "center" },
  errorText: { color: FS.danger, marginBottom: 8 },
  retryText: { color: FS.primary, fontWeight: "700" },

  scroll: { padding: 16, paddingBottom: 40 },

  emptyBox:  { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle:{ fontSize: 18, fontWeight: "900", color: FS.safe, marginBottom: 6 },
  emptySub:  { fontSize: 13, color: FS.subtext, textAlign: "center" },

  summaryBadge: {
    backgroundColor: FS.primary + "22", borderRadius: 8, borderWidth: 1, borderColor: FS.primary + "55",
    padding: 10, marginBottom: 14, alignItems: "center",
  },
  summaryText: { color: FS.primary, fontSize: 13, fontWeight: "800" },

  card: {
    backgroundColor: FS.card, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: FS.border, elevation: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  cardTop:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  caseIdRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  caseId:     { fontSize: 14, fontWeight: "900", color: FS.danger, letterSpacing: 0.5 },
  timeAgo:    { fontSize: 11, color: FS.subtext },
  district:   { fontSize: 18, fontWeight: "800", color: FS.text },
  situationBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: FS.surface, alignItems: "center", justifyContent: "center",
  },
  situationIcon: { fontSize: 22 },

  detailRow: {
    flexDirection: "row", backgroundColor: FS.surface, borderRadius: 10, padding: 12, marginBottom: 10,
  },
  detailItem:  { flex: 1, alignItems: "center" },
  detailLabel: { fontSize: 10, color: FS.subtext, marginBottom: 3 },
  detailValue: { fontSize: 13, fontWeight: "800", color: FS.text },

  notesBox: {
    backgroundColor: FS.surface, borderRadius: 8, padding: 10, marginBottom: 8,
  },
  notesText:   { fontSize: 12, color: FS.subtext, lineHeight: 18 },
  coordsText:  { fontSize: 11, color: FS.subtext, marginBottom: 8, textAlign: "center" },

  navBtn: {
    backgroundColor: FS.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center",
  },
  navBtnGps: { backgroundColor: "#059669" },
  navBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
