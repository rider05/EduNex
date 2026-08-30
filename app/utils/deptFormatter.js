/**
 * Department and Degree Name Formatter
 * Shortens long department and program names for constrained UI spaces.
 */

const DEPT_SHORT_MAP = {
  // AI & DS
  "artificial intelligence & data science": "AI & DS",
  "artificial intelligence and data science": "AI & DS",
  "b.tech in artificial intelligence & data science": "B.Tech AI & DS",
  "b.tech in artificial intelligence and data science": "B.Tech AI & DS",
  "b.tech artificial intelligence & data science": "B.Tech AI & DS",
  "b.tech artificial intelligence and data science": "B.Tech AI & DS",
  "department of artificial intelligence & data science": "Dept of AI & DS",
  "department of artificial intelligence and data science": "Dept of AI & DS",
  "aids": "AI & DS",
  "ai & ds": "AI & DS",
  "ai&ds": "AI & DS",

  // CSE
  "computer science & engineering": "CSE",
  "computer science and engineering": "CSE",
  "b.e in computer science & engineering": "B.E CSE",
  "b.e in computer science and engineering": "B.E CSE",
  "b.e computer science & engineering": "B.E CSE",
  "b.e computer science and engineering": "B.E CSE",
  "department of computer science & engineering": "Dept of CSE",
  "department of computer science and engineering": "Dept of CSE",
  "cse": "CSE",

  // AIML
  "artificial intelligence & machine learning": "AI & ML",
  "artificial intelligence and machine learning": "AI & ML",
  "b.tech in artificial intelligence & machine learning": "B.Tech AI & ML",
  "b.tech in artificial intelligence and machine learning": "B.Tech AI & ML",
  "aiml": "AI & ML",
  "ai & ml": "AI & ML",
  "ai&ml": "AI & ML",

  // IT
  "information technology": "IT",
  "b.tech in information technology": "B.Tech IT",
  "department of information technology": "Dept of IT",
  "it": "IT",

  // ECE
  "electronics & communication engineering": "ECE",
  "electronics and communication engineering": "ECE",
  "b.e in electronics & communication engineering": "B.E ECE",
  "ece": "ECE",

  // EEE
  "electrical & electronics engineering": "EEE",
  "electrical and electronics engineering": "EEE",
  "b.e in electrical & electronics engineering": "B.E EEE",
  "eee": "EEE",

  // MECH
  "mechanical engineering": "MECH",
  "b.e in mechanical engineering": "B.E MECH",
  "mech": "MECH",

  // CIVIL
  "civil engineering": "CIVIL",
  "b.e in civil engineering": "B.E CIVIL",
  "civil": "CIVIL",

  // BIOTECH
  "biotechnology": "BIOTECH",
  "b.tech in biotechnology": "B.Tech BioTech",
  "biotech": "BIOTECH",
};

/**
 * Formats a department name to a clean compact version for tight spaces.
 * @param {string} dept - Full or partial department name
 * @param {'short'|'compact'|'code'|'full'} [format='short']
 *   - 'code': e.g. "AI & DS" or "CSE"
 *   - 'short': e.g. "B.Tech AI & DS" or "CSE"
 *   - 'compact': if length > 22 chars, converts to short, else keeps
 * @returns {string}
 */
export function formatDeptName(dept, format = "compact") {
  if (!dept || typeof dept !== "string") return "";
  const trimmed = dept.trim();
  const lower = trimmed.toLowerCase();

  // If code requested
  if (format === "code") {
    if (lower.includes("intelligence") && (lower.includes("data") || lower.includes("ds") || lower.includes("aids"))) return "AI & DS";
    if (lower.includes("intelligence") && (lower.includes("machine") || lower.includes("ml") || lower.includes("aiml"))) return "AI & ML";
    if (lower.includes("computer") || lower === "cse") return "CSE";
    if (lower.includes("information") || lower === "it") return "IT";
    if (lower.includes("electronics") && lower.includes("comm")) return "ECE";
    if (lower.includes("electrical")) return "EEE";
    if (lower.includes("mech")) return "MECH";
    if (lower.includes("civil")) return "CIVIL";
    if (lower.includes("biotech")) return "BIOTECH";
  }

  if (DEPT_SHORT_MAP[lower]) {
    if (format === "code") {
      const mapped = DEPT_SHORT_MAP[lower];
      return mapped.replace(/B\.Tech |B\.E |Dept of /g, "");
    }
    return DEPT_SHORT_MAP[lower];
  }

  // Generalized rule replacements
  let shortened = trimmed
    .replace(/Department of /gi, "Dept of ")
    .replace(/Bachelor of Technology in /gi, "B.Tech ")
    .replace(/Bachelor of Engineering in /gi, "B.E ")
    .replace(/B\.Tech in /gi, "B.Tech ")
    .replace(/B\.E in /gi, "B.E ")
    .replace(/Artificial Intelligence and Data Science/gi, "AI & DS")
    .replace(/Artificial Intelligence & Data Science/gi, "AI & DS")
    .replace(/Artificial Intelligence and Machine Learning/gi, "AI & ML")
    .replace(/Artificial Intelligence & Machine Learning/gi, "AI & ML")
    .replace(/Computer Science and Engineering/gi, "CSE")
    .replace(/Computer Science & Engineering/gi, "CSE")
    .replace(/Electronics and Communication Engineering/gi, "ECE")
    .replace(/Electronics & Communication Engineering/gi, "ECE")
    .replace(/Electrical and Electronics Engineering/gi, "EEE")
    .replace(/Electrical & Electronics Engineering/gi, "EEE")
    .replace(/Information Technology/gi, "IT")
    .replace(/Mechanical Engineering/gi, "MECH")
    .replace(/Civil Engineering/gi, "CIVIL");

  if (format === "code") {
    shortened = shortened.replace(/B\.Tech |B\.E |Dept of /g, "");
  }

  return shortened;
}

export function getShortDept(dept) {
  return formatDeptName(dept, "code");
}
