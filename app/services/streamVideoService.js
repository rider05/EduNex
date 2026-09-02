// services/streamVideoService.js
// 100% Zero-Login, Pure Background Room Creation Video Service for EduNex

/**
 * Generates a deterministic Call Room ID for any pair of users
 */
export function getStreamCallId(userAId, userBId) {
  const cleanA = String(userAId || "userA").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const cleanB = String(userBId || "userB").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const sorted = [cleanA, cleanB].sort().join("_");
  return `edunex_${sorted}`;
}

/**
 * Generates a self-contained, 100% Zero-Login background WebRTC HTML room
 * - No login screen
 * - No sign-up
 * - No "create room" button
 * - Zero prompts: automatically joins and streams 2-way HD video
 */
export function getZeroLoginStreamVideoHtml({
  roomId,
  userName = "User",
  isCaller = true,
  isMuted = false,
  isVideoEnabled = true,
}) {
  const cleanRoomId = String(roomId || "edunex_call").replace(/[^a-zA-Z0-9_]/g, "_");
  const safeName = String(userName || "User").replace(/[^a-zA-Z0-9 _-]/g, "");
  const initial = (safeName[0] || "U").toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>EduNex Video</title>
  <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; background: #0B141A; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; }
    #remote-video { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 1; background: #0B141A; }
    #placeholder { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2; background: linear-gradient(180deg, #0B141A 0%, #111B21 50%, #0B141A 100%); transition: opacity 0.5s ease; }
    .avatar-circle { width: 110px; height: 110px; border-radius: 55px; background: #059669; display: flex; align-items: center; justify-content: center; font-size: 42px; font-weight: 800; color: #FFFFFF; box-shadow: 0 10px 30px rgba(5,150,105,0.3); animation: pulse 2s infinite ease-in-out; }
    .name-label { margin-top: 16px; font-size: 22px; font-weight: 800; color: #FFFFFF; }
    .status-pill { margin-top: 12px; padding: 6px 16px; background: rgba(16,185,129,0.18); border: 1px solid rgba(52,211,153,0.35); border-radius: 20px; font-size: 13px; color: #34D399; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .dot { width: 8px; height: 8px; border-radius: 4px; background: #10B981; animation: blink 1.5s infinite; }
    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  </style>
</head>
<body>
  <div id="placeholder">
    <div class="avatar-circle">${initial}</div>
    <div class="name-label">${safeName}</div>
    <div class="status-pill">
      <div class="dot"></div>
      <span id="status-text">Connecting Live 2-Way HD Video...</span>
    </div>
  </div>
  <video id="remote-video" autoplay playsinline></video>

  <script>
    (function() {
      const cleanRoom = "${cleanRoomId}";
      const isCaller = ${isCaller ? "true" : "false"};
      const myPeerId = isCaller ? (cleanRoom + "_caller") : (cleanRoom + "_receiver");
      const targetPeerId = isCaller ? (cleanRoom + "_receiver") : (cleanRoom + "_caller");

      const remoteVideo = document.getElementById('remote-video');
      const placeholder = document.getElementById('placeholder');
      const statusText = document.getElementById('status-text');

      let localStream = null;
      let peerInstance = null;

      function onRemoteConnected(stream) {
        if (remoteVideo) {
          remoteVideo.srcObject = stream;
          remoteVideo.play().catch(() => {});
        }
        if (placeholder) {
          placeholder.style.opacity = '0';
          setTimeout(() => { placeholder.style.display = 'none'; }, 500);
        }
      }

      async function startMedia() {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
          });
          ${isMuted ? "if (localStream.getAudioTracks()[0]) localStream.getAudioTracks()[0].enabled = false;" : ""}
          ${!isVideoEnabled ? "if (localStream.getVideoTracks()[0]) localStream.getVideoTracks()[0].enabled = false;" : ""}
        } catch (e) {
          console.warn("Direct media:", e);
        }

        try {
          peerInstance = new Peer(myPeerId, {
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' }
              ]
            }
          });

          peerInstance.on('open', () => {
            if (statusText) statusText.innerText = "Live HD Video Connected";
            if (isCaller) {
              callPeer();
            }
          });

          peerInstance.on('call', (incomingCall) => {
            incomingCall.answer(localStream);
            incomingCall.on('stream', onRemoteConnected);
          });

          peerInstance.on('error', (err) => {
            console.log("Peer state:", err);
            if (isCaller) {
              setTimeout(callPeer, 2000);
            }
          });
        } catch (err) {
          console.error("Peer init failed:", err);
        }
      }

      function callPeer() {
        if (!peerInstance || !localStream) return;
        const outgoingCall = peerInstance.call(targetPeerId, localStream);
        if (outgoingCall) {
          outgoingCall.on('stream', onRemoteConnected);
        }
      }

      startMedia();
    })();
  </script>
</body>
</html>`;
}

/**
 * Builds the Zero-Login GetStream / WebRTC fallback calling URL
 */
export function getStreamVideoUrl({
  roomId,
  userName = "User",
  isMuted = false,
  isVideoEnabled = true,
}) {
  const callId = roomId ? String(roomId).replace(/[^a-zA-Z0-9_-]/g, "_") : "edunex_room";
  const safeName = encodeURIComponent(String(userName || "User").trim());

  // Zero-login background connection bypassing all login/lobby/auth screens
  const zeroLoginUrl = `https://meet.jit.si/EduNex_${callId}#config.prejoinPageEnabled=false&config.prejoinConfig.enabled=false&config.disableDeepLinking=true&config.requireDisplayName=false&config.enableWelcomePage=false&config.enableClosePage=false&config.enableLobbyChat=false&config.startWithAudioMuted=${Boolean(isMuted)}&config.startWithVideoMuted=${!Boolean(isVideoEnabled)}&userInfo.displayName="${safeName}"`;

  return zeroLoginUrl;
}

/**
 * Injected JavaScript to bypass any lobby screens and join automatically in the background
 */
export function getStreamAutoJoinScript(userName = "User") {
  const safeName = String(userName || "User").replace(/[^a-zA-Z0-9 _-]/g, "");
  return `
    (function() {
      function autoJoinBackground() {
        // 1. Auto-fill name if input exists
        const nameInputs = document.querySelectorAll('input[type="text"], input[name="name"], input[placeholder*="name" i]');
        nameInputs.forEach(input => {
          if (!input.value) {
            input.value = "${safeName}";
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });

        // 2. Bypass download / open in app prompts
        const webButtons = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
        const launchWebBtn = webButtons.find(el => {
          const txt = (el.innerText || el.textContent || '').toLowerCase();
          return txt.includes('launch in web') || txt.includes('join in web') || txt.includes('continue on web') || txt.includes('join this meeting using the web');
        });
        if (launchWebBtn) launchWebBtn.click();

        // 3. Auto-click Join buttons with zero delay
        const joinButtons = Array.from(document.querySelectorAll('button, div[role="button"], input[type="submit"]'));
        const joinBtn = joinButtons.find(el => {
          const txt = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
          return (
            txt.includes('join meeting') ||
            txt.includes('join call') ||
            txt.includes('join room') ||
            txt.includes('enter') ||
            txt === 'join' ||
            txt === 'start'
          );
        });
        if (joinBtn) joinBtn.click();
      }

      const interval = setInterval(autoJoinBackground, 200);
      autoJoinBackground();
      setTimeout(() => clearInterval(interval), 12000);
    })();
    true;
  `;
}
