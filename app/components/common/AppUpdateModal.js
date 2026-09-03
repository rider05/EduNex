import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { openUpdateUrl, dismissUpdate } from "../../services/updateService";

const { width } = Dimensions.get("window");

export default function AppUpdateModal({
  visible = false,
  updateInfo = null,
  onClose = () => {},
}) {
  if (!visible || !updateInfo) return null;

  const isForced = Boolean(updateInfo.forceUpdate);

  const handleUpdate = () => {
    openUpdateUrl(updateInfo.downloadUrl || updateInfo.apkUrl);
  };

  const handleLater = async () => {
    if (updateInfo.latestVersion) {
      await dismissUpdate(updateInfo.latestVersion);
    }
    onClose();
  };

  const notes = String(updateInfo.releaseNotes || "").split("\n").filter((l) => l.trim());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={isForced ? () => {} : handleLater}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Top Decorative Header */}
          <View style={styles.headerGraphic}>
            <View style={styles.iconCircle}>
              <Icon name="rocket-launch" size={32} color="#FFFFFF" />
            </View>
            {isForced && (
              <View style={styles.mandatoryBadge}>
                <Icon name="alert-circle" size={13} color="#FFFFFF" />
                <Text style={styles.mandatoryText}>CRITICAL UPDATE</Text>
              </View>
            )}
          </View>

          {/* Title & Version Pills */}
          <View style={styles.contentBody}>
            <Text style={styles.titleText}>{updateInfo.title || "New Update Available!"}</Text>

            <View style={styles.versionPillRow}>
              <View style={styles.currentVerBadge}>
                <Text style={styles.currentVerText}>v{updateInfo.currentVersion || "1.0.0"}</Text>
              </View>
              <Icon name="arrow-right" size={16} color="#6B7280" />
              <View style={styles.latestVerBadge}>
                <Text style={styles.latestVerText}>v{updateInfo.latestVersion || "1.1.0"}</Text>
                <View style={styles.newTag}>
                  <Text style={styles.newTagText}>NEW</Text>
                </View>
              </View>
            </View>

            {/* Meta Info Strip */}
            <View style={styles.metaRow}>
              {updateInfo.releaseDate && (
                <View style={styles.metaItem}>
                  <Icon name="calendar-outline" size={14} color="#6B7280" />
                  <Text style={styles.metaText}>{updateInfo.releaseDate}</Text>
                </View>
              )}
              {updateInfo.fileSize && (
                <View style={styles.metaItem}>
                  <Icon name="package-variant-closed" size={14} color="#6B7280" />
                  <Text style={styles.metaText}>{updateInfo.fileSize}</Text>
                </View>
              )}
            </View>

            {/* Release Highlights / Changelog */}
            <Text style={styles.changelogHeader}>{"What's New in this Version:"}</Text>
            <View style={styles.changelogBox}>
              <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator>
                {notes.map((line, idx) => (
                  <View key={idx} style={styles.noteLine}>
                    <Text style={styles.bulletText}>•</Text>
                    <Text style={styles.noteContentText}>{line.replace(/^[•\-\*]\s*/, "")}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {isForced && (
              <View style={styles.forcedNoticeBox}>
                <Icon name="shield-alert" size={16} color="#B45309" />
                <Text style={styles.forcedNoticeText}>
                  This update contains essential performance and security improvements. Please update to continue using EduNex.
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.primaryUpdateBtn}
                onPress={handleUpdate}
                activeOpacity={0.8}
              >
                <Icon name="download" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>Update Now</Text>
              </TouchableOpacity>

              {!isForced && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleLater}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryBtnText}>Remind Me Later</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogCard: {
    width: Math.min(width - 32, 400),
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  headerGraphic: {
    backgroundColor: "#4F46E5",
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  mandatoryBadge: {
    position: "absolute",
    top: 10,
    right: 12,
    backgroundColor: "#DC2626",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  mandatoryText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  contentBody: {
    padding: 20,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  versionPillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  currentVerBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentVerText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },
  latestVerBadge: {
    backgroundColor: "#EEF2FF",
    borderColor: "#4F46E5",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  latestVerText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#4F46E5",
  },
  newTag: {
    backgroundColor: "#10B981",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newTagText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "900",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11.5,
    color: "#6B7280",
    fontWeight: "600",
  },
  changelogHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
    marginTop: 16,
    marginBottom: 6,
  },
  changelogBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
  },
  noteLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 6,
  },
  bulletText: {
    color: "#4F46E5",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  noteContentText: {
    flex: 1,
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 17,
  },
  forcedNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  forcedNoticeText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    fontWeight: "600",
    lineHeight: 15,
  },
  btnRow: {
    marginTop: 18,
    gap: 8,
  },
  primaryUpdateBtn: {
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "800",
  },
  secondaryBtn: {
    backgroundColor: "transparent",
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
  },
});
