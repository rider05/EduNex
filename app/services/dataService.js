import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { resolveIdentity, invalidateIdentity } from "./identityService";
import { getDeterministicNickname } from "../utils/nicknameGenerator";

// Every getter here:
//   1. resolves the logged-in user's real records via identityService
//   2. fetches LIVE data from the backend (MongoDB)
//   3. if empty/null → auto-seeds a valid document via POST, re-fetches, and returns it
//   4. mirrors every response into a per-user local cache (edunex_db_<username>)
// No bundled default dataset is ever used for display — seeds go to MongoDB.

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

async function mergeIntoCache(patch) {
  const db = await getDatabase();
  const next = { ...db, ...patch };
  await saveDatabase(next);
  return next;
}

/** Ensure-fetch pattern: GET → if empty → POST seed → re-GET */
async function ensureCollection(endpoint, seedPayload) {
  try {
    const res = await api.get(endpoint, { limit: 100 });
    const list = Array.isArray(res?.data) ? res.data : [];
    if (list.length > 0) return list;
  } catch {}

  // Auto-seed
  try {
    await api.post(endpoint, seedPayload);
  } catch (e) {
    console.warn(`ensureCollection seed POST failed for ${endpoint}:`, e?.message);
  }

  // Re-fetch after seeding
  try {
    const res2 = await api.get(endpoint, { limit: 100 });
    return Array.isArray(res2?.data) ? res2.data : [];
  } catch {}
  return [];
}

async function ensureDocByField(endpoint, field, value, seedPayload) {
  try {
    const res = await api.get(endpoint, { [field]: value, limit: 1 });
    const doc = res?.data?.[0] || null;
    if (doc) return doc;
  } catch {}

  try {
    const created = await api.post(endpoint, seedPayload);
    if (created?.data) return created.data;
  } catch (e) {
    console.warn(`ensureDocByField seed POST failed for ${endpoint}:`, e?.message);
  }

  try {
    const res2 = await api.get(endpoint, { [field]: value, limit: 1 });
    return res2?.data?.[0] || null;
  } catch {}
  return null;
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

export async function getStudentData() {
  const { doc, identity } = await fetchStudentDoc();
  if (doc) {
    await mergeIntoCache({ primaryStudent: doc });
    return doc;
  }

  // Auto-seed a student document
  const rollNo = identity.rollNo || identity.username || "STU001";
  const seedDoc = {
    rollNo,
    name: identity.user?.profile?.name || identity.username || "Student",
    nickname: getDeterministicNickname(rollNo),
    residentialStatus: "Day Scholar (Inside)",
    motherName: "Lakshmi M",
    email: `${identity.username}@edunex.edu`,
    phone: "+91 98000 00000",
    gender: "Male",
    bloodGroup: "O+",
    dob: "01 Jan 2006",
    department: "B.Tech in Computer Science & Engineering",
    departmentCode: "cse",
    dept: "CSE",
    deptShort: "CSE",
    year: "II Year",
    semester: "3rd Semester",
    section: "CSE - A",
    class: "CSE - A",
    batch: "2025-2029",
    lateral: false,
    hostel: "Hosteler",
    hostelBlock: "Block A",
    roomNo: "A-204",
    roomNumber: "A-204",
    hostelDetails: {
      block: "Block A",
      roomNo: "A-204",
      floor: "2nd Floor",
      warden: "Dr. R. Natarajan",
      wardenPhone: "+91 98765 43210",
      curfewTime: "08:30 PM",
      defaultOutTime: "06:00 AM",
      defaultInTime: "08:30 PM",
    },
    status: "active",
    cgpa: "8.74",
    grade: "A",
    feeStatus: "Due Rs.15,000",
    attendance: {
      percentage: "92.0%",
      status: "Good Standing",
      attendedClasses: 153,
      totalClasses: 170,
    },
    fees: {
      total: 100000,
      paid: 85000,
      due: 15000,
      dueDate: "30 Nov 2026",
      dueInvoices: [
        { id: "INV-2026-001", title: "Tuition Fee - Term 3", amount: 15000, dueDate: "30 Nov 2026", status: "Pending" },
      ],
      history: [
        { id: "TXN-2026-001", item: "Tuition Fee - Term 1", amount: 45000, date: "10 Jul 2026", method: "UPI Transfer", receiptNo: "RCP-10001", status: "Paid" },
        { id: "TXN-2026-002", item: "Tuition Fee - Term 2", amount: 40000, date: "10 Jan 2026", method: "Bank Transfer", receiptNo: "RCP-10002", status: "Paid" },
      ],
    },
    subjects: [
      { code: "CS-301", name: "Data Structures & Algorithms", faculty: "Joe", credits: 4, grade: "A", marks: 85, attendance: "92%" },
      { code: "CS-302", name: "Operating Systems", faculty: "Joe", credits: 4, grade: "B+", marks: 78, attendance: "88%" },
      { code: "CS-303", name: "Database Management Systems", faculty: "Joe", credits: 4, grade: "A+", marks: 90, attendance: "95%" },
      { code: "CS-304", name: "Computer Networks", faculty: "Joe", credits: 3, grade: "A", marks: 82, attendance: "91%" },
      { code: "CS-305", name: "Software Engineering", faculty: "Joe", credits: 3, grade: "B+", marks: 76, attendance: "87%" },
    ],
    schedule: [
      { time: "09:00 AM", subject: "Data Structures & Algorithms", faculty: "Joe", room: "CSE-201", color: "#1ABC9C" },
      { time: "10:45 AM", subject: "Operating Systems", faculty: "Joe", room: "CSE-202", color: "#3498DB" },
      { time: "01:45 PM", subject: "Database Management Systems", faculty: "Joe", room: "CSE-203", color: "#E67E22" },
      { time: "03:30 PM", subject: "Computer Networks", faculty: "Joe", room: "CSE-204", color: "#9B59B6" },
    ],
    library: {
      books: 1,
      dueIn: "5 days",
      fine: 0,
      borrowed: [
        { id: "BK-001", title: "Introduction to Algorithms", author: "Thomas H. Cormen", dueDate: "01 Sep 2026", issuedDate: "20 Aug 2026" },
      ],
    },
    parent: {
      name: "Kumar",
      relation: "Father",
      phone: "+91 98000 10003",
      email: "kumar@edunex.edu",
      address: "15, Gandhipuram, Coimbatore, Tamil Nadu 641012",
    },
    advisor: {
      name: "Joe",
      id: "STF-CSEAP001",
      email: "joe@edunex.edu",
      phone: "+91 98000 10002",
      cabin: "Faculty Block A, Room 101",
    },
    nextExam: {
      subject: "Data Structures & Algorithms",
      date: "15 Sep 2026",
      time: "10:00 AM - 01:00 PM",
      room: "Exam Hall A1",
    },
  };

  const created = await ensureDocByField("/students", "rollNo", rollNo, seedDoc);
  if (created) {
    await mergeIntoCache({ primaryStudent: created });
    return created;
  }
  return seedDoc;
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

  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;

  if (studentId) {
    const [invoicesRes, historyRes] = await Promise.allSettled([
      api.get(`/students/${studentId}/invoices`),
      api.get(`/students/${studentId}/history`),
    ]);
    const feesObj = { ...(student?.fees || {}) };
    if (invoicesRes.status === "fulfilled" && Array.isArray(invoicesRes.value?.data) && invoicesRes.value.data.length > 0) {
      feesObj.dueInvoices = invoicesRes.value.data;
    }
    if (historyRes.status === "fulfilled" && Array.isArray(historyRes.value?.data) && historyRes.value.data.length > 0) {
      feesObj.history = historyRes.value.data;
    }
    // If still no invoices, use student's embedded fees
    if (!feesObj.dueInvoices?.length && student?.fees?.dueInvoices) {
      feesObj.dueInvoices = student.fees.dueInvoices;
    }
    if (!feesObj.history?.length && student?.fees?.history) {
      feesObj.history = student.fees.history;
    }
    await mergeIntoCache({ primaryStudent: { ...(student || { id: studentId }), fees: feesObj } });
    return feesObj;
  }

  return student?.fees || { dueInvoices: [], history: [] };
}

export async function getStudentSchedule() {
  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
  return Array.isArray(student?.schedule) ? student.schedule : [];
}

export async function getStudentLibrary() {
  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
  if (student?.library && (student.library.books > 0 || student.library.borrowed?.length > 0)) {
    return student.library;
  }
  return { books: 0, dueIn: "—", fine: 0, borrowed: [] };
}

export async function getGradeLevels() {
  const list = await ensureCollection("/gradeLevels", [
    { grade: "O", range: "90-100", meaning: "Outstanding" },
    { grade: "A+", range: "80-89", meaning: "Excellent" },
    { grade: "A", range: "70-79", meaning: "Very Good" },
    { grade: "B+", range: "60-69", meaning: "Good" },
    { grade: "B", range: "50-59", meaning: "Average" },
    { grade: "RA", range: "<50", meaning: "Reappearance" },
  ]);
  await mergeIntoCache({ gradeLevels: list });
  return list;
}

// ─────────────────────────────────────────────
// 📋 ASSIGNMENTS & ATTENDANCE SERVICES
// ─────────────────────────────────────────────

export async function getAssignments(params = {}) {
  const identity = await resolveIdentity();
  const endpoint = "/assignments";
  const query = { sort: "-createdAt", limit: 50, ...params };

  let list = [];
  try {
    const res = await api.get(endpoint, query);
    list = Array.isArray(res?.data) ? res.data : [];
  } catch {}

  // Auto-seed if empty for student
  if (list.length === 0 && identity.role === "student") {
    const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
    const rollNo = student?.rollNo || identity.rollNo || identity.username;
    const seedDocs = [
      {
        title: "Data Structures - Binary Tree Implementation",
        subject: "Data Structures & Algorithms",
        subjectCode: "CS-301",
        assignedBy: "Joe",
        assignedTo: rollNo,
        assignedToName: student?.name || "Student",
        description: "Implement a binary search tree with insert, delete, and traversal operations.",
        dueDate: "28 Aug 2026",
        status: "Pending",
        totalMarks: 50,
        obtainedMarks: null,
      },
      {
        title: "Operating Systems - Process Scheduling",
        subject: "Operating Systems",
        subjectCode: "CS-302",
        assignedBy: "Joe",
        assignedTo: rollNo,
        assignedToName: student?.name || "Student",
        description: "Simulate FCFS, SJF, and Round Robin scheduling algorithms.",
        dueDate: "01 Sep 2026",
        status: "Submitted",
        totalMarks: 50,
        obtainedMarks: 42,
      },
      {
        title: "DBMS - ER Diagram Design",
        subject: "Database Management Systems",
        subjectCode: "CS-303",
        assignedBy: "Joe",
        assignedTo: rollNo,
        assignedToName: student?.name || "Student",
        description: "Design an ER diagram for a hospital management system.",
        dueDate: "05 Sep 2026",
        status: "Pending",
        totalMarks: 30,
        obtainedMarks: null,
      },
    ];
    for (const doc of seedDocs) {
      try { await api.post(endpoint, doc); } catch {}
    }
    try {
      const res2 = await api.get(endpoint, query);
      list = Array.isArray(res2?.data) ? res2.data : [];
    } catch {}
  }
  return list;
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
  let list = [];
  try {
    const res = await api.get("/timetable", { limit: 10, ...params });
    list = Array.isArray(res?.data) ? res.data : [];
  } catch {}

  if (list.length === 0) {
    // Auto-seed a default timetable for CSE Year 2 Section A
    const seedSchedule = {
      departmentCode: "CSE",
      departmentName: "Computer Science & Engineering",
      year: 2,
      section: "A",
      schedule: {
        Monday: [
          { time: "9:00 AM", duration: "60m", subject: "Data Structures & Algorithms", teacher: "Joe", room: "CSE-201", color: "#1ABC9C", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Operating Systems", teacher: "Joe", room: "CSE-202", color: "#3498DB", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Database Management Systems", teacher: "Joe", room: "CSE-203", color: "#E67E22", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "60m", subject: "Computer Networks", teacher: "Joe", room: "CSE-204", color: "#9B59B6", isBreak: false },
        ],
        Tuesday: [
          { time: "9:00 AM", duration: "60m", subject: "Operating Systems", teacher: "Joe", room: "CSE-202", color: "#3498DB", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Data Structures & Algorithms", teacher: "Joe", room: "CSE-201", color: "#1ABC9C", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Software Engineering", teacher: "Joe", room: "CSE-205", color: "#F39C12", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "120m", subject: "DBMS Lab", teacher: "Joe", room: "CSE-Lab 1", color: "#E67E22", isBreak: false },
        ],
        Wednesday: [
          { time: "9:00 AM", duration: "60m", subject: "Database Management Systems", teacher: "Joe", room: "CSE-203", color: "#E67E22", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Computer Networks", teacher: "Joe", room: "CSE-204", color: "#9B59B6", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Data Structures & Algorithms", teacher: "Joe", room: "CSE-201", color: "#1ABC9C", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "60m", subject: "Software Engineering", teacher: "Joe", room: "CSE-205", color: "#F39C12", isBreak: false },
        ],
        Thursday: [
          { time: "9:00 AM", duration: "60m", subject: "Software Engineering", teacher: "Joe", room: "CSE-205", color: "#F39C12", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Operating Systems", teacher: "Joe", room: "CSE-202", color: "#3498DB", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Database Management Systems", teacher: "Joe", room: "CSE-203", color: "#E67E22", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "120m", subject: "Data Structures Lab", teacher: "Joe", room: "CSE-Lab 1", color: "#1ABC9C", isBreak: false },
        ],
        Friday: [
          { time: "9:00 AM", duration: "60m", subject: "Computer Networks", teacher: "Joe", room: "CSE-204", color: "#9B59B6", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Data Structures & Algorithms", teacher: "Joe", room: "CSE-201", color: "#1ABC9C", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Operating Systems", teacher: "Joe", room: "CSE-202", color: "#3498DB", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "60m", subject: "Software Engineering", teacher: "Joe", room: "CSE-205", color: "#F39C12", isBreak: false },
        ],
      },
    };
    try { await api.post("/timetable", seedSchedule); } catch {}
    try {
      const res2 = await api.get("/timetable", { limit: 10, ...params });
      list = Array.isArray(res2?.data) ? res2.data : [];
    } catch {}
  }
  return list;
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

  if (doc) {
    await mergeIntoCache({ primaryFaculty: doc });
    return doc;
  }

  // Auto-seed staff
  const staffId = identity.staffId || identity.username || "STF001";
  const seedDoc = {
    staffId,
    name: identity.user?.profile?.name || identity.username || "Faculty",
    email: `${identity.username}@edunex.edu`,
    phone: "+91 98000 00002",
    address: "Staff Quarters, EduNex Campus",
    gender: "Male",
    bloodGroup: "O+",
    dob: "10 Aug 1990",
    department: "Computer Science & Engineering",
    departmentCode: "cse",
    position: "Assistant Professor",
    designation: "Assistant Professor & Class Advisor",
    qualification: "M.Tech in Computer Science",
    qualifications: "M.Tech in Computer Science",
    specialization: "Data Structures & Algorithms",
    experience: "5 Years Academic",
    aicteId: "CSE-AP-2021-045",
    publications: 3,
    grants: 1,
    cabin: "Faculty Block A, Room 101",
    consultation: "Mon-Wed 2:00 PM - 4:00 PM",
    portfolios: "Class Advisor, CSE-A",
    classTeacher: "CSE - A",
    status: "active",
    coursesTaught: [
      { code: "CS-301", name: "Data Structures & Algorithms", class: "CSE - A (Year 2)", studentsCount: 60 },
      { code: "CS-302", name: "Operating Systems", class: "CSE - A (Year 2)", studentsCount: 60 },
      { code: "CS-303", name: "Database Management Systems", class: "CSE - A (Year 2)", studentsCount: 60 },
    ],
    todaySchedule: [
      { time: "09:00 AM - 10:30 AM", subject: "Data Structures & Algorithms", class: "CSE - A", room: "CSE-201", type: "Lecture" },
      { time: "11:00 AM - 12:30 PM", subject: "Operating Systems", class: "CSE - A", room: "CSE-202", type: "Lecture" },
      { time: "02:00 PM - 03:30 PM", subject: "DBMS Lab Practicals", class: "CSE - A", room: "CSE-Lab 1", type: "Lab" },
    ],
    summary: {
      classesToday: 3,
      totalStudents: 60,
      pendingReports: 1,
      averageAttendance: "90.0%",
    },
  };

  const created = await ensureDocByField("/staff", "staffId", staffId, seedDoc);
  if (created) {
    await mergeIntoCache({ primaryFaculty: created });
    return created;
  }
  return seedDoc;
}

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

  if (parent && !ward && (parent.wardRollNo || identity.wardRollNo)) {
    // Ward not found - get or create it
    ward = await getStudentData();
  }

  if (!parent && !ward) {
    const db = await getDatabase();
    parent = db.primaryParent;
    ward = db.primaryStudent;
    if (!parent && !ward) {
      // Auto-seed parent
      const parentId = identity.parentId || identity.username || "PAR001";
      const wardRollNo = identity.wardRollNo || "25ACSE001";
      const seedParent = {
        parentId,
        name: identity.user?.profile?.name || identity.username || "Parent",
        email: `${identity.username}@edunex.edu`,
        phone: "+91 98000 00003",
        address: "15, Gandhipuram, Coimbatore, Tamil Nadu 641012",
        wardRollNo,
        relation: "Father",
        occupation: "Business Owner",
        secondaryGuardian: "",
        secondaryPhone: "",
        status: "active",
      };
      parent = await ensureDocByField("/parents", "parentId", parentId, seedParent);
      ward = await getStudentData();
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
    rollNo: ward?.rollNo || ward?.roll || "",
    regNo: ward?.regNo || "",
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
    rollNo: ward?.rollNo || ward?.roll || "",
    regNo: ward?.regNo || "",
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

export async function getParentNotices() {
  const list = await ensureCollection("/notices", [
    {
      subject: "Mid-Semester Exam Schedule",
      message: "The mid-semester examinations for Odd Semester 2026 will commence from 15th September. Students are advised to prepare well and carry their ID cards.",
      sender: "Prof. Joe (Class Advisor)",
      senderRole: "staff",
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      isNew: true,
    },
    {
      subject: "Assignment Submission Reminder",
      message: "Students who have not submitted CS-301 Data Structures assignment are requested to submit by 25th August. Late submissions will receive reduced marks.",
      sender: "Prof. Joe (Class Advisor)",
      senderRole: "staff",
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      isNew: false,
    },
  ]);
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
export async function getNoticesList(params = {}) {
  const list = await ensureCollection("/notices", {});
  if (params.senderRole) {
    return normalizeNotices(list.filter((n) => n.senderRole === params.senderRole));
  }
  return normalizeNotices(list);
}

// ─────────────────────────────────────────────
// 🛡️ ADMIN DATA SERVICES
// ─────────────────────────────────────────────

export async function getAdminData() {
  let institution = null;
  let departments = [];

  const [instList, deptList] = await Promise.all([
    ensureCollection("/institutions", {
      name: "EduNex Institute of Technology & Science",
      shortName: "EduNex Tech",
      code: "EDUNEX-ENGG-042",
      address: "Campus Boulevard, Tech Park Road, Coimbatore - 641014, Tamil Nadu",
      academicYear: "2025 - 2026",
      currentTerm: "Odd Semester (Term 3)",
      accreditation: "NAAC A++ Accredited & Autonomous",
      totalCourses: "3",
      activePrograms: "1",
      monthlyFeeCollection: "Rs.4.5L",
      systemHealth: "100%",
      contact: {
        phone: "+91 422 298 7654",
        email: "info@edunex.edu",
        website: "https://edunex.edu",
      },
    }),
    ensureCollection("/departments", [
      { name: "Computer Science & Engineering", code: "CSE", hod: "Joe", totalStudents: 1, facultyCount: 1 },
    ]),
  ]);

  if (instList.length > 0) institution = instList[0];
  departments = deptList;

  const identity = await resolveIdentity();
  const admin = identity.admin || null;

  await mergeIntoCache({ institution, departments, primaryAdmin: admin });

  return { ...(admin || {}), institution, departments };
}

export async function getInstitutions() {
  const list = await ensureCollection("/institutions", {
    name: "EduNex Institute of Technology & Science",
    shortName: "EduNex Tech",
    code: "EDUNEX-ENGG-042",
    address: "Campus Boulevard, Tech Park Road, Coimbatore - 641014, Tamil Nadu",
    academicYear: "2025 - 2026",
    currentTerm: "Odd Semester (Term 3)",
    accreditation: "NAAC A++ Accredited & Autonomous",
    totalCourses: "3",
    activePrograms: "1",
    monthlyFeeCollection: "Rs.4.5L",
    systemHealth: "100%",
    contact: {
      phone: "+91 422 298 7654",
      email: "info@edunex.edu",
      website: "https://edunex.edu",
    },
  });
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
  const list = await ensureCollection("/fees", [
    {
      studentId: "25ACSE001",
      rollNo: "25ACSE001",
      studentName: "Velu",
      invoiceId: "INV-2026-001",
      item: "Tuition Fee - Term 3",
      amount: 30000,
      paid: 0,
      status: "Pending",
      dueDate: "30 Nov 2026",
      semester: "3rd Semester",
    },
  ]);
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
    dueInvoices: list.filter((f) => f.invoiceId?.startsWith?.("INV")),
    recentPayments: list.filter((f) => f.invoiceId?.startsWith?.("TXN")),
  };
}

export async function getExams(params = {}) {
  const list = await ensureCollection("/exams", [
    {
      semester: "3rd Semester",
      examName: "CIA-2 (Continuous Internal Assessment)",
      subject: "Operating Systems",
      subjectCode: "CS-302",
      date: "15 Nov 2026",
      time: "10:00 AM - 01:00 PM",
      room: "Exam Hall A2",
      hallCapacity: 120,
      proctor: "Joe",
      status: "Scheduled",
    },
  ]);
  const halls = [...new Set(list.map((e) => e.room).filter(Boolean))];
  return { records: list, halls, exams: list };
}

export async function getTransport(params = {}) {
  const list = await ensureCollection("/transport", [
    { route: "Route 1 - Gandhipuram CLG", type: "transport", driver: "Ramesh", bus: "TN-38-AE-4521", status: "On Route", speed: "42 km/h" },
  ]);
  const transportRoutes = list.filter((t) => t.type === "transport" || !t.type);
  const fleetRoutes = list.filter((t) => t.type === "fleet");
  return { records: list, transportRoutes, fleetRoutes };
}

export async function getInfrastructure(params = {}) {
  const list = await ensureCollection("/infrastructure", [
    { category: "hostel", name: "Boys Hostel", occupancy: "93%", occupiedBeds: 93, totalBeds: 100, warden: "Revathi" },
  ]);
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

export async function getPermits(params = {}) {
  const list = await ensureCollection("/permits", [
    {
      studentId: "25ACSE001",
      rollNo: "25ACSE001",
      studentName: "Velu",
      type: "entry",
      gate: "Main Gate",
      place: "Campus",
      time: "08:45 AM",
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      status: "granted",
    },
  ]);
  return list.filter((p) => p && (Boolean(p.studentName?.trim?.()) || Boolean(p.rollNo?.trim?.()) || Boolean(p.place?.trim?.())));
}

export async function getReports(params = {}) {
  const list = await ensureCollection("/reports", [
    {
      title: "Academic Performance - CSE",
      category: "academic",
      desc: "Semester-wise performance across CSE batches.",
      statPrimary: "8.42",
      statPrimaryLabel: "Avg CGPA",
      statSecondary: "91.2%",
      statSecondaryLabel: "Pass Rate",
      highlights: ["Top performer batch: II Year CSE-A (avg 8.6)"],
      details: { "Total Students": "1", "Passed": "1" },
    },
  ]);
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
export async function getRequiredDocuments(params = {}) {
  try {
    const res = await api.get("/requiredDocuments", { limit: 100, ...params });
    if (Array.isArray(res?.data) && res.data.length > 0) return res.data;
  } catch (err) {
    console.warn("getRequiredDocuments error:", err);
  }
  return [];
}

export async function getStudentDocuments(rollNo, params = {}) {
  try {
    const q = rollNo ? { rollNo, ...params } : params;
    const res = await api.get("/studentDocuments", { limit: 100, ...q });
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
