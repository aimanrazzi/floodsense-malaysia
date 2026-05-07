/**
 * RescuerScreen — dashboard for rescue coordinators.
 * Shows all active SOS requests with GPS coordinates and one-tap navigation.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { floodApi } from "../utils/api";

const FS = {
  primary: "#3B82F6",
  danger:  "#EF4444",
  warning: "#F59E0B",
  safe:    "#22C55E",
  bg:      "#0F172A",
  surface: "#1E293B",
  card:    "#1E293B",
  text:    "#F1F5F9",
  subtext: "#94A3B8",
  border:  "#334155",
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
  const [resolving,  setResolving]  = useState(null); // case_id being resolved

  const fetchCases = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const data = await floodApi.getRescueCases();
      // Only show active and dispatched — resolved cases disappear from this view
      const open = (data.cases || []).filter(c => c.status !== "resolved");
      setCases(open);
    } catch {
      setError("Could not load rescue cases. Check server connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleResolve = useCallback((c) => {
    Alert.alert(
      "Mark as Resolved",
      `Confirm case ${c.case_id} in ${c.district} is handled?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resolved",
          style: "destructive",
          onPress: async () => {
            setResolving(c.case_id);
            try {
              await floodApi.resolveCase(c.case_id);
              // Remove immediately from local state — backend + dashboard will sync on next poll
              setCases(prev => prev.filter(x => x.case_id !== c.case_id));
            } catch {
              Alert.alert("Error", "Could not update case. Try again.");
            } finally {
              setResolving(null);
            }
          },
        },
      ]
    );
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
    <LinearGradient colors={["#0F172A","#0F172A","#131F35"]} style={{ flex: 1 }}>
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
                <Text style={styles.emptyTitle}>All Clear</Text>
                <Text style={styles.emptySub}>No open rescue requests at this time.</Text>
              </View>
            ) : (
              <>
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryText}>
                    {cases.length} open case{cases.length !== 1 ? "s" : ""} ·{" "}
                    {cases.filter(hasGps).length} with GPS
                  </Text>
                </View>

                {cases.map((c, i) => {
                  const isDispatched = c.status === "dispatched";
                  const isResolving  = resolving === c.case_id;
                  return (
                    <View key={c.case_id || i} style={[styles.card, isDispatched && styles.cardDispatched]}>
                      <View style={styles.cardTop}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.caseIdRow}>
                            <Text style={styles.caseId}>{c.case_id}</Text>
                            {isDispatched && (
                              <View style={styles.dispatchedTag}>
                                <Text style={styles.dispatchedTagText}>Team Dispatched</Text>
                              </View>
                            )}
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
                            {hasGps(c) ? "Yes" : "No"}
                          </Text>
                        </View>
                      </View>

                      {isDispatched && c.team && (
                        <View style={styles.teamBox}>
                          <Text style={styles.teamText}>Assigned: {c.team}</Text>
                        </View>
                      )}

                      {c.notes ? (
                        <View style={styles.notesBox}>
                          <Text style={styles.notesText}>{c.notes}</Text>
                        </View>
                      ) : null}

                      {hasGps(c) && (
                        <Text style={styles.coordsText}>
                          {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}
                        </Text>
                      )}

                      <View style={styles.btnRow}>
                        <TouchableOpacity
                          style={[styles.navBtn, hasGps(c) && styles.navBtnGps, { flex: 1 }]}
                          onPress={() => navigate(c)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.navBtnText}>
                            {hasGps(c) ? "Navigate to GPS" : "Navigate to District"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.resolveBtn, isResolving && { opacity: 0.6 }]}
                          onPress={() => handleResolve(c)}
                          disabled={isResolving}
                          activeOpacity={0.8}
                        >
                          {isResolving
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.resolveBtnText}>Resolved</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
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

  cardDispatched: { borderColor: "#065f46", borderWidth: 1.5 },

  dispatchedTag: {
    backgroundColor: "#064e3b", borderRadius: 4, borderWidth: 1,
    borderColor: "#065f46", paddingHorizontal: 6, paddingVertical: 2,
  },
  dispatchedTagText: { color: "#6ee7b7", fontSize: 10, fontWeight: "700" },

  teamBox: {
    backgroundColor: "#064e3b22", borderRadius: 6, padding: 8,
    marginBottom: 8, borderWidth: 1, borderColor: "#065f4655",
  },
  teamText: { color: "#6ee7b7", fontSize: 12, fontWeight: "600" },

  btnRow: { flexDirection: "row", gap: 8, marginTop: 4 },

  navBtn: {
    backgroundColor: FS.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center",
  },
  navBtnGps:  { backgroundColor: "#0284c7" },
  navBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  resolveBtn: {
    backgroundColor: "#15803d", borderRadius: 10, paddingVertical: 12,
    paddingHorizontal: 16, alignItems: "center", justifyContent: "center",
  },
  resolveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
