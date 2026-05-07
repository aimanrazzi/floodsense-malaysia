import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, Modal, Pressable, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase";

const FS = {
  primary:  "#1B6CA8",
  primaryDim:"#1B6CA822",
  bg:       "#0A1628",
  surface:  "#0F2440",
  card:     "#1A3A5C",
  text:     "#E8F4FD",
  subtext:  "#7FA8C4",
  border:   "#1E3A5F",
  danger:   "#DC2626",
};

export default function LoginScreen() {
  const [mode,         setMode]         = useState("login");
  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [forgotVisible,  setForgotVisible]  = useState(false);
  const [forgotEmail,    setForgotEmail]    = useState("");
  const [forgotLoading,  setForgotLoading]  = useState(false);
  const [forgotSuccess,  setForgotSuccess]  = useState(false);
  const [forgotError,    setForgotError]    = useState("");

  const openForgot = () => {
    setForgotEmail(email);
    setForgotSuccess(false);
    setForgotError("");
    setForgotVisible(true);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) { setForgotError("Please enter your email address."); return; }
    setForgotLoading(true);
    setForgotError("");
    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      setForgotSuccess(true);
    } catch (e) {
      const msg = {
        "auth/invalid-email":  "Invalid email address.",
        "auth/user-not-found": "No account found with this email.",
      }[e.code] || "Could not send reset email. Try again.";
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("Please enter email and password."); return; }
    if (mode === "signup" && !name) { setError("Please enter your name."); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (e) {
      const msg = {
        "auth/invalid-email":       "Invalid email address.",
        "auth/user-not-found":      "No account found. Please sign up.",
        "auth/wrong-password":      "Incorrect password.",
        "auth/email-already-in-use":"Email already registered. Please log in.",
        "auth/weak-password":       "Password must be at least 6 characters.",
        "auth/invalid-credential":  "Incorrect email or password.",
      }[e.code] || e.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#0A1628", "#0D1F38", "#112240"]} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor={FS.bg} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Branding */}
            <View style={S.brandWrap}>
              <Image source={require("../assets/logo.png")} style={S.brandLogo} />
              <Text style={S.brandName}>FloodSense</Text>
              <Text style={S.brandSub}>Malaysia</Text>
              <Text style={S.brandTagline}>Agentic AI Early Warning System</Text>
              <View style={S.brandBadge}>
                <Text style={S.brandBadgeText}>KL / Selangor · Real-time</Text>
              </View>
            </View>

            <View style={{ paddingBottom: 40 }}>
              {/* Login / Sign Up toggle */}
              <View style={S.toggleWrap}>
                <TouchableOpacity
                  style={[S.toggleBtn, mode === "login" && S.toggleActive]}
                  onPress={() => { setMode("login"); setError(""); }}
                >
                  <Text style={[S.toggleText, { color: mode === "login" ? "#fff" : FS.subtext }]}>
                    Log In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.toggleBtn, mode === "signup" && S.toggleActive]}
                  onPress={() => { setMode("signup"); setError(""); }}
                >
                  <Text style={[S.toggleText, { color: mode === "signup" ? "#fff" : FS.subtext }]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Name — signup only */}
              {mode === "signup" && (
                <View style={S.inputWrap}>
                  <Text style={S.inputLabel}>Full Name</Text>
                  <TextInput
                    style={S.input}
                    placeholder="Your name"
                    placeholderTextColor={FS.subtext + "88"}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              {/* Email */}
              <View style={S.inputWrap}>
                <Text style={S.inputLabel}>Email</Text>
                <TextInput
                  style={S.input}
                  placeholder="you@email.com"
                  placeholderTextColor={FS.subtext + "88"}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {/* Password */}
              <View style={S.inputWrap}>
                <Text style={S.inputLabel}>Password</Text>
                <TextInput
                  style={S.input}
                  placeholder="••••••••"
                  placeholderTextColor={FS.subtext + "88"}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                {mode === "login" && (
                  <TouchableOpacity onPress={openForgot}>
                    <Text style={S.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </View>

              {error ? <Text style={S.error}>{error}</Text> : null}

              {/* Submit */}
              <TouchableOpacity
                style={[S.submitBtn, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={S.submitText}>
                      {mode === "login" ? "Log In" : "Create Account"}
                    </Text>
                }
              </TouchableOpacity>

              <Text style={S.disclaimer}>
                By continuing you agree to receive flood alerts and emergency notifications for your registered area.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotVisible(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setForgotVisible(false)}>
          <Pressable style={S.modalCard} onPress={() => {}}>
            <Text style={S.modalTitle}>Reset Password</Text>
            <Text style={S.modalSubtitle}>
              Enter your email and we'll send a reset link.
            </Text>

            {forgotSuccess ? (
              <View style={S.successBox}>
                <Text style={S.successIcon}>✅</Text>
                <Text style={S.successText}>Reset link sent! Check your inbox.</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={S.modalInput}
                  placeholder="you@email.com"
                  placeholderTextColor={FS.subtext + "88"}
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoFocus
                />
                {forgotError ? <Text style={S.modalError}>{forgotError}</Text> : null}
                <TouchableOpacity
                  style={[S.modalBtn, forgotLoading && { opacity: 0.6 }]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                  activeOpacity={0.85}
                >
                  {forgotLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={S.modalBtnText}>Send Reset Link</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={S.modalCancel} onPress={() => setForgotVisible(false)}>
              <Text style={S.modalCancelText}>{forgotSuccess ? "Close" : "Cancel"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const S = StyleSheet.create({
  brandWrap: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 40,
  },
  brandLogo:    { width: 90, height: 90, resizeMode: "contain", marginBottom: 8, borderRadius: 8 },
  brandName:    { fontSize: 36, fontWeight: "900", color: FS.text, letterSpacing: -1 },
  brandSub:     { fontSize: 18, fontWeight: "700", color: FS.primary, marginTop: -4, marginBottom: 6 },
  brandTagline: { fontSize: 12, color: FS.subtext, fontWeight: "600", letterSpacing: 0.5, marginBottom: 12 },
  brandBadge: {
    backgroundColor: FS.primaryDim,
    borderWidth: 1,
    borderColor: FS.primary + "55",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  brandBadgeText: { fontSize: 11, color: FS.primary, fontWeight: "700" },

  toggleWrap: {
    flexDirection: "row",
    backgroundColor: FS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: FS.border,
  },
  toggleBtn:    { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  toggleActive: { backgroundColor: FS.primary },
  toggleText:   { fontWeight: "700", fontSize: 14 },

  inputWrap:  { marginBottom: 16 },
  inputLabel: { color: FS.subtext, fontSize: 12, fontWeight: "700", marginBottom: 7, letterSpacing: 0.4 },
  input: {
    backgroundColor: FS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: FS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: FS.border,
  },
  forgotText: { color: FS.subtext, fontSize: 12, textAlign: "right", marginTop: 7 },

  error: { color: "#f87171", fontSize: 13, marginBottom: 12, textAlign: "center" },

  submitBtn: {
    backgroundColor: FS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
    elevation: 4,
    shadowColor: FS.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  disclaimer: {
    fontSize: 11,
    color: FS.subtext + "99",
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: FS.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: FS.border,
  },
  modalTitle:    { color: FS.text, fontSize: 18, fontWeight: "800", marginBottom: 6 },
  modalSubtitle: { color: FS.subtext, fontSize: 13, lineHeight: 20, marginBottom: 18 },
  modalInput: {
    backgroundColor: "#0A1628",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: FS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: FS.border,
    marginBottom: 12,
  },
  modalError:   { color: "#f87171", fontSize: 13, marginBottom: 12 },
  modalBtn: {
    backgroundColor: FS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  modalBtnText:    { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalCancel:     { alignItems: "center", paddingVertical: 10 },
  modalCancelText: { color: FS.subtext, fontSize: 14 },
  successBox:  { alignItems: "center", paddingVertical: 16, gap: 12, marginBottom: 8 },
  successIcon: { fontSize: 40 },
  successText: { color: "#34d399", fontSize: 14, textAlign: "center", lineHeight: 22, fontWeight: "600" },
});
