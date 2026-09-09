import { secureGet, secureSet } from "./secureStorage";
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

/**
 * Re-fetch the logged-in user's account record from the backend and merge the
 * freshest profile (e.g. profile data synced from the student record) into the
 * stored session, then drop the cached identity so it re-resolves.
 * Returns the merged account doc, or null if nothing changed / on failure.
 */
export async function refreshSessionUserProfile() {
  const stored = await getSessionUser();
  if (!stored) return null;

  const account =
    stored?.data && typeof stored.data === "object" && !Array.isArray(stored.data) && (stored.data.username || stored.data.email)
      ? stored.data
      : stored?.user && typeof stored.user === "object" && !Array.isArray(stored.user) && (stored.user.username || stored.user.email)
      ? stored.user
      : stored;

  const username = norm(account?.username || account?.name);
  const email = norm(account?.email);
  const q = username || email;
  if (!q) return null;

  try {
    const res = await api.get("/users", { q, limit: 5 }, {}, { noCache: true });
    const list = Array.isArray(res?.data) ? res.data : [];
    const match =
      list.find((u) => u && (norm(u.username) === username || norm(u.email) === email)) || list[0] || null;
    if (!match) return null;

    const clean = { ...match };
    delete clean.passwordHash;
    delete clean.password;

    const merged = { ...stored };
    Object.keys(clean).forEach((k) => {
      merged[k] = clean[k];
    });
    delete merged.passwordHash;
    delete merged.password;
    delete merged.data;
    delete merged.user;

    await secureSet("userData", merged);
    invalidateIdentity();
    return merged;
  } catch (e) {
    console.warn("refreshSessionUserProfile error:", e?.message || e);
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
  if (user?.student && typeof user.student === "object" && user.student.name) return user.student;
  const profile = user?.profile || {};

  const cleanUsername = String(username || "").trim();
  const upperUsername = cleanUsername.toUpperCase();
  const cleanRoll = String(profile.rollNo || profile.roll || user?.rollNo || "").trim();
  const upperRoll = cleanRoll.toUpperCase();

  const candidates = await Promise.allSettled([
    profile.studentId || profile.id ? fetchOneById("/students", profile.studentId || profile.id) : null,
    cleanRoll ? searchFirst("/students", { rollNo: cleanRoll }) : null,
    upperRoll ? searchFirst("/students", { rollNo: upperRoll }) : null,
    cleanRoll ? searchFirst("/students", { roll: cleanRoll }) : null,
    upperRoll ? searchFirst("/students", { roll: upperRoll }) : null,
    cleanUsername ? searchFirst("/students", { rollNo: cleanUsername }) : null,
    upperUsername ? searchFirst("/students", { rollNo: upperUsername }) : null,
    cleanUsername ? searchFirst("/students", { roll: cleanUsername }) : null,
    upperUsername ? searchFirst("/students", { roll: upperUsername }) : null,
    cleanUsername ? searchFirst("/students", { username: cleanUsername }) : null,
    user?.email ? searchFirst("/students", { email: String(user.email).trim() }) : null,
    cleanUsername ? searchFirst("/students", { q: cleanUsername }) : null,
    profile.name ? searchFirst("/students", { q: profile.name }) : null,
  ]);

  for (const res of candidates) {
    if (res.status === "fulfilled" && res.value && res.value.name) {
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

  // Derive real human-friendly display name (avoiding login IDs / roll numbers)
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

  identity.name = realName ? String(realName).trim() : (role === "student" ? "Student" : role.charAt(0).toUpperCase() + role.slice(1));

  memo = identity;
  memoKey = key;
  return identity;
}

export function invalidateIdentity() {
  memo = null;
  memoKey = "";
}
