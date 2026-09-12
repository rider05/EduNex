# 🎓 EduNex — Smart Autonomous Campus Operating System

<div align="center">

[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-57.0.21-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![REST Backend](https://img.shields.io/badge/Backend-REST%20API-FF6C37?style=for-the-badge&logo=render&logoColor=white)](https://edunex-backend-rmvx.onrender.com)
[![Lint Status](https://img.shields.io/badge/ESLint-0%20Errors%20%7C%200%20Warnings-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)](https://eslint.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Type%20Safe-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**A Next-Generation, Multi-Role Autonomous Campus Management & Academic Operating System built with React Native, Expo, and MongoDB REST API.**

[Key Features](#-core-portals--feature-matrix) • [Architecture](#-system-architecture) • [Project Structure](#-project-directory-structure) • [Getting Started](#-getting-started) • [Tech Stack](#-technology-stack)

</div>

---

## 🌟 Overview

**EduNex** is an enterprise-grade academic mobile platform engineered for higher education universities and autonomous engineering institutes. It unifies institutional governance, faculty workflows, student academic tracking, and parent counseling into a unified, secure, real-time mobile application.

---

## 🚀 Core Portals & Feature Matrix

### 1. 🎓 Student Portal
* **Dashboard Command Center**: Live enrolled cohort identity, quick academic KPI cards (Attendance, CGPA, Credits, Cleared Dues), today's lecture schedule timeline, and campus notices ticker.
* **Locked Cohort Timetable**: Strict cohort-locked 5-day academic timetable (*e.g., B.Tech AI & DS, Year 3, Section A*) with subject period breakdown, faculty attribution, classroom venue tags, and 1-on-1 cabin consultation booking.
* **Academics & Grade Dossier**: Semester-by-semester SGPA & CGPA progression curves, Continuous Internal Assessment (CIA) marks, credits cleared, and verified course syllabus tracker.
* **Fees Management & UPI Gateway**: Outstanding dues ledger, categorized invoice receipts, scholarships/grants breakdown, and direct multi-method payment modal (UPI, Cards, Net Banking).
* **Document Vault & KYC Space**: Verified digital space for submitting and inspecting 10th/12th marksheets, transfer certificates, community affidavits, and government ID credentials.
* **College Leave & Academic On-Duty (OD) Hub**: Digital leave and symposium OD application with multi-level approval pipeline (Advisor ➔ HOD ➔ Dean) and live QR gate clearance pass.
* **Hostel Gate Pass & Outing Permitting**: Weekend home visit and local day outing permits with curfew countdown timer, parent consent attribution, and biometric security turnstile QR verification.
* **Counselor 1-on-1 Encrypted Chat**: End-to-end encrypted direct messaging channel between students and designated department faculty advisors.

---

### 2. 👨‍🏫 Faculty & Staff Portal
* **Faculty Command Center**: Professor profile hero with live in-session class indicators, 4-metric KPI power strip, quick-action operations grid, and teaching timeline.
* **Digital Attendance Studio & Freeze Ledger**: 3-state attendance roll call (`[P] Present`, `[A] Absent`, `[OD] On-Duty`), section & lab switcher, bulk marking, and a strict **Pre-Lock Confirmation & Freeze Ledger Workflow** with HOD administrative override protections.
* **Student Directory & Academic Dossier**: Complete student roster filtered by section, batch, mentee wards, and critical attendance (<75%), featuring 1-tap call student/guardian shortcuts and full academic dossier bottom sheets.
* **CIA & Lab Assessment Grading**: Grade Continuous Internal Assessment submissions, practical lab experiments, and moderate student marks.
* **Faculty Messages & Parent Inquiry Hub**: Centralized hub for resolving parent counseling inquiries and managing class broadcast circulars.
* **Academic Teaching Schedule**: Weekly schedule covering theory lectures, practical computing labs, and designated student cabin consultation office hours.

---

### 3. 👨‍👩‍👧 Parent & Guardian Portal
* **Ward Performance Hub**: Real-time campus presence status, attendance rate gauge, CGPA standings, cleared credits, and designated class advisor direct-dial shortcuts.
* **Parent Fee Settlement & Invoices**: Fee summary with settlement progress bar, pending invoice breakdown, paid receipts archive, and university bank transfer details.
* **Parent Messages & Circulars Suite**: Dual-mode communication hub switching between official institution circulars and direct counselor chat.
* **Campus Gate & Biometric Turnstile Log**: Real-time biometric entry/exit logs tracking turnstile gate scans with date/time stamps.
* **Exam Portions & Assessment Calendar**: CIA mid-term exam schedule, syllabus portions, room allocations, and assessment weightage.
* **Institutional Feedback & Inquiries**: Multi-department query submission with category selection, star satisfaction ratings, and historical resolution tracking.

---

### 4. 🛡️ Administrator & Governance Console
* **Master Governance Console**: System status monitor, active user count metrics, cluster latency indicators, and server health diagnostics.
* **Multi-Role User Onboarding Suite**: Create and enroll `Student`, `Faculty`, `Parent`, and `Admin` records individually or via bulk Excel/CSV file upload with automatic roll number and employee ID sequence generation.
* **Seating & Venue Planner**: Interactive classroom seating allocation planner with batch/section assignment and auto-generation of seating charts.
* **Academic Year Promotion Tool**: One-click batch promotion of students to the next academic year/semester with roll number regeneration.
* **Master System Settings**: Academic year controls, semester cutoff dates, grade lock permissions, minimum attendance thresholds (75%), and 2-Factor Authentication toggles.
* **Cloud Backup & Diagnostics**: 1-Tap database snapshot creation, cache clearance, MongoDB cluster ping tests, and emergency campus announcement broadcast.

---

### 5. ⚡ Platform Infrastructure
* **Offline-First Mutation Engine**: Persistent encrypted queue for offline POST/PUT/PATCH/DELETE mutations with automatic cloud replay the moment connectivity is restored (`offlineSyncService.js`).
* **Native WebSocket Call Signaling**: Zero-login, zero-WebView native video/audio call rooms over the EduNex backend WebSocket (`socketVideoService.js`) — no Jitsi dependency for in-app calls.
* **In-App Update Channel**: Version-check service that polls the backend `/appUpdates` endpoint, compares semver, and presents update/force-update prompts with dismiss persistence (`updateService.js` + `AppUpdateModal`).
* **Navigation Event Bus**: Cross-tab programmatic route switching and route-change broadcasting for precision notification routing (`navigationEvents.js`).
* **Real-Time Push & Presence**: Fast 1.5s delta-polling watcher firing system push notifications, live badge counts, and active-chat suppression.

---

## 🏛️ System Architecture

```mermaid
graph TD
    A[EduNex Mobile Client\nReact Native / Expo] --> B[Theme Context\nLight & Dark Mode]
    A --> C[AsyncStorage\nEncrypted Offline Cache & Session]
    A --> D[API Service Layer\nNative Fetch REST Client]
    
    D --> E[EduNex Cloud Backend\nNode.js / Express on Render]
    E --> F[(MongoDB Atlas\nPrimary Database)]
    E --> G[Cloudinary\nDocument & Media Vault]
    
    A --> H[Offline Mutation Queue\nCloud Replay Engine]
    A --> I[Native WebSocket\nCall Signaling & Realtime]
    I --> E
    
    A --> J[Multi-Role App Navigators]
    J --> K[Student Navigator]
    J --> L[Faculty Navigator]
    J --> M[Parent Navigator]
    J --> N[Admin Navigator]
```

---

## 📁 Project Directory Structure

```
d:/edunex/
├── app/
│   ├── _layout.tsx                     # Root application layout & route setup
│   ├── index.tsx                       # Root entry: role gate, auth dispatcher, headers
│   ├── config/
│   │   ├── color.json                  # Design tokens (light & dark palettes)
│   │   ├── firebaseConfig.js           # Firebase config (backward compat)
│   │   └── success.json                # Lottie success animation asset
│   ├── components/
│   │   ├── LoginPage.js                # Multi-role Login / Sign Up card modal
│   │   ├── FeedbackBugModal.js         # Bug & feedback reporting
│   │   ├── common/                     # Reusable loaders, skeletons, overlays
│   │   │   ├── SkeletonLoader.js       # Shimmer placeholders + screen loader
│   │   │   ├── GlobalCallOverlay.js    # In-app call UI overlay
│   │   │   ├── AppUpdateModal.js       # In-app update / force-update prompt
│   │   │   └── AddressAutocompleteInput.js
│   │   ├── header/                     # Top portal headers & modals
│   │   │   ├── Header.js               # Student Portal Header
│   │   │   ├── HeaderStaff.js          # Faculty Portal Header
│   │   │   ├── HeaderParent.js         # Parent Portal Header
│   │   │   ├── HeaderAdmin.js          # Admin Console Header
│   │   │   ├── modal/                  # Notification, Chat, Leave, Bus, Mess modals…
│   │   │   ├── amodal/                 # Admin modals (AddUser, SeatingPlanner, YearPromotion)
│   │   │   ├── pmodal/                 # Parent feedback & gate log modals
│   │   │   └── settings/               # Master System Settings modal
│   │   └── nav/                        # Role-based Tab Navigators
│   │       ├── AppNavigator.js         # Student navigator
│   │       ├── AppNavigatorStaff.js
│   │       ├── AppNavigatorParent.js
│   │       └── AppNavigatorAdmin.js
│   ├── context/
│   │   ├── ThemeContext.js             # Universal Light & Dark theme provider
│   │   └── ImmersiveBarsContext.js     # Auto-hide status/navigation bars
│   ├── hooks/
│   │   └── useRefreshOnForeground.js   # Data refresh on app foreground
│   ├── screens/
│   │   ├── SkipScreen.js               # Guest preview mode
│   │   ├── students/                   # Student screens & feature modals
│   │   │   ├── DashboardScreen.js      # QR ID, notices, KPI cards, schedule
│   │   │   ├── AcademicsScreen.js
│   │   │   ├── FeesScreen.js
│   │   │   ├── DocSpaceScreen.js
│   │   │   ├── ProfileScreen.js
│   │   │   ├── AdmissionFormScreen.js
│   │   │   └── modals/                 # Fees, Exam, Attendance, TimeTable, Library…
│   │   ├── staff/                      # Faculty portal screens & modals
│   │   │   ├── DashboardStaff.js
│   │   │   ├── AttendanceStaff.js
│   │   │   ├── StudentsStaff.js
│   │   │   ├── FeesStaff.js
│   │   │   ├── ProfileStaff.js
│   │   │   └── modals/                 # Attendance, Schedule, Messages, Reports
│   │   ├── parents/                    # Parent portal screens
│   │   │   ├── DashboardParent.js
│   │   │   ├── WardDetailsParent.js
│   │   │   ├── FeesParent.js
│   │   │   ├── MessagesParent.js
│   │   │   └── ProfileParent.js
│   │   └── admin/                      # Administrator screens
│   │       ├── DashboardAdmin.js
│   │       ├── ManageUsersAdmin.js
│   │       ├── ReportsAdmin.js
│   │       └── SystemSettingsAdmin.js
│   ├── services/
│   │   ├── api.js                      # Native fetch REST client, cache, auth tokens
│   │   ├── dataService.js              # Business logic & role-scoped data adapters
│   │   ├── chatService.js              # Chat, messaging & call signals
│   │   ├── offlineSyncService.js       # Offline mutation queue & cloud replay
│   │   ├── socketVideoService.js       # Native WebSocket call signaling
│   │   ├── realtimeNotificationService.js  # 1.5s delta-poll push watcher
│   │   ├── updateService.js            # In-app version update checker
│   │   ├── identityService.js          # Logged-in identity resolution
│   │   ├── navigationEvents.js         # Cross-tab navigation event bus
│   │   └── secureStorage.js            # AES-CBC/PBKDF2 encrypted storage
│   ├── utils/
│   │   ├── AnimatedToast.js            # Global animated toast UI + provider
│   │   ├── toastService.js             # Global toast dispatcher
│   │   ├── pdfGenerator.js             # ID card / document PDF export
│   │   ├── timetablePdfGenerator.js    # Timetable PDF export
│   │   ├── securityService.js          # Crypto utilities
│   │   ├── safeNotifications.js        # Safe local notification helpers
│   │   ├── notificationUtils.js        # Notification formatting helpers
│   │   ├── nicknameGenerator.js        # Auto nickname generation
│   │   ├── deptFormatter.js            # Department name formatting
│   │   └── SuccessAnimation.js         # Lottie animated status feedback
│   └── data/
│       └── edunexDatabase.json         # Per-user local sync template (DB-mirrored)
├── app.json
├── package.json
├── tsconfig.json
├── eslint.config.js
└── README.md
```

---

## 🛠️ Technology Stack

| Layer | Technology / Library |
| :--- | :--- |
| **Framework** | [React Native 0.86.3](https://reactnative.dev/) / [Expo SDK 57](https://expo.dev/) |
| **Routing & Navigation** | [Expo Router](https://docs.expo.dev/router/introduction/) + [React Navigation Bottom Tabs v7](https://reactnavigation.org/) |
| **Styling & UI** | React Native StyleSheet, [Expo Linear Gradient](https://docs.expo.dev/versions/latest/sdk/linear-gradient/), [lottie-react-native](https://github.com/lottie-react-native/lottie-react-native) |
| **Iconography** | [React Native Vector Icons (MaterialCommunityIcons)](https://oblador.github.io/react-native-vector-icons/) |
| **State & Storage** | React Context API, [`@react-native-async-storage/async-storage`](https://react-native-async-storage.github.io/async-storage/) with AES-CBC/PBKDF2 encryption |
| **QR Code Engine** | [`react-native-qrcode-svg`](https://github.com/awesomejerry/react-native-qrcode-svg) |
| **Charts & Dashboards** | [`react-native-chart-kit`](https://github.com/indiespirit/react-native-chart-kit) |
| **Forms & Pickers** | [`react-native-element-dropdown`](https://github.com/hoaphantn7604/react-native-element-dropdown), [`@react-native-picker/picker`](https://github.com/react-native-picker/picker), [`@react-native-community/datetimepicker`](https://github.com/react-native-community/datetimepicker) |
| **File & Media** | [`expo-document-picker`](https://docs.expo.dev/versions/latest/sdk/document-picker/), [`expo-image-picker`](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [`xlsx`](https://sheetjs.com/) |
| **PDF & Sharing** | [`expo-print`](https://docs.expo.dev/versions/latest/sdk/print/), [`expo-sharing`](https://docs.expo.dev/versions/latest/sdk/sharing/) |
| **Realtime & Calls** | `expo-notifications`, Native [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) signaling, [`react-native-webview`](https://github.com/react-native-webview/react-native-webview) for legacy Jitsi |
| **Camera & Haptics** | [`expo-camera`](https://docs.expo.dev/versions/latest/sdk/camera/), [`expo-haptics`](https://docs.expo.dev/versions/latest/sdk/haptics/) |
| **Backend REST API** | Node.js / Express deployed on [Render](https://render.com) |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/atlas) (Cloud Cluster) |
| **Code Quality** | ESLint (`expo lint`), TypeScript (`tsc --noEmit`) |

---

## ⚡ Getting Started

### Prerequisites
* **Node.js**: `v18.x` or `v20.x` installed
* **Package Manager**: `npm` or `yarn`
* **Expo CLI**: Installed globally or executed via `npx`
* **Expo Go App**: (Optional) Installed on iOS / Android physical devices for live testing

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/rider05/EduNex.git
cd EduNex
npm install
```

### 2. Backend Configuration
The application connects to the cloud backend at `https://edunex-backend-rmvx.onrender.com/api/v1` (configured in `app/services/api.js`):

```env
EXPO_PUBLIC_API_URL=https://edunex-backend-rmvx.onrender.com/api/v1
```

### 3. Launch Development Server
Start the Expo Metro bundler:
```bash
npx expo start
```
* Press `a` to launch in an **Android Emulator**.
* Press `i` to launch in an **iOS Simulator**.
* Scan the QR code using the **Expo Go** application on your physical device.

---

## 🧪 Code Quality & Verification

The codebase adheres to clean architecture principles with strict linting and type-checking standards:

```bash
# Run ESLint validation
npm run lint

# Run TypeScript type safety verification
npx tsc --noEmit
```

> **Validation Status**: `0 Errors` · `0 Warnings` maintained across all portal screens and component suites.

---

## 🔒 Security & Compliance

* **FERPA & Institutional Privacy**: Zero-knowledge encryption standard for counselor messages and student academic records.
* **Biometric QR Gate Passes**: Time-bounded cryptographic QR signatures prevent forged campus gate departures.
* **Attendance Ledger Locking**: Cryptographic freeze preventing tampering with official attendance records once finalized.
* **Role-Based Access Control (RBAC)**: Strict permission boundaries ensuring users access only their authorized portal space.

---

## 👥 Authors & Acknowledgments

* **Engineering Team**: EduNex Core Mobile & Platform Development Team
* **Backend Cloud Infrastructure**: Hosted on Render with MongoDB Atlas Distributed Clusters

<div align="center">
  <sub>Built with ❤️ for Higher Education Excellence · © 2026 EduNex Inc. All rights reserved.</sub>
</div>
