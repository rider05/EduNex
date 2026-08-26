import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getParentNotices, getParentData } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";

const formatDateStr = (value) => {
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (!isNaN(d)) return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {}
  return "";
};

const mapNotice = (n, i) => ({
  id: n.id || n._id || i,
  sender: n.sender || n.senderName || n.author || n.senderRole || "EduNex Administration",
  subject: n.title || n.subject || "Notice",
  message: n.message || n.body || n.content || "",
  date: formatDateStr(n.createdAt || n.date),
  isNew: n.isNew === true || n.read === false,
});

export default function MessagesParent() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    setLoadError(false);
    try {
      const notices = await getParentNotices();
      const mapped = Array.isArray(notices) ? notices.map(mapNotice) : [];
      setMessages(mapped);
      if (mapped.length === 0) setLoadError(true);
    } catch (err) {
      console.warn("MessagesParent load error:", err?.message || err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch notices when the app returns to the foreground
  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Email and Call Handlers (advisor contact resolved from the ward's record)
  const handleSendEmail = async () => {
    try {
      const data = await getParentData();
      const email = data?.ward?.advisor?.email || "";
      const url = `mailto:${email}`;
      if (!email) {
        Alert.alert("Not available", "Advisor contact is not set for your ward yet.");
        return;
      }
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        Linking.openURL(url);
      } else {
        Alert.alert("Error", "Unable to open email client.");
      }
    } catch {
      Alert.alert("Error", "Unable to open email client.");
    }
  };

  const handleCallAdmin = async () => {
    try {
      const data = await getParentData();
      const phone = data?.ward?.advisor?.phone || data?.ward?.phone || "";
      const digits = String(phone).replace(/[^\d+]/g, "");
      if (!digits) {
        Alert.alert("Not available", "Advisor phone number is not set yet.");
        return;
      }
      const phoneNumber = `tel:${digits}`;
      const canOpen = await Linking.canOpenURL(phoneNumber);
      if (canOpen) {
        Linking.openURL(phoneNumber);
      } else {
        Alert.alert("Error", "Unable to make a call from this device.");
      }
    } catch {
      Alert.alert("Error", "Unable to make a call from this device.");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
          progressBackgroundColor={colors.cardBackground}
        />
      }
    >
      {/* Header */}
      <Text style={styles.header}>Messages & Notices</Text>

      {isLoading ? (
        <View style={{ marginTop: 10 }}>
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </View>
      ) : (
        <>
          {/* Messages List */}
          {messages.length === 0 && loadError && (
            <View style={[styles.messageCard, { alignItems: "center", paddingVertical: 24 }]}>
              <Icon name="wifi-off" size={30} color={colors.secondaryText} />
              <Text style={[styles.sender, { marginTop: 8 }]}>
                {"Couldn't reach the EduNex server. Pull down to retry."}
              </Text>
            </View>
          )}
          {messages.map((msg) => (
        <TouchableOpacity
          key={msg.id}
          activeOpacity={0.9}
          style={[
            styles.messageCard,
            msg.isNew && {
              borderColor: colors.primaryAccent,
              backgroundColor: colors.cardHighlight || colors.cardBackground,
            },
          ]}
          onPress={() => console.log("Open message", msg.id)}
        >
          <View style={styles.row}>
            <Icon
              name={msg.isNew ? "email-mark-as-unread" : "email-outline"}
              size={22}
              color={msg.isNew ? colors.primaryAccent : colors.primaryText}
              style={styles.icon}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.subject}>{msg.subject}</Text>
              <Text style={styles.sender}>{msg.sender}</Text>
            </View>
            <Text style={styles.date}>{msg.date}</Text>
          </View>

          <Text style={styles.preview} numberOfLines={2}>
            {msg.message}
          </Text>

          {msg.isNew && (
            <View style={[styles.newBadge, { backgroundColor: colors.primaryAccent }]}>
              <Text style={styles.newText}>NEW</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Contact Section */}
      <Text style={styles.sectionTitle}>Contact School</Text>
      <View style={styles.contactCard}>
        <TouchableOpacity
          style={styles.contactRow}
          activeOpacity={0.8}
          onPress={handleSendEmail}
        >
          <View style={styles.contactIcon}>
            <Icon name="email-outline" size={22} color={colors.primaryAccent} />
          </View>
          <Text style={styles.contactText}>Send Email to Class Teacher</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.contactRow}
          activeOpacity={0.8}
          onPress={handleCallAdmin}
        >
          <View style={styles.contactIcon}>
            <Icon name="phone-outline" size={22} color={colors.primaryAccent} />
          </View>
          <Text style={styles.contactText}>Call Admin Office</Text>
        </TouchableOpacity>
      </View>
      </>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 40,
    },
    header: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.primaryText,
      marginBottom: 20,
    },

    // 🔹 Message Card
    messageCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      padding: 16,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: "transparent",
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 3,
      position: "relative",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    icon: {
      marginRight: 10,
    },
    subject: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primaryText,
    },
    sender: {
      fontSize: 14,
      color: colors.secondaryText,
      marginTop: 2,
    },
    date: {
      fontSize: 12,
      color: colors.secondaryText,
      marginLeft: 8,
    },
    preview: {
      fontSize: 14,
      color: colors.secondaryText,
      lineHeight: 20,
    },
    newBadge: {
      position: "absolute",
      top: 10,
      right: 12,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    newText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "700",
    },

    // 🔹 Contact Section
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.primaryText,
      marginTop: 30,
      marginBottom: 12,
    },
    contactCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      elevation: 3,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 3,
    },
    contactRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 15,
    },
    contactIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primaryAccent + "20",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    contactText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.primaryText,
    },
    divider: {
      height: 1,
      backgroundColor: colors.secondaryText + "25",
      marginHorizontal: 10,
    },
  });