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
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { api } from "../../../services/api";
import { resolveIdentity } from "../../../services/identityService";
import { showToast } from "../../../utils/toastService";
import { getRandomInterestingNickname } from "../../../utils/nicknameGenerator";
import AddressAutocompleteInput from "../../../components/common/AddressAutocompleteInput";

function EditProfileModal({ visible, onClose, user, onUpdate, onSave }) {
  const { colors } = useTheme();

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setName(user.name || "");
      setNickname(user.nickname || "");
      setPhone(user.phone || "");
      setAddress(user.address || "");
    }
  }, [visible, user]);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible, opacityAnim, scaleAnim]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter student's full name.");
      return;
    }

    setSaving(true);
    try {
      const updatePayload = {
        name: name.trim(),
        nickname: nickname.trim(),
        phone: phone.trim(),
        address: address.trim(),
      };

      try {
        const identity = await resolveIdentity();
        const collection = identity.role === "student" ? "students" : identity.role === "parent" ? "parents" : "staff";
        const docId = identity.id || identity.rollNo || identity.username;
        if (docId) {
          await api.patch(`/${collection}/${encodeURIComponent(docId)}`, updatePayload).catch(() => null);
        }
      } catch (apiErr) {
        console.log("REST profile patch err:", apiErr);
      }

      if (onUpdate) onUpdate(updatePayload);
      if (onSave) onSave(updatePayload);

      showToast("✅ Profile details updated successfully!", "success");
      onClose();
    } catch (e) {
      console.log("Profile save error:", e);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[modalStyles.overlay, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                modalStyles.card,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.divider,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Header */}
              <View style={modalStyles.headerRow}>
                <View style={[modalStyles.headerIconCircle, { backgroundColor: colors.primaryAccent + "18" }]}>
                  <Icon name="account-edit-outline" size={26} color={colors.primaryAccent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[modalStyles.title, { color: colors.primaryText }]}>Edit Student Profile</Text>
                  <Text style={[modalStyles.subtitle, { color: colors.secondaryText }]}>
                    Update Nickname, Contact & Address
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
                  <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                {/* 1. Full Official Name */}
                <Text style={[modalStyles.inputLabel, { color: colors.secondaryText }]}>Full Official Name</Text>
                <View style={[modalStyles.inputWrap, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="account-outline" size={20} color={colors.primaryAccent} />
                  <TextInput
                    style={[modalStyles.textInput, { color: colors.primaryText }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Official Name"
                    placeholderTextColor={colors.disabledText}
                    editable={!saving}
                  />
                </View>

                {/* 2. Nickname / Preferred Name */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <Text style={[modalStyles.inputLabel, { color: colors.secondaryText }]}>Nickname / Cool Alias</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const newNick = getRandomInterestingNickname(nickname);
                      setNickname(newNick);
                      showToast(`🎲 Sparked nickname: "${newNick}"`, "info");
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 2, paddingHorizontal: 6 }}
                  >
                    <Icon name="dice-5-outline" size={14} color="#F59E0B" />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#F59E0B" }}>Roll Random</Text>
                  </TouchableOpacity>
                </View>
                <View style={[modalStyles.inputWrap, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="account-star-outline" size={20} color="#F59E0B" />
                  <TextInput
                    style={[modalStyles.textInput, { color: colors.primaryText }]}
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="Nickname (e.g. QuantumVelo, NeuralNinja)"
                    placeholderTextColor={colors.disabledText}
                    editable={!saving}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      const newNick = getRandomInterestingNickname(nickname);
                      setNickname(newNick);
                    }}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: "#F59E0B18",
                    }}
                  >
                    <Icon name="shuffle-variant" size={16} color="#D97706" />
                  </TouchableOpacity>
                </View>

                {/* Nickname Quick Pick Chips */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10, marginTop: 4 }}>
                  {["QuantumVelo", "NeuralNinja", "ByteVoyager", "MatrixRider", "AstroVelu"].map((sug) => (
                    <TouchableOpacity
                      key={sug}
                      onPress={() => setNickname(sug)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: nickname === sug ? "#F59E0B" : colors.divider,
                        backgroundColor: nickname === sug ? "#F59E0B20" : colors.primaryBackground,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: nickname === sug ? "800" : "600",
                          color: nickname === sug ? "#F59E0B" : colors.secondaryText,
                        }}
                      >
                        ⚡ {sug}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 3. Mobile Phone Number */}
                <Text style={[modalStyles.inputLabel, { color: colors.secondaryText }]}>Primary Phone Number</Text>
                <View style={[modalStyles.inputWrap, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="phone-outline" size={20} color="#10B981" />
                  <TextInput
                    style={[modalStyles.textInput, { color: colors.primaryText }]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+91 Mobile Number"
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.disabledText}
                    editable={!saving}
                  />
                </View>

                {/* 4. Permanent Address with Dropdown Suggestions */}
                <Text style={[modalStyles.inputLabel, { color: colors.secondaryText }]}>Permanent Address</Text>
                <AddressAutocompleteInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Type street, area, city or pincode..."
                  editable={!saving}
                />
              </ScrollView>

              {/* Action Buttons */}
              <View style={[modalStyles.buttonRow, { borderTopColor: colors.divider }]}>
                <TouchableOpacity
                  style={[modalStyles.cancelBtn, { borderColor: colors.divider }]}
                  onPress={onClose}
                  disabled={saving}
                >
                  <Text style={{ color: colors.secondaryText, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.saveBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="check" size={18} color="#FFFFFF" />
                      <Text style={modalStyles.saveBtnText}>Save Profile</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    paddingTop: 22,
    elevation: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 17,
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
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  saveBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
  },
});

export default EditProfileModal;