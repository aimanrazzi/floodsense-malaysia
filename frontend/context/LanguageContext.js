import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    AsyncStorage.getItem("app_language").then((saved) => {
      if (saved) setLang(saved);
    });
  }, []);

  const changeLang = async (code) => {
    setLang(code);
    await AsyncStorage.setItem("app_language", code);
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
