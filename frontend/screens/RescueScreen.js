import { useState, useEffect } from "react";
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, Linking, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { floodApi } from "../utils/api";

const FS = {
  primary: "#1B6CA8",
  danger:  "#DC2626",
  warning: "#D97706",
  watch:   "#EAB308",
  safe:    "#16A34A",
  bg:      "#0A1628",
  surface: "#112240",
  card:    "#1A3A5C",
  text:    "#E8F4FD",
  subtext: "#7FA8C4",
  border:  "#1E3A5F",
};

// KL/Selangor monitored districts only
const DISTRICTS = [
  "Klang","Gombak","Kepong","Cheras","Ampang",
  "Petaling Jaya","Bangsar","Subang Jaya","Shah Alam",
  "Kuala Selangor","Sepang",
];

const STATUS_COLOR = {
  DANGER: FS.danger, WARNING: FS.warning, WATCH: FS.watch, SAFE: FS.safe,
};
const STATUS_DOT = { DANGER:"🔴", WARNING:"🟠", WATCH:"🟡", SAFE:"🟢" };

const SITUATIONS = [
  { label: "Stranded",        icon: "🌊" },
  { label: "Medical",         icon: "🏥" },
  { label: "Trapped",         icon: "🚧" },
  { label: "Need Evacuation", icon: "🚌" },
  { label: "Injured",         icon: "🩹" },
];

const PEOPLE = ["1","2","3","4","5","6","7","8","10+"];

const EMERGENCY = [
  { label: "Emergency", number: "999",        color: "#DC2626", icon: "🚨" },
  { label: "BOMBA",     number: "994",        color: "#EA580C", icon: "🚒" },
  { label: "JKM",       number: "1800881972", color: "#7C3AED", icon: "🤝" },
  { label: "NADMA",     number: "0362038246", color: "#0369A1", icon: "⛑️"  },
];

export default function RescueScreen({ navigation }) {
  const [district,        setDistrict]        = useState("");
  const [situation,       setSituation]       = useState("");
  const [peopleCount,     setPeopleCount]     = useState("1");
  const [notes,           setNotes]           = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const [locating,        setLocating]        = useState(false);
  const [coords,          setCoords]          = useState(null);
  const [result,          setResult]          = useState(null);
  const [districtStatuses, setDistrictStatuses] = useState({});  // { "Klang": "WARNING", ... }
  const [statusLoading,   setStatusLoading]   = useState(true);

  const call = (number) => Linking.openURL(`tel:${number}`);

  // Load live district flood statuses on mount
  useEffect(() => {
    floodApi.getLevels()
      .then(res => {
        const map = {};
        (res.data || []).forEach(d => { map[d.district] = d.status; });
        setDistrictStatuses(map);
      })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  const selectedStatus = district ? (districtStatuses[district] || null) : null;
  const isSafeZone     = selectedStatus === "SAFE";
  const isAffected     = selectedStatus && selectedStatus !== "SAFE";

  const getLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location Denied", "Enable location so rescuers can find you faster.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch {
      Alert.alert("Location Error", "Could not get your location. Describe it in the notes instead.");
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!district)  { Alert.alert("Required", "Please select your district."); return; }
    if (!situation) { Alert.alert("Required", "Please select your situation type."); return; }
    if (isSafeZone) {
      Alert.alert(
        "Area Not Affected",
        `${district} is currently SAFE — no active flood risk detected.\n\nSOS submissions are only accepted from WATCH, WARNING, or DANGER zones to prevent misuse.`,
        [{ text: "OK" }],
      );
      return;
    }
    setSubmitting(true);
    try {
      const count = parseInt(peopleCount) || 1;
      const res = await floodApi.requestRescue(
        district, situation, count, notes,
        coords?.latitude, coords?.longitude,
      );
      setResult(res);
    } catch (err) {
      const errMsg = err?.message || "";
      const msg = errMsg.includes("403")
        ? "Your area is currently SAFE. SOS is only available in flood-affected zones."
        : errMsg.includes("500")
        ? "Server error. Please try again in a moment or call 999 directly."
        : "Could not reach FloodSense. Check your connection or call 999 directly.";
      Alert.alert("Submission Failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────────
  if (result) {
    return (
      <LinearGradient colors={["#0A1628","#112240","#0D1F38"]} style={{ flex: 1 }}>
        <SafeAreaView style={styles.successWrap}>
          <ScrollView contentContainerStyle={styles.successScroll}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>Request Submitted</Text>

            <View style={styles.caseBox}>
              <Text style={styles.caseLabel}>Case ID</Text>
              <Text style={styles.caseId}>{result.case_id}</Text>
              <Text style={styles.caseSub}>Share this ID when calling emergency services.</Text>
            </View>

            {result.nearest_centre && (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>📍 Nearest Evacuation Centre</Text>
                {typeof result.nearest_centre === "string" ? (
                  <Text style={styles.infoValue}>{result.nearest_centre}</Text>
                ) : (
                  <>
                    <Text style={styles.infoValue}>{result.nearest_centre.name}</Text>
                    {result.nearest_centre.address ? (
                      <Text style={styles.infoSub}>{result.nearest_centre.address}</Text>
                    ) : null}
                    {result.nearest_centre.contact ? (
                      <Text style={styles.infoSub}>📞 {result.nearest_centre.contact}</Text>
                    ) : null}
                    {result.nearest_centre.capacity ? (
                      <Text style={styles.infoSub}>Capacity: {result.nearest_centre.capacity}</Text>
                    ) : null}
                  </>
                )}
              </View>
            )}

            {coords && (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>📡 Your GPS Location Shared</Text>
                <Text style={styles.infoValue}>
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                </Text>
                <TouchableOpacity
                  style={styles.mapsBtn}
                  onPress={() => Linking.openURL(result.maps_link || `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`)}
                >
                  <Text style={styles.mapsBtnText}>Open My Location in Google Maps →</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.successNote}>
              Your location and situation have been logged. Rescuers can now navigate to you.
              For immediate life-threatening danger, call 999.
            </Text>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: FS.danger }]} onPress={() => call("999")}>
              <Text style={styles.actionBtnText}>📞 Call 999 Emergency</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: FS.card, borderWidth: 1, borderColor: FS.border }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.actionBtnText, { color: FS.text }]}>← Back to Map</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={["#0A1628","#112240","#0D1F38"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>🆘 Rescue & Help</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Emergency call grid */}
          <Text style={styles.sectionLabel}>CALL FOR IMMEDIATE HELP</Text>
          <View style={styles.callGrid}>
            {EMERGENCY.map(({ label, number, color, icon }) => (
              <TouchableOpacity
                key={label}
                style={[styles.callCard, { borderColor: color, backgroundColor: color + "22" }]}
                onPress={() => call(number)}
                activeOpacity={0.75}
              >
                <Text style={styles.callIcon}>{icon}</Text>
                <Text style={[styles.callLabel, { color }]}>{label}</Text>
                <Text style={[styles.callNumber, { color }]}>{number}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SUBMIT REQUEST</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* GPS location */}
          <TouchableOpacity
            style={[styles.gpsBtn, coords && styles.gpsBtnActive, locating && { opacity: 0.6 }]}
            onPress={getLocation}
            disabled={locating}
          >
            {locating
              ? <ActivityIndicator color={FS.primary} size="small" />
              : <Text style={[styles.gpsBtnText, coords && { color: FS.safe }]}>
                  {coords
                    ? `📡 GPS Locked · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                    : "📡 Share My Location (helps rescuers find you)"}
                </Text>
            }
          </TouchableOpacity>

          {/* District */}
          <Text style={styles.formLabel}>Your District</Text>
          {!statusLoading && Object.keys(districtStatuses).length > 0 && (
            <View style={styles.statusLegend}>
              <Text style={styles.statusLegendText}>
                🟢 Safe  🟡 Watch  🟠 Warning  🔴 Danger — SOS only available in affected zones
              </Text>
            </View>
          )}
          <View style={styles.chipGrid}>
            {DISTRICTS.map((d) => {
              const st      = districtStatuses[d];
              const stColor = st ? STATUS_COLOR[st] : null;
              const isSafe  = st === "SAFE";
              const isSelected = district === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.chip,
                    isSelected && styles.chipActive,
                    isSelected && isSafe && styles.chipSafe,
                    isSafe && !isSelected && styles.chipDimmed,
                  ]}
                  onPress={() => setDistrict(d)}
                >
                  {st && <Text style={styles.chipDot}>{STATUS_DOT[st]}</Text>}
                  <Text style={[
                    styles.chipText,
                    isSelected && styles.chipTextActive,
                    isSafe && isSelected && { color: FS.safe },
                  ]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Zone-status warning */}
          {isSafeZone && (
            <View style={styles.safeWarning}>
              <Text style={styles.safeWarningText}>
                🟢 {district} is currently SAFE — no active flood risk. SOS submissions are restricted to affected areas only.
              </Text>
            </View>
          )}
          {isAffected && (
            <View style={[styles.safeWarning, { backgroundColor: (STATUS_COLOR[selectedStatus] || FS.warning) + "18", borderColor: STATUS_COLOR[selectedStatus] || FS.warning }]}>
              <Text style={[styles.safeWarningText, { color: STATUS_COLOR[selectedStatus] }]}>
                {STATUS_DOT[selectedStatus]} {district} is {selectedStatus} — SOS submission is enabled for this zone.
              </Text>
            </View>
          )}

          {/* Situation */}
          <Text style={styles.formLabel}>Situation Type</Text>
          <View style={styles.chipGrid}>
            {SITUATIONS.map(({ label, icon }) => (
              <TouchableOpacity
                key={label}
                style={[styles.chip, situation === label && styles.chipActive]}
                onPress={() => setSituation(label)}
              >
                <Text style={[styles.chipText, situation === label && styles.chipTextActive]}>
                  {icon} {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* People count */}
          <Text style={styles.formLabel}>Number of People</Text>
          <View style={styles.countRow}>
            {PEOPLE.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.countChip, peopleCount === n && styles.chipActive]}
                onPress={() => setPeopleCount(n)}
              >
                <Text style={[styles.chipText, peopleCount === n && styles.chipTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <Text style={styles.formLabel}>
            Additional Notes <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Street name, landmark, floor, or any detail that helps rescuers locate you…"
            placeholderTextColor="#4A6F8A"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (submitting || isSafeZone) && { opacity: 0.45 },
              isSafeZone && { backgroundColor: FS.safe },
            ]}
            onPress={handleSubmit}
            disabled={submitting || isSafeZone}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>
                  {isSafeZone ? "🔒  SOS Unavailable — Area is Safe" : "🆘  Submit Rescue Request"}
                </Text>
            }
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            SOS submissions are restricted to flood-affected zones (WATCH / WARNING / DANGER) to prevent misuse.
            For immediate life-threatening danger, always call 999 first.
          </Text>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: FS.border,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { color: FS.primary, fontSize: 14, fontWeight: "700" },
  screenTitle: { fontSize: 17, fontWeight: "900", color: FS.text, flex: 1 },
  rescuerBtn: {
    backgroundColor: FS.surface, borderRadius: 8, borderWidth: 1, borderColor: FS.border,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  rescuerBtnText: { color: FS.subtext, fontSize: 11, fontWeight: "700" },

  scroll: { padding: 20, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 11, fontWeight: "900", color: FS.subtext, letterSpacing: 1.2, marginBottom: 12,
  },
  callGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  callCard: {
    flex: 1, minWidth: "44%", borderRadius: 12, borderWidth: 1.5,
    padding: 14, alignItems: "center", gap: 4,
  },
  callIcon:   { fontSize: 26 },
  callLabel:  { fontSize: 13, fontWeight: "800" },
  callNumber: { fontSize: 12, fontWeight: "600", opacity: 0.9 },

  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: FS.border },
  dividerText: { fontSize: 10, fontWeight: "800", color: FS.subtext, letterSpacing: 1 },

  gpsBtn: {
    borderWidth: 1.5, borderColor: FS.border, borderRadius: 12, borderStyle: "dashed",
    padding: 14, alignItems: "center", marginBottom: 20, backgroundColor: FS.surface,
  },
  gpsBtnActive: { borderColor: FS.safe, borderStyle: "solid", backgroundColor: FS.safe + "18" },
  gpsBtnText: { color: FS.subtext, fontSize: 13, fontWeight: "700", textAlign: "center" },

  formLabel: { fontSize: 13, fontWeight: "800", color: FS.text, marginBottom: 10, marginTop: 4 },
  optional:  { fontSize: 11, fontWeight: "400", color: FS.subtext },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: FS.border, backgroundColor: FS.card,
  },
  chipActive:     { backgroundColor: FS.primary, borderColor: FS.primary },
  chipSafe:       { backgroundColor: FS.safe + "22", borderColor: FS.safe },
  chipDimmed:     { opacity: 0.5 },
  chipDot:        { fontSize: 10 },
  chipText:       { fontSize: 12, color: FS.subtext, fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "800" },

  statusLegend: {
    backgroundColor: FS.surface, borderRadius: 8, padding: 8, marginBottom: 10,
    borderWidth: 1, borderColor: FS.border,
  },
  statusLegendText: { fontSize: 10, color: FS.subtext, textAlign: "center" },

  safeWarning: {
    backgroundColor: FS.safe + "18", borderRadius: 10, padding: 10,
    marginBottom: 16, borderWidth: 1, borderColor: FS.safe,
  },
  safeWarningText: { fontSize: 12, color: FS.safe, fontWeight: "600", textAlign: "center" },

  countRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  countChip: {
    width: 46, height: 40, borderRadius: 10, borderWidth: 1,
    borderColor: FS.border, backgroundColor: FS.card, alignItems: "center", justifyContent: "center",
  },

  textInput: {
    backgroundColor: FS.card, borderWidth: 1, borderColor: FS.border,
    borderRadius: 12, padding: 14, color: FS.text, fontSize: 13, minHeight: 90, marginBottom: 20,
  },

  submitBtn: {
    backgroundColor: FS.danger, borderRadius: 14, paddingVertical: 16, alignItems: "center",
    elevation: 4, shadowColor: FS.danger, shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, marginBottom: 16,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },

  disclaimer: { fontSize: 11, color: FS.subtext, textAlign: "center", lineHeight: 17 },

  // ── Success
  successWrap:   { flex: 1 },
  successScroll: { padding: 28, alignItems: "center", paddingBottom: 40 },
  successEmoji:  { fontSize: 64, marginBottom: 12 },
  successTitle:  { fontSize: 24, fontWeight: "900", color: FS.safe, marginBottom: 20 },

  caseBox: {
    backgroundColor: FS.card, borderWidth: 1.5, borderColor: FS.safe,
    borderRadius: 16, padding: 20, alignItems: "center", width: "100%", marginBottom: 14,
  },
  caseLabel: { fontSize: 12, color: FS.subtext, fontWeight: "700", marginBottom: 6 },
  caseId:    { fontSize: 26, fontWeight: "900", color: FS.safe, letterSpacing: 2 },
  caseSub:   { fontSize: 11, color: FS.subtext, marginTop: 8, textAlign: "center" },

  infoBox: {
    backgroundColor: FS.surface, borderRadius: 12, padding: 14,
    width: "100%", marginBottom: 12, borderWidth: 1, borderColor: FS.border,
  },
  infoLabel: { fontSize: 12, color: FS.subtext, fontWeight: "700", marginBottom: 4 },
  infoValue: { fontSize: 13, color: FS.text, fontWeight: "700" },
  infoSub:   { fontSize: 11, color: FS.subtext, marginTop: 3 },
  mapsBtn:   { marginTop: 8 },
  mapsBtnText: { color: FS.primary, fontSize: 12, fontWeight: "700" },

  successNote: {
    fontSize: 12, color: FS.subtext, textAlign: "center",
    marginBottom: 24, lineHeight: 18, paddingHorizontal: 8,
  },
  actionBtn: {
    width: "100%", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginBottom: 10,
  },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
