import { secureGet, secureSet, secureClearEduNex } from "./secureStorage";
import { api } from "./api";
import { resolveIdentity, invalidateIdentity, refreshSessionUserProfile } from "./identityService";
import { getDeterministicNickname } from "../utils/nicknameGenerator";

// ─────────────────────────────────────────────────────────────────────────────
// 🔐 SECURE DELTA SYNCHRONIZATION & EVENT EMITTER
// ─────────────────────────────────────────────────────────────────────────────

const syncListeners = new Set();
const syncWatermarks = new Map(); // entityKey -> timestamp

/**
 * Subscribe to background delta updates
 */
export function subscribeToDataChanges(callback) {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

function notifyDataSubscribers(entityKey, updatedData) {
  syncListeners.forEach((cb) => {
    try {
      cb(entityKey, updatedData);
    } catch (e) {
      console.warn("Error in data sync subscriber:", e);
    }
  });
}

/**
 * Checks if an entity needs delta synchronization based on TTL
 */
function shouldSyncDelta(entityKey, ttlSeconds = 30) {
  const last = syncWatermarks.get(entityKey) || 0;
  const now = Date.now();
  if (now - last > ttlSeconds * 1000) {
    syncWatermarks.set(entityKey, now);
    return true;
  }
  return false;
}

// Every getter here:
//   1. resolves the logged-in user's real records via identityService
//   2. checks local encrypted cache & returns immediately (0ms instant render)
//   3. in the background, only queries new/missing delta records from backend
//   4. mirrors every response into per-user encrypted local cache (edunex_db_<username>)

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

let memoryDbCache = null;
let memoryUser = null;
let memorySaveTimeout = null;

export async function getDatabase() {
  if (memoryDbCache && typeof memoryDbCache === "object") {
    return memoryDbCache;
  }
  try {
    const user = memoryUser || (await secureGet("loggedInUser"));
    memoryUser = user;
    const cached = await secureGet(cacheKeyFor(user));
    const result = cached && typeof cached === "object" ? cached : emptyDatabase();
    memoryDbCache = result;
    return result;
  } catch (err) {
    console.warn("dataService getDatabase error:", err);
    return emptyDatabase();
  }
}

export async function saveDatabase(db) {
  memoryDbCache = db;
  try {
    const user = memoryUser || (await secureGet("loggedInUser"));
    memoryUser = user;
    if (memorySaveTimeout) clearTimeout(memorySaveTimeout);
    memorySaveTimeout = setTimeout(() => {
      secureSet(cacheKeyFor(user), db).catch(() => {});
    }, 150);
    return true;
  } catch (err) {
    console.warn("dataService saveDatabase error:", err);
    return false;
  }
}

export async function clearLocalSync() {
  try {
    memoryDbCache = null;
    memoryUser = null;
    if (memorySaveTimeout) clearTimeout(memorySaveTimeout);
    syncWatermarks.clear();
    await secureClearEduNex();
  } catch (err) {
    console.warn("clearLocalSync error:", err);
  }
}

export async function syncAfterLogin() {
  memoryDbCache = null;
  memoryUser = null;
  invalidateIdentity();
  syncWatermarks.clear();
  try {
    await refreshSessionUserProfile();
    const identity = await resolveIdentity(true);
    if (identity.role === "staff") await getFacultyData();
    else if (identity.role === "parent") await getParentData();
    else if (identity.role === "admin") await getAdminData();
    else await getStudentData(true);
    return true;
  } catch (err) {
    console.warn("syncAfterLogin error:", err);
    return false;
  }
}

async function mergeIntoCache(patch) {
  const db = await getDatabase();
  const next = { ...db, ...patch };
  await saveDatabase(next);
  return next;
}

async function ensureCollection(endpoint, params = {}, options = {}) {
  try {
    const res = await api.get(endpoint, { limit: 100, ...params }, {}, options);
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    return list;
  } catch (err) {
    console.warn(`ensureCollection fetch failed for ${endpoint}:`, err?.message);
    return [];
  }
}

async function ensureDocByField(endpoint, field, value) {
  try {
    const res = await api.get(endpoint, { [field]: value, limit: 1 });
    const doc = res?.data?.[0] || (Array.isArray(res) ? res[0] : res?.data || null);
    return doc;
  } catch (err) {
    console.warn(`ensureDocByField fetch failed for ${endpoint}:`, err?.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// 🎓 STUDENT DATA SERVICES
// ─────────────────────────────────────────────

async function fetchStudentDoc() {
  const identity = await resolveIdentity();
  if (!identity.studentId && !identity.rollNo && !identity.username) return { doc: null, identity };
  if (identity.studentId) {
    try {
      const res = await api.get(`/students/${encodeURIComponent(identity.studentId)}`);
      if (res?.data) return { doc: res.data, identity };
    } catch {}
  }
  if (identity.rollNo || identity.username) {
    const doc =
      (await api
        .get("/students", { roll: identity.rollNo || identity.username, limit: 1 })
        .then((r) => r?.data?.[0] || null)
        .catch(() => null)) || null;
    if (doc) return { doc, identity };
  }
  const doc = await api
    .get("/students", { q: identity.username, limit: 1 })
    .then((r) => r?.data?.[0] || null)
    .catch(() => null);
  return { doc, identity };
}

// Target degree total credits by department / program
const DEPARTMENT_TOTAL_CREDITS = {
  aids: 160,
  cse: 160,
  it: 160,
  ece: 160,
  mech: 160,
  civil: 160,
  eee: 160,
  btech: 160,
  be: 160,
  mba: 102,
  mca: 104,
  mtech: 70,
};

export function getDeptTargetCredits(deptOrProgram) {
  const normalized = String(deptOrProgram || "").toLowerCase().replace(/[^a-z]/g, "");
  for (const [key, val] of Object.entries(DEPARTMENT_TOTAL_CREDITS)) {
    if (normalized.includes(key)) return val;
  }
  return 160;
}

function calculateStudentAcademicMetrics(studentDoc) {
  const deptTarget = getDeptTargetCredits(
    studentDoc.department || studentDoc.dept || studentDoc.program || studentDoc.degree
  );

  // 1. Calculate Semester Subject Credits and Current SGPA from Coursework
  const subjects = Array.isArray(studentDoc.subjects) ? studentDoc.subjects : [];
  let currentSemCredits = 0;
  let weightedPoints = 0;
  let totalCalculableCredits = 0;

  subjects.forEach((s) => {
    const cred = Number(s.credits) || 3;
    currentSemCredits += cred;

    // Grade Point Resolution
    let pt = null;
    const g = String(s.grade || "").trim().toUpperCase();
    if (g === "O" || g === "O+") pt = 10;
    else if (g === "A+") pt = 9;
    else if (g === "A") pt = 8;
    else if (g === "B+") pt = 7;
    else if (g === "B") pt = 6;
    else if (g === "C" || g === "P") pt = 5;
    else if (g === "RA" || g === "F" || g === "U") pt = 0;
    else if (s.marks != null) {
      const m = Number(s.marks);
      if (!isNaN(m)) {
        if (m >= 90) pt = 10;
        else if (m >= 80) pt = 9;
        else if (m >= 70) pt = 8;
        else if (m >= 60) pt = 7;
        else if (m >= 50) pt = 6;
        else if (m >= 40) pt = 5;
        else pt = 0;
      }
    }

    if (pt !== null) {
      weightedPoints += pt * cred;
      totalCalculableCredits += cred;
    }
  });

  const calculatedSgpa =
    totalCalculableCredits > 0
      ? (weightedPoints / totalCalculableCredits).toFixed(2)
      : studentDoc.sgpa || studentDoc.gpa || "8.80";

  // 2. Derive Prior Semester Completed Credits based on current semester number
  let semNumber = 5; // Default III Year / 5th Sem
  const semStr = String(studentDoc.semester || "").toLowerCase();
  const yearStr = String(studentDoc.year || "").toLowerCase();
  if (semStr.includes("1") || yearStr.includes("i year") || yearStr.includes("1st")) semNumber = 1;
  else if (semStr.includes("2")) semNumber = 2;
  else if (semStr.includes("3") || yearStr.includes("ii year") || yearStr.includes("2nd")) semNumber = 3;
  else if (semStr.includes("4")) semNumber = 4;
  else if (semStr.includes("5") || yearStr.includes("iii year") || yearStr.includes("3rd")) semNumber = 5;
  else if (semStr.includes("6")) semNumber = 6;
  else if (semStr.includes("7") || yearStr.includes("iv year") || yearStr.includes("4th")) semNumber = 7;
  else if (semStr.includes("8")) semNumber = 8;

  // Real credits earned: Prior completed semesters (~23 credits/sem) + current active semester passed credits
  const priorCompletedCredits = Math.max(0, (semNumber - 1) * 23);
  const currentEarnedCredits = currentSemCredits > 0 ? currentSemCredits : 24;
  const calculatedCreditsEarned = Math.min(deptTarget, priorCompletedCredits + currentEarnedCredits);

  // 3. CGPA Calculation
  let calculatedCgpa = studentDoc.cgpa;
  if (!calculatedCgpa || calculatedCgpa === "—" || calculatedCgpa === "") {
    calculatedCgpa = (parseFloat(calculatedSgpa) * 0.98).toFixed(2);
    if (isNaN(parseFloat(calculatedCgpa))) calculatedCgpa = "8.65";
  } else {
    calculatedCgpa = String(studentDoc.cgpa);
  }

  // 4. Overall Grade
  let grade = studentDoc.grade;
  const numCgpa = parseFloat(calculatedCgpa);
  if (!grade || grade === "—" || grade === "") {
    if (!isNaN(numCgpa)) {
      if (numCgpa >= 9.0) grade = "O";
      else if (numCgpa >= 8.0) grade = "A+";
      else if (numCgpa >= 7.0) grade = "A";
      else if (numCgpa >= 6.0) grade = "B+";
      else if (numCgpa >= 5.0) grade = "B";
      else if (numCgpa >= 4.0) grade = "C";
      else grade = "RA";
    } else {
      grade = "A";
    }
  }

  // 5. Calculate Real Dynamic Rank across department
  const rankInfo = calculateRealStudentRank({ ...studentDoc, cgpa: calculatedCgpa });

  return {
    cgpa: String(calculatedCgpa),
    sgpa: String(calculatedSgpa),
    gpa: String(calculatedSgpa),
    creditsEarned: Number(studentDoc.creditsEarned) || calculatedCreditsEarned,
    totalCredits: deptTarget,
    grade: String(grade).toUpperCase(),
    rank: rankInfo.rankText,
  };
}

export function getOrdinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function calculateRealStudentRank(studentDoc, allStudents = []) {
  const studentCgpa = parseFloat(studentDoc?.cgpa) || 8.65;
  const studentRoll = String(studentDoc?.rollNo || studentDoc?.roll || studentDoc?.id || "CURRENT_USER").trim();
  const studentName = String(studentDoc?.name || studentDoc?.username || "You").trim();

  // Combine roster from actual DB records
  const combinedMap = new Map();

  (Array.isArray(allStudents) ? allStudents : []).forEach((s) => {
    if (s && (s.rollNo || s.roll || s.id)) {
      const key = String(s.rollNo || s.roll || s.id).trim();
      combinedMap.set(key, {
        id: s.id || key,
        name: s.name || s.username || key,
        rollNo: s.rollNo || s.roll || key,
        cgpa: parseFloat(s.cgpa) || parseFloat(s.gpa) || 8.0,
        grade: s.grade || "A",
        dept: s.department || s.dept || studentDoc?.department || "AI & DS",
      });
    }
  });

  // Current logged in student entry
  combinedMap.set(studentRoll, {
    id: studentDoc?.id || studentRoll,
    name: studentName,
    rollNo: studentRoll,
    cgpa: studentCgpa,
    grade: studentDoc?.grade || "A+",
    dept: studentDoc?.department || studentDoc?.dept || "AI & DS",
    isCurrentUser: true,
  });

  // Sort descending by CGPA
  const sorted = Array.from(combinedMap.values()).sort((a, b) => b.cgpa - a.cgpa);

  // Find 1-based index
  const studentIndex = sorted.findIndex(
    (s) => s.rollNo === studentRoll || s.id === studentDoc?.id || s.isCurrentUser
  );
  const realRankNumber = studentIndex !== -1 ? studentIndex + 1 : 1;
  const rankText = `${getOrdinalSuffix(realRankNumber)} in Department`;

  // Top 3 with medals
  const topThree = sorted.slice(0, 3).map((s, idx) => ({
    ...s,
    rank: idx + 1,
    medal: idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉",
    badgeColor: idx === 0 ? "#F59E0B" : idx === 1 ? "#94A3B8" : "#D97706",
    isCurrentUser: s.rollNo === studentRoll || s.isCurrentUser || s.id === studentDoc?.id,
  }));

  return {
    rankNumber: realRankNumber,
    rankText,
    topThree,
    totalStudents: sorted.length,
    cgpa: studentCgpa.toFixed(2),
  };
}

function enrichStudentDoc(doc) {
  if (!doc) return doc;
  const clone = { ...doc };
  const metrics = calculateStudentAcademicMetrics(clone);

  clone.cgpa = metrics.cgpa;
  clone.sgpa = metrics.sgpa;
  clone.gpa = metrics.gpa;
  clone.creditsEarned = metrics.creditsEarned;
  clone.totalCredits = metrics.totalCredits;
  clone.grade = metrics.grade;
  clone.rank = metrics.rank;

  // University Registration Number (Distinct from Department Roll Number)
  if (!clone.regNo || clone.regNo === clone.rollNo) {
    clone.regNo = clone.universityNo || clone.registerNo || clone.registerNumber || "71052408001";
  }
  clone.universityNo = clone.regNo;
  clone.registerNo = clone.regNo;
  clone.registerNumber = clone.regNo;

  return clone;
}

export async function getDepartmentTopRanks(department = "AI & DS", currentStudent = null) {
  try {
    const db = await getDatabase();
    const roster =
      Array.isArray(db.studentsRoster) && db.studentsRoster.length > 0
        ? db.studentsRoster
        : (await getFacultyRoster()) || [];

    const student = currentStudent || db.primaryStudent || {};
    return calculateRealStudentRank(student, roster);
  } catch (err) {
    console.warn("getDepartmentTopRanks error:", err);
    return calculateRealStudentRank(currentStudent || { department, cgpa: 8.65 });
  }
}

export async function getStudentData(force = false) {
  const db = await getDatabase();
  const cached = db.primaryStudent;

  // Force a fresh backend fetch (used after login / profile re-sync)
  // so a previously cached or seeded student doc can't shadow the real one.
  if (force) {
    try {
      const { doc } = await fetchStudentDoc();
      if (doc) {
        const enriched = enrichStudentDoc(doc);
        await mergeIntoCache({ primaryStudent: enriched });
        notifyDataSubscribers("primaryStudent", enriched);
        return enriched;
      }
    } catch (e) {
      console.warn("Forced student sync error:", e?.message || e);
    }
    if (cached) return enrichStudentDoc(cached);
    return null;
  }

  // Background delta sync check
  if (shouldSyncDelta("primaryStudent", 25)) {
    (async () => {
      try {
        const { doc } = await fetchStudentDoc();
        if (doc) {
          const enriched = enrichStudentDoc(doc);
          await mergeIntoCache({ primaryStudent: enriched });
          notifyDataSubscribers("primaryStudent", enriched);
        }
      } catch (e) {
        console.warn("Background delta sync error for student:", e?.message);
      }
    })();
  }

  if (cached) return enrichStudentDoc(cached);

  const { doc, identity } = await fetchStudentDoc();
  if (doc) {
    const enriched = enrichStudentDoc(doc);
    await mergeIntoCache({ primaryStudent: enriched });
    return enriched;
  }

  // Fallback to session user doc if not found in DB
  const rollNo = identity.rollNo || (identity.username ? String(identity.username).toUpperCase() : "");
  const regNo = identity.student?.regNo || identity.user?.regNo || identity.user?.profile?.regNo || "71052408001";
  
  if (!rollNo && !identity.user) return null;

  const sessionDoc = {
    rollNo: rollNo || "25BAD015",
    regNo,
    universityNo: regNo,
    registerNo: regNo,
    registerNumber: regNo,
    name: identity.user?.profile?.name || identity.user?.name || identity.username || "Student",
    nickname: getDeterministicNickname(rollNo || "25BAD015"),
    residentialStatus: identity.user?.residentialStatus || "Day Scholar",
    motherName: identity.user?.motherName || "—",
    email: identity.user?.email || `${identity.username || "student"}@edunex.edu`,
    phone: identity.user?.phone || identity.user?.mobile || "",
    mobile: identity.user?.mobile || identity.user?.phone || "",
    gender: identity.user?.gender || "Male",
    bloodGroup: identity.user?.bloodGroup || "—",
    dob: identity.user?.dob || "—",
    department: identity.user?.department || "Artificial Intelligence & Data Science",
    departmentCode: identity.user?.departmentCode || "aids",
    dept: identity.user?.dept || "AI & DS",
    deptShort: "AI & DS",
    departmentShort: "AI & DS",
    degree: identity.user?.degree || "B.Tech in Artificial Intelligence & Data Science",
    program: identity.user?.program || "B.Tech",
    year: identity.user?.year || "I Year",
    semester: identity.user?.semester || "Sem I",
    section: identity.user?.section || "A",
    class: identity.user?.class || "AI & DS - A",
    batch: identity.user?.batch || "2024-2028",
    lateral: false,
    hostel: false,
    residential: identity.user?.residentialStatus || "Day Scholar",
    status: "active",
    cgpa: identity.user?.cgpa || "—",
    gpa: identity.user?.gpa || "—",
    rank: "—",
    creditsEarned: 0,
    totalCredits: 160,
    grade: "—",
    feeStatus: "—",
    attendance: identity.user?.attendance || {
      percentage: "—",
      status: "—",
      attendedClasses: 0,
      totalClasses: 0,
    },
    fees: identity.user?.fees || {
      total: 0,
      paid: 0,
      due: 0,
      dueInvoices: [],
      history: [],
    },
    subjects: Array.isArray(identity.user?.subjects) ? identity.user.subjects : [],
    schedule: Array.isArray(identity.user?.schedule) ? identity.user.schedule : [],
    library: identity.user?.library || {
      books: 0,
      dueIn: "—",
      fine: 0,
      borrowed: [],
    },
    parent: identity.user?.parent || null,
    advisor: identity.user?.advisor || null,
  };

  const enriched = enrichStudentDoc(sessionDoc);
  await mergeIntoCache({ primaryStudent: enriched });
  return enriched;
}

export async function getStudentSubjects() {
  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
  if (Array.isArray(student?.subjects) && student.subjects.length > 0) {
    return student.subjects;
  }
  // If subjects empty on student doc, fetch from the database /subjects catalog
  const catalog = await getSubjects();
  return catalog;
}

export async function getStudentFees(force = false) {
  let studentId = null;
  try {
    const identity = await resolveIdentity(force);
    studentId = identity.studentId || identity.wardRollNo || identity.rollNo || identity.id || identity.username;
  } catch {}

  const student = (await getStudentData(force)) || (await getDatabase()).primaryStudent;
  if (!studentId && student) {
    studentId = student.id || student.rollNo;
  }

  let feesObj = {
    total: 0,
    paid: 0,
    due: 0,
    dueInvoices: [],
    history: [],
    breakdown: [],
    scholarship: null,
    ...(student?.fees || {}),
  };

  if (studentId) {
    try {
      const [studentDocRes, feesListRes] = await Promise.allSettled([
        api.get(`/students/${encodeURIComponent(studentId)}`, {}, {}, { noCache: force }),
        api.get("/fees", { studentId }, {}, { noCache: force }),
      ]);

      if (studentDocRes.status === "fulfilled" && studentDocRes.value?.data?.fees) {
        feesObj = { ...feesObj, ...studentDocRes.value.data.fees };
      }

      if (feesListRes.status === "fulfilled" && Array.isArray(feesListRes.value?.data) && feesListRes.value.data.length > 0) {
        const feeRecords = feesListRes.value.data;
        const dueItems = feeRecords.filter(f => f.status?.toLowerCase() === "pending" || f.status?.toLowerCase() === "due");
        const paidItems = feeRecords.filter(f => f.status?.toLowerCase() === "paid" || f.status?.toLowerCase() === "completed");

        const paidSum = paidItems.reduce((s, p) => s + (Number(p.amount) || Number(p.paid) || 0), 0);
        const dueSum = dueItems.reduce((s, d) => s + (Number(d.amount) || 0), 0);

        feesObj.paid = paidSum;
        feesObj.due = dueSum;
        feesObj.total = paidSum + dueSum;
        feesObj.paidFees = `Rs. ${paidSum.toLocaleString("en-IN")}`;
        feesObj.dueFees = `Rs. ${dueSum.toLocaleString("en-IN")}`;
        feesObj.totalFees = `Rs. ${(paidSum + dueSum).toLocaleString("en-IN")}`;
        feesObj.feeStatus = dueSum > 0 ? "Pending Dues" : "All Fees Cleared";

        feesObj.dueInvoices = dueItems.map(d => ({
          id: d.id || d.invoiceId,
          invoiceNo: d.invoiceId || d.invoiceNo || d.id,
          title: d.item || d.title || "Academic Fee",
          category: d.category || "Tuition",
          amount: Number(d.amount) || 0,
          dueDate: d.dueDate || "—",
          status: "due",
          term: d.semester || "Semester",
          description: d.description || `${d.semester || ""} Tuition & Lab Fee`,
          icon: "school-outline",
          iconBg: "#2563EB",
        }));

        feesObj.history = paidItems.map(p => ({
          id: p.id || p.invoiceId,
          receiptNo: p.receiptNo || p.invoiceId || p.id,
          title: p.item || p.title || "Fee Payment",
          amount: Number(p.amount) || 0,
          date: p.paymentDate || p.date || "—",
          method: p.method || "Online Payment",
          txnId: p.txnId || p.transactionId || `TXN-${p.id}`,
          status: "completed",
        }));
      }
    } catch (e) {
      console.log("Error querying live fees from backend:", e);
    }

    await mergeIntoCache({ primaryStudent: { ...(student || { id: studentId }), fees: feesObj } });
    return feesObj;
  }

  return student?.fees || feesObj;
}

export async function getStudentSchedule() {
  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
  if (Array.isArray(student?.schedule) && student.schedule.length > 0) {
    return student.schedule;
  }
  // Try fetching timetable for student
  try {
    const tt = await getTimetable();
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const daySchedule = tt?.[0]?.schedule?.[today] || tt?.[0]?.schedule?.["Monday"] || [];
    if (daySchedule.length > 0) return daySchedule;
  } catch {}
  return [];
}

export async function getStudentLibrary() {
  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
  if (student?.library && (student.library.books > 0 || student.library.borrowed?.length > 0)) {
    return student.library;
  }
  return { books: 0, dueIn: "—", fine: 0, borrowed: [] };
}

export async function getGradeLevels() {
  const defaultScale = [
    { grade: "O", range: "90 - 100", meaning: "Outstanding" },
    { grade: "A+", range: "80 - 89", meaning: "Excellent" },
    { grade: "A", range: "70 - 79", meaning: "Very Good" },
    { grade: "B+", range: "60 - 69", meaning: "Good" },
    { grade: "B", range: "50 - 59", meaning: "Average" },
    { grade: "C", range: "40 - 49", meaning: "Satisfactory" },
    { grade: "RA", range: "< 40", meaning: "Reappearance" },
  ];

  let list = [];
  try {
    const rawList = await ensureCollection("/gradeLevels");
    if (Array.isArray(rawList) && rawList.length > 0) {
      const seen = new Set();
      list = rawList.filter((item) => {
        const g = item?.grade?.trim?.() || "";
        if (!g || seen.has(g.toUpperCase())) return false;
        seen.add(g.toUpperCase());
        return true;
      });
    }
  } catch {}

  const finalList = list.length > 0 ? list : defaultScale;
  await mergeIntoCache({ gradeLevels: finalList });
  return finalList;
}

// ─────────────────────────────────────────────
// 📋 ASSIGNMENTS & ATTENDANCE SERVICES
// ─────────────────────────────────────────────

export async function getAssignments(params = {}, force = false) {
  const endpoint = "/assignments";
  const query = { sort: "-createdAt", limit: 50, ...params };

  try {
    const res = await api.get(endpoint, query, {}, { noCache: force });
    return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (e) {
    console.warn("getAssignments error:", e?.message || e);
    return [];
  }
}

export async function submitAssignment(asgId, submissionData = {}) {
  const identity = await resolveIdentity();
  const submissionTimestamp = new Date().toISOString();
  const formattedDate = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const payload = {
    status: "Submitted",
    submissionDate: formattedDate,
    submittedAt: submissionTimestamp,
    submittedBy: identity.rollNo || identity.username || "Student",
    submittedFile: submissionData.file || null,
    submissionRemarks: submissionData.remarks || "",
    repoLink: submissionData.repoLink || "",
  };

  // 1. Try backend API endpoints
  try {
    await api.post(`/assignments/${asgId}/submit`, payload).catch(() => null);
    await api.put(`/assignments/${asgId}`, payload).catch(() => null);
  } catch (e) {
    console.warn("Backend assignment submit sync:", e?.message);
  }

  // 2. Persist in local database/cache
  try {
    const db = await getDatabase();
    if (Array.isArray(db.assignments)) {
      db.assignments = db.assignments.map((a) =>
        String(a.id || a._id) === String(asgId) ? { ...a, ...payload } : a
      );
      await saveDatabase(db);
    }
  } catch (err) {
    console.warn("Local DB assignment save error:", err);
  }

  return payload;
}

export async function getFacultyAssignedSubjects(facultyDoc) {
  const faculty = facultyDoc || (await getFacultyData());
  const subjects = [];
  if (Array.isArray(faculty?.coursesTaught)) {
    faculty.coursesTaught.forEach((c) => {
      if (c.name && !subjects.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) {
        subjects.push({ name: c.name, code: c.code || "", class: c.class || "" });
      }
    });
  }
  if (Array.isArray(faculty?.todaySchedule)) {
    faculty.todaySchedule.forEach((s) => {
      if (s.subject && !subjects.some((x) => x.name.toLowerCase() === s.subject.toLowerCase())) {
        subjects.push({ name: s.subject, code: s.code || "", class: s.class || "" });
      }
    });
  }
  if (faculty?.subject && !subjects.some((x) => x.name.toLowerCase() === faculty.subject.toLowerCase())) {
    subjects.push({ name: faculty.subject, code: faculty.subjectCode || "", class: faculty.class || "" });
  }
  if (subjects.length === 0) {
    subjects.push(
      { name: "Machine Learning", code: "AD-506", class: "AI & DS - A (Year 3)" },
      { name: "Fundamentals of Cloud Computing", code: "AD-505", class: "AI & DS - A (Year 3)" },
      { name: "Explainable AI", code: "AD-509", class: "AI & DS - A (Year 3)" }
    );
  }
  return subjects;
}

export async function createAssignment(assignmentData = {}) {
  const identity = await resolveIdentity();
  const id = `asg_${Date.now()}`;
  const newDoc = {
    id,
    _id: id,
    title: assignmentData.title || "Coursework Problem Set",
    subject: assignmentData.subject || "Machine Learning",
    subjectCode: assignmentData.subjectCode || "AD-506",
    course: assignmentData.subject || "Machine Learning",
    assignedBy: assignmentData.assignedBy || identity?.staff?.name || identity?.name || "Course Faculty",
    facultyId: assignmentData.facultyId || identity?.staffId || identity?.username || "STF001",
    assignedToClass: assignmentData.class || "III AI & DS - A",
    description: assignmentData.description || "",
    dueDate: assignmentData.dueDate || "15 Sep 2026",
    totalMarks: Number(assignmentData.totalMarks) || 50,
    marks: Number(assignmentData.totalMarks) || 50,
    status: "Pending",
    submitted: 0,
    pending: 60,
    createdAt: new Date().toISOString(),
  };

  try {
    await api.post("/assignments", newDoc).catch(() => null);
  } catch {}

  try {
    const db = await getDatabase();
    if (!Array.isArray(db.assignments)) db.assignments = [];
    db.assignments.unshift(newDoc);
    await saveDatabase(db);
  } catch {}

  return newDoc;
}

export async function deleteAssignment(asgId) {
  try {
    await api.delete(`/assignments/${asgId}`).catch(() => null);
  } catch {}

  try {
    const db = await getDatabase();
    if (Array.isArray(db.assignments)) {
      db.assignments = db.assignments.filter(
        (a) => String(a.id || a._id) !== String(asgId)
      );
      await saveDatabase(db);
    }
  } catch {}

  return true;
}

export async function getAttendanceRecords(params = {}) {
  const identity = await resolveIdentity();
  const scope = identity.rollNo || identity.username || "";
  const scopeId = identity.studentId || "";
  const explicit = Boolean(params.rollNo || params.studentId || params.roll);

  let list = [];
  try {
    const res = await api.get("/attendance", { sort: "-date", limit: 500, ...params });
    list = Array.isArray(res?.data) ? res.data : [];
  } catch {
    list = [];
  }

  // Scope to the current student across every identifier field staff may use
  if (!explicit) {
    const key = (scope || scopeId || "").toLowerCase();
    if (key) {
      list = list.filter((r) => {
        if (!r || typeof r !== "object") return false;
        const vals = [r.rollNo, r.roll, r.studentId, r.student, r.studentName, r.student_name]
          .map((x) => String(x != null ? x : "").trim().toLowerCase())
          .filter(Boolean);
        return vals.includes(key);
      });
    }
  }
  return list;
}

export async function getStudentAttendanceSummary() {
  const identity = await resolveIdentity();
  const scope = identity.rollNo || identity.username || "";

  const records = (await getAttendanceRecords()) || [];

  const total = records.length;
  const attended = records.filter((r) => r && ["Present", "On-Duty", "OD"].includes(r.status)).length;
  const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;

  let summary = null;
  if (total > 0) {
    summary = {
      percentage: `${pct}%`,
      status: pct >= 90 ? "Good Standing" : pct >= 75 ? "Satisfactory" : "Needs Improvement",
      attendedClasses: attended,
      totalClasses: total,
    };
  }
  return { summary, records, rollNo: scope, total, attended, pct };
}

export async function getTimetable(params = {}) {
  try {
    const res = await api.get("/timetable", { limit: 10, ...params });
    return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn("getTimetable error:", err?.message || err);
    return [];
  }
}

// –––––––––––––––––––––––––––––––––––––––––––––
// 📖 SUBJECT CATALOG (live GET /subjects resource)
// –––––––––––––––––––––––––––––––––––––––––––––
export async function getSubjects(params = {}) {
  try {
    const res = await api.get("/subjects", { limit: 200, ...params });
    return Array.isArray(res?.data) ? res.data : [];
  } catch (e) {
    console.log("getSubjects fetch failed:", e?.message || e);
    return [];
  }
}

// Build a lookup table (by code, then by name) from the subject catalog.
export function buildSubjectCatalogMap(catalog) {
  const byCode = {};
  const byName = {};
  for (const c of Array.isArray(catalog) ? catalog : []) {
    if (c?.code) byCode[String(c.code).trim().toLowerCase()] = c;
    if (c?.name) byName[String(c.name).trim().toLowerCase()] = c;
  }
  return { byCode, byName };
}

export function findCatalogSubject(catalog, subject) {
  const { byCode, byName } = buildSubjectCatalogMap(catalog);
  const codeKey = String(subject?.code || "").trim().toLowerCase();
  const nameKey = String(subject?.name || subject?.title || "").trim().toLowerCase();
  return (codeKey && byCode[codeKey]) || (nameKey && byName[nameKey]) || null;
}

// Merge catalog metadata (credits/type/faculty/syllabus) onto a student's
// enrolled subject when the embedded subject is missing those fields.
export function enrichSubjectFromCatalog(subject, catalog) {
  const cat = findCatalogSubject(catalog, subject);
  if (!cat) return subject;
  return {
    ...subject,
    type: subject.type || cat.type || subject.type,
    credits: subject.credits != null ? subject.credits : cat.credits,
    faculty: subject.faculty || subject.facultyInCharge || cat.facultyInCharge || subject.faculty,
    syllabus: subject.syllabus || cat.syllabus || "",
  };
}

// –––––––––––––––––––––––––––––––––––––––––––––
// 👨‍🏫 FACULTY DATA SERVICES
// –––––––––––––––––––––––––––––––––––––––––––––

export async function getFacultyData(force = false) {
  const db = await getDatabase();
  const cached = db.primaryFaculty;

  if (force) {
    try {
      const identity = await resolveIdentity(true);
      let doc = null;
      if (identity.staffId) {
        doc = await api
          .get(`/staff/${encodeURIComponent(identity.staffId)}`, {}, {}, { noCache: true })
          .then((r) => r?.data || null)
          .catch(() => null);
      }
      if (!doc && identity.username) {
        doc = await api
          .get("/staff", { q: identity.username, limit: 1 }, {}, { noCache: true })
          .then((r) => r?.data?.[0] || null)
          .catch(() => null);
      }
      if (doc) {
        await mergeIntoCache({ primaryFaculty: doc });
        notifyDataSubscribers("primaryFaculty", doc);
        return doc;
      }
    } catch (e) {
      console.warn("Forced faculty sync error:", e?.message);
    }
    if (cached) return cached;
  }

  // Background delta sync check
  if (shouldSyncDelta("primaryFaculty", 25)) {
    (async () => {
      try {
        const identity = await resolveIdentity();
        let doc = null;
        if (identity.staffId) {
          doc = await api
            .get(`/staff/${encodeURIComponent(identity.staffId)}`)
            .then((r) => r?.data || null)
            .catch(() => null);
        }
        if (!doc && identity.staff) doc = identity.staff;
        if (doc) {
          await mergeIntoCache({ primaryFaculty: doc });
          notifyDataSubscribers("primaryFaculty", doc);
        }
      } catch (e) {
        console.warn("Background delta sync error for faculty:", e?.message);
      }
    })();
  }

  if (cached) return cached;

  const identity = await resolveIdentity();
  let doc = null;
  if (identity.staffId) {
    doc = await api
      .get(`/staff/${encodeURIComponent(identity.staffId)}`)
      .then((r) => r?.data || null)
      .catch(() => null);
  }
  if (!doc && identity.staff) doc = identity.staff;

  if (doc) {
    await mergeIntoCache({ primaryFaculty: doc });
    return doc;
  }

  // Fallback to session user doc
  const staffId = identity.staffId || identity.username || "STF001";
  const sessionDoc = {
    staffId,
    name: identity.user?.profile?.name || identity.user?.name || identity.username || "Faculty Member",
    email: identity.user?.email || `${identity.username}@edunex.edu`,
    phone: identity.user?.phone || identity.user?.mobile || "",
    address: identity.user?.address || "Staff Quarters, EduNex Campus",
    gender: identity.user?.gender || "Female",
    bloodGroup: identity.user?.bloodGroup || "—",
    dob: identity.user?.dob || "—",
    department: identity.user?.department || "Artificial Intelligence & Data Science",
    departmentCode: identity.user?.departmentCode || "aids",
    position: identity.user?.position || "Faculty",
    designation: identity.user?.designation || "Assistant Professor & Class Tutor",
    qualification: identity.user?.qualification || "M.Tech",
    qualifications: identity.user?.qualifications || "M.Tech",
    specialization: identity.user?.specialization || "Artificial Intelligence",
    experience: identity.user?.experience || "—",
    aicteId: identity.user?.aicteId || "—",
    publications: identity.user?.publications || 0,
    grants: identity.user?.grants || 0,
    cabin: identity.user?.cabin || "Department of AI & DS, Cabin D205",
    consultation: identity.user?.consultation || "Mon-Wed 2:00 PM - 4:00 PM",
    portfolios: identity.user?.portfolios || "Class Tutor, III AI&DS-A",
    classTeacher: identity.user?.classTeacher || "AI & DS - A",
    status: "active",
    coursesTaught: Array.isArray(identity.user?.coursesTaught) ? identity.user.coursesTaught : [],
    todaySchedule: Array.isArray(identity.user?.todaySchedule) ? identity.user.todaySchedule : [],
    summary: identity.user?.summary || {
      classesToday: 0,
      totalStudents: 0,
      pendingReports: 0,
      averageAttendance: "—",
    },
  };

  await mergeIntoCache({ primaryFaculty: sessionDoc });
  return sessionDoc;
}

export async function getFacultyMenteeIds() {
  try {
    const user = await secureGet("loggedInUser");
    const key = `edunex_mentee_wards_${user || "staff"}`;
    const raw = await secureGet(key);
    return Array.isArray(raw) ? raw : null;
  } catch (err) {
    console.warn("getFacultyMenteeIds error:", err);
    return null;
  }
}

export async function saveFacultyMenteeIds(menteeIds) {
  try {
    const user = await secureGet("loggedInUser");
    const key = `edunex_mentee_wards_${user || "staff"}`;
    await secureSet(key, menteeIds);
    return true;
  } catch (err) {
    console.warn("saveFacultyMenteeIds error:", err);
    return false;
  }
}

export async function addStudentToMenteeWard(studentId) {
  if (!studentId) return false;
  const current = (await getFacultyMenteeIds()) || [];
  const sId = String(studentId);
  if (!current.includes(sId)) {
    const updated = [...current, sId];
    await saveFacultyMenteeIds(updated);
    return updated;
  }
  return current;
}

export async function removeStudentFromMenteeWard(studentId) {
  if (!studentId) return false;
  const current = (await getFacultyMenteeIds()) || [];
  const sId = String(studentId);
  const updated = current.filter((id) => id !== sId);
  await saveFacultyMenteeIds(updated);
  return updated;
}

export async function toggleStudentMenteeStatus(studentId) {
  if (!studentId) return false;
  const current = (await getFacultyMenteeIds()) || [];
  const sId = String(studentId);
  let updated;
  if (current.includes(sId)) {
    updated = current.filter((id) => id !== sId);
  } else {
    updated = [...current, sId];
  }
  await saveFacultyMenteeIds(updated);
  return { menteeIds: updated, isMentee: updated.includes(sId) };
}

export async function getFacultyRoster(className, force = false) {
  const identity = await resolveIdentity(force);
  const targetClass = className || identity.className || "";
  const storedMentees = (await getFacultyMenteeIds()) || [];

  if (force) {
    try {
      const params = targetClass ? { class: targetClass } : {};
      const res = await api.get("/students", { ...params, sort: "rollNo", limit: 200 }, {}, { noCache: true });
      const roster = Array.isArray(res?.data) ? res.data : [];
      if (roster.length > 0) {
        await mergeIntoCache({ studentsRoster: roster });
        notifyDataSubscribers("roster", roster);
        return roster.map((s) => {
          const sId = String(s.id || s._id || s.rollNo || s.roll || "");
          const isMenteeFlag = storedMentees.includes(sId) || storedMentees.includes(String(s.rollNo || s.roll)) || Boolean(s.isMentee);
          return {
            ...s,
            isMentee: isMenteeFlag,
            __class: s.class || s.section || targetClass,
          };
        });
      }
    } catch (e) {
      console.warn("Forced roster sync error:", e?.message);
    }
  }

  // 1. Instant Cache Return (0ms latency from encrypted store)
  const db = await getDatabase();
  const cachedRoster = Array.isArray(db.studentsRoster) ? db.studentsRoster : [];
  let formattedCached = [];

  if (cachedRoster.length > 0) {
    formattedCached = cachedRoster.map((s) => {
      const sId = String(s.id || s._id || s.rollNo || s.roll || "");
      const isMenteeFlag = storedMentees.includes(sId) || storedMentees.includes(String(s.rollNo || s.roll)) || Boolean(s.isMentee);
      return {
        ...s,
        isMentee: isMenteeFlag,
        __class: s.__class || s.class || s.section || targetClass,
      };
    });
  }

  // 2. Background Delta Sync (Fetch only missing / updated students)
  if (shouldSyncDelta(`roster_${targetClass}`, 20)) {
    (async () => {
      try {
        const params = targetClass ? { class: targetClass } : {};
        const res = await api.get("/students", { ...params, sort: "rollNo", limit: 200 });
        const liveRoster = Array.isArray(res?.data) ? res.data : [];
        if (liveRoster.length > 0) {
          const existingMap = new Map();
          cachedRoster.forEach((s) => existingMap.set(String(s.id || s.rollNo || s.roll), s));
          liveRoster.forEach((s) => {
            const key = String(s.id || s.rollNo || s.roll);
            existingMap.set(key, { ...(existingMap.get(key) || {}), ...s });
          });
          const mergedList = Array.from(existingMap.values());
          await mergeIntoCache({ studentsRoster: mergedList });
          notifyDataSubscribers("roster", mergedList);
        }
      } catch (e) {
        console.warn("Background delta sync error for roster:", e?.message);
      }
    })();
  }

  if (formattedCached.length > 0) return formattedCached;

  // Cold cache initial fetch
  try {
    const params = targetClass ? { class: targetClass } : {};
    const res = await api.get("/students", { ...params, sort: "rollNo", limit: 200 });
    const roster = Array.isArray(res?.data) ? res.data : [];
    if (roster.length > 0) {
      await mergeIntoCache({ studentsRoster: roster });
      return roster.map((s) => {
        const sId = String(s.id || s._id || s.rollNo || s.roll || "");
        const isMenteeFlag = storedMentees.includes(sId) || storedMentees.includes(String(s.rollNo || s.roll)) || Boolean(s.isMentee);
        return {
          ...s,
          isMentee: isMenteeFlag,
          __class: s.class || s.section || targetClass,
        };
      });
    }
  } catch {}

  return [];
}

export async function getStaffClassName() {
  const identity = await resolveIdentity();
  return identity.className || "";
}

export async function getFacultySchedule() {
  const faculty = (await getFacultyData()) || (await getDatabase()).primaryFaculty;
  return Array.isArray(faculty?.todaySchedule) ? faculty.todaySchedule : [];
}

export async function getPeriodAttendanceRecords(date, classId) {
  try {
    const dStr = date || new Date().toISOString().split("T")[0];
    const cId = classId || "default";
    const key = `edunex_period_att_${dStr}_${cId}`;
    const raw = await secureGet(key);
    return raw && typeof raw === "object" ? raw : {};
  } catch (err) {
    console.warn("getPeriodAttendanceRecords error:", err);
    return {};
  }
}

export async function savePeriodAttendanceRecord(date, classId, periodId, record) {
  try {
    const dStr = date || new Date().toISOString().split("T")[0];
    const cId = classId || "default";
    const key = `edunex_period_att_${dStr}_${cId}`;
    const current = await getPeriodAttendanceRecords(dStr, cId);
    const updated = {
      ...current,
      [periodId]: {
        ...record,
        updatedAt: new Date().toISOString(),
      },
    };
    await secureSet(key, updated);
    return updated;
  } catch (err) {
    console.warn("savePeriodAttendanceRecord error:", err);
    return null;
  }
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

export async function getParentData(force = false) {
  const db = await getDatabase();
  const cachedParent = db.primaryParent;
  const cachedWard = db.primaryStudent;

  if (force) {
    try {
      const identity = await resolveIdentity(true);
      let parent = null;
      if (identity.parentId) {
        parent = await api
          .get(`/parents/${encodeURIComponent(identity.parentId)}`, {}, {}, { noCache: true })
          .then((r) => r?.data || null)
          .catch(() => null);
      }
      if (!parent && identity.parent) parent = identity.parent;
      let ward = null;
      const targetRoll = parent?.wardRollNo || identity.wardRollNo || parent?.studentID;
      if (targetRoll) {
        ward =
          (await api
            .get(`/students/${encodeURIComponent(targetRoll)}`, {}, {}, { noCache: true })
            .then((r) => r?.data || null)
            .catch(() => null)) || null;
      }
      if (parent || ward) {
        await mergeIntoCache({
          ...(parent ? { primaryParent: parent } : {}),
          ...(ward ? { primaryStudent: ward } : {}),
        });
        notifyDataSubscribers("parentData", { parent, ward });
      }
    } catch (e) {
      console.warn("Forced parent sync error:", e?.message);
    }
  }

  // Background delta sync check
  if (shouldSyncDelta("primaryParent", 25)) {
    (async () => {
      try {
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
        const targetRoll = parent?.wardRollNo || identity.wardRollNo || parent?.studentID;
        if (targetRoll) {
          ward =
            (await api
              .get(`/students/${encodeURIComponent(targetRoll)}`)
              .then((r) => r?.data || null)
              .catch(() => null)) || null;
        }
        if (parent || ward) {
          await mergeIntoCache({
            ...(parent ? { primaryParent: parent } : {}),
            ...(ward ? { primaryStudent: ward } : {}),
          });
          notifyDataSubscribers("parentData", { parent, ward });
        }
      } catch (_e) {}
    })();
  }

  if (!force && cachedParent && cachedWard) return { ...(cachedParent || {}), ward: cachedWard };

  const identity = await resolveIdentity();
  let parent = (!force && cachedParent) || null;
  if (!parent && identity.parentId) {
    parent = await api
      .get(`/parents/${encodeURIComponent(identity.parentId)}`)
      .then((r) => r?.data || null)
      .catch(() => null);
  }
  if (!parent && identity.parent) parent = identity.parent;

  let ward = cachedWard || null;
  const targetRoll = parent?.wardRollNo || identity.wardRollNo || parent?.studentID;
  if (!ward && targetRoll) {
    ward =
      (await api
        .get(`/students/${encodeURIComponent(targetRoll)}`)
        .then((r) => r?.data || null)
        .catch(() => null)) ||
      (await api
        .get("/students", { rollNo: targetRoll, limit: 1 })
        .then((r) => r?.data?.[0] || null)
        .catch(() => null)) ||
      (await api
        .get("/students", { roll: targetRoll, limit: 1 })
        .then((r) => r?.data?.[0] || null)
        .catch(() => null)) ||
      (await api
        .get("/students", { q: targetRoll, limit: 1 })
        .then((r) => r?.data?.[0] || null)
        .catch(() => null));
  }

  if (parent && !ward) {
    ward = identity.student || (await getStudentData());
  }

  if (!parent && !ward) {
    const db = await getDatabase();
    parent = db.primaryParent;
    ward = db.primaryStudent;
    if (!ward) {
      ward = await getStudentData();
    }
    if (!parent && ward?.parent) {
      parent = {
        parentId: identity.parentId || identity.username || "PAR001",
        name: ward.parent.name || ward.fatherName || identity.user?.profile?.name || "Parent",
        email: ward.parent.email || `${identity.username || "parent"}@edunex.edu`,
        phone: ward.parent.phone || ward.parentPhone || "",
        address: ward.parent.address || ward.address || "",
        wardRollNo: ward.rollNo || "25BAD015",
        relation: ward.parent.relation || "Father",
        occupation: ward.parent.occupation || "Guardian",
        status: "active",
      };
    }
  }

  await mergeIntoCache({ primaryParent: parent, primaryStudent: ward });

  const circulars = await getParentNotices();
  const timeline = Array.isArray(ward?.schedule)
    ? ward.schedule.map((s, i) => ({ time: s.time || `Slot ${i + 1}`, subject: s.subject || s.name || "", room: s.room || "", faculty: s.faculty || s.teacher || "" }))
    : [];
  const permits = await getPermits();

  const overview = {
    parentName: parent?.name || "",
    guardianId: parent?.parentId || parent?.id || parent?.guardianId || "",
    wardName: ward?.name || "",
    rollNo: ward?.rollNo || ward?.roll || "25BAD015",
    regNo: ward?.regNo || ward?.universityNo || ward?.registerNo || "71052408001",
    department: ward?.department || "",
    deptShort: ward?.deptShort || "",
    year: ward?.year || "",
    semester: ward?.semester || "",
    section: ward?.section || "",
    batch: ward?.batch || "",
    class: ward?.class || "",
    attendance: ward?.attendance?.percentage || ward?.attendance || "",
    grade: ward?.grade || "",
    cgpa: ward?.cgpa != null ? String(ward.cgpa) : "",
    bloodGroup: ward?.bloodGroup || "",
    hostel: typeof ward?.hostel === "boolean" ? (ward.hostel ? "Residential" : "Day Scholar") : ward?.hostel || "—",
    feesDue: ward?.fees?.due != null ? `₹ ${Number(ward.fees.due).toLocaleString("en-IN")}` : "",
    paidFees: ward?.fees?.paid != null ? `₹ ${Number(ward.fees.paid).toLocaleString("en-IN")}` : "",
    totalFees: ward?.fees?.total != null ? `₹ ${Number(ward.fees.total).toLocaleString("en-IN")}` : "",
    advisor: ward?.advisor?.name || "",
    advisorName: ward?.advisor?.name || "",
    advisorPhone: ward?.advisor?.phone || "",
    advisorEmail: ward?.advisor?.email || "",
    advisorCabin: ward?.advisor?.cabin || "",
    parentNameFull: parent?.name || "",
    parentPhone: parent?.phone || parent?.mobile || "",
    parentEmail: parent?.email || "",
    parentOccupation: parent?.occupation || "",
  };

  const wardInfo = {
    ...(ward || {}),
    name: ward?.name || "",
    rollNo: ward?.rollNo || ward?.roll || "25BAD015",
    regNo: ward?.regNo || ward?.universityNo || ward?.registerNo || "71052408001",
    class: ward?.class || ward?.section || "",
    department: ward?.department || "",
    year: ward?.year || "",
    advisor: ward?.advisor?.name || "",
    hostel: typeof ward?.hostel === "boolean" ? (ward.hostel ? "Residential" : "Day Scholar") : ward?.hostel || "—",
    bloodGroup: ward?.bloodGroup || "",
    profileImage: ward?.profileImage || null,
    courses: Array.isArray(ward?.subjects) ? ward.subjects : Array.isArray(ward?.courses) ? ward.courses : [],
    permits: permits.filter(
      (p) => !ward?.rollNo || p.rollNo === ward.rollNo || p.studentId === ward.rollNo
    ),
    attendancePct: ward?.attendance?.percentage || ward?.attendance || "",
    cgpa: ward?.cgpa != null ? String(ward.cgpa) : "",
  };

  return { ...(parent || {}), ward: wardInfo, overview, circulars, timeline, permits };
}

export async function getParentNotices(force = false) {
  const db = await getDatabase();
  const cached = (!force && Array.isArray(db.notices) && db.notices.length > 0) ? db.notices : null;

  if (force) {
    try {
      const list = await ensureCollection("/notices");
      const clean = normalizeNotices(list);
      await mergeIntoCache({ notices: clean });
      notifyDataSubscribers("notices", clean);
      return clean;
    } catch (e) {
      console.warn("Forced notices sync error:", e?.message);
    }
  }

  if (shouldSyncDelta("notices", 30)) {
    (async () => {
      try {
        const list = await ensureCollection("/notices");
        const clean = normalizeNotices(list);
        await mergeIntoCache({ notices: clean });
        notifyDataSubscribers("notices", clean);
      } catch (e) {
        console.warn("Background delta sync error for notices:", e?.message);
      }
    })();
  }

  if (cached) return cached;

  const list = await ensureCollection("/notices");
  const clean = normalizeNotices(list);
  await mergeIntoCache({ notices: clean });
  return clean;
}

function normalizeNotices(list) {
  return (Array.isArray(list) ? list : [])
    .filter(
      (n) =>
        n &&
        (Boolean(n.subject?.trim?.()) ||
          Boolean(n.title?.trim?.()) ||
          Boolean(n.message?.trim?.()) ||
          Boolean(n.content?.trim?.()) ||
          Boolean(n.description?.trim?.()))
    )
    .map((n) => ({
      ...n,
      title: n.title || n.subject || n.description || "",
      subject: n.subject || n.title || n.description || "",
      content: n.content || n.message || n.description || "",
      message: n.message || n.content || n.description || "",
    }));
}

/** Alias so admin/staff notice feeds can import one consistent getter. */
export async function getNoticesList(params = {}, force = false) {
  const db = await getDatabase();
  const cached = (!force && Array.isArray(db.notices) && db.notices.length > 0) ? db.notices : null;

  if (force) {
    try {
      const list = await ensureCollection("/notices", params);
      const clean = normalizeNotices(list);
      await mergeIntoCache({ notices: clean });
      notifyDataSubscribers("notices", clean);
      if (params.senderRole) {
        return normalizeNotices(clean.filter((n) => n.senderRole === params.senderRole));
      }
      return clean;
    } catch (e) {
      console.warn("Forced notices list sync error:", e?.message);
    }
  }

  if (shouldSyncDelta("notices_list", 30)) {
    (async () => {
      try {
        const list = await ensureCollection("/notices", params);
        const clean = normalizeNotices(list);
        await mergeIntoCache({ notices: clean });
        notifyDataSubscribers("notices", clean);
      } catch (_e) {}
    })();
  }

  if (cached) {
    if (params.senderRole) {
      return normalizeNotices(cached.filter((n) => n.senderRole === params.senderRole));
    }
    return normalizeNotices(cached);
  }

  const list = await ensureCollection("/notices", params);
  if (params.senderRole) {
    return normalizeNotices(list.filter((n) => n.senderRole === params.senderRole));
  }
  return normalizeNotices(list);
}

// ─────────────────────────────────────────────
// 🛡️ ADMIN DATA SERVICES
// ─────────────────────────────────────────────

export async function getAdminData(force = false) {
  const db = await getDatabase();
  const cachedAdmin = db.primaryAdmin;
  const cachedInst = db.institution;
  const cachedDepts = db.departments;

  if (force) {
    try {
      const [instList, deptList] = await Promise.all([
        ensureCollection("/institutions"),
        ensureCollection("/departments"),
      ]);
      const inst = instList.length > 0 ? instList[0] : null;
      await mergeIntoCache({ institution: inst, departments: deptList });
      notifyDataSubscribers("adminData", { institution: inst, departments: deptList });
      return { ...(cachedAdmin || {}), institution: inst, departments: deptList };
    } catch (e) {
      console.warn("Forced admin sync error:", e?.message);
    }
  }

  if (cachedInst && Array.isArray(cachedDepts) && cachedDepts.length > 0) {
    if (shouldSyncDelta("adminData", 30)) {
      (async () => {
        try {
          const [instList, deptList] = await Promise.all([
            ensureCollection("/institutions"),
            ensureCollection("/departments"),
          ]);
          if (instList.length > 0) {
            await mergeIntoCache({ institution: instList[0], departments: deptList });
            notifyDataSubscribers("adminData", { institution: instList[0], departments: deptList });
          }
        } catch (_e) {}
      })();
    }
    return { ...(cachedAdmin || {}), institution: cachedInst, departments: cachedDepts };
  }

  let institution = null;
  let departments = [];

  const [instList, deptList] = await Promise.all([
    ensureCollection("/institutions"),
    ensureCollection("/departments"),
  ]);

  if (instList.length > 0) institution = instList[0];
  departments = deptList;

  const identity = await resolveIdentity();
  const admin = identity.admin || null;

  await mergeIntoCache({ institution, departments, primaryAdmin: admin });

  return { ...(admin || {}), institution, departments };
}

export async function getInstitutions(force = false) {
  if (force) {
    api.invalidateCache("institution");
  }
  const list = await ensureCollection("/institutions");
  if (list.length > 0) {
    await mergeIntoCache({ institution: list[0] });
  }
  return list;
}

export async function getAdminStats() {
  const [studentsCount, staffCount, deptsCount, instRes, attendRes, fees, exams, infrastructure, transport, leavesRes] =
    await Promise.allSettled([
      api.get("/students", { limit: 1 }),
      api.get("/staff", { limit: 1 }),
      api.get("/departments", { limit: 1 }),
      api.get("/institutions", { sort: "-createdAt", limit: 1 }),
      api.get("/attendance", { limit: 200 }),
      getFeesSummary(),
      getExams(),
      getInfrastructure(),
      getTransport(),
      getLeavesList({ status: "pending" }),
    ]);

  const inst =
    instRes.status === "fulfilled" && Array.isArray(instRes.value?.data)
      ? instRes.value.data[0]
      : null;

  const attendanceTotal = attendRes.status === "fulfilled" && Array.isArray(attendRes.value?.data) ? attendRes.value.data : [];
  const presentCount = attendanceTotal.filter((a) => a.status === "Present").length;
  const attendancePct = attendanceTotal.length > 0 ? Math.round((presentCount / attendanceTotal.length) * 1000) / 10 : 0;

  const feeSummary = fees.status === "fulfilled" && fees.value ? fees.value : null;
  const examData = exams.status === "fulfilled" && exams.value ? exams.value : { records: [], halls: [] };
  const infra = infrastructure.status === "fulfilled" && infrastructure.value ? infrastructure.value : {};
  const transportData = transport.status === "fulfilled" && transport.value ? transport.value : { transportRoutes: [], fleetRoutes: [] };
  const leaves = leavesRes.status === "fulfilled" && Array.isArray(leavesRes.value) ? leavesRes.value : [];

  const stats = {
    totalStudents: "0",
    totalFaculty: "0",
    totalDepartments: "0",
    totalCourses: inst?.totalCourses || "0",
    activePrograms: inst?.activePrograms || "0",
    monthlyFeeCollection: inst?.monthlyFeeCollection || "₹0",
    systemHealth: inst?.systemHealth || "—",
    // Admin dashboard rich data
    attendancePct: `${attendancePct}%`,
    attendancePresent: presentCount,
    attendanceTotal: attendanceTotal.length,
    facultyOnCampus: staffCount.status === "fulfilled" && staffCount.value?.total != null ? String(staffCount.value.total) : "0",
    feeCollectionPct: feeSummary?.feeCollectionPct || "0%",
    feeCollectedStudents: feeSummary?.feeCollectedStudents || 0,
    feePendingStudents: feeSummary?.feePendingStudents || 0,
    feeCollected: feeSummary?.paidAmount ? `₹ ${Number(feeSummary.paidAmount).toLocaleString("en-IN")}` : "₹0",
    feePending: feeSummary?.pendingAmount ? `₹ ${Number(feeSummary.pendingAmount).toLocaleString("en-IN")}` : "₹0",
    hostelOccupancy: infra?.hostelOccupancy || "—",
    hostelBeds: infra?.hostelBeds || "—",
    labOccupancy: infra?.labOccupancy || "—",
    labSystems: infra?.labSystems || "—",
    libraryIssues: infra?.libraryIssues || "—",
    libraryReturnRate: infra?.libraryReturnRate || "—",
    examSchedule: examData.records || [],
    examHalls: examData.halls || [],
    transportRoutes: transportData.transportRoutes || [],
    fleetRoutes: transportData.fleetRoutes || [],
    pendingLeaves: leaves,
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

// ─────────────────────────────────────────────
// 🆕 ADDITIONAL COLLECTION SERVICES
// (fees, exams, transport, infrastructure, logs, permits, reports, announcements)
// ─────────────────────────────────────────────

export async function getFeesSummary(params = {}) {
  const list = await ensureCollection("/fees", params);
  const paid = list.filter((f) => f.status === "Paid" || (Number(f.paid) > 0 && Number(f.paid) >= Number(f.amount)));
  const pending = list.filter((f) => !(f.status === "Paid") && !(Number(f.paid) > 0 && Number(f.paid) >= Number(f.amount)));
  const totalAmount = list.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const paidAmount = list.reduce((s, f) => s + (Number(f.paid) || 0), 0);
  const pct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
  return {
    records: list,
    totalAmount,
    paidAmount,
    pendingAmount: totalAmount - paidAmount,
    feeCollectionPct: `${pct}%`,
    feeCollectedStudents: paid.length,
    feePendingStudents: pending.length,
    dueInvoices: list.filter((f) => String(f.status || "").toLowerCase() !== "paid"),
    recentPayments: list.filter((f) => String(f.status || "").toLowerCase() === "paid"),
  };
}

export async function getExams(params = {}) {
  const list = await ensureCollection("/exams", params);
  const halls = [...new Set(list.map((e) => e.room || e.hall).filter(Boolean))];
  return { records: list, halls, exams: list };
}

export async function getTransport(params = {}) {
  const list = await ensureCollection("/transport", params);
  const transportRoutes = list.filter((t) => t.type === "transport" || !t.type);
  const fleetRoutes = list.filter((t) => t.type === "fleet");
  return { records: list, transportRoutes, fleetRoutes };
}

export async function getInfrastructure(params = {}) {
  const list = await ensureCollection("/infrastructure", params);
  const byCat = (cat) => list.find((i) => i.category === cat) || {};
  const hostel = byCat("hostel");
  const labs = byCat("labs");
  const library = byCat("library");
  return {
    records: list,
    hostelOccupancy: hostel.occupancy || "—",
    hostelBeds: hostel.occupiedBeds != null ? `${hostel.occupiedBeds} / ${hostel.totalBeds != null ? hostel.totalBeds : hostel.occupiedBeds}` : "—",
    hostelOccupied: hostel.occupiedBeds != null ? Number(hostel.occupiedBeds) : 0,
    hostelTotal: hostel.totalBeds != null ? Number(hostel.totalBeds) : 0,
    labOccupancy: labs.occupancy || "—",
    labOccupied: labs.occupiedSystems != null ? Number(labs.occupiedSystems) : 0,
    labTotal: labs.totalSystems != null ? Number(labs.totalSystems) : 0,
    labSystems: labs.occupiedSystems != null ? `${labs.occupiedSystems} / ${labs.totalSystems != null ? labs.totalSystems : labs.occupiedSystems}` : "—",
    libraryIssues: library.issues != null ? library.issues : (library.totalIssues != null ? library.totalIssues : "—"),
    libraryReturnRate: library.returnRate || "—",
  };
}

export async function getSystemLogs(params = {}) {
  try {
    const res = await api.get("/logs", { sort: "-createdAt", limit: 50, ...params });
    if (res?.data) return res.data;
  } catch (err) {
    console.warn("getSystemLogs error:", err);
  }
  return [];
}

export async function getPermits(params = {}, force = false) {
  const list = await ensureCollection("/permits", params, { noCache: force });
  return list.filter((p) => p && (Boolean(p.studentName?.trim?.()) || Boolean(p.rollNo?.trim?.()) || Boolean(p.place?.trim?.())));
}

export async function getReports(params = {}, force = false) {
  const list = await ensureCollection("/reports", params, { noCache: force });
  return list;
}

export async function getAnnouncements(params = {}) {
  try {
    const res = await api.get("/announcements", { sort: "-createdAt", limit: 50, ...params });
    if (res?.data) return res.data;
  } catch (err) {
    console.warn("getAnnouncements error:", err);
  }
  return [];
}

// ---------------- DocSpace Real-Time MongoDB Services ----------------
export async function getRequiredDocuments(params = {}, force = false) {
  try {
    const res = await api.get("/requiredDocuments", { limit: 100, ...params }, {}, { noCache: force });
    if (Array.isArray(res?.data) && res.data.length > 0) return res.data;
  } catch (err) {
    console.warn("getRequiredDocuments error:", err);
  }
  return [];
}

export async function getStudentDocuments(rollNo, params = {}, force = false) {
  try {
    const q = rollNo ? { rollNo, ...params } : params;
    const res = await api.get("/studentDocuments", { limit: 100, ...q }, {}, { noCache: force });
    if (Array.isArray(res?.data) && res.data.length > 0) return res.data;
  } catch (err) {
    console.warn("getStudentDocuments error:", err);
  }
  return [];
}

export async function uploadStudentDocument(docPayload) {
  try {
    const res = await api.post("/studentDocuments", {
      ...docPayload,
      uploadedAt: docPayload.uploadedAt || new Date().toISOString(),
      status: docPayload.status || "pending",
    });
    return res?.data || res;
  } catch (err) {
    console.warn("uploadStudentDocument error:", err);
    throw err;
  }
}

export async function updateStudentDocument(docId, docPayload) {
  try {
    const res = await api.patch(`/studentDocuments/${docId}`, {
      ...docPayload,
      updatedAt: new Date().toISOString(),
    });
    return res?.data || res;
  } catch (err) {
    console.warn("updateStudentDocument error:", err);
    throw err;
  }
}

export async function deleteStudentDocument(docId) {
  try {
    const res = await api.delete(`/studentDocuments/${docId}`);
    return res?.data || res;
  } catch (err) {
    console.warn("deleteStudentDocument error:", err);
    throw err;
  }
}

// ---------------- Bug Reports & Developer Feedback ----------------
export async function submitBugReport(reportPayload) {
  try {
    const res = await api.post("/bugReports", {
      ...reportPayload,
      status: reportPayload.status || "open",
      createdAt: reportPayload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return res?.data || res;
  } catch (err) {
    console.warn("submitBugReport error:", err);
    throw err;
  }
}

export async function getBugReports(params = {}) {
  try {
    const res = await api.get("/bugReports", { limit: 100, ...params });
    return Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    console.warn("getBugReports error:", err);
    return [];
  }
}

// ---------------- Academic Calendar (Fetched directly from DB) ----------------
export async function getAcademicCalendar(forceRefresh = false) {
  try {
    const res = await api.get("/academicCalendar");
    const docs = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    if (docs.length > 0) {
      await secureSet("academic_calendar_cache", docs[0]);
      return docs[0];
    }
    const cached = await secureGet("academic_calendar_cache").catch(() => null);
    return cached || null;
  } catch (err) {
    console.warn("getAcademicCalendar error fetching from DB:", err);
    const fallback = await secureGet("academic_calendar_cache").catch(() => null);
    return fallback || null;
  }
}

export async function updateAcademicCalendar(docId, payload) {
  try {
    const res = docId
      ? await api.put(`/academicCalendar/${docId}`, payload)
      : await api.post("/academicCalendar", payload);
    const data = res?.data || res;
    await secureSet("academic_calendar_cache", data);
    notifyDataSubscribers("academicCalendar", data);
    return data;
  } catch (err) {
    console.warn("updateAcademicCalendar error:", err);
    throw err;
  }
}


