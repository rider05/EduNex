import { secureGet, secureSet } from "./secureStorage";
import { api } from "./api";

/**
 * ==============================================================================
 * 🆔 EDUNEX HARDENED IDENTITY RESOLVER
 * ==============================================================================
 * Resolves the logged-in user's role-specific document (student / staff / parent / admin)
 * via a single authorized call to `POST /auth/me` instead of firing 12+ scraping
 * search queries to `/students`.
 *
 * Defense-in-depth:
 *  - Strips any password/hash fields from stored and returned objects.
 *  - Handles offline cached fallback gracefully from hardware-backed secure storage.
 * ==============================================================================
 */

let memo = null;
let memoKey = "";

function norm(v) {
  return String(v || "").trim().toLowerCase();
}

function cleanDoc(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const clone = { ...doc };
  delete clone.passwordHash;
  delete clone.password;
  delete clone.salt;
  return clone;
}

export async function getSessionUser() {
  try {
    return await secureGet("userData");
  } catch {
    return null;
  }
}

/**
 * Re-fetch the logged-in user's account record and profile from backend in ONE call
 */
export async function refreshSessionUserProfile() {
  const stored = await getSessionUser();
  if (!stored) return null;

  try {
    // 1. Single authorized call to /auth/me
    let res = null;
    try {
      res = await api.post("/auth/me", {}, {}, { noCache: true });
    } catch {
      res = await api.get("/auth/me", {}, {}, { noCache: true });
    }

    const authData = res?.data || res;
    if (!authData || typeof authData !== "object") return stored;

    const clean = cleanDoc(authData.user || authData);
    const merged = { ...stored, ...clean };
    delete merged.passwordHash;
    delete merged.password;
    delete merged.salt;

    if (authData.student) merged.student = cleanDoc(authData.student);
    if (authData.staff) merged.staff = cleanDoc(authData.staff);
    if (authData.parent) merged.parent = cleanDoc(authData.parent);
    if (authData.admin) merged.admin = cleanDoc(authData.admin);

    await secureSet("userData", merged);
    invalidateIdentity();
    return merged;
  } catch (e) {
    console.warn("refreshSessionUserProfile fallback:", e?.message || e);
    return stored;
  }
}

/**
 * Resolve everything the app needs for the currently logged-in user.
 * Returns { role, username, user, studentId, student, staffId, staff, className, parentId, parent, wardRollNo, adminId, admin, name }
 */
export async function resolveIdentity(force = false) {
  const user = await getSessionUser();
  let role = norm(await secureGet("userRole"));
  if (!role || role === "guest") role = norm(user?.role);
  const username = norm(user?.username || user?.name || "");
  const key = `${role}:${username}`;

  if (!force && memo && memoKey === key) return memo;

  const identity = {
    role: role || "student",
    username,
    user: cleanDoc(user),
    studentId: null,
    student: null,
    rollNo: null,
    staffId: null,
    staff: null,
    className: "",
    parentId: null,
    parent: null,
    wardRollNo: null,
    adminId: null,
    admin: null,
    name: "",
  };

  // If user is guest, return minimal read-only identity immediately
  if (role === "guest") {
    identity.name = "Guest User";
    memo = identity;
    memoKey = key;
    return identity;
  }

  try {
    // 1. Attempt single authorized fetch to /auth/me for live data
    let authMeData = null;
    try {
      const res = await api.post("/auth/me", {}, {}, { noCache: force });
      authMeData = res?.data || res;
    } catch {
      try {
        const res = await api.get("/auth/me", {}, {}, { noCache: force });
        authMeData = res?.data || res;
      } catch {
        authMeData = null;
      }
    }

    if (authMeData && typeof authMeData === "object") {
      if (authMeData.student) identity.student = cleanDoc(authMeData.student);
      if (authMeData.staff) identity.staff = cleanDoc(authMeData.staff);
      if (authMeData.parent) identity.parent = cleanDoc(authMeData.parent);
      if (authMeData.admin) identity.admin = cleanDoc(authMeData.admin);
      if (authMeData.role) identity.role = norm(authMeData.role);
    }

    // 2. Offline / local cache fallback if /auth/me was unavailable
    if (!identity.student && user?.student) identity.student = cleanDoc(user.student);
    if (!identity.staff && user?.staff) identity.staff = cleanDoc(user.staff);
    if (!identity.parent && user?.parent) identity.parent = cleanDoc(user.parent);
    if (!identity.admin && user?.admin) identity.admin = cleanDoc(user.admin);

    // Populate role-specific fields
    if (identity.role === "staff") {
      if (identity.staff) {
        identity.staffId = identity.staff.id || identity.staff._id || null;
        identity.className =
          identity.staff.classTeacher ||
          (Array.isArray(identity.staff.coursesTaught) ? identity.staff.coursesTaught[0]?.class : "") ||
          identity.staff.section ||
          "";
      }
    } else if (identity.role === "parent") {
      if (identity.parent) {
        identity.parentId = identity.parent.id || identity.parent._id || null;
        identity.wardRollNo =
          identity.parent.wardRollNo || identity.parent.studentID || identity.parent.ward_roll_no || null;
        identity.studentId = identity.student?.id || identity.student?._id || identity.wardRollNo || null;
        identity.rollNo = identity.wardRollNo;
      }
    } else if (identity.role === "admin") {
      if (identity.admin) {
        identity.adminId = identity.admin.id || identity.admin._id || null;
      }
    } else {
      // Student (default)
      if (identity.student) {
        identity.studentId = identity.student.id || identity.student?._id || null;
        identity.rollNo = identity.student.rollNo || identity.student.roll || null;
        identity.className = identity.student.class || identity.student.section || "";
      }
    }
  } catch (err) {
    console.warn("resolveIdentity error:", err?.message || err);
  }

  // Derive human-friendly display name (avoiding IDs / roll numbers)
  const isRollOrId = (val) => {
    if (!val) return true;
    const s = String(val).trim();
    if (s.toLowerCase() === username.toLowerCase()) return true;
    if (identity.rollNo && s.toLowerCase() === String(identity.rollNo).toLowerCase()) return true;
    if (/^[0-9]{2}[a-z]{2,5}[0-9]{2,5}$/i.test(s)) return true;
    return false;
  };

  let realName =
    identity.student?.name ||
    identity.staff?.name ||
    identity.parent?.name ||
    identity.admin?.name ||
    user?.profile?.name ||
    user?.fullName ||
    "";

  if (!realName && user?.name && !isRollOrId(user.name)) {
    realName = user.name;
  }

  identity.name = realName
    ? String(realName).trim()
    : identity.role === "student"
    ? "Student"
    : identity.role.charAt(0).toUpperCase() + identity.role.slice(1);

  memo = identity;
  memoKey = key;
  return identity;
}

export function invalidateIdentity() {
  memo = null;
  memoKey = "";
}
