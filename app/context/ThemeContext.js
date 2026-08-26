// context/ThemeContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import colorConfig from "../config/color.json";
import { showToast } from "../utils/toastService"; // <- correct import

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemTheme = Appearance.getColorScheme();
  const [themeKey, setThemeKey] = useState(systemTheme || "light");

  // 🎯 compute derived value early so toggleTheme can use it correctly
  const isDarkMode = themeKey === "dark";

  // 🔄 Load saved theme or system preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("appTheme");
        if (savedTheme) {
          setThemeKey(savedTheme);
        } else {
          setThemeKey(systemTheme || "light");
        }
      } catch (error) {
        console.log("Failed to load theme:", error);
      }
    };
    loadTheme();
  }, [systemTheme]);

  // 🌗 Toggle and save theme
  const toggleTheme = async () => {
    const newTheme = themeKey === "light" ? "dark" : "light";
    setThemeKey(newTheme);

    try {
      // use showToast from toastService; message reflects the NEW theme
      showToast(`${newTheme === "dark" ? "Dark Mode" : "Light Mode"}`, "info");
      await AsyncStorage.setItem("appTheme", newTheme);
    } catch (error) {
      console.log("Failed to save theme:", error);
    }
  };

  // 🎨 Ensure fallback keys exist for color usage
  const selectedColors = {
    ...colorConfig[themeKey],
    primary:
      colorConfig[themeKey]?.primary ||
      colorConfig[themeKey]?.primaryAccent ||
      "#3366FF",
    secondary:
      colorConfig[themeKey]?.secondary ||
      colorConfig[themeKey]?.secondaryAccent ||
      "#00B894",
  };

  return (
    <ThemeContext.Provider
      value={{
        themeKey,
        colors: selectedColors,
        isDarkMode,
        toggleTheme,
        setThemeKey,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);