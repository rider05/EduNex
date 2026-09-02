# EduNex UI Design System

> **Smart Autonomous Campus Operating System**
> *Empowering Campus, Simplifying Success*

---

## 1. Brand Identity

| Property | Value |
|----------|-------|
| **App Name** | EduNex |
| **Subtitle** | Student Management System |
| **Bundle ID** | `com.bkmsb.EduNex` |
| **Scheme** | `edunex://` |
| **Platform** | React Native (Expo SDK 54) |
| **Orientation** | Portrait-locked |

---

## 2. Color System

EduNex uses a token-based theming system defined in `app/config/color.json`, with full **Light** and **Dark** mode support powered by `ThemeContext`.

### 2.1 Light Mode

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#4F46E5` | Primary buttons, active tabs, links |
| `primaryDark` | `#3730A3` | Pressed states |
| `primaryLight` | `#EEF2FF` | Light backgrounds, badges |
| `primaryGradient` | `#4338CA → #6366F1` | Gradient headers, CTA buttons |
| `headerBg` | `#4338CA` | Top header bar |
| `headerText` | `#FFFFFF` | Header title / icons |
| `secondary` | `#0D9488` | Secondary actions, accents |
| `primaryBackground` | `#F8FAFC` | Screen background |
| `surface` | `#FFFFFF` | Card surface |
| `cardBackground` | `#FFFFFF` | Card fill |
| `cardHighlight` | `#F1F5F9` | Hover / selected state |
| `primaryText` | `#0F172A` | Headings, body text |
| `secondaryText` | `#475569` | Subtitles, descriptions |
| `disabledText` | `#94A3B8` | Placeholder, inactive |
| `divider` | `#E2E8F0` | Lines, borders |
| `border` | `#E2E8F0` | Input borders, card outlines |
| `inputBackground` | `#F8FAFC` | Text input fill |
| `tabBarBg` | `#FFFFFF` | Bottom tab bar |
| `tabBarActive` | `#4F46E5` | Active tab icon + label |
| `tabBarInactive` | `#94A3B8` | Inactive tab icon + label |
| `shadow` | `rgba(15,23,42,0.08)` | Card / elevation shadow |

### 2.2 Dark Mode

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#6366F1` | Primary buttons, active tabs |
| `primaryLight` | `#1E1B4B` | Dark accent bg |
| `primaryDark` | `#818CF8` | Pressed states |
| `primaryGradient` | `#312E81 → #4F46E5` | Gradient headers |
| `headerBg` | `#1E1B4B` | Top header bar |
| `primaryBackground` | `#090D16` | Screen background |
| `surface` | `#111827` | Card surface |
| `cardBackground` | `#161F30` | Card fill |
| `cardHighlight` | `#1F2B42` | Hover / selected state |
| `primaryText` | `#F8FAFC` | Headings, body text |
| `secondaryText` | `#94A3B8` | Subtitles |
| `disabledText` | `#64748B` | Placeholder |
| `divider` | `#26354D` | Lines, borders |
| `shadow` | `rgba(0,0,0,0.5)` | Elevated shadow |

### 2.3 Semantic Status Colors

| Status | Text | Background | Icon Color |
|--------|------|------------|------------|
| **Success** | `#059669` / `#34D399` | `#D1FAE5` / `#064E3B` | `#10B981` |
| **Warning** | `#D97706` / `#FBBF24` | `#FEF3C7` / `#451A03` | `#F59E0B` |
| **Danger** | `#DC2626` / `#F87171` | `#FEE2E2` / `#450A0A` | `#EF4444` |
| **Info** | `#2563EB` / `#60A5FA` | `#DBEAFE` / `#1E3A8A` | `#3B82F6` |

> *Format: Light value / Dark value*

---

## 3. Typography

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Screen title | 20–22px | 800 (ExtraBold) | Header bar |
| Section heading | 17–18px | 700 (Bold) | Card sections |
| Card title | 15–16px | 700 (Bold) | Dashboard cards |
| Body text | 14px | 400–500 | Descriptions |
| Caption / Label | 11–12px | 600–700 | Tab labels, badges |
| Tab label | 11px | 700 | Bottom nav |

All typography uses the system font stack. No custom font families are loaded.

---

## 4. Spacing & Layout

| Token | Value | Usage |
|-------|-------|-------|
| Screen padding | 16px | Horizontal screen margins |
| Card padding | 14–16px | Inner card spacing |
| Card gap | 12–14px | Space between cards |
| Section gap | 18–20px | Space between sections |
| Border radius (card) | 12–16px | Card corners |
| Border radius (button) | 10–12px | Button corners |
| Border radius (input) | 10px | Input field corners |
| Header height | ~140px | Fixed top header |
| Tab bar height | 68px (Android) / 85px (iOS) | Bottom navigation |

---

## 5. Component Library

### 5.1 Header Bar

Each role has a dedicated header component:

| Role | Component | File |
|------|-----------|------|
| Student | `Header` | `app/components/header/Header.js` |
| Staff | `HeaderStaff` | `app/components/header/HeaderStaff.js` |
| Parent | `HeaderParent` | `app/components/header/HeaderParent.js` |
| Admin | `HeaderAdmin` | `app/components/header/HeaderAdmin.js` |

**Design:**
- Fixed-position, absolute top (`zIndex: 100`)
- Gradient background (`primaryGradient`)
- White text + MaterialCommunityIcons
- Hamburger / action icons for modals
- Notification bell with badge count

### 5.2 Bottom Tab Navigator

| Role | Tabs |
|------|------|
| **Student** | Dashboard, Academics, Fees, DocSpace, Profile |
| **Staff** | Dashboard, Attendance, Students, Profile |
| **Parent** | Dashboard, Fees, Messages, WardDetails, Profile |
| **Admin** | Dashboard, ManageUsers, Reports, SystemSettings |

**Design:**
- `@react-navigation/bottom-tabs` v7
- Dynamic icons: filled variant when active, outline when inactive
- Active tab: `primary` color, 24px icon
- Inactive tab: `disabledText`, 22px icon
- Elevated shadow on Android, native shadow on iOS

### 5.3 Dashboard Cards

Cards follow a consistent pattern across all roles:

```
┌─────────────────────────────┐
│  Icon   Title          Badge│
│  ───────────────────────────│
│  Metric / Summary     Arrow │
│  Subtitle / Progress Bar    │
└─────────────────────────────┘
```

- `cardBackground` fill, 12–16px border radius
- Elevated shadow (`elevation: 3` on Android)
- Press state → `cardHighlight`
- Arrow icon (`chevron-right`) for navigation cues
- Badge pills for status (e.g., "Due", "Pending")

### 5.4 Modal System

EduNex uses full-screen animated modals for deep interactions:

| Modal | Purpose | Trigger |
|-------|---------|---------|
| `FeesModal` | Fee details & payment | Dashboard card tap |
| `ExamModal` | Exam schedule & results | Dashboard card tap |
| `AttendanceModal` | Attendance calendar view | Dashboard card tap |
| `LibraryModal` | Library books & due dates | Dashboard card tap |
| `FullTimeTable` | Weekly timetable grid | Dashboard card tap |
| `LeaveFormModal` | Apply for leave | Header action |
| `NotificationModal` | Notification center | Header bell |
| `ChatModal` | In-app messaging | Header action |
| `BusTrackerModal` | Transport tracking | Header action |
| `MessMenuModal` | Cafeteria menu | Header action |
| `CommunityModal` | Community forum | Header action |
| `StaffLeaveApprovals` | Leave approval queue | Staff header |
| `AddUserModal` | Create new user | Admin screen |
| `EditProfileModal` | Edit profile info | Profile screen |
| `FeedbackBugModal` | Bug / feedback report | Profile screen |
| `FullSettingsModal` | App settings panel | Header settings |

**Animation:** Fade-in overlay + slide-up panel using `Animated.timing` with `Easing.out(Easing.ease)`.

### 5.5 Login Card

The login component (`app/components/LoginPage.js`) features:

- Full-screen modal with gradient background (`#312E81` deep indigo)
- Card-style form with rounded corners
- Toggle between **Login** and **Sign Up** modes
- Role selector chips: Student, Faculty, Parent, Admin
- Password visibility toggle icons
- Animated loading spinner on submit
- Success animation with scale bounce
- Toast notifications (success / warning / error)
- Animated keyboard avoidance

### 5.6 Skeleton Loaders

`app/components/common/SkeletonLoader.js` provides:

- Shimmer-animated placeholder blocks
- Screen-level loader (`SkeletonScreenLoader`) for full-page loading states
- Matches the layout of the content it replaces

### 5.7 Toast System

`app/utils/AnimatedToast.js` + `app/utils/toastService.js`:

- Slide-in from top with opacity animation
- Color-coded: green (success), amber (warning), red (error), blue (info)
- Auto-dismiss after 3 seconds
- Global ref accessible from any screen via `showToast(msg, type)`

### 5.8 Global Call Overlay

`app/components/common/GlobalCallOverlay.js`:

- Floating incoming call UI
- Native Socket.IO real-time signaling + `expo-video` HD video call integration
- Accept / decline buttons with haptic feedback and draggable WhatsApp PiP camera

### 5.9 Success Animation

`app/utils/SuccessAnimation.js`:

- Lottie-based checkmark animation (`app/config/success.json`)
- Scale-up entrance animation
- Used after successful actions (login, payment, submission)

---

## 6. Iconography

| Library | Usage |
|---------|-------|
| `react-native-vector-icons/MaterialCommunityIcons` | Primary icon set |
| `@expo/vector-icons` | Secondary / fallback |

**Common Icons:**

| Context | Icon Name |
|---------|-----------|
| Dashboard | `view-dashboard` / `view-dashboard-outline` |
| Academics | `book-open-variant` / `book-open-page-variant-outline` |
| Fees | `credit-card` / `credit-card-outline` |
| Documents | `folder-account` / `folder-account-outline` |
| Profile | `account` / `account-outline` |
| Notifications | `bell` / `bell-outline` |
| Logout | `logout` |
| Settings | `cog` |
| Attendance | `calendar-check` |
| Library | `bookshelf` |
| Timetable | `timetable` |
| QR Code | `qrcode` |
| Chat | `message-text` |
| Call | `phone` |
| Bus | `bus` |
| Hostel | `home-city` |

---

## 7. Animations & Transitions

| Animation | Implementation | Usage |
|-----------|---------------|-------|
| Fade-in | `Animated.Value(0→1)` | Screen load, modal entrance |
| Slide-up | `translateY` interpolation | Modal panels |
| Scale bounce | `Animated.spring` | Success animation, button press |
| Shimmer | `Animated.loop` + linear gradient | Skeleton loaders |
| Pulse | `Animated.loop` with scale | Loading indicators |
| Toast slide | `translateY` + opacity | Notification toasts |
| Spin | `Animated.loop` with rotate | Loading spinner |

---

## 8. Dark Mode Implementation

- Toggled via `ThemeContext` (`app/context/ThemeContext.js`)
- Persisted to `AsyncStorage` key `appTheme`
- Defaults to system `Appearance` setting
- All components read colors via `useTheme()` hook
- Every screen uses `getStyles(colors)` pattern for dynamic `StyleSheet.create`
- Splash screen adapts: white bg (light) / black bg (dark)

---

## 9. Immersive Mode

`app/context/ImmersiveBarsContext.js`:

- Auto-hides Android status bar and navigation bar after 3 seconds of inactivity
- Uses `Animated` + `PanResponder` gesture detection
- Restores bars on touch interaction
- Edge-to-edge enabled on Android

---

## 10. Screen Overview

### Student Portal

| Screen | Description |
|--------|-------------|
| Dashboard | QR code ID, notice board, assignment tracker, quick-access cards (fees, exams, attendance, library, timetable) |
| Academics | Course list, grades, CGPA display |
| Fees | Fee breakdown, due amounts, payment history |
| DocSpace | Document library, upload/download |
| Profile | User info, photo, ID card PDF, settings, logout |

### Staff Portal

| Screen | Description |
|--------|-------------|
| Dashboard | Faculty info card, today's schedule, notices, pending leave requests |
| Attendance | Period-wise attendance marking, batch selection |
| Students | Student roster, mentee list |
| Profile | Faculty profile, settings |

### Parent Portal

| Screen | Description |
|--------|-------------|
| Dashboard | Ward summary, notices |
| Fees | Ward fee status, payment |
| Messages | Communication with faculty |
| WardDetails | Academic progress, attendance |
| Profile | Parent profile, settings |

### Admin Portal

| Screen | Description |
|--------|-------------|
| Dashboard | System overview, stats |
| ManageUsers | User CRUD, add user modal |
| Reports | Analytics, data exports |
| SystemSettings | App configuration, logs |

---

## 11. Responsive Behavior

| Platform | Adaptation |
|----------|-----------|
| **iOS** | Taller tab bar (85px), safe area insets, shadow API |
| **Android** | Shorter tab bar (68px), elevation API, immersive mode, edge-to-edge |
| **Tablet** | `supportsTablet: true` in app.json |
| **Screen sizes** | `Dimensions.get('window')` for dynamic sizing |

---

*Design tokens and component specs derived from source at `app/config/color.json` and component files.*
