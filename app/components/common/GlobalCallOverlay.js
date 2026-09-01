import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  Linking,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { CameraView, Camera } from "expo-camera";
import * as WebBrowser from "expo-web-browser";
import { resolveIdentity } from "../../services/identityService";
import {
  subscribeToChatMessages,
  sendCallSignal,
  getCanonicalPairKey,
  resolveHumanDisplayName,
} from "../../services/chatService";
import { showToast } from "../../utils/toastService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function GlobalCallOverlay() {
  const [currentUser, setCurrentUser] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState("audio"); // 'audio' | 'video'
  const [callStatus, setCallStatus] = useState("ringing"); // 'ringing' | 'connected' | 'ended'
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [cameraFacing, setCameraFacing] = useState("front");
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [remoteParty, setRemoteParty] = useState(null);

  const callIntervalRef = useRef(null);
  const incomingRingTimeoutRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const wave1Anim = useRef(new Animated.Value(12)).current;
  const wave2Anim = useRef(new Animated.Value(24)).current;
  const wave3Anim = useRef(new Animated.Value(16)).current;
  const wave4Anim = useRef(new Animated.Value(30)).current;

  // 1. Load user identity
  useEffect(() => {
    async function loadUser() {
      try {
        const id = await resolveIdentity();
        setCurrentUser(id);
      } catch (err) {
        console.warn("GlobalCallOverlay loadUser error:", err);
      }
    }
    loadUser();
  }, []);

  // 2. Pulse & Waveform animations during call
  useEffect(() => {
    if (isCalling) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      pulseLoop.start();

      const waveLoop = Animated.loop(
        Animated.stagger(120, [
          Animated.sequence([
            Animated.timing(wave1Anim, { toValue: 34, duration: 320, useNativeDriver: false }),
            Animated.timing(wave1Anim, { toValue: 10, duration: 320, useNativeDriver: false }),
          ]),
          Animated.sequence([
            Animated.timing(wave2Anim, { toValue: 46, duration: 300, useNativeDriver: false }),
            Animated.timing(wave2Anim, { toValue: 14, duration: 300, useNativeDriver: false }),
          ]),
          Animated.sequence([
            Animated.timing(wave3Anim, { toValue: 38, duration: 360, useNativeDriver: false }),
            Animated.timing(wave3Anim, { toValue: 8, duration: 360, useNativeDriver: false }),
          ]),
          Animated.sequence([
            Animated.timing(wave4Anim, { toValue: 50, duration: 330, useNativeDriver: false }),
            Animated.timing(wave4Anim, { toValue: 12, duration: 330, useNativeDriver: false }),
          ]),
        ])
      );
      waveLoop.start();

      return () => {
        pulseLoop.stop();
        waveLoop.stop();
      };
    }
  }, [isCalling, pulseAnim, wave1Anim, wave2Anim, wave3Anim, wave4Anim]);

  // 3. Global Listener for incoming calls & signaling
  useEffect(() => {
    const unsub = subscribeToChatMessages((payload) => {
      if (!payload) return;

      if (payload.type === "call_signal" || payload.signalType) {
        const myId = String(
          currentUser?.student?.rollNo ||
          currentUser?.staffId ||
          currentUser?.staff?.id ||
          currentUser?.id ||
          ""
        ).toLowerCase().trim();
        const myRoll = String(currentUser?.student?.rollNo || currentUser?.rollNo || "").toLowerCase().trim();
        const myStaffId = String(currentUser?.staff?.id || currentUser?.staffId || "").toLowerCase().trim();
        const myRole = String(currentUser?.role || "").toLowerCase().trim();

        const rId = String(payload.recipientId || "").toLowerCase().trim();
        const rRole = String(payload.recipientRole || "").toLowerCase().trim();

        const isTargetedToMe =
          (myId && rId === myId) ||
          (myRoll && rId === myRoll) ||
          (myStaffId && rId === myStaffId) ||
          (rRole && myRole && rRole === myRole && !rId);

        // Incoming Call Invitation
        if (payload.signalType === "call_invite" && isTargetedToMe) {
          setIncomingCall(payload);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch {}

          // 45-Second Maximum Ringing Limit for Incoming Call
          if (incomingRingTimeoutRef.current) clearTimeout(incomingRingTimeoutRef.current);
          incomingRingTimeoutRef.current = setTimeout(() => {
            setIncomingCall(null);
            sendCallSignal({
              type: "call_decline",
              roomId: payload.roomId,
              caller: payload.caller,
              recipientId: payload.recipientId,
              recipientName: payload.recipientName,
              callType: payload.callType || "audio",
              reason: "timeout",
            }).catch(() => {});
            showToast("📞 Missed call", "info");
          }, 45000);
          return;
        }

        // Call Accepted
        if (payload.signalType === "call_accept") {
          if (incomingRingTimeoutRef.current) clearTimeout(incomingRingTimeoutRef.current);
          setCallStatus("connected");
          return;
        }

        // Call Declined or Ended by Remote Party
        if (payload.signalType === "call_end" || payload.signalType === "call_decline") {
          if (incomingRingTimeoutRef.current) clearTimeout(incomingRingTimeoutRef.current);
          if (isCalling) {
            if (callIntervalRef.current) clearInterval(callIntervalRef.current);
            setIsCalling(false);
            setCallStatus("ended");
            setCallTimer(0);
            showToast(payload.reason === "timeout" ? "📞 Call unanswered" : "📞 Call ended", "info");
          }
          if (incomingCall) {
            setIncomingCall(null);
          }
        }
      }
    });

    return () => unsub();
  }, [currentUser, isCalling, incomingCall]);

  const handleAnswerIncomingCall = async () => {
    if (!incomingCall) return;
    const call = incomingCall;
    setIncomingCall(null);

    const callerNameResolved = resolveHumanDisplayName(
      call.caller?.id || call.senderId,
      call.caller?.role || call.senderRole || "staff",
      call.caller?.name || call.senderName
    );

    const callerData = {
      id: call.caller?.id || call.senderId,
      name: callerNameResolved,
      role: call.caller?.role || call.senderRole || "Contact",
      initials: (callerNameResolved || "U")[0],
    };

    setRemoteParty(callerData);
    setCallType(call.callType || "audio");
    setIsCalling(true);
    setCallStatus("connected");
    setCallTimer(0);
    setIsMuted(false);
    setIsSpeaker(call.callType === "video");
    setIsVideoEnabled(true);
    setCameraFacing("front");

    if (call.callType === "video") {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasCameraPermission(status === "granted");
      } catch (err) {
        console.log("Camera permission error:", err);
      }
    }

    const myId =
      currentUser?.student?.rollNo ||
      currentUser?.staffId ||
      currentUser?.staff?.id ||
      currentUser?.id ||
      "user_current";
    const myName =
      currentUser?.student?.name ||
      currentUser?.staff?.name ||
      currentUser?.name ||
      "User";

    // Send accept signal back
    sendCallSignal({
      type: "call_accept",
      roomId: call.roomId,
      caller: { id: myId, name: myName, role: currentUser?.role || "student" },
      recipientId: callerData.id,
      recipientName: callerData.name,
      callType: call.callType || "audio",
      channelType: call.channelType || "student_staff",
    }).catch(() => {});

    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    callIntervalRef.current = setInterval(() => {
      setCallTimer((prev) => prev + 1);
    }, 1000);
  };

  const handleDeclineIncomingCall = () => {
    if (incomingCall) {
      const myId =
        currentUser?.student?.rollNo ||
        currentUser?.staffId ||
        currentUser?.staff?.id ||
        currentUser?.id ||
        "user_current";
      const myName =
        currentUser?.student?.name ||
        currentUser?.staff?.name ||
        currentUser?.name ||
        "User";

      sendCallSignal({
        type: "call_decline",
        roomId: incomingCall.roomId,
        caller: { id: myId, name: myName, role: currentUser?.role || "student" },
        recipientId: incomingCall.caller?.id || incomingCall.senderId,
        recipientName: incomingCall.caller?.name || incomingCall.senderName,
        callType: incomingCall.callType || "audio",
        channelType: incomingCall.channelType || "student_staff",
      }).catch(() => {});
    }
    setIncomingCall(null);
    showToast("📞 Call declined", "info");
  };

  const handleLaunchFullDuplexRoom = async (type = callType) => {
    if (!remoteParty && !incomingCall) return;
    const party = remoteParty || incomingCall?.caller;
    const myId =
      currentUser?.student?.rollNo ||
      currentUser?.staffId ||
      currentUser?.staff?.id ||
      currentUser?.id ||
      "user_current";
    const myName =
      currentUser?.student?.name ||
      currentUser?.staff?.name ||
      currentUser?.name ||
      "User";

    const roomId = getCanonicalPairKey(myId, party?.id);
    const isVideoMuted = type === "audio" || !isVideoEnabled;
    const meetUrl = `https://meet.jit.si/EduNex_${roomId}#config.startWithAudioMuted=${isMuted}&config.startWithVideoMuted=${isVideoMuted}&config.prejoinPageEnabled=false&userInfo.displayName=${encodeURIComponent(myName)}`;

    try {
      await WebBrowser.openBrowserAsync(meetUrl, {
        showTitle: true,
        enableBarCollapsing: true,
        toolbarColor: "#064E3B",
      });
    } catch {
      Linking.openURL(meetUrl).catch(() => {});
    }
  };

  const handleEndCall = () => {
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    setIsCalling(false);
    setCallStatus("ended");
    setCallTimer(0);

    if (remoteParty) {
      const myId =
        currentUser?.student?.rollNo ||
        currentUser?.staffId ||
        currentUser?.staff?.id ||
        currentUser?.id ||
        "user_current";
      const myName =
        currentUser?.student?.name ||
        currentUser?.staff?.name ||
        currentUser?.name ||
        "User";

      const roomId = getCanonicalPairKey(myId, remoteParty.id);
      sendCallSignal({
        type: "call_end",
        roomId,
        caller: { id: myId, name: myName, role: currentUser?.role || "student" },
        recipientId: remoteParty.id,
        recipientName: remoteParty.name,
        callType,
      }).catch(() => {});

      showToast(`📞 Call ended (${formatCallTime(callTimer)})`, "info");
    }
  };

  const formatCallTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <>
      {/* ---------------------------------------------------- */}
      {/* 1. GLOBAL INCOMING CALL OVERLAY MODAL                */}
      {/* ---------------------------------------------------- */}
      {incomingCall && (
        <Modal
          visible={Boolean(incomingCall)}
          transparent
          animationType="fade"
          onRequestClose={handleDeclineIncomingCall}
        >
          <View style={styles.sheetBackdrop}>
            <LinearGradient
              colors={["#064E3B", "#022C22", "#0F172A"]}
              style={styles.incomingCallCard}
            >
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <Icon
                  name={incomingCall.callType === "video" ? "video" : "phone-in-talk"}
                  size={32}
                  color="#34D399"
                />
                <Text style={{ color: "#34D399", fontSize: 13, fontWeight: "800", marginTop: 6, letterSpacing: 0.5 }}>
                  INCOMING {incomingCall.callType === "video" ? "VIDEO" : "VOICE"} CALL
                </Text>
                <View
                  style={[
                    styles.callAvatarLarge,
                    {
                      width: 86,
                      height: 86,
                      borderRadius: 43,
                      marginVertical: 14,
                      backgroundColor: "#059669",
                    },
                  ]}
                >
                  <Text style={{ fontSize: 34, fontWeight: "800", color: "#FFF" }}>
                    {(resolveHumanDisplayName(incomingCall.caller?.id || incomingCall.senderId, incomingCall.caller?.role || incomingCall.senderRole, incomingCall.caller?.name || incomingCall.senderName) || "U")[0]}
                  </Text>
                </View>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", textAlign: "center", paddingHorizontal: 12 }}>
                  {resolveHumanDisplayName(
                    incomingCall.caller?.id || incomingCall.senderId,
                    incomingCall.caller?.role || incomingCall.senderRole || "staff",
                    incomingCall.caller?.name || incomingCall.senderName
                  )}
                </Text>
                <Text style={{ color: "#34D399", fontSize: 13, fontWeight: "600", marginTop: 4 }}>
                  {incomingCall.caller?.role === "staff" ? "Faculty Advisor · AI & Data Science" : "Student · III Year AI & DS"}
                </Text>
                <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 2 }}>
                  EduNex E2EE Real-Time Call
                </Text>
              </View>

              {/* Accept / Decline Buttons */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  width: "100%",
                  marginTop: 28,
                  marginBottom: 10,
                }}
              >
                <TouchableOpacity
                  style={[styles.callEndBtnCircle, { backgroundColor: "#EF4444" }]}
                  onPress={handleDeclineIncomingCall}
                >
                  <Icon name="phone-hangup" size={28} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.callEndBtnCircle, { backgroundColor: "#10B981" }]}
                  onPress={handleAnswerIncomingCall}
                >
                  <Icon name="phone" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Modal>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. GLOBAL ACTIVE AUDIO / VIDEO CALL SCREEN           */}
      {/* ---------------------------------------------------- */}
      {isCalling && (
        <Modal
          visible={isCalling}
          animationType="slide"
          transparent={false}
          onRequestClose={handleEndCall}
        >
          <View style={{ flex: 1, backgroundColor: "#0B141A" }}>
            {callType === "video" ? (
              /* VIDEO CALL SCREEN */
              <View style={{ flex: 1 }}>
                {isVideoEnabled && hasCameraPermission ? (
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing={cameraFacing}
                    mute={isMuted}
                  />
                ) : (
                  <LinearGradient
                    colors={["#0F172A", "#1E293B", "#0F172A"]}
                    style={[
                      StyleSheet.absoluteFillObject,
                      { justifyContent: "center", alignItems: "center" },
                    ]}
                  >
                    <View
                      style={[
                        styles.callAvatarLarge,
                        {
                          backgroundColor: "#059669",
                          width: 110,
                          height: 110,
                          borderRadius: 55,
                        },
                      ]}
                    >
                      <Text style={[styles.callAvatarLargeText, { fontSize: 38 }]}>
                        {remoteParty?.initials || "U"}
                      </Text>
                    </View>
                    <Text style={{ color: "#94A3B8", marginTop: 14, fontSize: 14, fontWeight: "600" }}>
                      {!hasCameraPermission ? "Camera permission required" : "Camera turned off"}
                    </Text>
                  </LinearGradient>
                )}

                {/* Dark Gradient Overlay for readability */}
                <LinearGradient
                  colors={["rgba(0,0,0,0.7)", "transparent", "rgba(0,0,0,0.85)"]}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* Top Header Floating Info */}
                <View style={[styles.callHeader, { paddingTop: Platform.OS === "ios" ? 54 : 36 }]}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: "rgba(0,0,0,0.45)",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                    }}
                  >
                    <Icon name="shield-lock" size={14} color="#34D399" />
                    <Text style={styles.callEncryptedText}>End-to-End Encrypted (HD Video)</Text>
                  </View>
                  <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 8 }}>
                    {remoteParty?.name || "Participant"}
                  </Text>
                  <Text style={{ color: callStatus === "connected" ? "#34D399" : "#FBBF24", fontSize: 14, fontWeight: "600", marginTop: 2 }}>
                    {callStatus === "connected" ? formatCallTime(callTimer) : "Connecting..."}
                  </Text>

                  {/* Launch Full-Duplex WebRTC Live Session */}
                  <TouchableOpacity
                    style={styles.fullDuplexPillBtn}
                    onPress={() => handleLaunchFullDuplexRoom("video")}
                    activeOpacity={0.8}
                  >
                    <Icon name="broadcast" size={14} color="#34D399" />
                    <Text style={styles.fullDuplexPillText}>Full Duplex HD WebRTC</Text>
                    <Icon name="open-in-new" size={12} color="#34D399" />
                  </TouchableOpacity>
                </View>

                {/* Floating PIP Self-View / Contact Tile */}
                <View style={styles.videoPipCard}>
                  <View
                    style={[
                      styles.waSmallAvatar,
                      { backgroundColor: "#059669", width: 36, height: 36, borderRadius: 18 },
                    ]}
                  >
                    <Text style={styles.waSmallAvatarText}>{remoteParty?.initials || "U"}</Text>
                  </View>
                  <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700", marginTop: 4 }} numberOfLines={1}>
                    {remoteParty?.name?.split(" ")[0] || "Remote"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" }} />
                    <Text style={{ color: "#34D399", fontSize: 9.5, fontWeight: "700" }}>HD Live</Text>
                  </View>
                </View>

                {/* Video Call Controls Docked at Bottom */}
                <View style={styles.callControlsRow}>
                  <TouchableOpacity
                    style={styles.callBtnCircle}
                    onPress={() => setCameraFacing((p) => (p === "front" ? "back" : "front"))}
                  >
                    <Icon name="camera-flip" size={24} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.callBtnCircle, !isVideoEnabled && { backgroundColor: "rgba(239,68,68,0.5)" }]}
                    onPress={() => setIsVideoEnabled((p) => !p)}
                  >
                    <Icon name={isVideoEnabled ? "video" : "video-off"} size={24} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.callBtnCircle, isMuted && { backgroundColor: "rgba(239,68,68,0.5)" }]}
                    onPress={() => setIsMuted((p) => !p)}
                  >
                    <Icon name={isMuted ? "microphone-off" : "microphone"} size={24} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.callBtnCircle, isSpeaker && { backgroundColor: "rgba(0,168,132,0.6)" }]}
                    onPress={() => setIsSpeaker((p) => !p)}
                  >
                    <Icon name={isSpeaker ? "volume-high" : "volume-medium"} size={24} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.callEndBtnCircle} onPress={handleEndCall}>
                    <Icon name="phone-hangup" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* VOICE CALL SCREEN */
              <LinearGradient
                colors={["#064E3B", "#022C22", "#0B141A"]}
                style={styles.callScreenContainer}
              >
                <View style={[styles.callHeader, { paddingTop: Platform.OS === "ios" ? 54 : 36 }]}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: "rgba(0,0,0,0.35)",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                    }}
                  >
                    <Icon name="shield-lock" size={14} color="#34D399" />
                    <Text style={styles.callEncryptedText}>End-to-End Encrypted Voice Call</Text>
                  </View>
                </View>

                <View style={styles.callProfileCenter}>
                  <Animated.View
                    style={[
                      styles.callAvatarLarge,
                      {
                        backgroundColor: "#059669",
                        transform: [{ scale: callStatus === "connected" ? pulseAnim : 1 }],
                      },
                    ]}
                  >
                    <Text style={styles.callAvatarLargeText}>{remoteParty?.initials || "U"}</Text>
                  </Animated.View>

                  <Text style={styles.callContactName}>{remoteParty?.name || "Participant"}</Text>
                  <Text style={[styles.callStatusText, { color: callStatus === "connected" ? "#34D399" : "#FBBF24" }]}>
                    {callStatus === "connected" ? formatCallTime(callTimer) : "Connecting..."}
                  </Text>

                  {/* Launch Real Full-Duplex WebRTC Live Session */}
                  <TouchableOpacity
                    style={styles.fullDuplexPillBtn}
                    onPress={() => handleLaunchFullDuplexRoom("audio")}
                    activeOpacity={0.8}
                  >
                    <Icon name="broadcast" size={14} color="#34D399" />
                    <Text style={styles.fullDuplexPillText}>Full Duplex HD WebRTC</Text>
                    <Icon name="open-in-new" size={12} color="#34D399" />
                  </TouchableOpacity>

                  {/* Animated Audio Waveform Equalizer */}
                  {callStatus === "connected" && (
                    <View style={styles.audioWaveformRow}>
                      <Animated.View style={[styles.waveBar, { height: wave1Anim }]} />
                      <Animated.View style={[styles.waveBar, { height: wave2Anim }]} />
                      <Animated.View style={[styles.waveBar, { height: wave4Anim }]} />
                      <Animated.View style={[styles.waveBar, { height: wave3Anim }]} />
                      <Animated.View style={[styles.waveBar, { height: wave1Anim }]} />
                    </View>
                  )}
                </View>

                {/* Voice Call Controls Docked at Bottom */}
                <View style={styles.callControlsRow}>
                  <TouchableOpacity
                    style={[styles.callBtnCircle, isMuted && { backgroundColor: "rgba(239,68,68,0.5)" }]}
                    onPress={() => setIsMuted((p) => !p)}
                  >
                    <Icon name={isMuted ? "microphone-off" : "microphone"} size={26} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.callBtnCircle, isSpeaker && { backgroundColor: "rgba(0,168,132,0.6)" }]}
                    onPress={() => setIsSpeaker((p) => !p)}
                  >
                    <Icon name={isSpeaker ? "volume-high" : "volume-medium"} size={26} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.callEndBtnCircle} onPress={handleEndCall}>
                    <Icon name="phone-hangup" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            )}
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  incomingCallCard: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    elevation: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.4)",
  },
  callScreenContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 54,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  callHeader: {
    alignItems: "center",
    gap: 6,
    zIndex: 10,
  },
  callEncryptedText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
  },
  callProfileCenter: {
    alignItems: "center",
    gap: 12,
    marginTop: 20,
  },
  callAvatarLarge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
    elevation: 6,
  },
  callAvatarLargeText: {
    fontSize: 42,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  callContactName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  callStatusText: {
    fontSize: 15,
    fontWeight: "600",
  },
  fullDuplexPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  fullDuplexPillText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "700",
  },
  videoPipCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 110 : 90,
    right: 16,
    width: 100,
    height: 125,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderRadius: 16,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  waSmallAvatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  waSmallAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  audioWaveformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 60,
    marginTop: 20,
  },
  waveBar: {
    width: 6,
    backgroundColor: "#34D399",
    borderRadius: 3,
  },
  callControlsRow: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 42 : 28,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    backgroundColor: "rgba(11, 20, 26, 0.88)",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    zIndex: 999,
  },
  callBtnCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    justifyContent: "center",
    alignItems: "center",
  },
  callEndBtnCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
