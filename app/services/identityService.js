import { secureGet } from "./secureStorage";
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
    return await secureGet("userData");
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

async function resolveStudentDoc(user, username) {
  if (user?.student && typeof user.student === "object") return user.student;
  const profile = user?.profile || {};

  const candidates = await Promise.allSettled([
    profile.studentId || profile.id ? fetchOneById("/students", profile.studentId || profile.id) : null,
    profile.rollNo ? searchFirst("/students", { roll: profile.rollNo }) : null,
    username ? searchFirst("/students", { rollNo: username }) : null,
    username ? searchFirst("/students", { q: username }) : null,
    profile.name ? searchFirst("/students", { q: profile.name }) : null,
  ]);

  for (const res of candidates) {
    if (res.status === "fulfilled" && res.value) {
      return res.value;
    }
  }
  return null;
}

async function resolveStaffDoc(user, username) {
  if (user?.staff && typeof user.staff === "object") return user.staff;
  const profile = user?.profile || {};

  const candidates = await Promise.allSettled([
    profile.staffId || profile.id ? fetchOneById("/staff", profile.staffId || profile.id) : null,
    username ? searchFirst("/staff", { id: username }) : null,
    username ? searchFirst("/staff", { q: username }) : null,
    profile.name ? searchFirst("/staff", { q: profile.name }) : null,
  ]);

  for (const res of candidates) {
    if (res.status === "fulfilled" && res.value) {
      return res.value;
    }
  }
  return null;
}

async function resolveParentDoc(user, username) {
  if (user?.parent && typeof user.parent === "object") return user.parent;
  const profile = user?.profile || {};

  const candidates = await Promise.allSettled([
    profile.parentId || profile.id ? fetchOneById("/parents", profile.parentId || profile.id) : null,
    username ? searchFirst("/parents", { username: username }) : null,
    profile.wardRollNo ? searchFirst("/parents", { wardRollNo: profile.wardRollNo }) : null,
    username ? searchFirst("/parents", { q: username }) : null,
    profile.name ? searchFirst("/parents", { q: profile.name }) : null,
  ]);

  for (const res of candidates) {
    if (res.status === "fulfilled" && res.value) {
      return res.value;
    }
  }
  return null;
}

async function resolveAdminDoc(user, username) {
  if (user?.admin && typeof user.admin === "object") return user.admin;
  const profile = user?.profile || {};

  const candidates = await Promise.allSettled([
    profile.adminId || profile.id ? fetchOneById("/admins", profile.adminId || profile.id) : null,
    user?.email ? searchFirst("/admins", { email: norm(user.email) }) : null,
    username ? searchFirst("/admins", { q: username }) : null,
  ]);

  for (const res of candidates) {
    if (res.status === "fulfilled" && res.value) {
      return res.value;
    }
  }
  return null;
}

/**
 * Resolve everything the app needs for the currently logged-in user.
 * Returns { role, username, user, studentId, student, staffId, staff, className, parentId, parent, wardRollNo, adminId, admin }
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
        identity.wardRollNo = parent.wardRollNo || parent.studentID || parent.ward_roll_no || user?.profile?.wardRollNo || null;
        if (identity.wardRollNo) {
          identity.student =
            (await fetchOneById("/students", identity.wardRollNo)) ||
            (await searchFirst("/students", { rollNo: identity.wardRollNo })) ||
            (await searchFirst("/students", { roll: identity.wardRollNo })) ||
            (await searchFirst("/students", { q: identity.wardRollNo }));
        }
        identity.studentId = identity.student?.id || identity.student?._id || identity.wardRollNo || null;
        identity.rollNo = identity.wardRollNo;
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
