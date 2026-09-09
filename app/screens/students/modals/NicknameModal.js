import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import {
  NICKNAME_CATEGORIES,
  CURATED_NICKNAMES,
  getRandomInterestingNickname,
} from "../../../utils/nicknameGenerator";
import { showToast } from "../../../utils/toastService";

export default function NicknameModal({ visible, onClose, currentNickname = "", onSave }) {
  const { colors } = useTheme();

  const [nickname, setNickname] = useState("");
  const [activeCategory, setActiveCategory] = useState("⚡ Cyber & AI");
  const [saving, setSaving] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setNickname(currentNickname || "");
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0);
    }
  }, [visible, currentNickname, opacityAnim, scaleAnim]);

  const handleRollRandom = () => {
    const newNick = getRandomInterestingNickname(nickname);
    setNickname(newNick);
    showToast(`🎲 Sparked alias: "${newNick}"`, "info");
  };

  const handleClear = () => {
    setNickname("");
  };

  const handleSave = async (overrideValue) => {
    const finalNick = typeof overrideValue === "string" ? overrideValue.trim() : nickname.trim();
    setSaving(true);
    try {
      if (onSave) {
        await onSave(finalNick);
      }
      if (finalNick) {
        showToast(`✨ Nickname set to "${finalNick}"!`, "success");
      } else {
        showToast("🗑️ Nickname removed successfully", "info");
      }
      onClose();
    } catch (err) {
      console.log("Nickname save error:", err);
      showToast("Could not update nickname", "error");
    } finally {
      setSaving(false);
    }
  };

  const categories = Object.keys(NICKNAME_CATEGORIES);
  const currentCategoryPicks = NICKNAME_CATEGORIES[activeCategory] || CURATED_NICKNAMES.slice(0, 10);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ width: "100%", alignItems: "center" }}
          >
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.divider,
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              >
                {/* Modal Header */}
                <View style={styles.headerRow}>
                  <View style={[styles.headerIconCircle, { backgroundColor: "#F59E0B18" }]}>
                    <Icon name="account-star-outline" size={24} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.title, { color: colors.primaryText }]}>Student Alias / Nickname</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                      Pick your vibe, customize, or remove anytime
                    </Text>
                  </View>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                  </TouchableOpacity>
                </View>

                {/* Live Preview Box */}
                <View
                  style={[
                    styles.previewContainer,
                    {
                      backgroundColor: colors.primaryBackground,
                      borderColor: nickname ? "#F59E0B44" : colors.divider,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={[styles.previewLabel, { color: colors.secondaryText }]}>ACTIVE ALIAS PREVIEW</Text>
                    {!!nickname && (
                      <TouchableOpacity
                        onPress={handleClear}
                        style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                      >
                        <Icon name="close-circle" size={13} color="#EF4444" />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#EF4444" }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.previewBadgeRow}>
                    {nickname ? (
                      <View style={[styles.activeBadge, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B" }]}>
                        <Icon name="tag-heart-outline" size={14} color="#D97706" />
                        <Text style={[styles.activeBadgeText, { color: "#D97706" }]}>{`"${nickname}"`}</Text>
                      </View>
                    ) : (
                      <View style={[styles.activeBadge, { backgroundColor: colors.cardHighlight, borderColor: colors.divider }]}>
                        <Icon name="tag-off-outline" size={14} color={colors.disabledText} />
                        <Text style={[styles.activeBadgeText, { color: colors.disabledText }]}>No Nickname (Disabled)</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Custom Input Field */}
                <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>Custom Choice (Type your own)</Text>
                <View style={[styles.inputWrap, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="pencil-outline" size={18} color="#F59E0B" />
                  <TextInput
                    style={[styles.textInput, { color: colors.primaryText }]}
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="Enter custom nickname..."
                    placeholderTextColor={colors.disabledText}
                    maxLength={30}
                    editable={!saving}
                  />
                  {!!nickname && (
                    <TouchableOpacity onPress={handleClear} style={{ padding: 4 }}>
                      <Icon name="close-circle" size={16} color={colors.secondaryText} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleRollRandom}
                    style={styles.rollBtn}
                    title="Roll Random"
                  >
                    <Icon name="dice-5-outline" size={15} color="#D97706" />
                    <Text style={styles.rollBtnText}>Roll</Text>
                  </TouchableOpacity>
                </View>

                {/* Categories Tabs */}
                <Text style={[styles.sectionLabel, { color: colors.secondaryText, marginTop: 14 }]}>
                  Or Select by Wish & Category
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, maxHeight: 36 }}>
                  {categories.map((cat) => {
                    const isSelected = activeCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setActiveCategory(cat)}
                        style={[
                          styles.catTab,
                          {
                            backgroundColor: isSelected ? "#F59E0B" : colors.primaryBackground,
                            borderColor: isSelected ? "#F59E0B" : colors.divider,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.catTabText,
                            { color: isSelected ? "#FFFFFF" : colors.secondaryText },
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Categorized Nickname Chips */}
                <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.chipsWrap}>
                    {currentCategoryPicks.map((pick) => {
                      const isPicked = nickname === pick;
                      return (
                        <TouchableOpacity
                          key={pick}
                          onPress={() => setNickname(pick)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isPicked ? "#F59E0B22" : colors.primaryBackground,
                              borderColor: isPicked ? "#F59E0B" : colors.divider,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              {
                                color: isPicked ? "#F59E0B" : colors.primaryText,
                                fontWeight: isPicked ? "800" : "600",
                              },
                            ]}
                          >
                            {isPicked ? "✓ " : ""}
                            {pick}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Modal Footer Buttons */}
                <View style={[styles.buttonRow, { borderTopColor: colors.divider }]}>
                  {!!currentNickname && (
                    <TouchableOpacity
                      onPress={() => handleSave("")}
                      disabled={saving}
                      style={[styles.removeBtn, { borderColor: "#EF444466", backgroundColor: "#EF444412" }]}
                    >
                      <Icon name="delete-outline" size={16} color="#EF4444" />
                      <Text style={[styles.removeBtnText, { color: "#EF4444" }]}>Remove</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={onClose}
                    disabled={saving}
                    style={[styles.cancelBtn, { borderColor: colors.divider }]}
                  >
                    <Text style={[styles.cancelBtnText, { color: colors.secondaryText }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSave()}
                    disabled={saving}
                    style={[styles.saveBtn, { backgroundColor: "#F59E0B" }]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Icon name="check" size={16} color="#FFFFFF" />
                        <Text style={styles.saveBtnText}>{nickname ? "Save Alias" : "Save"}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 16.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  previewContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  previewBadgeRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  activeBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 5,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 7,
  },
  rollBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#F59E0B18",
  },
  rollBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#D97706",
  },
  catTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
    justifyContent: "center",
  },
  catTabText: {
    fontSize: 11,
    fontWeight: "700",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11.5,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: "center",
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  removeBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "800",
  },
});
