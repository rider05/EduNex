# EduNex Application Workflow

> **Architecture, Data Flow, and User Journeys**

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        EduNex Mobile App                     │
│            (React Native 0.86.3 / Expo SDK 57)               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │  UI Layer │  │ Service Layer │  │    Persistence Layer   ││
│  │           │  │               │  │                        ││
│  │ Screens   │  │ api.js        │  │ secureStorage.js       ││
│  │ Components│  │ dataService   │  │  (AES-CBC/PBKDF2       ││
│  │ Headers   │  │ chatService   │  │   encrypted AsyncStorage)│
│  │ Modals    │  │ offlineSync   │  │                        ││
│  │ Nav       │  │ socketVideo   │  │ Local DB per user      ││
│  │           │  │ realtimeNotif │  │ edunex_db_<username>   ││
│  │           │  │ updateService │  │ offline mutation queue ││
│  │           │  │ identitySvc   │  │  (encrypted)           ││
│  │           │  │ navEvents     │  │                        ││
│  └─────┬─────┘  └──────┬───────┘  └───────────┬────────────┘│
│        │               │                       │             │
│        └───────────────┼───────────────────────┘             │
│                        │                                     │
├────────────────────────┼─────────────────────────────────────┤
│                   REST API                                    │
│         https://edunex-backend-rmvx.onrender.com/api/v1      │
│                                                               │
│                   Native WebSocket                            │
│            ws://edunex-backend-rmvx.onrender.com/ws/calls     │
│                   (call signaling)                            │
│                   (MongoDB backend)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Application Entry & Boot Sequence

```
app/_layout.tsx  (Expo Router Stack)
    │
    ├── SafeAreaProvider
    ├── GlobalCallOverlay  (native WebSocket call listener)
    ├── startRealtimeWatcher(1500)  (1.5s polling)
    │
    └── app/index.tsx  (Real Root)
         │
         ├── ThemeProvider  (light/dark toggle)
         ├── ToastProvider  (global toast system)
         │
         └── IndexCore
              │
              ├── [1] Load role from secureStorage("userRole")
              │       ├── "admin"  → Admin UI
              │       ├── "staff"  → Staff UI
              │       ├── "parent" → Parent UI
              │       ├── "student"→ Student UI
              │       └── "guest"  → SkipScreen / Login
              │
              ├── [2] Register auth listener (onUnauthorized)
              │
              └── [3] Render based on role
```

---

## 3. Authentication Flow

```
                    ┌──────────────┐
                    │  App Launch   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ secureGet()  │
                    │ "userRole"   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         Role found   No role     Session expired
              │            │            │
              ▼            ▼            ▼
     ┌────────────┐ ┌──────────┐ ┌──────────┐
     │ Render Role │ │  Login   │ │  Login   │
     │ Navigator   │ │  Modal   │ │  Modal   │
     └────────────┘ │ (Guest)  │ │ (Error)  │
                    └─────┬────┘ └─────┬────┘
                          │            │
                    ┌─────▼────────────▼─────┐
                    │   LoginPage Modal       │
                    │                         │
                    │  ┌─────┐  ┌──────────┐ │
                    │  │Login│  │ Sign Up  │ │
                    │  └──┬──┘  └────┬─────┘ │
                    │     │          │        │
                    │  Username   Name/Email  │
                    │  Password   Role Select │
                    │             Password    │
                    └────────────┬────────────┘
                                 │
                          ┌──────▼──────┐
                          │ POST /login │
                          │ or /signup  │
                          └──────┬──────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                   200          401          Error
                    │            │            │
                    ▼            ▼            ▼
              ┌──────────┐ ┌─────────┐ ┌─────────┐
              │ setAuth  │ │ Show    │ │ Toast   │
              │ Session  │ │ Error   │ │ Error   │
              │          │ │ Toast   │ │         │
              └────┬─────┘ └─────────┘ └─────────┘
                   │
              ┌────▼──────┐
              │ syncAfter │  (Delta sync to local DB)
              │ Login()   │
              └────┬──────┘
                   │
              ┌────▼──────────────┐
              │ secureSet(        │
              │  "userRole",      │
              │  mappedRole)      │
              └────┬──────────────┘
                   │
              ┌────▼──────────────┐
              │ Navigate to       │
              │ Role Dashboard    │
              └───────────────────┘
```

### Role Mapping

| Backend Role | App Role |
|-------------|----------|
| `stud` / `student` | `student` |
| `staff` / `faculty` | `staff` |
| `parent` | `parent` |
| `admin` | `admin` |
| *(unrecognized)* | `guest` |

---

## 4. Navigation Architecture

### 4.1 Top-Level Routing

```
index.tsx
  │
  ├── showLoginModal = true  ──→  <CardLoginModal />
  │
  ├── userRole = "guest"     ──→  <SkipScreen />
  │
  └── userRole = <role>      ──→  <Header> + <Navigator>
```

### 4.2 Per-Role Tab Navigation

```
Student                              Staff
┌──────┬──────┬──────┬──────┬──────┐ ┌──────┬──────┬──────┬──────┐
│ Dash │ Acad │ Fees │ Doc  │ Prof │ │ Dash │ Att  │ Stu  │ Prof │
│ board│ emics│      │ Space│ ile  │ │ board│ end. │ dents│ ile  │
└──────┴──────┴──────┴──────┴──────┘ └──────┴──────┴──────┴──────┘

Parent                              Admin
┌──────┬──────┬──────┬──────┬──────┐ ┌──────┬──────┬──────┬──────┐
│ Dash │ Fees │ Msgs │ Ward │ Prof │ │ Dash │ User │ Rpt  │ Set  │
│ board│      │      │ Dets │ ile  │ │ board│ Mgmt │ s    │ tings│
└──────┴──────┴──────┴──────┴──────┘ └──────┴──────┴──────┴──────┘
```

Each tab uses `@react-navigation/bottom-tabs` v7 with `independent={true}` `NavigationContainer`.

---

## 5. Data Flow

### 5.1 API Client (`app/services/api.js`)

```
Screen Component
      │
      ▼
  dataService.js  (Business Logic)
      │
      ├── Check in-memory cache
      │     ├── Cache HIT  → return cached data
      │     └── Cache MISS → continue
      │
      ├── Dedup in-flight requests
      │     ├── Same request pending → return shared promise
      │     └── New request → continue
      │
      ▼
  api.js  (HTTP Client)
      │
      ├── GET/POST/PUT/DELETE
      ├── Headers: Authorization, Content-Type
      │
      ▼
  Backend API (Render + MongoDB)
      │
      ├── 200 → cache response → return data
      ├── 401 → onUnauthorized() → clear session → show login
      └── Error → return null / fallback
```

### 5.2 Data Service (`app/services/dataService.js`)

The data service provides ~70 role-scoped getter and action functions:

**Student Functions:**
- `getStudentData()` — profile, grades, fees, attendance
- `getStudentAttendanceSummary()` — attendance records
- `getAssignments()` — homework/assignments
- `getGradeLevels()` — grade scale
- `getInstitutions()` — institution info
- `getParentNotices()` — announcements

**Staff Functions:**
- `getStaffData()` — faculty profile, schedule
- `getAttendanceRecords()` — class attendance
- `submitAttendance()` — mark attendance
- `getStudentRoster()` — class list

**Parent Functions:**
- `getParentData()` — linked wards
- `getWardDetails()` — ward academic info

**Admin Functions:**
- `getAllUsers()` — user management
- `createUser()` — add new user
- `getSystemReports()` — analytics

### 5.3 Delta Sync

```
App Login
    │
    ▼
syncAfterLogin()
    │
    ├── Fetch all role-scoped data from API
    │
    ├── Compare with local encrypted DB
    │
    ├── Update changed records only
    │
    └── Emit change events → UI updates
```

### 5.4 Offline Mutation Engine (`app/services/offlineSyncService.js`)

EduNex is fully usable offline. Writes are queued locally and replayed the moment connectivity returns.

```
User Action (submit attendance, send message, pay, apply leave…)
    │
    ├── ONLINE? ──────────────────────────────┐
    │  YES                                     │ NO
    │  │                                      │
    │  ├── Execute directly                   │
    │  │                                      │
    │  └── Also enqueue for state consistency │
    │         ┌───────────────────────────────┘
    │         ▼
    └── enqueueMutation()
         │
         ├── Persist to encrypted queue
         │    key: edunex_offline_mutation_queue_v1
         │    { id, endpoint, method, body, ts }
         │
         ├── Optimistic local UI update
         │    (app remains 100% usable offline)
         │    Notify sync-status listeners
         │    { isOnline, isSyncing, pendingCount }
         │
         └── Connectivity heartbeat probe
              │
              └── Connection restored?
                   │
                   ▼
              processOfflineQueue()
                   │  (FIFO, oldest first)
                   └── POST/PUT/PATCH/DELETE replay
                        ├── success → dequeue
                        └── failure → retry later, keep
```

### 5.5 App Update Check (`app/services/updateService.js`)

```
App Launch
    │
    ▼
checkAppUpdate()
    │
    ├── api.get("/appUpdates", { limit: 5, sort: "-versionCode" })
    │
    ├── Compare latest.version vs CURRENT_APP_VERSION (semver)
    │
    ├── Newer version available?
    │     ├── NO  → silent
    │     └── YES →
    │           ├── Dismissed previously (persisted per version)?
    │           │     ├── YES → skip (unless forceUpdate)
    │           │     └── NO  → show AppUpdateModal
    │           │
    │           └── forceUpdate == true
    │                 ├── Blocking modal (no dismiss)
    │                 └── Linking to store / apk
    │
    └── User chooses
          ├── Update → Linking.openURL()
          └── Later  → secureSet("edunex_dismissed_update_version", v)
```

---

## 6. Encryption & Security

### 6.1 Secure Storage (`app/services/secureStorage.js`)

```
┌─────────────────────────────────────────┐
│           Secure Storage                 │
│                                          │
│  User Data (plaintext)                   │
│       │                                  │
│       ▼                                  │
│  PBKDF2 Key Derivation                   │
│  (password + salt + 10000 iterations)    │
│       │                                  │
│       ▼                                  │
│  AES-256-CBC Encryption                  │
│       │                                  │
│       ▼                                  │
│  AsyncStorage                            │
│  Key prefix: _EDUNEX_ENC_V1_::           │
│                                          │
└─────────────────────────────────────────┘
```

**Stored Keys:**
- `userRole` — mapped role string
- `userData` — full user object
- `appTheme` — light/dark preference
- `edunex_db_<username>` — encrypted local DB

### 6.2 Auth Session

```
setAuthSession(accessToken, refreshToken)
    │
    ├── Store tokens in secure memory
    ├── Attach to all API requests via headers
    │
    └── On 401 response:
         ├── Clear tokens
         ├── Clear user data
         ├── Reset role to "guest"
         └── Show login modal
```

---

## 7. Realtime Features

### 7.1 Notification Polling

```
startRealtimeWatcher(1500)  // 1.5 second interval
    │
    ├── Poll GET /notifications?since=<lastSeen>
    │
    ├── Compare with last known state (delta detection)
    │
    ├── New notifications found?
    │     ├── YES → Trigger expo-notifications local notification
    │     │         Update badge count in header
    │     │         Emit event for active screens
    │     └── NO  → Continue polling
    │
    └── Active chat suppression:
          If user is in ChatModal → suppress notification sound
```

### 7.2 Chat Service (`app/services/chatService.js`)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   User A     │───▶│  Chat Service │◀───│   User B     │
│              │    │              │    │              │
│  sendMessage │    │  DM / Channel│    │  recvMessage │
│  editMessage │    │  15min limit │    │  readReceipt │
│  typing      │    │  roster sync │    │  typing      │
│  call signal │    │  call setup  │    │  call signal │
└──────────────┘    └──────────────┘    └──────────────┘
```

- **DM:** Direct messages between two users
- **Channel:** Class group messaging
- **Edit window:** 15 minutes after send
- **Calls:** Native WebSocket signaling via `socketVideoService.js` (legacy Jitsi WebView fallback via `GlobalCallOverlay`)

### 7.3 Native WebSocket Call Signaling (`app/services/socketVideoService.js`)

Zero-login, zero-WebView native video/audio calls over a WebSocket directly to the EduNex backend at `ws://…/ws/calls`.

```
User taps Call in ChatModal
    │
    ▼
initSocketVideoRoom({ roomId, user, onRemoteMediaChange, onPeerHangup })
    │
    ├── WebSocket.connect(ws://.../ws/calls?roomId=<roomId>)
    │
    ├── onopen → send
    │       { type: "join_call_room",
    │         roomId, user: { id, name, role } }
    │
    └── onmessage → route events
          ├── "remote_media_change" → onRemoteMediaChange (audio/video toggles)
          └── "call_hangup"         → onPeerHangup
    │
    ├── WebSocket failure → native in-app event bus fallback
    │     (chatService.sendCallSignal)
    ├── WebSocket unavailable → Jitsi Meet WebView (GlobalCallOverlay)
    └── Hangup cleanup → leaveSocketVideoRoom()
```

### 7.4 Navigation Event Bus (`app/services/navigationEvents.js`)

Precision cross-tab routing so notification taps land on the exact modal/screen without opening unrelated modals.

```
emitRouteChange("Dashboard") / emitTabNavigation("Academics")
    │
    ├── routeListeners.forEach(cb)
    │     └── Screen-level handlers re-route to target modal
    │
    └── tabListeners.forEach(cb)
          └── Programmatic tab switch via useNavigation().navigate()
```

---

## 8. User Journeys

### 8.1 Student Journey

```
Launch → Login (Student role)
    │
    ├── Dashboard
    │    ├── View QR Code ID card
    │    ├── Tap "Fees" card → FeesModal (due amount, pay)
    │    ├── Tap "Exam" card → ExamModal (schedule, results)
    │    ├── Tap "Attendance" card → AttendanceModal (calendar)
    │    ├── Tap "Library" card → LibraryModal (books due)
    │    ├── Tap "Timetable" card → FullTimeTable (weekly grid)
    │    ├── View notices (top 3)
    │    ├── View assignments (top 5, status badges)
    │    └── Pull-to-refresh → reload all data
    │
    ├── Academics
    │    ├── View course list
    │    ├── View grades per subject
    │    └── CGPA summary
    │
    ├── Fees
    │    ├── Fee breakdown by semester
    │    ├── Due amount highlight
    │    ├── Payment history
    │    └── Payment modal (Razorpay-style)
    │
    ├── DocSpace
    │    ├── Browse document categories
    │    ├── Download documents
    │    └── Upload documents
    │
    └── Profile
         ├── View / Edit profile
         ├── Download ID card PDF
         ├── Notification toggle
         ├── Theme toggle (light/dark)
         ├── Report bug / feedback
         └── Logout
```

### 8.2 Staff Journey

```
Launch → Login (Staff role)
    │
    ├── Dashboard
    │    ├── Faculty info card
    │    ├── Today's schedule timeline
    │    ├── Recent notices
    │    └── Pending leave approvals
    │
    ├── Attendance
    │    ├── Select class / batch
    │    ├── Period-wise marking
    │    ├── Mark present / absent per student
    │    └── Submit attendance
    │
    ├── Students
    │    ├── Student roster
    │    ├── Search / filter
    │    └── Individual student details
    │
    └── Profile
         ├── Faculty details
         ├── Schedule view
         └── Settings
```

### 8.3 Parent Journey

```
Launch → Login (Parent role)
    │
    ├── Dashboard
    │    ├── Ward summary card
    │    └── Notices
    │
    ├── Fees
    │    ├── Ward fee status
    │    └── Payment history
    │
    ├── Messages
    │    ├── Chat with faculty
    │    └── Class group messages
    │
    ├── WardDetails
    │    ├── Academic progress
    │    ├── Attendance overview
    │    └── Reports
    │
    └── Profile
         ├── Parent info
         └── Settings
```

### 8.4 Admin Journey

```
Launch → Login (Admin role)
    │
    ├── Dashboard
    │    ├── System overview stats
    │    └── Quick actions
    │
    ├── ManageUsers
    │    ├── User list (all roles)
    │    ├── Search / filter
    │    ├── Add User modal
    │    │    ├── Name, email, role
    │    │    ├── Department selection
    │    │    └── Auto-generate credentials
    │    └── Edit / deactivate users
    │
    ├── Reports
    │    ├── Attendance reports
    │    ├── Fee collection reports
    │    ├── Academic performance
    │    └── Export to PDF
    │
    └── SystemSettings
         ├── App configuration
         ├── System logs
         └── Maintenance tools
```

---

## 9. Modal Workflow

```
Screen Component
    │
    ├── User taps card / action button
    │
    ▼
setVisibleModal("type")
    │
    ▼
Animated fade-in (0 → 1, 300ms)
    │
    ├── Render <Modal type="type" />
    │
    │   ┌────────────────────────────┐
    │   │  Modal Content             │
    │   │                            │
    │   │  ┌──────┐  ┌────────────┐ │
    │   │  │ Close│  │  Title     │ │
    │   │  │ (X)  │  │            │ │
    │   │  └──────┘  └────────────┘ │
    │   │                            │
    │   │  ┌────────────────────┐   │
    │   │  │  Data Content      │   │
    │   │  │  (ScrollView)      │   │
    │   │  └────────────────────┘   │
    │   │                            │
    │   │  ┌────────────────────┐   │
    │   │  │  Action Buttons    │   │
    │   │  └────────────────────┘   │
    │   └────────────────────────────┘
    │
    └── User closes modal
         │
         ▼
    Animated fade-out → setVisibleModal(null)
```

---

## 10. PDF Generation

```
User action (Share ID Card / Timetable)
    │
    ▼
pdfGenerator.js / timetablePdfGenerator.js
    │
    ├── Build HTML template with user data
    │
    ├── expo-print (printAsync)
    │   └── Generate PDF from HTML
    │
    └── expo-sharing (shareAsync)
        └── Share PDF via system share sheet
```

---

## 11. Build & Deployment

### 11.1 Development

```bash
npx expo start          # Dev server with hot reload
```

### 11.2 EAS Build (Cloud)

```bash
eas build --profile development   # Dev client
eas build --profile preview       # Preview APK
eas build --profile production    # Production build
```

### 11.3 Local APK Build (WSL)

```bash
./scripts/setup-wsl-android.sh    # One-time WSL setup
./scripts/build-apk.sh            # Build debug APK locally
```

### 11.4 OTA Updates

```bash
eas update --branch production    # Push OTA update
```

Configured via `app.json`:
- Runtime version policy: `appVersion`
- Update URL: `https://u.expo.dev/<projectId>`

---

## 12. File Structure Reference

```
app/
├── _layout.tsx                     # Expo Router entry + SafeArea + GlobalCallOverlay + realtime watcher
├── index.tsx                       # Root: role gate, per-role headers/navigators, login modal
├── config/
│   ├── color.json                  # Design tokens (light/dark)
│   ├── firebaseConfig.js           # Firebase (backward compat)
│   └── success.json                # Lottie success animation
├── context/
│   ├── ThemeContext.js             # Light/dark theme provider
│   └── ImmersiveBarsContext.js     # Auto-hide status/nav bars
├── services/
│   ├── api.js                      # Native fetch REST client + cache + dedup + auth
│   ├── dataService.js              # Business logic + 70+ role-scoped getters/actions
│   ├── chatService.js              # Chat / messaging / call signals
│   ├── offlineSyncService.js       # Offline mutation queue + cloud replay
│   ├── socketVideoService.js       # Native WebSocket call signaling
│   ├── realtimeNotificationService.js  # 1.5s delta-poll push watcher
│   ├── updateService.js            # In-app app-update checker (semver)
│   ├── identityService.js          # Logged-in identity resolution
│   ├── navigationEvents.js         # Cross-tab navigation event bus
│   └── secureStorage.js            # AES-CBC/PBKDF2 encrypted storage
├── utils/
│   ├── toastService.js             # Global toast ref
│   ├── AnimatedToast.js            # Toast UI + provider
│   ├── pdfGenerator.js             # ID card / doc PDF
│   ├── timetablePdfGenerator.js    # Timetable PDF
│   ├── securityService.js          # Crypto utilities
│   ├── safeNotifications.js        # Safe local notification helpers
│   ├── nicknameGenerator.js        # Auto nickname
│   ├── deptFormatter.js            # Department name format
│   ├── notificationUtils.js        # Notification helpers
│   └── SuccessAnimation.js         # Lottie wrapper
├── hooks/
│   └── useRefreshOnForeground.js   # Refresh on app focus
├── data/
│   └── edunexDatabase.json         # Per-user local sync template
├── components/
│   ├── LoginPage.js                # Multi-role login/signup card modal
│   ├── FeedbackBugModal.js         # Bug report form
│   ├── common/
│   │   ├── SkeletonLoader.js       # Shimmer placeholders
│   │   ├── GlobalCallOverlay.js    # Native WebSocket + legacy Jitsi calls
│   │   ├── AppUpdateModal.js       # In-app update / force-update prompt
│   │   └── AddressAutocompleteInput.js  # Address autocomplete dropdown
│   ├── nav/
│   │   ├── AppNavigator.js         # Student tabs
│   │   ├── AppNavigatorStaff.js    # Staff tabs
│   │   ├── AppNavigatorParent.js   # Parent tabs
│   │   └── AppNavigatorAdmin.js    # Admin tabs
│   ├── header/
│   │   ├── Header.js               # Student header
│   │   ├── HeaderStaff.js          # Staff header
│   │   ├── HeaderParent.js         # Parent header
│   │   ├── HeaderAdmin.js          # Admin header
│   │   ├── settings/
│   │   │   └── FullSettingsModal.js
│   │   ├── modal/                  # Header-triggered modals
│   │   │   ├── NotificationModal.js
│   │   │   ├── LeaveFormModal.js
│   │   │   ├── HostelFormModal.js
│   │   │   ├── CommunityModal.js
│   │   │   ├── ClassTestModal.js
│   │   │   ├── ClassGroupMsgModal.js
│   │   │   ├── ChatModal.js
│   │   │   ├── BusTrackerModal.js
│   │   │   ├── MessMenuModal.js
│   │   │   ├── AssignmentModal.js
│   │   │   └── StaffLeaveApprovalsModal.js
│   │   ├── pmodal/
│   │   │   ├── FeedbackModal.js
│   │   │   ├── EntryExitModal.js
│   │   │   └── AssignmentModal.js
│   │   └── amodal/
│   │       ├── AddUserModal.js
│   │       ├── SeatingPlannerModal.js
│   │       └── YearPromotionModal.js
│   └── screens/
│       ├── SkipScreen.js           # Guest preview
│       ├── students/
│       │   ├── DashboardScreen.js
│       │   ├── AcademicsScreen.js
│       │   ├── FeesScreen.js
│       │   ├── DocSpaceScreen.js
│       │   ├── ProfileScreen.js
│       │   ├── AdmissionFormScreen.js
│       │   ├── ResetPasswordModal.js
│       │   └── modals/
│       │       ├── FeesModal.js
│       │       ├── ExamModal.js
│       │       ├── AttendanceModal.js
│       │       ├── LibraryModal.js
│       │       ├── FullTimeTable.js
│       │       ├── AcademicCalendarModal.js
│       │       ├── PaymentModal.js
│       │       ├── EditProfileModal.js
│       │       ├── NicknameModal.js
│       │       └── AssessmentsReportsModal.js
│       ├── staff/
│       │   ├── DashboardStaff.js
│       │   ├── AttendanceStaff.js
│       │   ├── StudentsStaff.js
│       │   ├── FeesStaff.js
│       │   ├── ProfileStaff.js
│       │   └── modals/
│       │       ├── ScheduleModal.js
│       │       ├── MessagesModal.js
│       │       ├── AttendanceModal.js
│       │       └── AssignmentReportModal.js
│       ├── parents/
│       │   ├── DashboardParent.js
│       │   ├── FeesParent.js
│       │   ├── MessagesParent.js
│       │   ├── WardDetailsParent.js
│       │   ├── ProfileParent.js
│       │   └── modals/
│       │       ├── WardModal.js
│       │       ├── ReportModal.js
│       │       ├── MessagesModal.js
│       │       └── FeesModal.js
│       └── admin/
│           ├── DashboardAdmin.js
│           ├── ManageUsersAdmin.js
│           ├── ReportsAdmin.js
│           └── SystemSettingsAdmin.js
```

---

*Workflow documentation derived from source code analysis of the EduNex codebase.*
