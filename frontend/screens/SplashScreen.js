import React, { useEffect } from "react";
import { View, Text, StyleSheet, StatusBar, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

export default function SplashScreen({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <LinearGradient
        colors={["#051525", "#0A2540", "#1B6CA8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={styles.gradient}
      />
      {/* Decorative water ripple rings */}
      <View style={[styles.ring, { width: 320, height: 320, borderColor: "rgba(27,108,168,0.3)" }]} />
      <View style={[styles.ring, { width: 220, height: 220, borderColor: "rgba(27,108,168,0.5)" }]} />
      <View style={[styles.ring, { width: 130, height: 130, borderColor: "rgba(27,108,168,0.7)" }]} />
      <View style={styles.textWrap}>
        <Text style={styles.droplet}>💧</Text>
        <Text style={styles.title}>FloodSense</Text>
        <Text style={styles.sub}>Malaysia Early Warning System</Text>
      </View>
      <Text style={styles.poweredBy}>Powered by Agentic AI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#051525",
    alignItems: "center",
    justifyContent: "center",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  ring: {
    position: "absolute",
    borderRadius: 9999,
    borderWidth: 1,
  },
  textWrap: {
    alignItems: "center",
  },
  droplet: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#E8F4FD",
    letterSpacing: -1,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: "rgba(232,244,253,0.65)",
    letterSpacing: 0.5,
  },
  poweredBy: {
    position: "absolute",
    bottom: 48,
    fontSize: 12,
    color: "rgba(232,244,253,0.4)",
    letterSpacing: 1,
  },
});
