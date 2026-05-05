import React, { useState } from "react";

let qrImage = null;
try { qrImage = require("../assets/qrcode.png"); } catch {}
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLang } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { translations } from "../utils/translations";
import { securePost } from "../utils/api";

export default function QRScreen({ embedded = false }) {
  const { lang } = useLang();
  const t = translations[lang] || translations.en;
  const { theme } = useTheme();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const styles = makeStyles(theme);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await securePost("/analyze", { text: data });
      const json = await response.json();
      if (json.error) {
        setError(json.error);
      } else {
        setResult({ ...json, url: data });
      }
    } catch {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScanned(false);
    setResult(null);
    setError(null);
    setScanning(false);
  };

  const getStatusColor = (status) => {
    if (status === "SAFE") return theme.safe;
    if (status === "SUSPICIOUS") return theme.warning;
    return theme.danger;
  };

  if (!permission) return <View style={styles.container} />;

  const Wrap = embedded ? View : SafeAreaView;

  if (!permission.granted) {
    return (
      <Wrap style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.permIcon}>📷</Text>
          <Text style={styles.permTitle}>{t.cameraPermRequired}</Text>
          <Text style={styles.permSubtitle}>{t.allowCameraAccess}</Text>
          <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
            <Text style={styles.permButtonText}>{t.grantPermission}</Text>
          </TouchableOpacity>
        </View>
      </Wrap>
    );
  }

  return (
    <Wrap style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.qrCodeScanner}</Text>
        <Text style={styles.subtitle}>{t.qrSubtitle}</Text>
      </View>

      {scanning ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setScanning(false)}>
            <Text style={styles.cancelText}>{t.cancelScan}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          {!result && !loading && !error && (
            <View style={styles.topContent}>
              <View style={styles.qrIconWrap}>
                {qrImage
                  ? <Image source={qrImage} style={styles.qrIcon} resizeMode="contain" />
                  : <Text style={{ fontSize: 80 }}>📷</Text>
                }
              </View>
              <Text style={styles.instructionText}>{t.tapToScan}</Text>
              <TouchableOpacity style={styles.scanButton} onPress={() => { setScanning(true); setScanned(false); }}>
                <Text style={styles.scanButtonText}>{t.startScanning}</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={styles.loadingText}>{t.analyzingQR}</Text>
            </View>
          )}

          {error && (
            <View style={styles.centered}>
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
              <TouchableOpacity style={styles.scanButton} onPress={reset}>
                <Text style={styles.scanButtonText}>{t.tryAgain}</Text>
              </TouchableOpacity>
            </View>
          )}

          {result && (
            <View style={styles.resultContainer}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(result.status) + "22", borderColor: getStatusColor(result.status) }]}>
                <Text style={[styles.statusText, { color: getStatusColor(result.status) }]}>
                  {result.status === "SAFE" ? "✅ SAFE" : result.status === "SUSPICIOUS" ? "⚠️ SUSPICIOUS" : "🚨 SCAM DETECTED"}
                </Text>
              </View>
              <Text style={styles.scoreText}>{t.riskScoreLabel} {result.score}/100</Text>
              <View style={styles.scoreBarBg}>
                <View style={[styles.scoreBarFill, { width: `${result.score}%`, backgroundColor: getStatusColor(result.status) }]} />
              </View>
              <Text style={styles.urlLabel}>{t.qrCodeUrl}</Text>
              <Text style={styles.urlText} numberOfLines={3}>{result.url}</Text>
              <Text style={styles.reasonLabel}>{t.whatWeFound}</Text>
              <Text style={styles.reasonText}>{result.reason}</Text>
              <TouchableOpacity style={styles.scanButton} onPress={reset}>
                <Text style={styles.scanButtonText}>{t.scanAnother}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </Wrap>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  header: { padding: 20, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: "bold", color: theme.text, marginTop: 10 },
  subtitle: { fontSize: 14, color: theme.subtext, marginTop: 4 },
  cameraBox: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: theme.accent,
    borderRadius: 12,
  },
  cancelButton: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: theme.surface,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelText: { color: theme.text, fontSize: 15 },
  content: { flex: 1, padding: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  topContent: { alignItems: "center", paddingTop: 16, gap: 16 },
  qrIconWrap: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  qrIcon: { width: 180, height: 180 },
  instructionText: { color: theme.subtext, fontSize: 14, textAlign: "center" },
  scanButton: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  scanButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  loadingText: { color: theme.subtext, marginTop: 12 },
  errorBox: {
    backgroundColor: theme.danger + "22",
    borderColor: theme.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    width: "100%",
  },
  errorText: { color: theme.danger, fontSize: 14 },
  resultContainer: { paddingTop: 10 },
  statusBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  statusText: { fontWeight: "bold", fontSize: 16 },
  scoreText: { color: theme.subtext, fontSize: 13, marginBottom: 8 },
  scoreBarBg: {
    backgroundColor: theme.border,
    borderRadius: 999,
    height: 10,
    marginBottom: 20,
    overflow: "hidden",
  },
  scoreBarFill: { height: "100%", borderRadius: 999 },
  urlLabel: { color: theme.subtext, fontSize: 12, marginBottom: 4 },
  urlText: { color: theme.accent, fontSize: 13, marginBottom: 16 },
  reasonLabel: { color: theme.subtext, fontSize: 12, marginBottom: 6 },
  reasonText: { color: theme.text, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  permIcon: { fontSize: 48, marginBottom: 12 },
  permTitle: { fontSize: 18, fontWeight: "bold", color: theme.text, marginBottom: 8 },
  permSubtitle: { fontSize: 14, color: theme.subtext, marginBottom: 24, textAlign: "center" },
  permButton: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
