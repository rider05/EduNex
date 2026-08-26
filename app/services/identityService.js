import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

// Resolves the logged-in user's real records (student / staff / parent / admin)
// from the backend (MongoDB) by combining:
//   1. profile links saved on the account at registration (profile.rollNo etc.)
//   2. exact field matches (rollNo === username)
//   3. server-side search (?q=<username> or profile.name)

let memo = null;
let memoKey = "";

function norm(v) {
  return String(v || "").trim().toLowerCase();
}

export async function getSessionUser() {
  try {
    const raw = await AsyncStorage.getItem("userData");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fetchOneById(path, id) {
  if (!id) return null;
  try {
    const res = await api.get(`${path}/${encodeURIComponent(id)}`);
    return res?.data || null;
  } catch {
    return null;
  }
}

async function searchFirst(path, params = {}) {
  try {
    const res = await api.get(path, { limit: 10, ...params });
    const list = Array.isArray(res?.data) ? res.data : [];
    return list[0] || null;
  } catch {
    return null;
  }
}

function docMatchesUsername(doc, username) {
  if (!doc || !username) return false;
  const u = norm(username);
  return [doc.username, doc.name, doc.rollNo, doc.roll, doc.email, doc.id].some(
    (f) => f && (norm(f) === u || norm(f).includes(u))
  );
}

async function resolveStudentDoc(user, username) {
  const profile = user?.profile || {};
  let doc =
    (await fetchOneById("/students", profile.studentId || profile.id)) ||
    (await searchFirst("/students", { roll: profile.rollNo })) ||
    (await searchFirst("/students", { rollNo: username })) ||
    (await searchFirst("/students", { q: username }));
  if (!doc && profile.name) {
    const alt = await searchFirst("/students", { q: profile.name });
    if (alt && docMatchesUsername(alt, username)) doc = alt;
  }
  return doc;
}

async function resolveStaffDoc(user, username) {
  const profile = user?.profile || {};
  let doc =
    (await fetchOneById("/staff", profile.staffId || profile.id)) ||
    (await searchFirst("/staff", { id: username })) ||
    (await searchFirst("/staff", { q: username }));
  if (!doc && profile.name) {
    doc = await searchFirst("/staff", { q: profile.name });
  }
  return doc;
}

async function resolveParentDoc(user, username) {
  const profile = user?.profile || {};
  let doc =
    (await fetchOneById("/parents", profile.parentId || profile.id)) ||
    (await searchFirst("/parents", { wardRollNo: profile.wardRollNo || username })) ||
    (await searchFirst("/parents", { q: username }));
  if (!doc && profile.name) {
    doc = await searchFirst("/parents", { q: profile.name });
  }
  return doc;
}

async function resolveAdminDoc(user, username) {
  const profile = user?.profile || {};
  let doc =
    (await fetchOneById("/admins", profile.adminId || profile.id)) ||
    (await searchFirst("/admins", { email: norm(user?.email) }));
  if (!doc) {
    doc = await searchFirst("/admins", { q: username });
  }
  return doc;
}

/**
 * Resolve everything the app needs for the currently logged-in user.
 * Returns { role, username, user, studentId, student, staffId, staff, className, parentId, parent, wardRollNo, adminId, admin }
 */
export async function resolveIdentity(force = false) {
  const user = await getSessionUser();
  let role = norm(await AsyncStorage.getItem("userRole"));
  if (!role || role === "guest") role = norm(user?.role);
  const username = norm(user?.username || user?.name || "");
  const key = `${role}:${username}`;

  if (!force && memo && memoKey === key) return memo;

  const identity = {
    role: role || "student",
    username,
    user,
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
  };

  try {
    if (role === "staff") {
      const staff = await resolveStaffDoc(user, username);
      if (staff) {
        identity.staff = staff;
        identity.staffId = staff.id || staff._id || null;
        identity.className =
          staff.classTeacher ||
          (Array.isArray(staff.coursesTaught) ? staff.coursesTaught[0]?.class : "") ||
          staff.section ||
          "";
      }
    } else if (role === "parent") {
      const parent = await resolveParentDoc(user, username);
      if (parent) {
        identity.parent = parent;
        identity.parentId = parent.id || parent._id || null;
        identity.wardRollNo = parent.wardRollNo || parent.ward_roll_no || user?.profile?.wardRollNo || null;
        identity.student = identity.wardRollNo
          ? (await searchFirst("/students", { roll: identity.wardRollNo })) ||
            (await searchFirst("/students", { q: identity.wardRollNo }))
          : null;
        identity.studentId = identity.student?.id || identity.student?._id || null;
      }
    } else if (role === "admin") {
      const admin = await resolveAdminDoc(user, username);
      if (admin) {
        identity.admin = admin;
        identity.adminId = admin.id || admin._id || null;
      }
    } else {
      // student (default)
      const student = await resolveStudentDoc(user, username);
      if (student) {
        identity.student = student;
        identity.studentId = student.id || student._id || null;
        identity.rollNo = student.rollNo || student.roll || null;
        identity.className = student.class || student.section || "";
      }
    }
  } catch (err) {
    console.warn("resolveIdentity error:", err?.message || err);
  }

  memo = identity;
  memoKey = key;
  return identity;
}

export function invalidateIdentity() {
  memo = null;
  memoKey = "";
}
