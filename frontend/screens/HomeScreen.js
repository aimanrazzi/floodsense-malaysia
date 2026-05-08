import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Animated, useWindowDimensions,
  Image, Modal, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useTheme } from "../context/ThemeContext";
import { useLang } from "../context/LanguageContext";
import { translations } from "../utils/translations";
import { floodApi } from "../utils/api";

// ── Design tokens ─────────────────────────────────────────────────────────────
const FS = {
  primary: "#3B82F6", danger: "#EF4444", warning: "#F59E0B",
  watch: "#EAB308", safe: "#22C55E", bg: "#0F172A",
  surface: "#1E293B", card: "#1E293B", text: "#F1F5F9",
  subtext: "#94A3B8", border: "#334155",
};

const STATUS_ICON  = { DANGER: "🔴", WARNING: "🟠", WATCH: "🟡", SAFE: "🟢" };
const STATUS_COLOR = { DANGER: FS.danger, WARNING: FS.warning, WATCH: FS.watch, SAFE: FS.safe };

const URBAN_SET = new Set([
  "Klang","Gombak","Kepong","Cheras","Ampang",
  "Petaling Jaya","Bangsar","Subang Jaya","Shah Alam",
  "Johor Bahru","Ipoh","Kota Bharu","Kuala Terengganu",
  "Kuantan","Seremban","Melaka Tengah",
  "Alor Setar","Sungai Petani","Georgetown","Seberang Perai","Kangar",
]);

const MONITOR_COORDS = {
  "Klang":             [3.0449, 101.4468],
  "Gombak":            [3.2353, 101.7044],
  "Kepong":            [3.2119, 101.6293],
  "Cheras":            [3.0945, 101.7455],
  "Ampang":            [3.1478, 101.7618],
  "Petaling Jaya":     [3.1073, 101.6067],
  "Bangsar":           [3.1302, 101.6741],
  "Subang Jaya":       [3.0565, 101.5897],
  "Shah Alam":         [3.0733, 101.5185],
  "Kuala Selangor":    [3.3474, 101.2442],
  "Sepang":            [2.7305, 101.7164],
  "Johor Bahru":       [1.4927, 103.7414],
  "Kota Tinggi":       [1.7337, 103.9017],
  "Batu Pahat":        [1.8547, 102.9346],
  "Muar":              [2.0444, 102.5689],
  "Ipoh":              [4.5975, 101.0901],
  "Teluk Intan":       [4.0229, 101.0227],
  "Taiping":           [4.8500, 100.7333],
  "Kota Bharu":        [6.1254, 102.2381],
  "Pasir Mas":         [6.0500, 102.1333],
  "Kuala Krai":        [5.5333, 102.2000],
  "Kuala Terengganu":  [5.3302, 103.1408],
  "Kemaman":           [4.2333, 103.4167],
  "Kuantan":           [3.8077, 103.3260],
  "Temerloh":          [3.4500, 102.4167],
  "Pekan":             [3.4883, 103.3887],
  "Seremban":          [2.7297, 101.9381],
  "Port Dickson":      [2.5234, 101.7966],
  "Melaka Tengah":     [2.1972, 102.2501],
  "Alor Gajah":        [2.3799, 102.2061],
  "Alor Setar":        [6.1184, 100.3686],
  "Sungai Petani":     [5.6479, 100.4883],
  "Baling":            [5.6833, 100.9167],
  "Georgetown":        [5.4141, 100.3288],
  "Seberang Perai":    [5.3971, 100.3985],
  "Kangar":            [6.4414, 100.1986],
};

const DISTRICT_TO_STATE = {
  "Klang":"Selangor","Gombak":"Selangor","Kepong":"Selangor","Cheras":"Selangor",
  "Ampang":"Selangor","Petaling Jaya":"Selangor","Bangsar":"Selangor",
  "Subang Jaya":"Selangor","Shah Alam":"Selangor","Kuala Selangor":"Selangor","Sepang":"Selangor",
  "Johor Bahru":"Johor","Kota Tinggi":"Johor","Batu Pahat":"Johor","Muar":"Johor",
  "Ipoh":"Perak","Teluk Intan":"Perak","Taiping":"Perak",
  "Kota Bharu":"Kelantan","Pasir Mas":"Kelantan","Kuala Krai":"Kelantan",
  "Kuala Terengganu":"Terengganu","Kemaman":"Terengganu",
  "Kuantan":"Pahang","Temerloh":"Pahang","Pekan":"Pahang",
  "Seremban":"Negeri Sembilan","Port Dickson":"Negeri Sembilan",
  "Melaka Tengah":"Melaka","Alor Gajah":"Melaka",
  "Alor Setar":"Kedah","Sungai Petani":"Kedah","Baling":"Kedah",
  "Georgetown":"Pulau Pinang","Seberang Perai":"Pulau Pinang",
  "Kangar":"Perlis",
};

const STATE_LIST = [
  "Selangor","Johor","Perak","Kelantan","Terengganu",
  "Pahang","Negeri Sembilan","Melaka","Kedah","Pulau Pinang","Perlis",
];

function nearestDistrict(userLat, userLng) {
  let best = null, bestDist = Infinity;
  for (const [district, [dlat, dlng]] of Object.entries(MONITOR_COORDS)) {
    const d = Math.hypot(dlat - userLat, dlng - userLng);
    if (d < bestDist) { bestDist = d; best = district; }
  }
  return best;
}

function formatTime(iso) {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
}

function getDrainStress(rainfall, tf) {
  if (rainfall >= 70) return { label: tf.drainCrit, color: FS.danger };
  if (rainfall >= 50) return { label: tf.drainHigh, color: FS.warning };
  if (rainfall >= 30) return { label: tf.drainMod,  color: FS.watch };
  return                      { label: tf.drainLow,  color: FS.safe };
}

const LANGUAGES = [
  { code: "en", label: "EN",   full: "English" },
  { code: "ms", label: "MY",   full: "Melayu" },
  { code: "zh", label: "中文", full: "中文" },
  { code: "ta", label: "த",   full: "தமிழ்" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function FloodMapScreen({ navigation }) {
  useTheme();
  const { lang, changeLang } = useLang();
  const tf = (translations[lang] || translations.en).flood;
  const { width: SCREEN_W } = useWindowDimensions();

  const [levels,           setLevels]           = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [lastUpdated,      setLastUpdated]      = useState(null);
  const [bannerDismissed,  setBannerDismissed]  = useState(false);
  const [prevOverallRisk,  setPrevOverallRisk]  = useState("SAFE");
  const [activeTab,        setActiveTab]        = useState(0);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [selectedState,    setSelectedState]    = useState(null); // null = All Peninsula

  // GPS state
  const [userDistrict,    setUserDistrict]    = useState(null);
  const [locationDenied,  setLocationDenied]  = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);

  const userState = userDistrict ? (DISTRICT_TO_STATE[userDistrict] || null) : null;

  const bannerAnim = useRef(new Animated.Value(0)).current;
  const hScrollRef = useRef(null);

  // ── Fetch flood levels ──────────────────────────────────────────────────────
  const fetchLevels = useCallback(async () => {
    setError(null);
    try {
      const data = await floodApi.getLevels();
      setLevels(data.data || []);
      setLastUpdated(new Date().toISOString());
    } catch {
      setError(tf.connectionError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLevels();
    const t = setInterval(fetchLevels, 30000);
    return () => clearInterval(t);
  }, [fetchLevels]);

  // ── GPS location ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setLocationDenied(true); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserDistrict(nearestDistrict(loc.coords.latitude, loc.coords.longitude));
      } catch {
        setLocationDenied(true);
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  // Auto-select user's state when GPS resolves (only if still on "All")
  useEffect(() => {
    if (userDistrict && selectedState === null) {
      const s = DISTRICT_TO_STATE[userDistrict];
      if (s) setSelectedState(s);
    }
  }, [userDistrict]);

  // ── Risk aggregation (banner: user's own state only, not browsed state) ──────
  const overallRisk = levels
    .filter(i => !userState || (i.state || "Selangor") === userState)
    .reduce((worst, item) => {
      const ord = { DANGER: 4, WARNING: 3, WATCH: 2, SAFE: 1 };
      return (ord[item.status] || 0) > (ord[worst] || 0) ? item.status : worst;
    }, "SAFE");

  useEffect(() => {
    if (overallRisk !== prevOverallRisk) {
      setBannerDismissed(false);
      setPrevOverallRisk(overallRisk);
    }
  }, [overallRisk]);

  const showBanner    = !bannerDismissed && (overallRisk === "WARNING" || overallRisk === "DANGER");
  const worstDistrict = levels.find(i => i.status === overallRisk);
  const worstColor    = STATUS_COLOR[overallRisk] || FS.safe;
  const worstIcon     = STATUS_ICON[overallRisk]  || "🟢";

  useEffect(() => {
    Animated.timing(bannerAnim, {
      toValue: showBanner ? 1 : 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [showBanner]);

  // ── District splits — filtered by selected state ──────────────────────────
  const displayLevels = selectedState
    ? levels.filter(i => (i.state || "Selangor") === selectedState)
    : levels;
  const flashZones  = displayLevels.filter(i => URBAN_SET.has(i.district));
  const riverZones  = displayLevels.filter(i => !URBAN_SET.has(i.district));
  const flashAlerts = flashZones.filter(i => i.status !== "SAFE").length;
  const riverAlerts = riverZones.filter(i => i.status !== "SAFE").length;

  const userAreaData = userDistrict ? levels.find(i => i.district === userDistrict) : null;

  const scrollToTab = (idx) => {
    hScrollRef.current?.scrollTo({ x: idx * SCREEN_W, animated: true });
    setActiveTab(idx);
  };

  // ── Your Area card ──────────────────────────────────────────────────────────
  const YourAreaSection = () => {
    if (locationLoading) {
      return (
        <View style={styles.yourAreaLoading}>
          <ActivityIndicator size="small" color={FS.primary} />
          <Text style={styles.yourAreaLoadingText}>Locating you…</Text>
        </View>
      );
    }

    if (locationDenied || !userDistrict) {
      return (
        <TouchableOpacity
          style={styles.yourAreaPrompt}
          onPress={async () => {
            setLocationLoading(true);
            setLocationDenied(false);
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== "granted") { setLocationDenied(true); return; }
              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              setUserDistrict(nearestDistrict(loc.coords.latitude, loc.coords.longitude));
            } catch { setLocationDenied(true); }
            finally { setLocationLoading(false); }
          }}
        >
          <Text style={styles.yourAreaPromptIcon}>📍</Text>
          <Text style={styles.yourAreaPromptText}>{tf.enableLocation}</Text>
          <Text style={styles.yourAreaPromptBtn}>{tf.allowLocation} →</Text>
        </TouchableOpacity>
      );
    }

    if (!userAreaData) {
      return (
        <View style={styles.yourAreaLoading}>
          <Text style={styles.yourAreaLoadingText}>📍 {userDistrict} — {tf.fetchingData}</Text>
        </View>
      );
    }

    const isFlash = URBAN_SET.has(userAreaData.district);
    const color   = STATUS_COLOR[userAreaData.status] || FS.safe;
    const icon    = STATUS_ICON[userAreaData.status]  || "🟢";
    const ds      = getDrainStress(userAreaData.rainfall_rate, tf);

    return (
      <TouchableOpacity
        style={[styles.yourAreaCard, { borderColor: color }]}
        onPress={() => navigation.navigate("AlertDetail", { reading: userAreaData })}
        activeOpacity={0.88}
      >
        <LinearGradient colors={[color + "28", color + "08"]} style={styles.yourAreaGrad}>
          <View style={styles.yourAreaTop}>
            <View style={styles.yourAreaLabelRow}>
              <Text style={styles.yourAreaPin}>📍</Text>
              <Text style={styles.yourAreaLabel}>{tf.yourArea}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: color + "33", borderColor: color }]}>
              <Text style={[styles.statusBadgeText, { color }]}>{icon} {tf[userAreaData.status?.toLowerCase()] || userAreaData.status}</Text>
            </View>
          </View>

          <Text style={styles.yourAreaDistrict}>{userAreaData.district}</Text>
          <Text style={styles.yourAreaSub}>
            {isFlash ? tf.urbanFlashZone : userAreaData.river}
          </Text>

          <View style={styles.yourAreaMetricRow}>
            {isFlash ? (
              <>
                <View style={styles.yourAreaMetric}>
                  <Text style={[styles.yourAreaBigNum, { color }]}>{userAreaData.rainfall_rate.toFixed(1)}</Text>
                  <Text style={styles.yourAreaUnit}>{tf.rainfall}</Text>
                </View>
                <View style={[styles.yourAreaDrainBadge, { backgroundColor: ds.color + "33", borderColor: ds.color }]}>
                  <Text style={[styles.yourAreaDrainText, { color: ds.color }]}>{ds.label}</Text>
                </View>
                <View style={styles.yourAreaMetric}>
                  <Text style={[styles.yourAreaBigNum, { color: FS.subtext, fontSize: 18 }]}>{userAreaData.river_level.toFixed(1)}</Text>
                  <Text style={styles.yourAreaUnit}>m</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.yourAreaMetric}>
                  <Text style={[styles.yourAreaBigNum, { color }]}>{userAreaData.river_level.toFixed(1)}</Text>
                  <Text style={styles.yourAreaUnit}>m</Text>
                </View>
                <View style={styles.yourAreaMetric}>
                  <Text style={[styles.yourAreaBigNum, { color: FS.subtext, fontSize: 18 }]}>{userAreaData.rainfall_rate.toFixed(1)}</Text>
                  <Text style={styles.yourAreaUnit}>{tf.rainfall}</Text>
                </View>
              </>
            )}
            <Text style={[styles.yourAreaHint, { color }]}>{tf.viewDetails}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // ── District card renderer ──────────────────────────────────────────────────
  const renderCard = (item) => {
    const isFlash = URBAN_SET.has(item.district);
    const color   = STATUS_COLOR[item.status] || FS.safe;
    const icon    = STATUS_ICON[item.status]  || "🟢";
    const label   = tf[item.status?.toLowerCase()] || item.status;
    const ds      = getDrainStress(item.rainfall_rate, tf);
    const isYours = item.district === userDistrict;

    return (
      <TouchableOpacity
        key={item.river}
        style={[
          styles.card,
          { borderLeftColor: color, borderLeftWidth: 4 },
          isYours && styles.cardHighlighted,
        ]}
        onPress={() => navigation.navigate("AlertDetail", { reading: item })}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.districtName}>{item.district}</Text>
              {isYours && <Text style={styles.youBadge}>📍</Text>}
            </View>
            <Text style={styles.districtSub}>
              {isFlash ? tf.urbanFlashZone : item.river}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: color + "22", borderColor: color }]}>
            <Text style={[styles.statusBadgeText, { color }]}>{icon} {label}</Text>
          </View>
        </View>

        <View style={styles.cardMetrics}>
          {isFlash ? (
            <>
              <View style={styles.metric}>
                <Text style={styles.metricIcon}>🌧</Text>
                <Text style={styles.metricValue}>{item.rainfall_rate.toFixed(1)}</Text>
                <Text style={styles.metricLabel}>{tf.rainfall}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <View style={[styles.drainBadge, { backgroundColor: ds.color + "33", borderColor: ds.color }]}>
                  <Text style={[styles.drainBadgeText, { color: ds.color }]}>{ds.label}</Text>
                </View>
                <Text style={styles.metricLabel}>Intensity</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <Text style={styles.metricIcon}>🌊</Text>
                <Text style={styles.metricValue}>{item.river_level.toFixed(1)}m</Text>
                <Text style={styles.metricLabel}>{tf.riverLevel}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.metric}>
                <Text style={styles.metricIcon}>🌊</Text>
                <Text style={styles.metricValue}>{item.river_level.toFixed(1)}m</Text>
                <Text style={styles.metricLabel}>{tf.riverLevel}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <Text style={styles.metricIcon}>🌧</Text>
                <Text style={styles.metricValue}>{item.rainfall_rate.toFixed(1)}</Text>
                <Text style={styles.metricLabel}>{tf.rainfall}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <Text style={styles.metricIcon}>⛅</Text>
                <Text style={[styles.metricValue, { fontSize: 9 }]} numberOfLines={2}>
                  {item.condition || "Clear"}
                </Text>
                <Text style={styles.metricLabel}>Weather</Text>
              </View>
            </>
          )}
        </View>

        {(() => {
          const peak  = Math.max(item.forecast_1h || 0, item.forecast_2h || 0);
          const trend = item.trend;
          if (!peak && !trend) return null;
          const trendColor = trend === "rising" ? "#F59E0B" : trend === "easing" ? "#16A34A" : "#64748B";
          const trendLabel = trend === "rising"
            ? `Rain building — ${peak.toFixed(1)}mm expected next 2h`
            : trend === "easing"
            ? "Rain easing off"
            : peak > 0 ? `${peak.toFixed(1)}mm forecast next 2h` : "Stable conditions";
          return (
            <View style={[styles.forecastRow, { borderColor: trendColor + "55" }]}>
              {trend === "rising"
                ? <Image source={require("../assets/arrow_up.png")} style={styles.forecastArrow} />
                : trend === "easing"
                ? <Image source={require("../assets/arrow_down.png")} style={styles.forecastArrow} />
                : <Text style={[styles.forecastIcon, { color: trendColor }]}>→</Text>
              }
              <Text style={[styles.forecastText, { color: trendColor }]}>{trendLabel}</Text>
              {(item.rain_chance_max || 0) > 0 && (
                <Text style={[styles.forecastChance, { color: trendColor }]}>{item.rain_chance_max}% chance</Text>
              )}
            </View>
          );
        })()}

        {(item.status === "WARNING" || item.status === "DANGER") && (
          <TouchableOpacity
            style={[styles.evacuateBtn, { backgroundColor: color + "22", borderColor: color }]}
            onPress={() => navigation.navigate("Evacuation", { district: item.district, risk: item.status })}
          >
            <Text style={[styles.evacuateBtnText, { color }]}>🏃 {tf.findEvacuation}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.tapHint}>{tf.viewAiAnalysis}</Text>
      </TouchableOpacity>
    );
  };

  // ── Legend ──────────────────────────────────────────────────────────────────
  const Legend = ({ type }) => {
    const data = type === "flash" ? [
      [tf.safe,    "< 15mm/hr",  FS.safe],
      [tf.watch,   "15–30mm/hr", FS.watch],
      [tf.warning, "30–50mm/hr", FS.warning],
      [tf.danger,  "> 50mm/hr",  FS.danger],
    ] : [
      [tf.safe,    "< 3.0m",   FS.safe],
      [tf.watch,   "3–4.5m",   FS.watch],
      [tf.warning, "4.5–5.5m", FS.warning],
      [tf.danger,  "> 5.5m",   FS.danger],
    ];
    return (
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>
          {type === "flash" ? tf.rainfallThresholds : tf.jpsThresholds}
        </Text>
        <View style={styles.legendRow}>
          {data.map(([label, range, color]) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendLabel}>{label}</Text>
              <Text style={styles.legendRange}>{range}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={["#0F172A", "#0F172A", "#131F35"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={FS.bg} />

        {/* Alert banner */}
        {(showBanner || bannerAnim._value > 0) && (
          <Animated.View style={[
            styles.alertBanner,
            { borderColor: worstColor, backgroundColor: worstColor + "22" },
            { opacity: bannerAnim, transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }] },
          ]}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerIcon}>{worstIcon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerTitle, { color: worstColor }]}>{overallRisk} {tf.detected}</Text>
                <Text style={styles.bannerSub}>
                  {worstDistrict ? `${worstDistrict.district} — ${tf.aiReady}` : tf.anomalyFlagged}
                </Text>
              </View>
            </View>
            <View style={styles.bannerActions}>
              <TouchableOpacity style={[styles.bannerBtn, { backgroundColor: worstColor }]} onPress={() => { setBannerDismissed(true); if (worstDistrict) navigation.navigate("AlertDetail", { reading: worstDistrict }); }}>
                <Text style={styles.bannerBtnText}>{tf.viewBtn}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBannerDismissed(true)} style={styles.dismissBtn}>
                <Text style={styles.dismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image source={require("../assets/logo.png")} style={styles.logoImg} />
            <Text style={styles.appName}>{tf.appTitle}</Text>
          </View>
            <Text style={styles.appSub}>{tf.appSub}</Text>
          </View>
          {/* Language dropdown trigger */}
          <TouchableOpacity
            style={styles.langDropdownBtn}
            onPress={() => setLangDropdownOpen(true)}
          >
            <Text style={styles.langDropdownText}>{currentLang.label}</Text>
            <Text style={styles.langDropdownCaret}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Language selection modal */}
        <Modal
          visible={langDropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setLangDropdownOpen(false)}
        >
          <Pressable style={styles.langModalOverlay} onPress={() => setLangDropdownOpen(false)}>
            <View style={styles.langModalMenu}>
              <Text style={styles.langModalTitle}>Select Language</Text>
              {LANGUAGES.map(l => (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.langModalItem, lang === l.code && styles.langModalItemActive]}
                  onPress={() => { changeLang(l.code); setLangDropdownOpen(false); }}
                >
                  <Text style={[styles.langModalItemText, lang === l.code && styles.langModalItemTextActive]}>
                    {l.label} · {l.full}
                  </Text>
                  {lang === l.code && <Text style={styles.langModalCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Subheader — update time */}
        {lastUpdated && (
          <View style={styles.subHeader}>
            <Text style={styles.updateTime}>{tf.updated} {formatTime(lastUpdated)} · {tf.autoRefresh}</Text>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={FS.primary} />
            <Text style={styles.loadingText}>{tf.fetchingData}</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchLevels}>
              <Text style={styles.retryText}>{tf.retry}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && (
          <>
            {/* Your Area */}
            <View style={styles.yourAreaWrap}>
              <YourAreaSection />
            </View>

            {/* State filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stateChipsRow}
              style={styles.stateChipsWrap}
            >
              {/* All Peninsula chip */}
              <TouchableOpacity
                style={[styles.stateChip, !selectedState && styles.stateChipActive]}
                onPress={() => setSelectedState(null)}
                activeOpacity={0.75}
              >
                <Text style={[styles.stateChipText, !selectedState && styles.stateChipTextActive]}>
                  All Peninsula
                </Text>
              </TouchableOpacity>

              {STATE_LIST.map(state => {
                const isActive  = selectedState === state;
                const isHome    = state === userState;
                const alerts    = levels.filter(i => (i.state || "Selangor") === state && i.status !== "SAFE").length;
                return (
                  <TouchableOpacity
                    key={state}
                    style={[styles.stateChip, isActive && styles.stateChipActive, isHome && !isActive && styles.stateChipHome]}
                    onPress={() => setSelectedState(state)}
                    activeOpacity={0.75}
                  >
                    {isHome && <Text style={styles.stateChipPin}>📍</Text>}
                    <Text style={[styles.stateChipText, isActive && styles.stateChipTextActive, isHome && !isActive && styles.stateChipTextHome]}>
                      {state}
                    </Text>
                    {alerts > 0 && (
                      <View style={[styles.stateChipBadge, {backgroundColor: alerts > 2 ? FS.danger : FS.warning}]}>
                        <Text style={styles.stateChipBadgeText}>{alerts}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Browsing notice — shown when viewing a different state */}
            {selectedState && selectedState !== userState && userState && (
              <View style={styles.browsingNotice}>
                <Text style={styles.browsingNoticeText}>
                  Browsing {selectedState} · Notifications active for {userState} only
                </Text>
              </View>
            )}

            {/* Tab bar */}
            <View style={styles.tabBar}>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 0 && styles.tabBtnActive]} onPress={() => scrollToTab(0)} activeOpacity={0.8}>
                <Text style={[styles.tabLabel, activeTab === 0 && styles.tabLabelActive]}>{tf.flashFloodZones}</Text>
                {flashAlerts > 0
                  ? <View style={[styles.tabBadge, { backgroundColor: FS.danger }]}><Text style={styles.tabBadgeText}>{flashAlerts}</Text></View>
                  : <Text style={styles.tabClear}>{tf.allClear}</Text>}
              </TouchableOpacity>
              <View style={styles.tabSep} />
              <TouchableOpacity style={[styles.tabBtn, activeTab === 1 && styles.tabBtnActive]} onPress={() => scrollToTab(1)} activeOpacity={0.8}>
                <Text style={[styles.tabLabel, activeTab === 1 && styles.tabLabelActive]}>{tf.riverOverflowZones}</Text>
                {riverAlerts > 0
                  ? <View style={[styles.tabBadge, { backgroundColor: FS.primary }]}><Text style={styles.tabBadgeText}>{riverAlerts}</Text></View>
                  : <Text style={styles.tabClear}>{tf.allClear}</Text>}
              </TouchableOpacity>
            </View>

            {/* Dot indicators */}
            <View style={styles.dotsRow}>
              {[0, 1].map(i => <View key={i} style={[styles.dot, activeTab === i && styles.dotActive]} />)}
            </View>

            {/* Horizontal pager */}
            <ScrollView
              ref={hScrollRef}
              horizontal pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={e => setActiveTab(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
              style={{ flex: 1 }}
            >
              {/* Page 0 — Flash Flood */}
              <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
                {flashZones.length === 0
                  ? <View style={styles.emptyPage}><Text style={styles.emptyIcon}>⚡</Text><Text style={styles.emptyText}>{tf.flashFloodZones}</Text></View>
                  : flashZones.map(renderCard)}
                <Legend type="flash" />
                <View style={{ height: 110 }} />
              </ScrollView>

              {/* Page 1 — River Overflow */}
              <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
                {riverZones.length === 0
                  ? <View style={styles.emptyPage}><Text style={styles.emptyIcon}>🌊</Text><Text style={styles.emptyText}>{tf.riverOverflowZones}</Text></View>
                  : riverZones.map(renderCard)}
                <Legend type="river" />
                <View style={{ height: 110 }} />
              </ScrollView>
            </ScrollView>
          </>
        )}

        {/* Floating SOS */}
        <TouchableOpacity style={styles.sosBtn} onPress={() => navigation.navigate("Rescue")} activeOpacity={0.85}>
          <Text style={styles.sosBtnIcon}>🆘</Text>
          <Text style={styles.sosBtnText}>{tf.sos}</Text>
        </TouchableOpacity>

      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  alertBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 12, marginTop: 6, marginBottom: 4,
    borderRadius: 12, borderWidth: 1.5, padding: 12, elevation: 6,
  },
  bannerLeft:    { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  bannerIcon:    { fontSize: 26 },
  bannerTitle:   { fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  bannerSub:     { fontSize: 12, color: FS.subtext, marginTop: 2 },
  bannerActions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
  bannerBtn:     { borderRadius: 7, paddingHorizontal: 12, paddingVertical: 6 },
  bannerBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  dismissBtn:    { padding: 4 },
  dismissText:   { color: FS.subtext, fontSize: 16, fontWeight: "600" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 8,
  },
  logoImg: { width: 40, height: 40, resizeMode: "contain",borderRadius: 8 },
  appName: { fontSize: 26, fontWeight: "900", color: FS.text, letterSpacing: -0.5 },
  appSub:  { fontSize: 13, color: FS.subtext, marginTop: 1 },

  langDropdownBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: FS.surface, borderRadius: 10,
    borderWidth: 1, borderColor: FS.border,
  },
  langDropdownText:  { fontSize: 13, color: FS.text, fontWeight: "700" },
  langDropdownCaret: { fontSize: 9, color: FS.subtext },

  langModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 48,
  },
  langModalMenu: {
    backgroundColor: FS.card, borderRadius: 16, borderWidth: 1,
    borderColor: FS.border, overflow: "hidden", width: "100%", elevation: 14,
  },
  langModalTitle: {
    fontSize: 13, fontWeight: "800", color: FS.subtext, letterSpacing: 0.5,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: FS.border,
  },
  langModalItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: FS.border,
  },
  langModalItemActive:     { backgroundColor: FS.primary + "22" },
  langModalItemText:       { fontSize: 15, color: FS.subtext, fontWeight: "600" },
  langModalItemTextActive: { color: FS.primary, fontWeight: "800" },
  langModalCheck:          { color: FS.primary, fontSize: 16, fontWeight: "900" },

  subHeader: {
    paddingHorizontal: 16, paddingBottom: 8,
  },
  updateTime: { fontSize: 12, color: FS.subtext },

  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: FS.subtext, marginTop: 12, fontSize: 15 },
  errorBox: {
    margin: 16, backgroundColor: FS.danger + "22", borderColor: FS.danger,
    borderWidth: 1, borderRadius: 12, padding: 16, alignItems: "center",
  },
  errorText: { color: FS.danger, fontSize: 14, textAlign: "center", marginBottom: 12 },
  retryBtn:  { backgroundColor: FS.danger, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Your Area
  yourAreaWrap: { paddingHorizontal: 16, marginBottom: 8 },
  yourAreaCard: {
    borderRadius: 16, borderWidth: 1.5, overflow: "hidden",
    elevation: 6, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  yourAreaGrad:      { padding: 14 },
  yourAreaTop:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  yourAreaLabelRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  yourAreaPin:       { fontSize: 14 },
  yourAreaLabel:     { fontSize: 13, fontWeight: "800", color: FS.subtext, letterSpacing: 0.5 },
  yourAreaDistrict:  { fontSize: 25, fontWeight: "900", color: FS.text, marginBottom: 2 },
  yourAreaSub:       { fontSize: 13, color: FS.subtext, marginBottom: 10 },
  yourAreaMetricRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  yourAreaMetric:    { flexDirection: "row", alignItems: "baseline", gap: 4 },
  yourAreaBigNum:    { fontSize: 32, fontWeight: "900" },
  yourAreaUnit:      { fontSize: 14, color: FS.subtext, fontWeight: "600" },
  yourAreaDrainBadge:{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  yourAreaDrainText: { fontSize: 13, fontWeight: "900" },
  yourAreaHint:      { marginLeft: "auto", fontSize: 12, fontWeight: "700" },

  yourAreaLoading: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: FS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: FS.border,
  },
  yourAreaLoadingText: { color: FS.subtext, fontSize: 13 },

  yourAreaPrompt: {
    backgroundColor: FS.surface, borderRadius: 12, borderWidth: 1,
    borderColor: FS.primary + "55", borderStyle: "dashed",
    padding: 14, flexDirection: "row", alignItems: "center", gap: 10,
  },
  yourAreaPromptIcon: { fontSize: 20 },
  yourAreaPromptText: { flex: 1, fontSize: 13, color: FS.subtext },
  yourAreaPromptBtn:  { fontSize: 13, color: FS.primary, fontWeight: "800" },

  // Tab bar
  tabBar: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 4,
    backgroundColor: FS.surface, borderRadius: 14, borderWidth: 1, borderColor: FS.border, overflow: "hidden",
  },
  tabBtn:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 6, gap: 5 },
  tabBtnActive:   { backgroundColor: FS.card },
  tabLabel:       { fontSize: 13, fontWeight: "700", color: FS.subtext },
  tabLabelActive: { color: FS.text, fontWeight: "900" },
  tabBadge:       { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: "center" },
  tabBadgeText:   { color: "#fff", fontSize: 11, fontWeight: "900" },
  tabClear:       { fontSize: 11, color: FS.safe, fontWeight: "700" },
  tabSep:         { width: 1, backgroundColor: FS.border, marginVertical: 8 },

  dotsRow:  { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 8 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: FS.border },
  dotActive: { backgroundColor: FS.primary, width: 18 },

  // Pages
  pageScroll: { padding: 14, paddingTop: 6 },
  emptyPage:  { alignItems: "center", paddingVertical: 60 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyText:  { color: FS.subtext, fontSize: 15 },

  // Card
  card: {
    backgroundColor: FS.card, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: FS.border, elevation: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6,
  },
  cardHighlighted: { borderColor: FS.primary + "88", borderWidth: 1.5 },
  cardHeader:      { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  districtName:    { fontSize: 20, fontWeight: "800", color: FS.text },
  districtSub:     { fontSize: 12, color: FS.subtext, marginTop: 3 },
  youBadge:        { fontSize: 14 },
  statusBadge:     { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: "800" },

  cardMetrics:    { flexDirection: "row", backgroundColor: FS.surface, borderRadius: 10, padding: 10, marginBottom: 10 },
  metric:         { flex: 1, alignItems: "center" },
  metricIcon:     { fontSize: 17, marginBottom: 4 },
  metricValue:    { fontSize: 17, fontWeight: "700", color: FS.text },
  metricLabel:    { fontSize: 12, color: "#A8CCE0", marginTop: 2 },
  metricDivider:  { width: 1, backgroundColor: FS.border, marginVertical: 4 },
  drainBadge:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 2 },
  drainBadgeText: { fontSize: 10, fontWeight: "900" },

  levelBarBg:     { height: 5, backgroundColor: FS.border, borderRadius: 999, overflow: "hidden", marginBottom: 4 },
  levelBarFill:   { height: "100%", borderRadius: 999 },
  levelBarLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  levelBarLabel:  { fontSize: 11, color: "#A8CCE0" },

  evacuateBtn:     { borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", marginBottom: 6 },
  evacuateBtnText: { fontSize: 12, fontWeight: "800" },
  tapHint:         { fontSize: 11, color: FS.primary, textAlign: "right", fontWeight: "600" },

  forecastRow:    { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6, gap: 5 },
  forecastArrow:  { width: 14, height: 14, resizeMode: "contain" },
  forecastIcon:   { fontSize: 12, fontWeight: "700" },
  forecastText:   { fontSize: 12, fontWeight: "600", flex: 1 },
  forecastChance: { fontSize: 11, fontWeight: "600" },

  legend: {
    backgroundColor: FS.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: FS.border, marginTop: 4,
  },
  legendTitle: { fontSize: 12, color: FS.subtext, fontWeight: "700", marginBottom: 8 },
  legendRow:   { flexDirection: "row", justifyContent: "space-between" },
  legendItem:  { alignItems: "center", flex: 1 },
  legendDot:   { width: 9, height: 9, borderRadius: 5, marginBottom: 4 },
  legendLabel: { fontSize: 12, color: FS.text, fontWeight: "700" },
  legendRange: { fontSize: 10, color: "#A8CCE0", marginTop: 2 },

  sosBtn: {
    position: "absolute", bottom: 96, right: 20,
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#DC2626",
    alignItems: "center", justifyContent: "center", elevation: 10,
    shadowColor: "#DC2626", shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 5 },
  },
  sosBtnIcon: { fontSize: 22, lineHeight: 26 },
  sosBtnText: { fontSize: 10, fontWeight: "900", color: "#fff", letterSpacing: 1 },

  // State chips
  stateChipsWrap: { maxHeight: 44, marginBottom: 6 },
  stateChipsRow: { paddingHorizontal: 16, gap: 6, alignItems: "center" },
  stateChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: FS.border,
    backgroundColor: FS.surface,
  },
  stateChipActive: { backgroundColor: FS.primary, borderColor: FS.primary },
  stateChipHome:   { borderColor: FS.primary + "88" },
  stateChipPin:    { fontSize: 10 },
  stateChipText:       { fontSize: 12, fontWeight: "700", color: FS.subtext },
  stateChipTextActive: { color: "#fff" },
  stateChipTextHome:   { color: FS.primary },
  stateChipBadge:      { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, minWidth: 16, alignItems: "center" },
  stateChipBadgeText:  { color: "#fff", fontSize: 10, fontWeight: "900" },

  browsingNotice: {
    marginHorizontal: 16, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: FS.primary + "18", borderRadius: 8, borderWidth: 1,
    borderColor: FS.primary + "44",
  },
  browsingNoticeText: { fontSize: 11, color: FS.primary, fontWeight: "600", textAlign: "center" },
});
