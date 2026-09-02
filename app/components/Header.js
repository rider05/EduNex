import React, { useState, useEffect } from "react";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { showToast } from "../utils/toastService";
import { resolveIdentity } from "../services/identityService";

export default function Header() {
  const { colors } = useTheme();
  const [userName, setUserName] = useState("");

  const styles = getStyles(colors);

  useEffect(() => {
    resolveIdentity()
      .then((id) => {
        const name =
          id?.student?.name ||
          id?.staff?.name ||
          id?.parent?.name ||
          id?.admin?.name ||
          id?.name ||
          id?.fullName ||
          id?.username ||
          "";
        if (name) setUserName(name);
      })
      .catch(() => {});
  }, []);

  // Show welcome toast on tap
  const handleAppIconPress = () => {
    showToast(`👋 Welcome, ${userName || "User"}! Enjoy your learning journey.`, "success");
  };

  const handleMenuPress = () => {
    console.log("Menu icon pressed");
  };

  return (
    <View style={styles.header}>
      <View style={styles.textContainer}>
        <TouchableOpacity onPress={handleAppIconPress}>
          <Text style={styles.appIconName}>EduNex</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Student Management System</Text>
        <Text style={styles.subtitle}>Empowering Campus, Simplifying Success</Text>
      </View>

      <TouchableOpacity style={styles.menuIcon} onPress={handleMenuPress}>
        <View style={styles.bar} />
        <View style={styles.bar} />
        <View style={styles.bar} />
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    header: {
      backgroundColor: "#3A51E0",
      height: 150,
      marginTop: -50,
      borderBottomLeftRadius: 40,
      borderBottomRightRadius: 40,
      paddingTop: 40,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      shadowColor: "#00000066",
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 8,
      elevation: 8,
    },
    textContainer: {
      flex: 1,
    },
    appIconName: {
      color: colors.cardBackground,
      fontSize: 36,
      fontWeight: "900",
      marginBottom: 4,
      fontStyle: "italic",
    },
    title: {
      color: colors.cardBackground,
      fontSize: 18,
      fontWeight: "bold",
    },
    subtitle: {
      color: "#D3D7F9",
      fontSize: 12,
      marginTop: 4,
    },
    menuIcon: {
      flexDirection: "column",
      justifyContent: "space-between",
      height: 24,
      width: 28,
    },
    bar: {
      width: 28,
      height: 4,
      backgroundColor: colors.cardBackground,
      borderRadius: 3,
    },
  });