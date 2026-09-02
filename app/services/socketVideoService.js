// services/socketVideoService.js
// Pure In-App Socket.IO Real-Time Video & Audio Signaling for EduNex (Zero Login, Zero WebViews)

import { io } from "socket.io-client";
import { notifyChatSubscribers, sendCallSignal } from "./chatService";

// Free, fast public WebSocket / Socket.io signaling server or fallback
const SOCKET_SIGNALING_URL = "https://edunex-signaling.glitch.me";

let socket = null;
let activeRoomId = null;

/**
 * Initializes and connects Socket.io room for a call session
 */
export function initSocketVideoRoom({ roomId, user, onRemoteMediaChange, onPeerHangup }) {
  activeRoomId = roomId;

  try {
    if (!socket) {
      socket = io(SOCKET_SIGNALING_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 5000,
      });
    }

    socket.emit("join_call_room", {
      roomId,
      user: {
        id: user?.id || "user",
        name: user?.name || "User",
        role: user?.role || "student",
      },
    });

    socket.on("remote_media_change", (data) => {
      if (data?.roomId === activeRoomId && onRemoteMediaChange) {
        onRemoteMediaChange(data);
      }
    });

    socket.on("call_hangup", (data) => {
      if (data?.roomId === activeRoomId && onPeerHangup) {
        onPeerHangup(data);
      }
    });
  } catch (err) {
    console.log("Socket.IO init fallback to real-time event bus:", err);
  }

  return () => {
    leaveSocketVideoRoom();
  };
}

/**
 * Broadcasts media state change (mute, video toggle, camera flip) to peer
 */
export function emitMediaStateChange({ isMuted, isVideoEnabled, cameraFacing, user }) {
  if (socket && activeRoomId) {
    socket.emit("media_state_change", {
      roomId: activeRoomId,
      isMuted,
      isVideoEnabled,
      cameraFacing,
      user,
    });
  }

  // Also broadcast over in-app real-time event bus
  notifyChatSubscribers({
    type: "call_media_change",
    roomId: activeRoomId,
    isMuted,
    isVideoEnabled,
    cameraFacing,
  });
}

/**
 * Emits hangup to remote peer
 */
export function emitCallHangup({ caller, recipientId, reason = "ended" }) {
  if (socket && activeRoomId) {
    socket.emit("hangup_call", {
      roomId: activeRoomId,
      caller,
      recipientId,
      reason,
    });
  }

  if (activeRoomId && recipientId) {
    sendCallSignal({
      type: "call_end",
      roomId: activeRoomId,
      caller,
      recipientId,
      reason,
    }).catch(() => {});
  }

  leaveSocketVideoRoom();
}

/**
 * Disconnects and cleans up socket room
 */
export function leaveSocketVideoRoom() {
  if (socket && activeRoomId) {
    socket.emit("leave_call_room", { roomId: activeRoomId });
  }
  activeRoomId = null;
}
