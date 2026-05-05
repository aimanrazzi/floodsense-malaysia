import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image, StatusBar, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

// Save your knight photo as frontend/assets/wall.jpg
let knightImage = null;
try { knightImage = require("../assets/wall.jpg"); } catch {}

export default function SplashScreen({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {knightImage
        ? <Image source={knightImage} style={styles.image} resizeMode="cover" />
        : <LinearGradient colors={["#12072a", "#3b1080", "#6d28d9"]} style={styles.image} />
      }
      <View style={styles.overlay} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>Combat.</Text>
        <Text style={styles.sub}>Defend yourself from scams</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  image: { width, height, position: "absolute" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  textWrap: {
    position: "absolute",
    bottom: 80,
    left: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1,
  },
  sub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
