import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { resolveIdentity, invalidateIdentity } from "./identityService";

// Every getter here:
//   1. resolves the logged-in user's real records via identityService
//   2. fetches LIVE data from the backend (MongoDB)
//   3. mirrors the response into a per-user local cache (localSync) so
//      pull-to-refresh / reloads / offline restarts still have data
// No bundled default dataset is ever used — unmatched users simply get null/[].

function emptyDatabase() {
  return {
    institution: null,
    departments: [],
    primaryStudent: null,
    primaryFaculty: null,
    primaryParent: null,
    primaryAdmin: null,
    studentsRoster: [],
    notices: [],
    gradeLevels: [],
  };
}

function cacheKeyFor(username) {
  return `edunex_db_${username || "guest"}`;
}

export async function getDatabase() {
  try {
    const user = await AsyncStorage.getItem("loggedInUser");
    const raw = await AsyncStorage.getItem(cacheKeyFor(user));
    return raw ? JSON.parse(raw) : emptyDatabase();
  } catch (err) {
    console.warn("dataService getDatabase error:", err);
    return emptyDatabase();
  }
}

export async function saveDatabase(db) {
  try {
    const user = await AsyncStorage.getItem("loggedInUser");
    await AsyncStorage.setItem(cacheKeyFor(user), JSON.stringify(db));
    return true;
  } catch (err) {
    console.warn("dataService saveDatabase error:", err);
    return false;
  }
}

/** Wipe every local mirror (used on login/logout so users never see stale other-user data). */
export async function clearLocalSync() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter(
      (k) => k.startsWith("edunex_db_") || k === "edunex_unified_database_v1"
    );
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
  } catch (err) {
    console.warn("clearLocalSync error:", err);
  }
}

/**
 * Called right after a successful login/register.
 * Drops old mirrors, then pulls this user's live data from MongoDB into cache.
 */
export async function syncAfterLogin() {
  invalidateIdentity();
  await clearLocalSync();
  try {
    const identity = await resolveIdentity(true);
    if (identity.role === "staff") await getFacultyData();
    else if (identity.role === "parent") await getParentData();
    else if (identity.role === "admin") await getAdminData();
    else await getStudentData();
    return true;
  } catch (err) {
    console.warn("syncAfterLogin error:", err);
    return false;
  }
}

// ─────────────────────────────────────────────
// 🎓 STUDENT DATA SERVICES
// ─────────────────────────────────────────────

async function fetchStudentDoc() {
  const identity = await resolveIdentity();
  if (!identity.studentId && !identity.rollNo && !identity.username) return { doc: null, identity };
  // Direct hit by resolved id
  if (identity.studentId) {
    try {
      const res = await api.get(`/students/${encodeURIComponent(identity.studentId)}`);
      if (res?.data) return { doc: res.data, identity };
    } catch {}
  }
  // Filter by exact roll number
  if (identity.rollNo || identity.username) {
    const doc =
      (await api
        .get("/students", { roll: identity.rollNo || identity.username, limit: 1 })
        .then((r) => r?.data?.[0] || null)
        .catch(() => null)) || null;
    if (doc) return { doc, identity };
  }
  // Last resort: server search by username
  const doc = await api
    .get("/students", { q: identity.username, limit: 1 })
    .then((r) => r?.data?.[0] || null)
    .catch(() => null);
  return { doc, identity };
}

async function mergeIntoCache(patch) {
  const db = await getDatabase();
  const next = { ...db, ...patch };
  await saveDatabase(next);
  return next;
}

export async function getStudentData() {
  const { doc } = await fetchStudentDoc();
  if (!doc) {
    const db = await getDatabase();
    return db.primaryStudent || null; // last synced copy only — never bundled defaults
  }
  await mergeIntoCache({ primaryStudent: doc });
  return doc;
}

export async function getStudentSubjects() {
  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
  return Array.isArray(student?.subjects) ? student.subjects : [];
}

export async function getStudentFees() {
  let studentId = null;
  try {
    const identity = await resolveIdentity();
    studentId = identity.studentId;
  } catch {}
  let feesObj = null;
  if (studentId) {
    const [invoicesRes, historyRes] = await Promise.allSettled([
      api.get(`/students/${studentId}/invoices`),
      api.get(`/students/${studentId}/history`),
    ]);
    const cached = (await getDatabase()).primaryStudent;
    feesObj = { ...(cached?.fees || {}) };
    if (invoicesRes.status === "fulfilled" && invoicesRes.value?.data) {
      feesObj.dueInvoices = invoicesRes.value.data;
    }
    if (historyRes.status === "fulfilled" && historyRes.value?.data) {
      feesObj.history = historyRes.value.data;
    }
    if (cached?.fees || feesObj.dueInvoices || feesObj.history) {
      await mergeIntoCache({
        primaryStudent: { ...(cached || { id: studentId }), fees: feesObj },
      });
    }
  }
  if (!feesObj) {
    feesObj = ((await getDatabase()).primaryStudent || {}).fees || {};
  }
  return feesObj;
}

export async function getStudentSchedule() {
  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
  return Array.isArray(student?.schedule) ? student.schedule : [];
}

export async function getStudentLibrary() {
  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
  return student?.library || {};
}

export async function getGradeLevels() {
  try {
    const res = await api.get("/gradeLevels");
    if (Array.isArray(res?.data)) {
      await mergeIntoCache({ gradeLevels: res.data });
      return res.data;
    }
  } catch {}
  return (await getDatabase()).gradeLevels || [];
}

// ─────────────────────────────────────────────
// 👨‍🏫 FACULTY DATA SERVICES
// ─────────────────────────────────────────────

export async function getFacultyData() {
  const identity = await resolveIdentity();
  let doc = null;
  if (identity.staffId) {
    doc = await api
      .get(`/staff/${encodeURIComponent(identity.staffId)}`)
      .then((r) => r?.data || null)
      .catch(() => null);
  }
  if (!doc && identity.staff) doc = identity.staff;

  if (!doc) {
    const db = await getDatabase();
    return db.primaryFaculty || null;
  }
  await mergeIntoCache({ primaryFaculty: doc });
  return doc;
}

/**
 * Class roster for the logged-in staff member.
 * className defaults to the class derived from their staff record.
 */
export async function getFacultyRoster(className) {
  const identity = await resolveIdentity();
  const targetClass = className || identity.className || "";
  let roster = [];
  try {
    const params = targetClass ? { class: targetClass } : {};
    const res = await api.get("/students", { ...params, sort: "rollNo", limit: 200 });
    roster = Array.isArray(res?.data) ? res.data : [];
  } catch {}

  if (roster.length > 0) {
    await mergeIntoCache({ studentsRoster: roster });
    return roster.map((s) => ({ ...s, __class: s.class || s.section || targetClass }));
  }
  const db = await getDatabase();
  return (db.studentsRoster || []).map((s) => ({ ...s, __class: s.__class || s.class || s.section || targetClass }));
}

export async function getStaffClassName() {
  const identity = await resolveIdentity();
  return identity.className || "";
}

export async function getFacultySchedule() {
  const faculty = (await getFacultyData()) || (await getDatabase()).primaryFaculty;
  return Array.isArray(faculty?.todaySchedule) ? faculty.todaySchedule : [];
}

export async function submitAttendanceBatch(attendanceDocs) {
  try {
    const res = await api.post("/attendance/bulk", { docs: attendanceDocs });
    return res?.data || true;
  } catch (err) {
    console.warn("submitAttendanceBatch error:", err);
    return null;
  }
}

export async function updateStudentAttendance(rollNo, isPresent) {
  const db = await getDatabase();
  if (db.studentsRoster) {
    db.studentsRoster = db.studentsRoster.map((s) =>
      (s.rollNo || s.roll) === rollNo ? { ...s, present: isPresent } : s
    );
    await saveDatabase(db);
  }
  return db.studentsRoster;
}

// ─────────────────────────────────────────────
// 👨‍👩‍👧 PARENT DATA SERVICES
// ─────────────────────────────────────────────

export async function getParentData() {
  const identity = await resolveIdentity();
  let parent = null;
  if (identity.parentId) {
    parent = await api
      .get(`/parents/${encodeURIComponent(identity.parentId)}`)
      .then((r) => r?.data || null)
      .catch(() => null);
  }
  if (!parent && identity.parent) parent = identity.parent;

  let ward = null;
  if (parent?.wardRollNo || identity.wardRollNo) {
    ward =
      (await api
        .get("/students", { roll: parent?.wardRollNo || identity.wardRollNo, limit: 1 })
        .then((r) => r?.data?.[0] || null)
        .catch(() => null)) || null;
  }

  if (!parent && !ward) {
    const db = await getDatabase();
    parent = db.primaryParent;
    ward = db.primaryStudent;
    if (!parent && !ward) return null;
  }

  await mergeIntoCache({ primaryParent: parent, primaryStudent: ward });

  const overview = {
    parentName: parent?.name || "",
    wardName: ward?.name || "",
    rollNo: ward?.rollNo || ward?.roll || "",
    department: ward?.department || "",
    year: ward?.year || "",
    section: ward?.section || "",
    attendance: ward?.attendance?.percentage || ward?.attendance || "",
    grade: ward?.grade || "",
    cgpa: ward?.cgpa != null ? String(ward.cgpa) : "",
    feesDue: ward?.fees?.due != null ? `₹ ${Number(ward.fees.due).toLocaleString("en-IN")}` : "",
    paidFees: ward?.fees?.paid != null ? `₹ ${Number(ward.fees.paid).toLocaleString("en-IN")}` : "",
    totalFees: ward?.fees?.total != null ? `₹ ${Number(ward.fees.total).toLocaleString("en-IN")}` : "",
  };

  return { ...(parent || {}), ward: ward || {}, overview };
}

export async function getParentNotices() {
  try {
    const res = await api.get("/notices", { sort: "-createdAt" });
    if (Array.isArray(res?.data)) {
      const cleanNotices = res.data.filter(
        (n) =>
          n &&
          (Boolean(n.title && typeof n.title === "string" && n.title.trim()) ||
            Boolean(n.content && typeof n.content === "string" && n.content.trim()) ||
            Boolean(n.description && typeof n.description === "string" && n.description.trim()))
      );
      await mergeIntoCache({ notices: cleanNotices });
      return cleanNotices;
    }
  } catch {}
  const cached = (await getDatabase()).notices || [];
  return Array.isArray(cached)
    ? cached.filter(
        (n) =>
          n &&
          (Boolean(n.title && typeof n.title === "string" && n.title.trim()) ||
            Boolean(n.content && typeof n.content === "string" && n.content.trim()) ||
            Boolean(n.description && typeof n.description === "string" && n.description.trim()))
      )
    : [];
}

// ─────────────────────────────────────────────
// 🛡️ ADMIN DATA SERVICES
// ─────────────────────────────────────────────

export async function getAdminData() {
  const [instRes, deptRes] = await Promise.allSettled([
    api.get("/institutions"),
    api.get("/departments"),
  ]);

  let institution = null;
  let departments = [];
  if (instRes.status === "fulfilled" && Array.isArray(instRes.value?.data) && instRes.value.data.length > 0) {
    institution = instRes.value.data[0];
  }
  if (deptRes.status === "fulfilled" && Array.isArray(deptRes.value?.data)) {
    departments = deptRes.value.data;
  }

  const identity = await resolveIdentity();
  const admin = identity.admin || null;

  await mergeIntoCache({ institution, departments, primaryAdmin: admin });

  return {
    ...(admin || {}),
    institution,
    departments,
  };
}

export async function getInstitutions() {
  try {
    const res = await api.get("/institutions", { sort: "-createdAt", limit: 1 });
    if (Array.isArray(res?.data) && res.data.length > 0) {
      await mergeIntoCache({ institution: res.data[0] });
      return res.data;
    }
    return [];
  } catch {
    const db = await getDatabase();
    return db.institution ? [db.institution] : [];
  }
}

export async function getAdminStats() {
  const [studentsCount, staffCount, deptsCount, instRes] = await Promise.allSettled([
    api.get("/students", { limit: 1 }),
    api.get("/staff", { limit: 1 }),
    api.get("/departments", { limit: 1 }),
    api.get("/institutions", { sort: "-createdAt", limit: 1 }),
  ]);

  const inst =
    instRes.status === "fulfilled" && Array.isArray(instRes.value?.data)
      ? instRes.value.data[0]
      : null;

  const stats = {
    totalStudents: "0",
    totalFaculty: "0",
    totalDepartments: "0",
    totalCourses: inst?.totalCourses || "0",
    activePrograms: inst?.activePrograms || "0",
    monthlyFeeCollection: inst?.monthlyFeeCollection || "₹0",
    systemHealth: inst?.systemHealth || "—",
  };
  if (studentsCount.status === "fulfilled" && studentsCount.value?.total != null) {
    stats.totalStudents = Number(studentsCount.value.total).toLocaleString("en-IN");
  }
  if (staffCount.status === "fulfilled" && staffCount.value?.total != null) {
    stats.totalFaculty = String(staffCount.value.total);
  }
  if (deptsCount.status === "fulfilled" && deptsCount.value?.total != null) {
    stats.totalDepartments = String(deptsCount.value.total);
  }
  return stats;
}

// ─────────────────────────────────────────────
// 📝 LEAVES & MESSAGES SERVICES
// ─────────────────────────────────────────────

export async function submitLeaveRequest(leaveData) {
  try {
    const res = await api.post("/leaves", leaveData);
    return res?.data || leaveData;
  } catch (err) {
    console.warn("submitLeaveRequest error:", err);
    return null;
  }
}

export async function getLeavesList(params = {}) {
  try {
    const res = await api.get("/leaves", { sort: "-createdAt", ...params });
    if (res?.data) return res.data;
  } catch (err) {
    console.warn("getLeavesList error:", err);
  }
  return [];
}

export async function getMessagesList(params = {}) {
  try {
    const res = await api.get("/messages", { sort: "-createdAt", ...params });
    if (res?.data) return res.data;
  } catch (err) {
    console.warn("getMessagesList error:", err);
  }
  return [];
}

export async function sendMessage(messageData) {
  try {
    const res = await api.post("/messages", messageData);
    return res?.data || messageData;
  } catch (err) {
    console.warn("sendMessage error:", err);
    return null;
  }
}
