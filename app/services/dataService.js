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
  const rollNo = identity.rollNo || (identity.username === "velu" ? "STU-2024-AIDS01" : identity.username) || "STU-2024-AIDS01";
  const seedDoc = {
    rollNo,
    name: identity.user?.profile?.name || "Velu",
    nickname: getDeterministicNickname(rollNo),
    residentialStatus: "Day Scholar (Inside)",
    motherName: "—",
    email: `${identity.username || "velu"}@edunex.edu`,
    phone: "+91 98000 10001",
    mobile: "+91 98000 10001",
    gender: "Male",
    bloodGroup: "O+",
    dob: "15 May 2004",
    department: "Artificial Intelligence & Data Science",
    departmentCode: "aids",
    dept: "AI & DS",
    deptShort: "AI & DS",
    departmentShort: "AI & DS",
    degree: "B.Tech in Artificial Intelligence & Data Science",
    program: "B.Tech",
    year: "III Year",
    semester: "5th Semester",
    section: "AI & DS - A",
    class: "AI & DS - A",
    batch: "2024-2028",
    lateral: false,
    hostel: false,
    residential: "Day Scholar (Inside)",
    status: "active",
    cgpa: "8.65",
    gpa: "8.80",
    rank: "5th in Department",
    creditsEarned: 92,
    totalCredits: 160,
    grade: "A",
    feeStatus: "Pending (Term 5)",
    attendance: {
      percentage: "93.4%",
      status: "Good Standing",
      attendedClasses: 184,
      totalClasses: 197,
    },
    fees: {
      total: 100000,
      paid: 125000,
      due: 35000,
      dueDate: "15 Sep 2026",
      dueFees: "Rs. 35,000",
      paidFees: "Rs. 1,25,000",
      totalFees: "Rs. 1,60,000",
      feeStatus: "Pending (Term 5)",
      dueInvoices: [
        { id: "INV-STU-2024-AIDS01-05", invoiceNo: "INV/2026/05/01", title: "Tuition & Core Computing Fee (Sem 5)", category: "Tuition", amount: 35000, dueDate: "15 Sep 2026", status: "due", term: "Odd '26 (Sem 5)", description: "5th Semester Academic Tuition, AI High-Compute GPU Lab Access & IEEE Digital Library Subscription" },
      ],
      history: [
        { id: "TXN-STU-2024-AIDS01-04", receiptNo: "REC-2026-0801", title: "Tuition & Laboratory Fee - Semester 4", amount: 45000, date: "12 Jan 2026, 10:30 AM", method: "Online NetBanking (HDFC Bank)", txnId: "TXN-EDX-880101", status: "completed" },
        { id: "TXN-STU-2024-AIDS01-03", receiptNo: "REC-2025-0401", title: "Tuition & Development Fee - Semester 3", amount: 40000, date: "15 Jul 2025, 02:15 PM", method: "UPI (Google Pay)", txnId: "TXN-EDX-770102", status: "completed" },
        { id: "TXN-STU-2024-AIDS01-02", receiptNo: "REC-2025-0101", title: "Tuition & Practical Lab Fee - Semester 2", amount: 40000, date: "10 Jan 2025, 11:00 AM", method: "Online NetBanking (SBI)", txnId: "TXN-EDX-660103", status: "completed" },
      ],
    },
    subjects: [
      { code: "AD-506", name: "Machine Learning", title: "Machine Learning", type: "Theory", credits: 4, faculty: "Mr. S. Chandramohan", grade: "A", marks: 87, attendance: "92%", staffHours: "38 / 40 Hours", attendedHours: 38, totalHours: 40, attendancePct: 95, unitsCovered: "4 / 5 Units", syllabusCovered: 82, activeUnit: "Unit 5: Deep Learning Essentials", ciaScore: "44 / 50", gradeExpected: "A", color: "#10B981", icon: "brain", units: ["Unit 1: Supervised Learning (Completed)", "Unit 2: Unsupervised Learning (Completed)", "Unit 3: Neural Networks & Backpropagation (In Progress)"] },
      { code: "AD-502", name: "Big Data Analytics", title: "Big Data Analytics", type: "Theory", credits: 4, faculty: "Ms. M. Malliga", grade: "A", marks: 84, attendance: "89%", staffHours: "36 / 40 Hours", attendedHours: 36, totalHours: 40, attendancePct: 90, unitsCovered: "4 / 5 Units", syllabusCovered: 80, activeUnit: "Unit 5: Spark & Streaming", ciaScore: "42 / 50", gradeExpected: "A", color: "#F59E0B", icon: "database-search", units: ["Unit 1: Hadoop Ecosystem (Completed)", "Unit 2: MapReduce & HDFS (Completed)", "Unit 3: Hive & Pig (In Progress)"] },
      { code: "AD-501", name: "Software Engineering", title: "Software Engineering", type: "Theory", credits: 3, faculty: "Ms. Arul Mozhi", grade: "A+", marks: 90, attendance: "95%", staffHours: "34 / 36 Hours", attendedHours: 34, totalHours: 36, attendancePct: 94.4, unitsCovered: "4.5 / 5 Units", syllabusCovered: 88, activeUnit: "Unit 5: DevOps & CI/CD", ciaScore: "47 / 50", gradeExpected: "A+", color: "#F59E0B", icon: "source-branch", units: ["Unit 1: SDLC & Agile (Completed)", "Unit 2: UML & Design Patterns (Completed)", "Unit 3: Testing & QA (In Progress)"] },
      { code: "AD-504", name: "Applied Design Thinking", title: "Applied Design Thinking", type: "Theory", credits: 3, faculty: "Ms. Arul Mozhi", grade: "A", marks: 82, attendance: "91%", staffHours: "26 / 30 Hours", attendedHours: 26, totalHours: 30, attendancePct: 86.7, unitsCovered: "3 / 5 Units", syllabusCovered: 74, activeUnit: "Unit 4: Prototyping & Testing", ciaScore: "40 / 50", gradeExpected: "A", color: "#8B5CF6", icon: "lightbulb-on-outline", units: ["Unit 1: Empathize & Define (Completed)", "Unit 2: Ideate & Storyboard (Completed)", "Unit 3: Prototyping (In Progress)"] },
      { code: "AD-505", name: "Fundamentals of Cloud Computing", title: "Fundamentals of Cloud Computing", type: "Theory", credits: 3, faculty: "Mr. S. Chandramohan", grade: "A", marks: 80, attendance: "88%", staffHours: "28 / 32 Hours", attendedHours: 28, totalHours: 32, attendancePct: 87.5, unitsCovered: "4 / 5 Units", syllabusCovered: 78, activeUnit: "Unit 5: Cloud Security", ciaScore: "41 / 50", gradeExpected: "A", color: "#0EA5E9", icon: "cloud-outline", units: ["Unit 1: IaaS/PaaS/SaaS (Completed)", "Unit 2: Virtualization (Completed)", "Unit 3: AWS/Azure/GCP (In Progress)"] },
      { code: "AD-509", name: "Explainable AI", title: "Explainable AI", type: "Theory", credits: 3, faculty: "Mr. S. Chandramohan", grade: "A+", marks: 88, attendance: "94%", staffHours: "30 / 32 Hours", attendedHours: 30, totalHours: 32, attendancePct: 93.8, unitsCovered: "4 / 5 Units", syllabusCovered: 82, activeUnit: "Unit 5: Fairness & Bias", ciaScore: "46 / 50", gradeExpected: "A+", color: "#6366F1", icon: "account-eye-outline", units: ["Unit 1: Interpretability (Completed)", "Unit 2: LIME & SHAP (Completed)", "Unit 3: Counterfactuals (In Progress)"] },
      { code: "AD-503", name: "Industry Oriented Course", title: "Industry Oriented Course", type: "Theory", credits: 3, faculty: "Ms. M. Malliga", grade: "A", marks: 85, attendance: "90%", staffHours: "24 / 28 Hours", attendedHours: 24, totalHours: 28, attendancePct: 85.7, unitsCovered: "3 / 5 Units", syllabusCovered: 76, activeUnit: "Project Sprint 2", ciaScore: "43 / 50", gradeExpected: "A", color: "#14B8A6", icon: "briefcase-outline", units: ["Module 1: Industry Case Studies (Completed)", "Module 2: Live Project (In Progress)"] },
      { code: "AD-513", name: "Machine Learning Laboratory", title: "Machine Learning Laboratory", type: "Practical Lab", credits: 2, faculty: "Mr. S. Chandramohan", grade: "O", marks: 94, attendance: "98%", staffHours: "38 / 40 Hours", attendedHours: 38, totalHours: 40, attendancePct: 95, unitsCovered: "5 / 6 Modules", syllabusCovered: 92, activeUnit: "Mini Project: EDA Pipeline", ciaScore: "48 / 50", gradeExpected: "O", color: "#10B981", icon: "flask-outline", units: ["Exp 1-2: Python & NumPy (Completed)", "Exp 3-4: Regression & Classifiers (Completed)", "Exp 5-6: Neural Network Lab (In Progress)"] },
      { code: "AD-514", name: "Big Data Analytics Laboratory", title: "Big Data Analytics Laboratory", type: "Practical Lab", credits: 2, faculty: "Ms. M. Malliga", grade: "A+", marks: 91, attendance: "96%", staffHours: "37 / 40 Hours", attendedHours: 37, totalHours: 40, attendancePct: 92.5, unitsCovered: "5 / 6 Modules", syllabusCovered: 90, activeUnit: "Spark SQL Project", ciaScore: "46 / 50", gradeExpected: "A+", color: "#F59E0B", icon: "chart-box-outline", units: ["Exp 1-2: HDFS Commands (Completed)", "Exp 3-4: MapReduce Jobs (Completed)", "Exp 5-6: Spark Streaming (In Progress)"] },
      { code: "AD-511", name: "Software Engineering Laboratory", title: "Software Engineering Laboratory", type: "Practical Lab", credits: 2, faculty: "Ms. Arul Mozhi", grade: "A", marks: 89, attendance: "95%", staffHours: "36 / 40 Hours", attendedHours: 36, totalHours: 40, attendancePct: 90, unitsCovered: "5 / 6 Modules", syllabusCovered: 88, activeUnit: "UML Case Study", ciaScore: "45 / 50", gradeExpected: "A", color: "#F59E0B", icon: "code-tags", units: ["Exp 1-3: Requirements & Use Cases (Completed)", "Exp 4-6: Sequence & Class Diagrams (Completed)"] },
      { code: "AD-508", name: "Placement & Training", title: "Placement & Training", type: "Theory", credits: 1, faculty: "Ms. M. Malliga", grade: "A", marks: 85, attendance: "95%", staffHours: "20 / 22 Hours", attendedHours: 20, totalHours: 22, attendancePct: 90.9, unitsCovered: "DSA, Aptitude & Mock Interviews", syllabusCovered: 90, activeUnit: "Technical Coding Round Mastery", ciaScore: "—", gradeExpected: "Pass", color: "#14B8A6", icon: "briefcase-outline", units: ["DSA Interview Patterns (Completed)", "Quantitative Aptitude (Completed)", "System Design Fundamentals (In Progress)"] },
      { code: "AD-510", name: "Seminar on Emerging Trends", title: "Seminar on Emerging Trends", type: "Theory", credits: 1, faculty: "Ms. Z. Ananth Angel", grade: "A+", marks: 90, attendance: "100%", staffHours: "15 / 15 Hours", attendedHours: 15, totalHours: 15, attendancePct: 100, unitsCovered: "Research Presentations", syllabusCovered: 100, activeUnit: "Technical Paper Presentation", ciaScore: "—", gradeExpected: "A+", color: "#6366F1", icon: "presentation", units: ["Literature Survey (Completed)", "Technical Presentation (Completed)"] },
      { code: "AD-507", name: "Mentor & Tutor Ward", title: "Mentor & Tutor Ward", type: "Theory", credits: 1, faculty: "Ms. Z. Ananth Angel", grade: "O", marks: 95, attendance: "100%", staffHours: "15 / 15 Hours", attendedHours: 15, totalHours: 15, attendancePct: 100, unitsCovered: "Academic & Career Counseling", syllabusCovered: 100, activeUnit: "Quarterly Review", ciaScore: "—", gradeExpected: "O", color: "#6366F1", icon: "account-supervisor-outline", units: ["Semester Goal Setting (Completed)", "Mid-Term Academic Progress Review (Completed)"] },
      { code: "AD-512", name: "NPTEL / Library", title: "NPTEL / Library", type: "Theory", credits: 1, faculty: "Ms. Z. Ananth Angel", grade: "A", marks: 88, attendance: "95%", staffHours: "15 / 16 Hours", attendedHours: 15, totalHours: 16, attendancePct: 93.8, unitsCovered: "Self-Paced Certification", syllabusCovered: 85, activeUnit: "NPTEL Deep Learning Assignment 6", ciaScore: "—", gradeExpected: "Elite", color: "#64748B", icon: "book-reader", units: ["NPTEL Deep Learning Course (In Progress)", "IEEE Xplore Research Reading (Completed)"] },
    ],
    schedule: [
      { time: "09:00 AM - 09:55 AM", subject: "Machine Learning", code: "ML", faculty: "Mr. S. Chandramohan", room: "D205", color: "#10B981" },
      { time: "09:55 AM - 10:50 AM", subject: "Software Engineering", code: "SE", faculty: "Ms. Arul Mozhi", room: "D205", color: "#F59E0B" },
      { time: "11:10 AM - 12:00 PM", subject: "Machine Learning", code: "ML", faculty: "Mr. S. Chandramohan", room: "D205", color: "#10B981" },
      { time: "12:00 PM - 04:10 PM", subject: "Big Data Analytics Lab", code: "BDA LAB", faculty: "Ms. M. Malliga", room: "Big Data Lab", color: "#3B82F6" },
      { time: "04:10 PM - 05:00 PM", subject: "Explainable AI", code: "X-AI", faculty: "Mr. S. Chandramohan", room: "D205", color: "#6366F1" },
    ],
    library: {
      books: 2,
      dueIn: "8 days",
      fine: 0,
      borrowed: [
        { id: "BK-001", title: "Pattern Recognition and Machine Learning", author: "Christopher M. Bishop", dueDate: "10 Sep 2026", issuedDate: "20 Aug 2026" },
        { id: "BK-002", title: "Hadoop: The Definitive Guide", author: "Tom White", dueDate: "15 Sep 2026", issuedDate: "22 Aug 2026" },
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
      name: "Ms. Z. Ananth Angel",
      id: "STF-AIDS001",
      designation: "Assistant Professor & Class Tutor (III AI&DS-A)",
      department: "Artificial Intelligence & Data Science",
      email: "ananthangel@edunex.edu",
      phone: "+91 98000 10005",
      room: "D205",
      cabin: "Department of AI & DS, Cabin D205",
    },
    nextExam: {
      subject: "Machine Learning",
      date: "18 Sep 2026",
      time: "10:00 AM - 01:00 PM",
      room: "Exam Hall D2",
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
    studentId = identity.studentId || identity.wardRollNo || identity.rollNo || identity.id || identity.username;
  } catch {}

  const student = (await getStudentData()) || (await getDatabase()).primaryStudent;
  if (!studentId && student) {
    studentId = student.id || student.rollNo;
  }

  let feesObj = {
    total: 160000,
    paid: 125000,
    due: 35000,
    dueInvoices: [],
    history: [],
    breakdown: [],
    scholarship: null,
    ...(student?.fees || {}),
  };

  if (studentId) {
    try {
      const [studentDocRes, feesListRes] = await Promise.allSettled([
        api.get(`/students/${studentId}`),
        api.get(`/fees?studentId=${studentId}`),
      ]);

      if (studentDocRes.status === "fulfilled" && studentDocRes.value?.data?.fees) {
        feesObj = { ...feesObj, ...studentDocRes.value.data.fees };
      }

      if (feesListRes.status === "fulfilled" && Array.isArray(feesListRes.value?.data) && feesListRes.value.data.length > 0) {
        const feeRecords = feesListRes.value.data;
        const dueItems = feeRecords.filter(f => f.status?.toLowerCase() === "pending" || f.status?.toLowerCase() === "due");
        const paidItems = feeRecords.filter(f => f.status?.toLowerCase() === "paid" || f.status?.toLowerCase() === "completed");

        if (dueItems.length > 0) {
          feesObj.dueInvoices = dueItems.map(d => ({
            id: d.id || d.invoiceId,
            invoiceNo: d.invoiceId || d.invoiceNo || d.id,
            title: d.item || d.title,
            category: d.category || "Tuition",
            amount: Number(d.amount) || 0,
            dueDate: d.dueDate || "15 Sep 2026",
            status: "due",
            term: d.semester || "5th Semester",
            description: d.description || `${d.semester || "5th Semester"} Tuition & Lab Fee`,
            icon: "school-outline",
            iconBg: "#2563EB",
          }));
        }

        if (paidItems.length > 0) {
          feesObj.history = paidItems.map(p => ({
            id: p.id || p.invoiceId,
            receiptNo: p.receiptNo || p.invoiceId || p.id,
            title: p.item || p.title,
            amount: Number(p.amount) || 0,
            date: p.paymentDate || p.date || "10 Jan 2026",
            method: p.method || "Online NetBanking / UPI",
            txnId: p.txnId || p.transactionId || `TXN-${p.id}`,
            status: "completed",
          }));
        }
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
        title: "Machine Learning - Neural Network Backpropagation",
        subject: "Machine Learning",
        subjectCode: "AD-506",
        assignedBy: "Mr. S. Chandramohan",
        assignedTo: rollNo,
        assignedToName: student?.name || "Student",
        description: "Implement backpropagation for a 3-layer neural network on the MNIST dataset.",
        dueDate: "28 Aug 2026",
        status: "Pending",
        totalMarks: 50,
        obtainedMarks: null,
      },
      {
        title: "Big Data Analytics - MapReduce Word Count",
        subject: "Big Data Analytics",
        subjectCode: "AD-502",
        assignedBy: "Ms. M. Malliga",
        assignedTo: rollNo,
        assignedToName: student?.name || "Student",
        description: "Write a MapReduce job to compute word frequency over a given text corpus.",
        dueDate: "01 Sep 2026",
        status: "Submitted",
        totalMarks: 50,
        obtainedMarks: 42,
      },
      {
        title: "Software Engineering - Test Case Design",
        subject: "Software Engineering",
        subjectCode: "AD-501",
        assignedBy: "Ms. Arul Mozhi",
        assignedTo: rollNo,
        assignedToName: student?.name || "Student",
        description: "Design black-box and white-box test cases for an ATM cash withdrawal system.",
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
    // Auto-seed a default timetable for III Year AI & DS Section A
    const seedSchedule = {
      departmentCode: "AIDS",
      departmentName: "Artificial Intelligence & Data Science",
      year: 3,
      section: "A",
      schedule: {
        Monday: [
          { time: "9:00 AM", duration: "60m", subject: "Machine Learning", teacher: "Mr. S. Chandramohan", room: "D205", color: "#10B981", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Software Engineering", teacher: "Ms. Arul Mozhi", room: "D205", color: "#F59E0B", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Big Data Analytics", teacher: "Ms. M. Malliga", room: "D205", color: "#3B82F6", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "60m", subject: "Machine Learning", teacher: "Mr. S. Chandramohan", room: "D205", color: "#10B981", isBreak: false },
        ],
        Tuesday: [
          { time: "9:00 AM", duration: "60m", subject: "Software Engineering", teacher: "Ms. Arul Mozhi", room: "D205", color: "#F59E0B", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Machine Learning", teacher: "Mr. S. Chandramohan", room: "D205", color: "#10B981", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Cloud Computing", teacher: "Mr. S. Chandramohan", room: "D205", color: "#0EA5E9", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "120m", subject: "Machine Learning Lab", teacher: "Mr. S. Chandramohan", room: "AI&DS Lab 1", color: "#10B981", isBreak: false },
        ],
        Wednesday: [
          { time: "9:00 AM", duration: "60m", subject: "Big Data Analytics", teacher: "Ms. M. Malliga", room: "D205", color: "#3B82F6", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Explainable AI", teacher: "Mr. S. Chandramohan", room: "D205", color: "#6366F1", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Machine Learning", teacher: "Mr. S. Chandramohan", room: "D205", color: "#10B981", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "120m", subject: "Big Data Analytics Lab", teacher: "Ms. M. Malliga", room: "Big Data Lab", color: "#3B82F6", isBreak: false },
        ],
        Thursday: [
          { time: "9:00 AM", duration: "60m", subject: "Cloud Computing", teacher: "Mr. S. Chandramohan", room: "D205", color: "#0EA5E9", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Big Data Analytics", teacher: "Ms. M. Malliga", room: "D205", color: "#3B82F6", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Applied Design Thinking", teacher: "Ms. Arul Mozhi", room: "D205", color: "#8B5CF6", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "120m", subject: "Software Engineering Lab", teacher: "Ms. Arul Mozhi", room: "AI&DS Lab 1", color: "#F59E0B", isBreak: false },
        ],
        Friday: [
          { time: "9:00 AM", duration: "60m", subject: "Explainable AI", teacher: "Mr. S. Chandramohan", room: "D205", color: "#6366F1", isBreak: false },
          { time: "10:00 AM", duration: "15m", subject: "Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "10:15 AM", duration: "60m", subject: "Machine Learning", teacher: "Mr. S. Chandramohan", room: "D205", color: "#10B981", isBreak: false },
          { time: "11:15 AM", duration: "60m", subject: "Big Data Analytics", teacher: "Ms. M. Malliga", room: "D205", color: "#3B82F6", isBreak: false },
          { time: "12:15 PM", duration: "60m", subject: "Lunch Break", teacher: "", room: "", color: "#64748b", isBreak: true },
          { time: "1:15 PM", duration: "60m", subject: "Placement & Training", teacher: "Ms. M. Malliga", room: "D205", color: "#14B8A6", isBreak: false },
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
    name: identity.user?.profile?.name || "Ms. Z. Ananth Angel",
    email: `${identity.username}@edunex.edu`,
    phone: "+91 98000 10005",
    address: "Staff Quarters, EduNex Campus",
    gender: "Female",
    bloodGroup: "B+",
    dob: "10 Aug 1990",
    department: "Artificial Intelligence & Data Science",
    departmentCode: "aids",
    position: "Assistant Professor",
    designation: "Assistant Professor & Class Tutor",
    qualification: "M.Tech in Artificial Intelligence",
    qualifications: "M.Tech in Artificial Intelligence",
    specialization: "Machine Learning & Pattern Recognition",
    experience: "5 Years Academic",
    aicteId: "AIDS-AP-2021-045",
    publications: 3,
    grants: 1,
    cabin: "Department of AI & DS, Cabin D205",
    consultation: "Mon-Wed 2:00 PM - 4:00 PM",
    portfolios: "Class Tutor, III AI&DS-A",
    classTeacher: "AI & DS - A",
    status: "active",
    coursesTaught: [
      { code: "AD-506", name: "Machine Learning", class: "AI & DS - A (Year 3)", studentsCount: 60 },
      { code: "AD-505", name: "Fundamentals of Cloud Computing", class: "AI & DS - A (Year 3)", studentsCount: 60 },
      { code: "AD-509", name: "Explainable AI", class: "AI & DS - A (Year 3)", studentsCount: 60 },
    ],
    todaySchedule: [
      { time: "09:00 AM - 10:30 AM", subject: "Machine Learning", class: "AI & DS - A", room: "D205", type: "Lecture" },
      { time: "11:00 AM - 12:30 PM", subject: "Cloud Computing", class: "AI & DS - A", room: "D205", type: "Lecture" },
      { time: "02:00 PM - 03:30 PM", subject: "Machine Learning Lab Practicals", class: "AI & DS - A", room: "AI&DS Lab 1", type: "Lab" },
    ],
    summary: {
      classesToday: 3,
      totalStudents: 60,
      pendingReports: 1,
      averageAttendance: "93.4%",
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
  const targetRoll = parent?.wardRollNo || identity.wardRollNo || parent?.studentID;
  if (targetRoll) {
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
    if (!parent && !ward) {
      // Auto-seed parent
      const parentId = identity.parentId || identity.username || "PAR001";
      const wardRollNo = identity.wardRollNo || "STU-2024-AIDS01";
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
      sender: "Ms. Z. Ananth Angel (Class Tutor)",
      senderRole: "staff",
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      isNew: true,
    },
    {
      subject: "Assignment Submission Reminder",
      message: "Students who have not submitted the Machine Learning (AD-506) Neural Network Backpropagation assignment are requested to submit by 26th August. Late submissions will receive reduced marks.",
      sender: "Ms. Z. Ananth Angel (Class Tutor)",
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
      { name: "Artificial Intelligence & Data Science", code: "AIDS", short: "AI&DS", hod: "Ms. Z. Ananth Angel", totalStudents: 1, facultyCount: 1 },
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
      studentId: "STU-2024-AIDS01",
      rollNo: "STU-2024-AIDS01",
      studentName: "Velu",
      invoiceId: "INV-STU-2024-AIDS01-05",
      item: "Tuition & Core Computing Fee (Sem 5)",
      amount: 35000,
      paid: 0,
      status: "Pending",
      dueDate: "15 Sep 2026",
      semester: "5th Semester",
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
      semester: "5th Semester",
      examName: "CIA-2 (Continuous Internal Assessment)",
      subject: "Machine Learning",
      subjectCode: "AD-506",
      date: "18 Nov 2026",
      time: "10:00 AM - 01:00 PM",
      room: "Exam Hall D2",
      hallCapacity: 120,
      proctor: "Mr. S. Chandramohan",
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
      studentId: "STU-2024-AIDS01",
      rollNo: "STU-2024-AIDS01",
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
      title: "Academic Performance - AI & DS",
      category: "academic",
      desc: "Semester-wise performance across AI & DS batches.",
      statPrimary: "8.65",
      statPrimaryLabel: "Avg CGPA",
      statSecondary: "97.6%",
      statSecondaryLabel: "Pass Rate",
      highlights: ["Top performer batch: III Year AI&DS-A (avg 8.65)"],
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

