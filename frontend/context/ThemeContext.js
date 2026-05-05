import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const darkTheme = {
  isDark: true,
  background: "#12072a",
  backgroundGradient: ["#12072a", "#3b1080", "#6d28d9"],
  surface: "rgba(109, 40, 217, 0.18)",
  card: "rgba(109, 40, 217, 0.15)",
  border: "rgba(167, 139, 250, 0.25)",
  text: "#ffffff",
  subtext: "rgba(255,255,255,0.55)",
  accent: "#a78bfa",
  accentSolid: "#7c3aed",
  accentBg: "rgba(167, 139, 250, 0.15)",
  safe: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  statusBar: "light-content",
};

export const lightTheme = {
  isDark: false,
  background: "#f5f3ff",
  backgroundGradient: ["#ede9fe", "#ddd6fe", "#c4b5fd"],
  surface: "#ffffff",
  card: "#ffffff",
  border: "#ddd6fe",
  text: "#1e1b4b",
  subtext: "#6d28d9",
  accent: "#7c3aed",
  accentSolid: "#7c3aed",
  accentBg: "#ede9fe",
  safe: "#059669",
  warning: "#d97706",
  danger: "#dc2626",
  statusBar: "dark-content",
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(darkTheme);

  useEffect(() => {
    AsyncStorage.getItem("app_theme").then((saved) => {
      if (saved === "light") setTheme(lightTheme);
    });
  }, []);

  const toggleTheme = async () => {
    const next = theme.isDark ? lightTheme : darkTheme;
    setTheme(next);
    await AsyncStorage.setItem("app_theme", next.isDark ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
