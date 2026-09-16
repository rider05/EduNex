// services/socketVideoService.js
// Pure Native Real-Time Video & Audio Signaling for EduNex (Zero Login, Zero WebViews, 100% Native Metro Compatible)

import { notifyChatSubscribers, sendCallSignal } from "./chatService";
import { BASE_URL } from "./api";

// Connect directly to the EduNex production backend host via Native WebSocket
const WS_SIGNALING_URL = BASE_URL.replace(/^http/, "ws").replace(/\/api\/v1\/?$/, "/ws/calls");

let ws = null;
let activeRoomId = null;

/**
 * Initializes and connects Native WebSocket room for a call session
 */
export function initSocketVideoRoom({ roomId, user, onRemoteMediaChange, onPeerHangup }) {
  activeRoomId = roomId;

  try {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      ws = new WebSocket(`${WS_SIGNALING_URL}?roomId=${encodeURIComponent(roomId)}`);

      ws.onopen = () => {
        try {
          ws.send(
            JSON.stringify({
              type: "join_call_room",
              roomId,
              user: {
                id: user?.id || "user",
                name: user?.name || "User",
                role: user?.role || "student",
              },
            })
          );
        } catch (_e) {}
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === "remote_media_change" && onRemoteMediaChange) {
            onRemoteMediaChange(data);
          } else if (data?.type === "call_hangup" && onPeerHangup) {
            onPeerHangup(data);
          }
        } catch (_e) {}
      };

      ws.onerror = (_err) => {
        // Native fallback to in-app event bus
      };
    }
  } catch (err) {
    console.log("WebSocket init fallback to real-time event bus:", err);
  }

  return () => {
    leaveSocketVideoRoom();
  };
}

/**
 * Broadcasts media state change (mute, video toggle, camera flip) to peer
 */
export function emitMediaStateChange({ isMuted, isVideoEnabled, cameraFacing, user }) {
  if (ws && ws.readyState === WebSocket.OPEN && activeRoomId) {
    try {
      ws.send(
        JSON.stringify({
          type: "media_state_change",
          roomId: activeRoomId,
          isMuted,
          isVideoEnabled,
          cameraFacing,
          user,
        })
      );
    } catch (_e) {}
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
  if (ws && ws.readyState === WebSocket.OPEN && activeRoomId) {
    try {
      ws.send(
        JSON.stringify({
          type: "hangup_call",
          roomId: activeRoomId,
          caller,
          recipientId,
          reason,
        })
      );
    } catch (_e) {}
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
 * Disconnects and cleans up native websocket room
 */
export function leaveSocketVideoRoom() {
  if (ws) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    } catch (_e) {}
    ws = null;
  }
  activeRoomId = null;
}
