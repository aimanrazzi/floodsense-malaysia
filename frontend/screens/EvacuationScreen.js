/**
 * EvacuationScreen — nearest evacuation centres.
 * Shown when risk level is WARNING or DANGER.
 * Data comes from /api/flood/evacuate?district=X (JKM / MERCY Malaysia centres).
 */
import React, { useState, useEffect } from "react";
import {
  StyleSheet, Text, View, ScrollView,
  TouchableOpacity, ActivityIndicator, StatusBar, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { floodApi } from "../utils/api";

const FS = {
  primary:  "#1B6CA8",
  danger:   "#DC2626",
  warning:  "#D97706",
  bg:       "#0A1628",
  surface:  "#112240",
  card:     "#1A3A5C",
  text:     "#E8F4FD",
  subtext:  "#7FA8C4",
  border:   "#1E3A5F",
};

export default function EvacuationScreen({ route, navigation }) {
  const { district, risk } = route.params || {};
  const isDanger = risk === "DANGER";
  const bannerColor = isDanger ? FS.danger : FS.warning;
  const bannerGradient = isDanger ? ["#7F1D1D", "#1A0808"] : ["#78350F", "#1A1008"];

  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await floodApi.getEvacuationCenters(district);
      setCenters(data.data || []);
    } catch {
      setError("Could not load evacuation centres. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const callContact = (contact) => {
    if (!contact) return;
    Linking.openURL(`tel:${contact.replace(/\s/g, "")}`);
  };

  const openMaps = (address) => {
    const encoded = encodeURIComponent(address);
    Linking.openURL(`https://maps.google.com/?q=${encoded}`);
  };

  return (
    <LinearGradient colors={["#0A1628", "#112240", "#0D1F38"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={FS.bg} />

        {/* Nav bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Evacuation Centres</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Urgency banner */}
          <LinearGradient colors={bannerGradient} style={[styles.urgencyBanner, { borderColor: bannerColor }]}>
            <Text style={styles.urgencyIcon}>{isDanger ? "🚨" : "⚠️"}</Text>
            <View>
              <Text style={[styles.urgencyTitle, { color: bannerColor }]}>
                {isDanger ? "DANGER — Evacuate Now" : "WARNING — Be Ready"}
              </Text>
              <Text style={styles.urgencySubtext}>
                {district
                  ? `Showing centres near ${district}`
                  : "All available centres"}
              </Text>
            </View>
          </LinearGradient>

          {/* Emergency contact */}
          <View style={styles.emergencyRow}>
            <TouchableOpacity
              style={[styles.emergencyBtn, { backgroundColor: FS.danger }]}
              onPress={() => Linking.openURL("tel:999")}
            >
              <Text style={styles.emergencyBtnText}>📞 999 Police</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emergencyBtn, { backgroundColor: FS.primary }]}
              onPress={() => Linking.openURL("tel:03-80642400")}
            >
              <Text style={styles.emergencyBtnText}>🆘 JKM 03-8064 2400</Text>
            </TouchableOpacity>
          </View>

          {/* Loading */}
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={FS.primary} />
              <Text style={styles.loadingText}>Loading centres…</Text>
            </View>
          )}

          {/* Error */}
          {!loading && error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchCenters}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Centre cards */}
          {!loading && !error && centers.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🏫</Text>
              <Text style={styles.emptyText}>No centres found for this area.</Text>
              <Text style={styles.emptySubtext}>Call JKM at 03-8064 2400 for assistance.</Text>
            </View>
          )}

          {!loading && centers.map((centre, index) => (
            <View key={index} style={styles.card}>
              {/* Number badge */}
              <View style={styles.cardTop}>
                <View style={[styles.numberBadge, { backgroundColor: bannerColor }]}>
                  <Text style={styles.numberText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.centreName}>{centre.name}</Text>
                  {centre.district && (
                    <Text style={styles.centreDistrict}>{centre.district}</Text>
                  )}
                </View>
                {centre.capacity && (
                  <View style={styles.capacityBadge}>
                    <Text style={styles.capacityText}>
                      👥 {centre.capacity.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Address */}
              <View style={styles.addressRow}>
                <Text style={styles.addressIcon}>📍</Text>
                <Text style={styles.addressText}>{centre.address}</Text>
              </View>

              {/* Action buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openMaps(centre.address)}
                >
                  <Text style={styles.actionBtnText}>🗺 Get Directions</Text>
                </TouchableOpacity>
                {centre.contact && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: FS.primary }]}
                    onPress={() => callContact(centre.contact)}
                  >
                    <Text style={[styles.actionBtnText, { color: FS.primary }]}>
                      📞 {centre.contact}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {/* What to bring reminder */}
          {!loading && centers.length > 0 && (
            <View style={styles.reminderCard}>
              <Text style={styles.reminderTitle}>📦 What to bring</Text>
              {[
                "IC / MyKad for all family members",
                "3-day supply of food and water",
                "Important documents (birth certs, insurance)",
                "Medications and first-aid kit",
                "Phone charger and power bank",
                "Change of clothes",
              ].map((item, i) => (
                <View key={i} style={styles.reminderRow}>
                  <Text style={styles.reminderBullet}>•</Text>
                  <Text style={styles.reminderText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: FS.border,
  },
  backBtn: { width: 60 },
  backText: { color: FS.primary, fontSize: 15, fontWeight: "600" },
  navTitle: { fontSize: 16, fontWeight: "800", color: FS.text, flex: 1, textAlign: "center" },

  urgencyBanner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1.5,
  },
  urgencyIcon: { fontSize: 36 },
  urgencyTitle: { fontSize: 18, fontWeight: "900" },
  urgencySubtext: { color: FS.subtext, fontSize: 13, marginTop: 2 },

  emergencyRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  emergencyBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center",
    elevation: 3,
  },
  emergencyBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  center: { alignItems: "center", paddingVertical: 40 },
  loadingText: { color: FS.subtext, marginTop: 12, fontSize: 14 },

  errorBox: {
    backgroundColor: FS.danger + "22", borderColor: FS.danger,
    borderWidth: 1, borderRadius: 12, padding: 16, alignItems: "center",
  },
  errorText: { color: FS.danger, fontSize: 14, marginBottom: 10 },
  retryText: { color: FS.primary, fontSize: 14, fontWeight: "700" },

  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: "700", color: FS.text, marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: FS.subtext },

  card: {
    backgroundColor: FS.card, borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: FS.border,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  numberBadge: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },
  numberText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  centreName: { fontSize: 15, fontWeight: "800", color: FS.text, flex: 1 },
  centreDistrict: { fontSize: 12, color: FS.subtext, marginTop: 2 },
  capacityBadge: {
    backgroundColor: FS.surface, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  capacityText: { fontSize: 11, color: FS.subtext, fontWeight: "600" },

  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 12 },
  addressIcon: { fontSize: 14, marginTop: 1 },
  addressText: { fontSize: 13, color: FS.subtext, flex: 1, lineHeight: 20 },

  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, borderWidth: 1, borderColor: FS.primary,
    borderRadius: 8, paddingVertical: 9, alignItems: "center",
  },
  actionBtnText: { color: FS.primary, fontSize: 12, fontWeight: "700" },

  reminderCard: {
    backgroundColor: FS.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: FS.border, marginTop: 4,
  },
  reminderTitle: { fontSize: 14, fontWeight: "800", color: FS.text, marginBottom: 12 },
  reminderRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  reminderBullet: { color: FS.primary, fontSize: 14, fontWeight: "700" },
  reminderText: { color: FS.subtext, fontSize: 13, flex: 1, lineHeight: 20 },
});
