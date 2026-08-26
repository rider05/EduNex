import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Alert,
  StyleSheet,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../../context/ThemeContext";  // ✅ added

function EditProfileModal({ visible, onClose, user }) {
  const { colors } = useTheme();  // ✅ use theme directly

  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [address, setAddress] = useState(user.address);

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible, opacityAnim, scaleAnim]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[modalStyles.overlay, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                modalStyles.card,
                {
                  backgroundColor: colors.cardBackground,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View style={{ alignItems: "center", marginBottom: 10 }}>
                <Icon name="account-edit" size={50} color={colors.primaryAccent} />
                <Text style={[modalStyles.title, { color: colors.primaryText }]}>
                  Edit Profile
                </Text>
              </View>

              <View style={modalStyles.inputContainer}>
                <Icon
                  name="account-outline"
                  size={20}
                  color={colors.primaryAccent}
                  style={modalStyles.inputIcon}
                />
                <TextInput
                  style={[
                    modalStyles.input,
                    { color: colors.primaryText, borderColor: colors.divider },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full Name"
                  placeholderTextColor={colors.disabledText}
                />
              </View>

              <View style={modalStyles.inputContainer}>
                <Icon
                  name="phone-outline"
                  size={20}
                  color={colors.primaryAccent}
                  style={modalStyles.inputIcon}
                />
                <TextInput
                  style={[
                    modalStyles.input,
                    { color: colors.primaryText, borderColor: colors.divider },
                  ]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone Number"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.disabledText}
                />
              </View>

              <View style={modalStyles.inputContainer}>
                <Icon
                  name="map-marker-outline"
                  size={20}
                  color={colors.primaryAccent}
                  style={modalStyles.inputIcon}
                />
                <TextInput
                  style={[
                    modalStyles.input,
                    { color: colors.primaryText, borderColor: colors.divider },
                  ]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Address"
                  multiline
                  placeholderTextColor={colors.disabledText}
                />
              </View>

              <View style={modalStyles.buttonRow}>
                <TouchableOpacity
                  style={modalStyles.cancelBtn}
                  onPress={onClose}
                >
                  <Text style={{ color: colors.primaryText }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Alert.alert("Saved", "Profile updated successfully!");
                    onClose();
                  }}
                >
                  <LinearGradient
                    colors={[colors.primaryAccent, "#4A90E2"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={modalStyles.saveBtn}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "700",
                        fontSize: 16,
                      }}
                    >
                      Save
                    </Text>
                  </LinearGradient>
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  inputIcon: {
    position: "absolute",
    left: 10,
    zIndex: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 40,
    paddingVertical: 10,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "rgba(200,200,200,0.3)",
    marginRight: 10,
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
});

export default EditProfileModal;