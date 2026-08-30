/**
 * Timetable PDF Generator & Sharing Utility
 * Converts weekly timetable schedules and student cohort details into a
 * print-ready, high-resolution PDF document with institutional styling.
 */

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { formatDeptName } from "./deptFormatter";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SUBJECT_CODES_MAP = {
  ML: { title: "Machine Learning", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  ADT: { title: "Applied Design Thinking", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  BDA: { title: "Big Data Analytics", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  "X-AI": { title: "Explainable AI", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  SE: { title: "Software Engineering", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  FCC: { title: "Fundamentals of Cloud Computing", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  "ML LAB": { title: "Machine Learning Laboratory", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  "BDA LAB": { title: "Big Data Analytics Laboratory", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  "SE LAB": { title: "Software Engineering Laboratory", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  IOC: { title: "Industry Oriented Course", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  "NPTEL/LIB": { title: "NPTEL / Library", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  MTW: { title: "Mentor & Tutor Ward", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  SET: { title: "Seminar on Emerging Trends", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
  Placement: { title: "Placement & Training", faculty: "Ms. Z. Ananth Angel, AP/AI&DS" },
};

/**
 * Builds standard institutional HTML template for Timetable PDF.
 */
export function generateTimetableHtml({
  timetableData = {},
  cohort = {},
  selectedDay = null, // if null, generates full weekly matrix
}) {
  const deptName = cohort.department || "Artificial Intelligence & Data Science";
  const deptShort = cohort.deptShort || formatDeptName(deptName, "code");
  const year = cohort.year || "III Year";
  const semester = cohort.semester || "5th Semester (V-A)";
  const section = cohort.section ? (cohort.section.includes("Section") ? cohort.section : `Section ${cohort.section}`) : "Section A";
  const advisor = cohort.advisor || "Ms. Z. Ananth Angel, AP/AI&DS";
  const hall = cohort.hall || "D205";
  const batch = cohort.batch || "2024–2028";
  const academicYear = cohort.academicYear || "2026–27 (Odd Semester)";
  const effectiveFrom = cohort.effectiveFrom || "02/07/2026";

  const periodsHeader = `
    <tr>
      <th style="width: 90px;">Day / Time</th>
      <th>9:00–9:55<br><span class="period-tag">Period 1</span></th>
      <th>9:55–10:50<br><span class="period-tag">Period 2</span></th>
      <th class="break-th">10:50–11:10<br><span class="break-tag">Tea Break</span></th>
      <th>11:10–12:00<br><span class="period-tag">Period 3</span></th>
      <th>12:00–12:50<br><span class="period-tag">Period 4</span></th>
      <th class="break-th">12:50–1:40<br><span class="break-tag">Lunch Break</span></th>
      <th>1:40–2:30<br><span class="period-tag">Period 5</span></th>
      <th>2:30–3:20<br><span class="period-tag">Period 6</span></th>
      <th>3:20–4:10<br><span class="period-tag">Period 7</span></th>
    </tr>
  `;

  // Build rows for each day
  const daysToRender = selectedDay && selectedDay !== "All" && DAYS.includes(selectedDay) ? [selectedDay] : DAYS;

  const tableRows = daysToRender
    .map((day) => {
      const daySchedule = timetableData[day] || [];

      // Extract periods (P1 to P7) & Breaks
      const p1 = daySchedule.find((s) => s.time?.includes("9:00")) || { code: "—", subject: "—" };
      const p2 = daySchedule.find((s) => s.time?.includes("9:55") && !s.isBreak) || { code: "—", subject: "—" };
      const p3 = daySchedule.find((s) => s.time?.includes("11:10")) || { code: "—", subject: "—" };
      const p4 = daySchedule.find((s) => s.time?.includes("12:00")) || { code: "—", subject: "—" };
      const p5 = daySchedule.find((s) => s.time?.includes("1:40")) || { code: "—", subject: "—" };
      const p6 = daySchedule.find((s) => s.time?.includes("2:30")) || { code: "—", subject: "—" };
      const p7 = daySchedule.find((s) => s.time?.includes("3:20")) || { code: "—", subject: "—" };

      const formatSlot = (slot) => {
        if (!slot || slot.code === "—") return `<div class="slot-empty">—</div>`;
        const code = slot.code || slot.subject || "—";
        const isLab = /lab/i.test(code) || /lab/i.test(slot.subject);
        return `
          <div class="slot-box ${isLab ? "slot-lab" : "slot-theory"}">
            <span class="slot-code">${code}</span>
            <span class="slot-room">${slot.room || "D205"}</span>
          </div>
        `;
      };

      return `
        <tr>
          <td class="day-td"><strong>${day}</strong></td>
          <td>${formatSlot(p1)}</td>
          <td>${formatSlot(p2)}</td>
          <td class="break-td">☕</td>
          <td>${formatSlot(p3)}</td>
          <td>${formatSlot(p4)}</td>
          <td class="break-td">🍱</td>
          <td>${formatSlot(p5)}</td>
          <td>${formatSlot(p6)}</td>
          <td>${formatSlot(p7)}</td>
        </tr>
      `;
    })
    .join("\n");

  // Subject legend items
  const subjectsLegend = Object.entries(SUBJECT_CODES_MAP)
    .map(
      ([code, item]) => `
      <div class="legend-item">
        <span class="legend-code">${code}</span>
        <span class="legend-title">${item.title}</span>
        <span class="legend-faculty" style="color: #64748b; font-size: 8px;">(${item.faculty})</span>
      </div>
    `
    )
    .join("\n");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>EduNex Academic Timetable - ${deptShort}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-size: 11px;
          }
          .header {
            border-bottom: 2px solid #2563eb;
            padding-bottom: 8px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .inst-title {
            font-size: 18px;
            font-weight: 900;
            color: #1e3a8a;
            letter-spacing: -0.3px;
            margin: 0;
            text-transform: uppercase;
          }
          .inst-sub {
            font-size: 10px;
            color: #64748b;
            margin: 2px 0 0;
          }
          .doc-badge {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1d4ed8;
            padding: 4px 10px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 10.5px;
            text-align: right;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 12px;
            margin-bottom: 12px;
            font-size: 10px;
          }
          .meta-item strong {
            color: #475569;
          }
          .meta-item span {
            color: #0f172a;
            font-weight: 700;
          }

          table.timetable {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            table-layout: fixed;
          }
          table.timetable th, table.timetable td {
            border: 1px solid #cbd5e1;
            padding: 6px 4px;
            text-align: center;
            vertical-align: middle;
          }
          table.timetable th {
            background: #1e293b;
            color: #ffffff;
            font-size: 9.5px;
            font-weight: 700;
            line-height: 1.2;
          }
          table.timetable th.break-th {
            background: #475569;
            width: 50px;
          }
          .period-tag {
            font-size: 8px;
            opacity: 0.85;
            font-weight: normal;
          }
          .break-tag {
            font-size: 7.5px;
            color: #fef08a;
          }
          td.day-td {
            background: #f1f5f9;
            color: #1e293b;
            font-size: 10.5px;
            font-weight: 800;
            text-align: left;
            padding-left: 8px;
          }
          td.break-td {
            background: #f8fafc;
            font-size: 12px;
            color: #64748b;
          }

          .slot-box {
            border-radius: 4px;
            padding: 3px 2px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 38px;
          }
          .slot-theory {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
          }
          .slot-lab {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
          }
          .slot-code {
            font-weight: 900;
            font-size: 11px;
            color: #0f172a;
          }
          .slot-lab .slot-code {
            color: #065f46;
          }
          .slot-theory .slot-code {
            color: #1e40af;
          }
          .slot-room {
            font-size: 8px;
            color: #64748b;
            margin-top: 1px;
          }
          .slot-empty {
            color: #94a3b8;
            font-size: 11px;
          }

          .section-heading {
            font-size: 10px;
            font-weight: 800;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 8px 0 4px;
          }
          .legend-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 9px;
          }
          .legend-item {
            display: flex;
            align-items: center;
            gap: 5px;
          }
          .legend-code {
            background: #1e293b;
            color: #ffffff;
            padding: 1px 4px;
            border-radius: 3px;
            font-weight: 800;
            font-size: 8.5px;
            min-width: 32px;
            text-align: center;
          }
          .legend-title {
            color: #334155;
            font-weight: 600;
          }

          .footer-signatures {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px dashed #cbd5e1;
            font-size: 9.5px;
            color: #475569;
          }
          .sig-box {
            text-align: center;
            min-width: 140px;
          }
          .sig-line {
            border-top: 1px solid #94a3b8;
            margin-top: 24px;
            padding-top: 3px;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <!-- 1. Institutional Header -->
        <div class="header">
          <div>
            <h1 class="inst-title">EduNex Institute of Technology & Science</h1>
            <p class="inst-sub">Autonomous Institution · Affiliated with Anna University · NAAC A++ Accredited</p>
            <p style="margin: 2px 0 0; font-weight: 800; color: #2563eb; font-size: 11px;">
              ${deptName} (${deptShort})
            </p>
          </div>
          <div class="doc-badge">
            OFFICIAL CLASS TIMETABLE<br>
            <span style="font-size: 8.5px; font-weight: 600; color: #475569;">Effective: ${effectiveFrom}</span>
          </div>
        </div>

        <!-- 2. Cohort Metadata -->
        <div class="meta-grid">
          <div class="meta-item"><strong>Degree & Dept:</strong> <span>${deptShort}</span></div>
          <div class="meta-item"><strong>Year & Section:</strong> <span>${year} — ${section}</span></div>
          <div class="meta-item"><strong>Academic Year:</strong> <span>${academicYear}</span></div>
          <div class="meta-item"><strong>Semester:</strong> <span>${semester}</span></div>
          <div class="meta-item"><strong>Lecture Hall:</strong> <span>${hall}</span></div>
          <div class="meta-item"><strong>Class Advisor:</strong> <span>${advisor}</span></div>
          <div class="meta-item"><strong>Batch:</strong> <span>${batch}</span></div>
          <div class="meta-item"><strong>Generated On:</strong> <span>${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></div>
        </div>

        <!-- 3. Weekly Timetable Grid -->
        <table class="timetable">
          <thead>
            ${periodsHeader}
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <!-- 4. Subject Codes Legend -->
        <div class="section-heading">📖 Subject Codes & Course Titles</div>
        <div class="legend-grid">
          ${subjectsLegend}
        </div>

        <!-- 5. Verification Signatures -->
        <div class="footer-signatures">
          <div class="sig-box">
            <div class="sig-line">Class Advisor / Tutor<br>(${advisor})</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Timetable Coordinator<br>(Department of AI & DS)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Head of the Department (HOD)<br>(Dr. K. Senthil Kumar)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Principal / Dean Academic<br>(EduNex Tech)</div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates and shares a generated PDF of the timetable.
 */
export async function shareTimetableAsPdf({ timetableData, cohort, selectedDay = null }) {
  try {
    const html = generateTimetableHtml({ timetableData, cohort, selectedDay });

    // Print to temporary file
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (Platform.OS === "web") {
      await Print.printAsync({ html });
      return { success: true, uri };
    }

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `EduNex Timetable - ${cohort.deptShort || "AI&DS"} (${cohort.year || "III Year"})`,
      });
      return { success: true, uri };
    } else {
      await Print.printAsync({ uri });
      return { success: true, uri };
    }
  } catch (err) {
    console.error("Timetable PDF generation / share error:", err);
    throw err;
  }
}
