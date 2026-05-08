/**
 * AlertDetailScreen — full Claude AI reasoning for one alert event.
 *
 * Accepts two shapes of route.params:
 *   { reading }  — district card tapped from FloodMapScreen → runs /api/flood/analyze
 *   { alert }    — history item tapped from AlertHistoryScreen → displays stored data
 */
import React, { useState, useEffect } from "react";
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Modal, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { floodApi } from "../utils/api";

const FS = {
  primary:  "#3B82F6",
  danger:   "#EF4444",
  warning:  "#F59E0B",
  watch:    "#EAB308",
  safe:     "#22C55E",
  bg:       "#0F172A",
  surface:  "#1E293B",
  card:     "#1E293B",
  text:     "#F1F5F9",
  subtext:  "#94A3B8",
  border:   "#334155",
};

const URBAN_SET = new Set([
  "Klang","Gombak","Kepong","Cheras","Ampang","Petaling Jaya","Bangsar",
  "Georgetown","Melaka Tengah","Seremban","Alor Setar","Kangar","Kuantan",
]);

function drainStress(rainfall) {
  if (rainfall >= 70) return { label: "CRITICAL", color: "#DC2626" };
  if (rainfall >= 50) return { label: "HIGH",     color: "#D97706" };
  if (rainfall >= 30) return { label: "MODERATE", color: "#EAB308" };
  return                      { label: "LOW",      color: "#16A34A" };
}

function riverPressure(level) {
  if (level >= 5.5) return { label: "EXTREME",  color: "#DC2626" };
  if (level >= 4.5) return { label: "HIGH",     color: "#D97706" };
  if (level >= 3.0) return { label: "ELEVATED", color: "#EAB308" };
  return                    { label: "NORMAL",   color: "#16A34A" };
}

const STATUS_META = {
  DANGER:  { color: FS.danger,  icon: "🔴", gradient: ["#7F1D1D", "#1A0808"] },
  WARNING: { color: FS.warning, icon: "🟠", gradient: ["#78350F", "#1A1008"] },
  WATCH:   { color: FS.watch,   icon: "🟡", gradient: ["#713F12", "#1A1508"] },
  SAFE:    { color: FS.safe,    icon: "🟢", gradient: ["#14532D", "#081A0F"] },
};

function formatDateTime(isoString) {
  if (!isoString) return "--";
  return new Date(isoString).toLocaleString("en-MY");
}

export default function AlertDetailScreen({ route, navigation }) {
  const { reading, alert: existingAlert } = route.params || {};

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // If we have a stored alert, use it directly; if we have a fresh reading, analyze it
  useEffect(() => {
    if (existingAlert) {
      // Map stored alert fields to assessment shape
      setAssessment({
        risk_level: existingAlert.risk_level,
        affected_districts: existingAlert.affected_districts,
        estimated_time_to_critical: existingAlert.estimated_time_to_critical,
        confidence: existingAlert.confidence,
        recommended_action: existingAlert.recommended_action,
        reasoning: existingAlert.reasoning,
        anomaly_score: existingAlert.anomaly_score,
        timestamp: existingAlert.timestamp,
        readings: existingAlert.readings,
      });
    } else if (reading) {
      analyzeReading(reading);
    }
  }, []);

  const analyzeReading = async (r) => {
    setLoading(true);
    setError(null);
    try {
      // Build single-station readings object for the API
      const readings = {
        [r.river]: {
          level: r.river_level,
          rainfall: r.rainfall_rate,
          district: r.district,
          station: r.station,
        },
      };
      const data = await floodApi.analyze(readings);
      setAssessment({
        ...data.assessment,
        anomaly_score: data.anomaly_score,
        timestamp: new Date().toISOString(),
        readings,
      });
    } catch {
      setError("Could not get AI assessment. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const risk  = assessment?.risk_level || reading?.status || "SAFE";
  const meta  = STATUS_META[risk] || STATUS_META.SAFE;
  const title = reading?.district || assessment?.affected_districts?.[0] || "Unknown";

  const isFlash = URBAN_SET.has(reading?.district) ||
                  URBAN_SET.has(assessment?.affected_districts?.[0]);

  // Pull the primary reading values for risk-factor display
  const primaryLevel    = reading?.river_level ?? 0;
  const primaryRainfall = reading?.rainfall_rate ?? 0;
  const ds = drainStress(primaryRainfall);
  const rp = riverPressure(primaryLevel);

  const canEvacuate = ["WARNING", "DANGER"].includes(risk);

  const submitReport = async () => {
    const district = title;
    setReportSubmitting(true);
    try {
      await floodApi.reportFeedback(district, risk, reportReason);
      setReportSent(true);
      setReportVisible(false);
      setReportReason("");
    } catch {
      Alert.alert("Error", "Could not send report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={["#0F172A", "#0F172A", "#131F35"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={FS.bg} />

        {/* Nav bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Risk banner */}
          <LinearGradient colors={meta.gradient} style={styles.riskBanner}>
            <Text style={styles.riskIcon}>{meta.icon}</Text>
            <Text style={[styles.riskLabel, { color: meta.color }]}>{risk}</Text>
            {assessment?.timestamp && (
              <Text style={styles.riskTime}>{formatDateTime(assessment.timestamp)}</Text>
            )}
          </LinearGradient>

          {/* Loading */}
          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={FS.primary} />
              <Text style={styles.loadingText}>Consulting Risk Assessment Agent…</Text>
            </View>
          )}

          {/* Error */}
          {!loading && error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {reading && (
                <TouchableOpacity onPress={() => analyzeReading(reading)}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Assessment details */}
          {!loading && assessment && (
            <>
              {/* Key metrics row */}
              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {Math.round((assessment.confidence || 0) * 100)}%
                  </Text>
                  <Text style={styles.metricLabel}>Confidence</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {assessment.anomaly_score != null
                      ? assessment.anomaly_score.toFixed(2)
                      : "--"}
                  </Text>
                  <Text style={styles.metricLabel}>Anomaly Score</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={[styles.metricValue, { fontSize: 13 }]}>
                    {assessment.estimated_time_to_critical || "N/A"}
                  </Text>
                  <Text style={styles.metricLabel}>Time to Critical</Text>
                </View>
              </View>

              {/* Recommended action */}
              {assessment.recommended_action && (
                <View style={[styles.section, { borderLeftColor: meta.color }]}>
                  <Text style={styles.sectionLabel}>RECOMMENDED ACTION</Text>
                  <Text style={styles.actionText}>{assessment.recommended_action}</Text>
                </View>
              )}

              {/* Summary — split into scannable sentences */}
              {assessment.reasoning && (() => {
                const sentences = assessment.reasoning
                  .split(/(?<=[.!?])\s+/)
                  .map(s => s.trim())
                  .filter(Boolean);
                const headline = sentences[0] || "";
                const rest     = sentences.slice(1);
                return (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Summary</Text>
                    <View style={[styles.summaryHeadline, { borderLeftColor: meta.color }]}>
                      <Text style={[styles.summaryHeadlineText, { color: meta.color }]}>
                        {headline}
                      </Text>
                    </View>
                    {rest.map((s, i) => (
                      <View key={i} style={styles.summaryLine}>
                        <Text style={styles.summaryDot}>·</Text>
                        <Text style={styles.summaryLineText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Risk Factors — flood-type-aware, replaces the generic Affected Districts list */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {isFlash ? "Flash Flood Risk Factors" : "River Overflow Risk Factors"}
                </Text>

                {isFlash ? (
                  <>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Flood Type</Text>
                      <Text style={styles.factorValue}>Flash Flood (Banjir Kilat)</Text>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Primary Trigger</Text>
                      <Text style={styles.factorValue}>Heavy Rainfall / Drain Overflow</Text>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Rainfall Rate</Text>
                      <Text style={styles.factorValue}>{primaryRainfall.toFixed(1)} mm/hr</Text>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Drainage Stress</Text>
                      <View style={[styles.factorBadge, { backgroundColor: ds.color + "28", borderColor: ds.color }]}>
                        <Text style={[styles.factorBadgeText, { color: ds.color }]}>{ds.label}</Text>
                      </View>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Area Profile</Text>
                      <Text style={styles.factorValue}>High-density urban</Text>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>At-Risk Infrastructure</Text>
                      <Text style={styles.factorValue}>Roads, underpasses, LRT</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Flood Type</Text>
                      <Text style={styles.factorValue}>River Overflow (Banjir Sungai)</Text>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Primary Trigger</Text>
                      <Text style={styles.factorValue}>River Level / Upstream Flow</Text>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>River Level</Text>
                      <Text style={styles.factorValue}>{primaryLevel.toFixed(1)} m</Text>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>River Pressure</Text>
                      <View style={[styles.factorBadge, { backgroundColor: rp.color + "28", borderColor: rp.color }]}>
                        <Text style={[styles.factorBadgeText, { color: rp.color }]}>{rp.label}</Text>
                      </View>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>Area Profile</Text>
                      <Text style={styles.factorValue}>Riverside / semi-rural</Text>
                    </View>
                    <View style={styles.factorRow}>
                      <Text style={styles.factorLabel}>At-Risk Infrastructure</Text>
                      <Text style={styles.factorValue}>Bridges, farmland, low homes</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Live sensor readings */}
              {assessment.readings && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {isFlash ? "🌧 Rainfall Readings" : "🌊 River Level Readings"}
                  </Text>
                  {Object.entries(assessment.readings).map(([river, data]) => (
                    <View key={river} style={styles.readingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.readingRiver}>{river}</Text>
                        <Text style={styles.readingDistrict}>{data.station || data.district}</Text>
                      </View>
                      <View style={styles.readingStats}>
                        {!isFlash && (
                          <Text style={styles.readingValue}>
                            🌊 {typeof data.level === "number" ? data.level.toFixed(1) : "--"}m
                          </Text>
                        )}
                        <Text style={styles.readingValue}>
                          🌧 {typeof data.rainfall === "number" ? data.rainfall.toFixed(1) : "--"} mm/hr
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Evacuation CTA */}
              {canEvacuate && (
                <TouchableOpacity
                  style={[styles.evacuateBtn, { backgroundColor: meta.color }]}
                  onPress={() =>
                    navigation.navigate("Evacuation", {
                      district: assessment.affected_districts?.[0] || reading?.district,
                      risk,
                    })
                  }
                >
                  <Text style={styles.evacuateBtnText}>
                    🚨 View Evacuation Centres
                  </Text>
                </TouchableOpacity>
              )}

              {/* False positive report */}
              {reportSent ? (
                <View style={styles.reportSentBox}>
                  <Text style={styles.reportSentText}>
                    Report received — thank you. Your feedback helps improve prediction accuracy.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.reportBtn}
                  onPress={() => setReportVisible(true)}
                >
                  <Text style={styles.reportBtnText}>Report incorrect prediction</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>

        {/* Report modal */}
        <Modal
          visible={reportVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReportVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Report Incorrect Prediction</Text>
              <Text style={styles.modalSubtitle}>
                District: {title}  ·  Predicted: {risk}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Why do you think this is incorrect? (optional)"
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
                value={reportReason}
                onChangeText={setReportReason}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => { setReportVisible(false); setReportReason(""); }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmit}
                  onPress={submitReport}
                  disabled={reportSubmitting}
                >
                  {reportSubmitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.modalSubmitText}>Submit Report</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FS.border,
  },
  backBtn: { width: 60 },
  backText: { color: FS.primary, fontSize: 15, fontWeight: "600" },
  navTitle: { fontSize: 16, fontWeight: "800", color: FS.text, flex: 1, textAlign: "center" },

  riskBanner: {
    borderRadius: 16, padding: 24, alignItems: "center",
    marginBottom: 20, borderWidth: 1, borderColor: FS.border,
  },
  riskIcon: { fontSize: 48, marginBottom: 8 },
  riskLabel: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  riskTime: { color: FS.subtext, fontSize: 12, marginTop: 6 },

  loadingBox: { alignItems: "center", paddingVertical: 40 },
  loadingText: { color: FS.subtext, marginTop: 12, fontSize: 14, textAlign: "center" },

  errorBox: {
    backgroundColor: FS.danger + "22", borderColor: FS.danger, borderWidth: 1,
    borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 16,
  },
  errorText: { color: FS.danger, fontSize: 14, marginBottom: 10 },
  retryText: { color: FS.primary, fontSize: 14, fontWeight: "700" },

  metricsRow: {
    flexDirection: "row", backgroundColor: FS.card, borderRadius: 12,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: FS.border,
  },
  metricBox: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 20, fontWeight: "800", color: FS.text },
  metricLabel: { fontSize: 12, color: "#A8CCE0", marginTop: 4, textAlign: "center" },
  metricDivider: { width: 1, backgroundColor: FS.border, marginVertical: 4 },

  section: {
    backgroundColor: FS.card, borderRadius: 12, padding: 16,
    marginBottom: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: FS.border,
  },
  sectionLabel: { fontSize: 11, color: "#A8CCE0", fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  actionText: { fontSize: 16, color: FS.text, fontWeight: "700", lineHeight: 24 },

  card: {
    backgroundColor: FS.card, borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: FS.border,
  },
  cardTitle: { fontSize: 14, color: FS.text, fontWeight: "700", marginBottom: 10 },
  reasoningText: { fontSize: 15, color: FS.text, lineHeight: 24 },

  summaryHeadline: {
    borderLeftWidth: 3, paddingLeft: 10, marginBottom: 12,
  },
  summaryHeadlineText: { fontSize: 15, fontWeight: "800", lineHeight: 22 },
  summaryLine: { flexDirection: "row", marginBottom: 8, alignItems: "flex-start" },
  summaryDot:  { fontSize: 16, color: FS.subtext, marginRight: 8, lineHeight: 22 },
  summaryLineText: { flex: 1, fontSize: 14, color: FS.text, lineHeight: 22 },

  factorRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: FS.border,
  },
  factorLabel: { fontSize: 13, color: "#A8CCE0", fontWeight: "600", flex: 1 },
  factorValue: { fontSize: 14, color: FS.text, fontWeight: "700", textAlign: "right", flex: 1 },
  factorBadge: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  factorBadgeText: { fontSize: 11, fontWeight: "900" },

  readingRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: FS.border,
  },
  readingRiver: { fontSize: 14, fontWeight: "700", color: FS.text },
  readingDistrict: { fontSize: 12, color: "#A8CCE0", marginTop: 2 },
  readingStats: { alignItems: "flex-end", gap: 4 },
  readingValue: { fontSize: 14, color: FS.text, fontWeight: "600" },

  evacuateBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: "center",
    marginTop: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  evacuateBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },

  reportBtn: {
    marginTop: 12, paddingVertical: 12, alignItems: "center",
    borderWidth: 1, borderColor: "#334155", borderRadius: 10,
  },
  reportBtnText: { color: "#64748b", fontSize: 13, fontWeight: "600" },
  reportSentBox: {
    marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: "#0f2e1a", borderWidth: 1, borderColor: "#166534",
  },
  reportSentText: { color: "#4ade80", fontSize: 13, textAlign: "center", lineHeight: 20 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalBox: {
    backgroundColor: "#1E293B", borderRadius: 16, padding: 20,
    width: "100%", borderWidth: 1, borderColor: "#334155",
  },
  modalTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "800", marginBottom: 4 },
  modalSubtitle: { color: "#94A3B8", fontSize: 12, marginBottom: 14 },
  modalInput: {
    backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#334155",
    borderRadius: 8, padding: 10, color: "#F1F5F9", fontSize: 13,
    textAlignVertical: "top", minHeight: 72, marginBottom: 16,
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancel: {
    flex: 1, paddingVertical: 11, alignItems: "center",
    borderWidth: 1, borderColor: "#334155", borderRadius: 8,
  },
  modalCancelText: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },
  modalSubmit: {
    flex: 1, paddingVertical: 11, alignItems: "center",
    backgroundColor: "#1d4ed8", borderRadius: 8,
  },
  modalSubmitText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
