import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { formatDeptName } from "./deptFormatter";

const BASE_CSS = `
  @page {
    size: A4 portrait;
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
    background: #ffffff;
    margin: 0;
    padding: 0;
    font-size: 11px;
    line-height: 1.4;
  }
  .header-table {
    width: 100%;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 12px;
    margin-bottom: 14px;
  }
  .inst-title {
    font-size: 18px;
    font-weight: 900;
    color: #1e3a8a;
    letter-spacing: 0.5px;
  }
  .inst-sub {
    font-size: 9.5px;
    color: #64748b;
    font-weight: 500;
    margin-top: 2px;
  }
  .doc-badge {
    display: inline-block;
    background: #2563eb;
    color: #ffffff;
    font-size: 10px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .meta-grid {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }
  .meta-grid td {
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
    font-size: 10.5px;
  }
  .meta-label {
    font-weight: 700;
    color: #475569;
    width: 25%;
  }
  .meta-val {
    font-weight: 600;
    color: #0f172a;
  }
  .section-title {
    font-size: 12px;
    font-weight: 800;
    color: #1e293b;
    border-left: 3px solid #2563eb;
    padding-left: 8px;
    margin: 12px 0 8px 0;
  }
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
  }
  table.data-table th, table.data-table td {
    border: 1px solid #cbd5e1;
    padding: 7px 10px;
    font-size: 10px;
  }
  table.data-table th {
    background: #1e293b;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
  }
  .stamp-box {
    display: inline-block;
    border: 2px solid #10b981;
    color: #10b981;
    padding: 4px 12px;
    font-weight: 900;
    font-size: 12px;
    letter-spacing: 1px;
    border-radius: 4px;
    text-transform: uppercase;
    transform: rotate(-3deg);
  }
  .footer-sig {
    margin-top: 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .sig-block {
    text-align: center;
    width: 28%;
    border-top: 1px dashed #94a3b8;
    padding-top: 6px;
    font-size: 9.5px;
    color: #475569;
    font-weight: 600;
  }
`;

/**
 * Shared helper to print and share any generated HTML
 */
async function printAndShare(html, filename, dialogTitle) {
  try {
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
        dialogTitle: dialogTitle || filename,
      });
      return { success: true, uri };
    } else {
      await Print.printAsync({ uri });
      return { success: true, uri };
    }
  } catch (err) {
    console.error("PDF generation/sharing error:", err);
    throw err;
  }
}

/**
 * 1. FEE RECEIPT PDF GENERATOR
 */
export async function shareFeeReceiptPdf({ receipt = {}, student = {} }) {
  const receiptNo = receipt.id || receipt.receiptNo || `REC-${Date.now().toString().slice(-6)}`;
  const date = receipt.date || receipt.paidDate || new Date().toLocaleDateString("en-GB");
  const studentName = student.name || receipt.studentName || "Student";
  const rollNo = student.rollNo || receipt.rollNo || "—";
  const deptName = student.department || receipt.department || "Artificial Intelligence & Data Science";
  const deptShort = formatDeptName(deptName, "compact");
  const sem = student.semester || receipt.semester || "5th Semester";
  const academicYear = receipt.academicYear || "2026–2027 (Odd Semester)";
  const mode = receipt.paymentMethod || receipt.mode || "Online NetBanking (EduNex Pay)";
  const txnId = receipt.transactionId || receipt.txnId || `TXN-EDX-${Date.now().toString().slice(-8)}`;
  const amount = receipt.amount || receipt.total || "Rs. 45,000";

  const breakdown = receipt.breakdown || [
    { item: "Tuition & Academic Training Fee", amount: "Rs. 32,000" },
    { item: "Specialized Laboratory & Computing Charges", amount: "Rs. 6,500" },
    { item: "Digital Library, IEEE Access & Cloud Labs", amount: "Rs. 3,500" },
    { item: "Placement Training & Career Assessment", amount: "Rs. 3,000" },
  ];

  const breakdownRows = breakdown
    .map(
      (b, i) => `
      <tr>
        <td style="text-align: center; width: 35px;">${i + 1}</td>
        <td><strong>${b.item}</strong></td>
        <td style="text-align: right; font-weight: 700; width: 120px;">${b.amount}</td>
      </tr>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Fee Receipt - ${receiptNo}</title>
        <style>${BASE_CSS}</style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="inst-title">🎓 EDUNEX INSTITUTE OF TECHNOLOGY</div>
              <div class="inst-sub">Autonomous Institution · Affiliated to University · Coimbatore, Tamil Nadu</div>
              <div class="inst-sub">Accredited by NAAC 'A++' Grade · AICTE Approved</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <span class="doc-badge">Official Fee Receipt</span>
              <div style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin-top: 4px;"># ${receiptNo}</div>
              <div style="font-size: 9.5px; color: #64748b;">Date: ${date}</div>
            </td>
          </tr>
        </table>

        <div class="section-title">Student & Cohort Credentials</div>
        <table class="meta-grid">
          <tr>
            <td class="meta-label">Student Name</td>
            <td class="meta-val">${studentName}</td>
            <td class="meta-label">Roll / Reg No</td>
            <td class="meta-val">${rollNo}</td>
          </tr>
          <tr>
            <td class="meta-label">Department</td>
            <td class="meta-val">${deptShort}</td>
            <td class="meta-label">Semester / Year</td>
            <td class="meta-val">${sem} (${student.year || "III Year"})</td>
          </tr>
          <tr>
            <td class="meta-label">Academic Session</td>
            <td class="meta-val">${academicYear}</td>
            <td class="meta-label">Payment Mode</td>
            <td class="meta-val">${mode}</td>
          </tr>
          <tr>
            <td class="meta-label">Transaction Reference</td>
            <td class="meta-val" colspan="3"><code>${txnId}</code></td>
          </tr>
        </table>

        <div class="section-title">Fee Particulars & Itemized Breakdown</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: center; width: 35px;">#</th>
              <th>Fee Head / Particulars Description</th>
              <th style="text-align: right; width: 120px;">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${breakdownRows}
            <tr style="background: #f1f5f9; font-weight: 900;">
              <td colspan="2" style="text-align: right; font-size: 11px;">TOTAL PAID AMOUNT:</td>
              <td style="text-align: right; font-size: 12px; color: #1e3a8a;">${amount}</td>
            </tr>
          </tbody>
        </table>

        <table style="width: 100%; margin-top: 8px;">
          <tr>
            <td style="vertical-align: top; width: 65%;">
              <div style="font-size: 9.5px; color: #64748b; line-height: 1.4;">
                • This receipt is digitally generated by the EduNex ERP Accounts Engine and is legally valid.<br>
                • Fee payments are subject to university clearance rules and exam eligibility.<br>
                • Keep this receipt safely for semester registration, hall ticket issuance, and tax verification.
              </div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <div class="stamp-box">✓ VERIFIED & PAID</div>
            </td>
          </tr>
        </table>

        <div class="footer-sig">
          <div class="sig-block">Student / Depositor</div>
          <div class="sig-block">Finance Officer<br>(EduNex Tech Accounts)</div>
          <div class="sig-block">Authorized Signatory<br>(Registrar)</div>
        </div>
      </body>
    </html>
  `;

  return printAndShare(html, `Fee_Receipt_${receiptNo}.pdf`, `Fee Receipt - ${receiptNo}`);
}

/**
 * 2. STUDENT DIGITAL ID PASS PDF GENERATOR
 */
export async function shareStudentIdCardPdf({ student = {} }) {
  const rollNo = student.rollNo || "STU-001";
  const name = student.name || "Student";
  const dept = student.department || "Artificial Intelligence & Data Science";
  const deptShort = formatDeptName(dept, "compact");
  const year = student.year || "III Year";
  const sem = student.semester || "5th Semester";
  const batch = student.batch || "2024-2028";
  const blood = student.bloodGroup || "—";
  const dob = student.dob || "—";
  const mobile = student.phone || student.mobile || "—";
  const parentName = student.parent?.name || "—";
  const parentPhone = student.parent?.phone || "—";
  const res = student.residentialStatus || (student.hostel ? "Hosteler" : "Day Scholar");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Student ID Pass - ${name}</title>
        <style>${BASE_CSS}</style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="inst-title">🎓 EDUNEX INSTITUTE OF TECHNOLOGY</div>
              <div class="inst-sub">Office of the Registrar · Autonomous Examination Cell</div>
              <div class="inst-sub">Digital Student Verification Pass</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <span class="doc-badge" style="background: #10b981;">Active Student</span>
              <div style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin-top: 4px;">ID: ${rollNo}</div>
            </td>
          </tr>
        </table>

        <div class="section-title">Official Student Identification Dossier</div>
        <table class="meta-grid">
          <tr>
            <td class="meta-label">Full Name</td>
            <td class="meta-val"><strong>${name}</strong></td>
            <td class="meta-label">Roll / Reg No</td>
            <td class="meta-val"><code>${rollNo}</code></td>
          </tr>
          <tr>
            <td class="meta-label">Department</td>
            <td class="meta-val">${deptShort}</td>
            <td class="meta-label">Academic Batch</td>
            <td class="meta-val">${batch}</td>
          </tr>
          <tr>
            <td class="meta-label">Current Standing</td>
            <td class="meta-val">${year} · ${sem}</td>
            <td class="meta-label">Residential Status</td>
            <td class="meta-val">${res}</td>
          </tr>
          <tr>
            <td class="meta-label">Date of Birth</td>
            <td class="meta-val">${dob}</td>
            <td class="meta-label">Blood Group</td>
            <td class="meta-val" style="color: #dc2626; font-weight: 800;">${blood}</td>
          </tr>
          <tr>
            <td class="meta-label">Student Contact</td>
            <td class="meta-val">${mobile}</td>
            <td class="meta-label">Primary Guardian</td>
            <td class="meta-val">${parentName} (${parentPhone})</td>
          </tr>
        </table>

        <div class="section-title">Institutional Privileges & Approvals</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Facility / Privilege Area</th>
              <th>Status</th>
              <th>Authorization Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Campus Smart Turnstile Access</td>
              <td><strong style="color: #10b981;">GRANTED</strong></td>
              <td>RFID Turnstile & Biometric Automated Entry Gate</td>
            </tr>
            <tr>
              <td>Central Library Borrowing Permit</td>
              <td><strong style="color: #10b981;">ACTIVE</strong></td>
              <td>Up to 4 Books + IEEE Digital Xplore Term Access</td>
            </tr>
            <tr>
              <td>Autonomous Exam Hall Eligibility</td>
              <td><strong style="color: #10b981;">VERIFIED</strong></td>
              <td>Eligible for CIA-1, CIA-2 and End Semester Examination</td>
            </tr>
            <tr>
              <td>High Performance Computing & AI Labs</td>
              <td><strong style="color: #10b981;">AUTHORIZED</strong></td>
              <td>NVIDIA GPU Compute Cluster & Spark Data Lab</td>
            </tr>
          </tbody>
        </table>

        <div class="footer-sig" style="margin-top: 40px;">
          <div class="sig-block">Student Signature</div>
          <div class="sig-block">Head of Department<br>(${deptShort})</div>
          <div class="sig-block">Dean / University Registrar<br>(Official Seal)</div>
        </div>
      </body>
    </html>
  `;

  return printAndShare(html, `Student_ID_${rollNo}.pdf`, `Student ID Pass - ${name}`);
}

/**
 * 3. LEAVE & OD GATE PASS PDF GENERATOR
 */
export async function shareLeaveGatePassPdf({ leave = {}, student = {} }) {
  const passId = leave.id || `PASS-${Date.now().toString().slice(-6)}`;
  const name = student.name || leave.studentName || "Student";
  const rollNo = student.rollNo || leave.rollNo || "—";
  const dept = student.department || "Artificial Intelligence & Data Science";
  const deptShort = formatDeptName(dept, "compact");
  const leaveType = leave.type || leave.leaveType || "On Duty (OD) Permission";
  const reason = leave.reason || "Official Academic Seminar & Project Work";
  const fromDate = leave.startDate || leave.fromDate || "28 Aug 2026";
  const toDate = leave.endDate || leave.toDate || "29 Aug 2026";
  const days = leave.durationLabel || leave.days || leave.duration || (leave.daysCount === 0.5 ? "Half Day" : "1 Day");
  const status = leave.status || "Approved";
  const approvedBy = leave.approvedByName || leave.approvedBy || "Ms. Z. Ananth Angel (Class Tutor)";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Leave Pass - ${passId}</title>
        <style>${BASE_CSS}</style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="inst-title">🎓 EDUNEX INSTITUTE OF TECHNOLOGY</div>
              <div class="inst-sub">Office of Student Affairs & Warden Administration</div>
              <div class="inst-sub">Official Campus Leave & Outing Gate Pass</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <span class="doc-badge" style="background: #10b981;">${status}</span>
              <div style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin-top: 4px;"># ${passId}</div>
            </td>
          </tr>
        </table>

        <div class="section-title">Student Particulars</div>
        <table class="meta-grid">
          <tr>
            <td class="meta-label">Student Name</td>
            <td class="meta-val"><strong>${name}</strong></td>
            <td class="meta-label">Roll Number</td>
            <td class="meta-val">${rollNo}</td>
          </tr>
          <tr>
            <td class="meta-label">Department</td>
            <td class="meta-val">${deptShort}</td>
            <td class="meta-label">Standing</td>
            <td class="meta-val">${student.year || "III Year"} · ${student.section || "Sec A"}</td>
          </tr>
        </table>

        <div class="section-title">Leave & Absence Details</div>
        <table class="meta-grid">
          <tr>
            <td class="meta-label">Permission Category</td>
            <td class="meta-val" colspan="3"><strong>${leaveType}</strong></td>
          </tr>
          <tr>
            <td class="meta-label">From Date</td>
            <td class="meta-val">${fromDate}</td>
            <td class="meta-label">To Date</td>
            <td class="meta-val">${toDate}</td>
          </tr>
          <tr>
            <td class="meta-label">Total Duration</td>
            <td class="meta-val">${days}</td>
            <td class="meta-label">Approval Authority</td>
            <td class="meta-val">${approvedBy}</td>
          </tr>
          <tr>
            <td class="meta-label">Reason / Justification</td>
            <td class="meta-val" colspan="3">${reason}</td>
          </tr>
        </table>

        <table style="width: 100%; margin-top: 14px;">
          <tr>
            <td style="vertical-align: top; width: 65%;">
              <div style="font-size: 9.5px; color: #64748b; line-height: 1.4;">
                • Present this QR gate pass at the Main Security Archway during campus egress.<br>
                • Student must report back to campus strictly within the sanctioned timeframe.<br>
                • Approved electronically through EduNex HOD / Faculty Portal.
              </div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <div class="stamp-box" style="border-color: #10b981; color: #10b981;">✓ GATE AUTHORIZED</div>
            </td>
          </tr>
        </table>

        <div class="footer-sig" style="margin-top: 40px;">
          <div class="sig-block">Student Signature</div>
          <div class="sig-block">Class Tutor / Advisor<br>(${approvedBy})</div>
          <div class="sig-block">Security In-Charge<br>(Main Gate Post)</div>
        </div>
      </body>
    </html>
  `;

  return printAndShare(html, `GatePass_${passId}.pdf`, `Gate Pass - ${name}`);
}

/**
 * 4. COURSE SYLLABUS PDF GENERATOR
 */
export async function shareCourseSyllabusPdf({ course = {}, student = {} }) {
  const code = course.code || course.shortCode || "AD-501";
  const name = course.name || course.title || "Course Subject";
  const credits = course.credits || "3";
  const type = course.type || "Theory";
  const faculty = course.faculty || course.facultyInCharge || "Ms. Z. Ananth Angel, AP/AI&DS";
  const dept = student.department || "Artificial Intelligence & Data Science";
  const deptShort = formatDeptName(dept, "compact");

  const units = course.units || [
    "Unit 1: Fundamental Concepts & Architecture",
    "Unit 2: Core Algorithms & Methodologies",
    "Unit 3: Design Patterns & Implementation",
    "Unit 4: Advanced Systems & Testing Frameworks",
    "Unit 5: Enterprise Deployment & Emerging Trends",
  ];

  const unitsHtml = units
    .map(
      (u, i) => `
      <tr>
        <td style="text-align: center; width: 40px; font-weight: 800;">${i + 1}</td>
        <td><strong>${u}</strong></td>
        <td style="text-align: center; width: 100px; color: #10b981; font-weight: 700;">Completed</td>
      </tr>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Syllabus - ${code}</title>
        <style>${BASE_CSS}</style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="inst-title">🎓 EDUNEX INSTITUTE OF TECHNOLOGY</div>
              <div class="inst-sub">Department of ${dept}</div>
              <div class="inst-sub">Official Academic Course Curriculum & Unit Plan</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <span class="doc-badge">${code}</span>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Credits: ${credits} · ${type}</div>
            </td>
          </tr>
        </table>

        <div class="section-title">Course Overview</div>
        <table class="meta-grid">
          <tr>
            <td class="meta-label">Course Title</td>
            <td class="meta-val"><strong>${name}</strong></td>
            <td class="meta-label">Course Code</td>
            <td class="meta-val"><code>${code}</code></td>
          </tr>
          <tr>
            <td class="meta-label">Faculty in Charge</td>
            <td class="meta-val">${faculty}</td>
            <td class="meta-label">Department</td>
            <td class="meta-val">${deptShort}</td>
          </tr>
        </table>

        <div class="section-title">Detailed Unit Structure & Syllabus Plan</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">Unit</th>
              <th>Curriculum Topics & Coverage Objectives</th>
              <th style="text-align: center; width: 100px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${unitsHtml}
          </tbody>
        </table>

        <div class="footer-sig" style="margin-top: 30px;">
          <div class="sig-block">Subject Faculty<br>(${faculty})</div>
          <div class="sig-block">Curriculum Coordinator<br>(Department of AI & DS)</div>
          <div class="sig-block">Dean Academic<br>(EduNex Tech)</div>
        </div>
      </body>
    </html>
  `;

  return printAndShare(html, `Syllabus_${code}.pdf`, `Syllabus - ${name}`);
}

/**
 * 5. DOCSPACE CREDENTIAL & CERTIFICATE PDF
 */
export async function shareDocSpaceCertificatePdf({ doc = {}, student = {} }) {
  const serial = doc.serialNo || doc.id || `DOC-${Date.now().toString().slice(-6)}`;
  const title = doc.title || "Academic Verification Credential";
  const cat = doc.category || "Official Document";
  const name = student.name || "Student";
  const roll = student.rollNo || "—";
  const dept = student.department || "Artificial Intelligence & Data Science";
  const deptShort = formatDeptName(dept, "compact");
  const status = (doc.status || "VERIFIED").toUpperCase();
  const verifier = doc.verifiedBy || "Registrar Administrative Cell";
  const date = doc.verifiedAt || doc.updatedAt || new Date().toLocaleDateString("en-GB");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>DocSpace Credential - ${title}</title>
        <style>${BASE_CSS}</style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="inst-title">🎓 EDUNEX INSTITUTE OF TECHNOLOGY</div>
              <div class="inst-sub">Office of Academic Records & DocSpace Vault</div>
              <div class="inst-sub">Institutional Document Verification Certificate</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <span class="doc-badge" style="background: #10b981;">${status}</span>
              <div style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin-top: 4px;">Serial: ${serial}</div>
              <div style="font-size: 9px; color: #64748b;">Issued: ${date}</div>
            </td>
          </tr>
        </table>

        <div class="section-title">Student Particulars</div>
        <table class="meta-grid">
          <tr>
            <td class="meta-label">Credential Holder</td>
            <td class="meta-val"><strong>${name}</strong></td>
            <td class="meta-label">Roll / Reg Number</td>
            <td class="meta-val"><code>${roll}</code></td>
          </tr>
          <tr>
            <td class="meta-label">Department</td>
            <td class="meta-val">${deptShort}</td>
            <td class="meta-label">Academic Program</td>
            <td class="meta-val">B.Tech (${student.year || "III Year"})</td>
          </tr>
        </table>

        <div class="section-title">Document & Verification Audit Details</div>
        <table class="meta-grid">
          <tr>
            <td class="meta-label">Document Title</td>
            <td class="meta-val" colspan="3"><strong>${title}</strong></td>
          </tr>
          <tr>
            <td class="meta-label">Category / Classification</td>
            <td class="meta-val">${cat}</td>
            <td class="meta-label">Verification Status</td>
            <td class="meta-val" style="color: #10b981; font-weight: 800;">${status}</td>
          </tr>
          <tr>
            <td class="meta-label">Verifying Authority</td>
            <td class="meta-val">${verifier}</td>
            <td class="meta-label">Cryptographic Hash</td>
            <td class="meta-val"><code>SHA-256 / ${Date.now().toString(16).toUpperCase()}</code></td>
          </tr>
        </table>

        <table style="width: 100%; margin-top: 18px;">
          <tr>
            <td style="vertical-align: top; width: 65%;">
              <div style="font-size: 9.5px; color: #64748b; line-height: 1.4;">
                • This certificate confirms the authenticity of the stored record within the EduNex DocSpace Vault.<br>
                • Institutional verification signature and digital cryptographic seals are validated.<br>
                • Tamper-evident electronic record recognized by University Examination Cell.
              </div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <div class="stamp-box">✓ SEALED & AUDITED</div>
            </td>
          </tr>
        </table>

        <div class="footer-sig" style="margin-top: 40px;">
          <div class="sig-block">Student Depositor</div>
          <div class="sig-block">Academic Records In-Charge<br>(${verifier})</div>
          <div class="sig-block">Dean / Registrar<br>(University Seal)</div>
        </div>
      </body>
    </html>
  `;

  return printAndShare(html, `Doc_${serial}.pdf`, `DocSpace Credential - ${title}`);
}

/**
 * 6. ASSIGNMENT BRIEF PDF
 */
export async function shareAssignmentBriefPdf({ assignment = {}, student = {} }) {
  const asgId = assignment.id || `ASG-${Date.now().toString().slice(-4)}`;
  const title = assignment.title || "Academic Assignment";
  const subject = assignment.subject || "Machine Learning";
  const deadline = assignment.dueDate || assignment.deadline || "10 Sep 2026";
  const faculty = assignment.faculty || "Ms. Z. Ananth Angel, AP/AI&DS";
  const maxMarks = assignment.maxMarks || assignment.marks || "50";
  const desc = assignment.description || assignment.brief || "Complete all problem sets and upload Jupyter notebook/code repository.";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Assignment - ${title}</title>
        <style>${BASE_CSS}</style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="inst-title">🎓 EDUNEX INSTITUTE OF TECHNOLOGY</div>
              <div class="inst-sub">Department of Artificial Intelligence & Data Science</div>
              <div class="inst-sub">Official Academic Assignment Task Brief</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <span class="doc-badge" style="background: #f59e0b;">Assignment Brief</span>
              <div style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin-top: 4px;"># ${asgId}</div>
            </td>
          </tr>
        </table>

        <div class="section-title">Assignment Particulars</div>
        <table class="meta-grid">
          <tr>
            <td class="meta-label">Task Title</td>
            <td class="meta-val" colspan="3"><strong>${title}</strong></td>
          </tr>
          <tr>
            <td class="meta-label">Subject / Course</td>
            <td class="meta-val">${subject}</td>
            <td class="meta-label">Faculty in Charge</td>
            <td class="meta-val">${faculty}</td>
          </tr>
          <tr>
            <td class="meta-label">Submission Due Date</td>
            <td class="meta-val" style="color: #dc2626; font-weight: 800;">${deadline}</td>
            <td class="meta-label">Maximum Assessment Marks</td>
            <td class="meta-val">${maxMarks} Marks</td>
          </tr>
        </table>

        <div class="section-title">Assignment Description & Requirements</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 11px; line-height: 1.5; color: #334155;">
          ${desc}
        </div>

        <div class="footer-sig" style="margin-top: 50px;">
          <div class="sig-block">Faculty Evaluator<br>(${faculty})</div>
          <div class="sig-block">Head of Department<br>(AI & DS)</div>
        </div>
      </body>
    </html>
  `;

  return printAndShare(html, `Assignment_${asgId}.pdf`, `Assignment - ${title}`);
}

/**
 * 7. OFFICIAL EXAMINATION HALL TICKET PDF
 */
export async function shareHallTicketPdf({ student = {}, exams = [], examSettings = {} }) {
  const name = student.name || "Student";
  const rollNo = student.rollNo || student.id || "STU-2024-AIDS01";
  const regNo = student.regNo || rollNo.replace("STU-", "REG-");
  const dept = student.department || "Artificial Intelligence & Data Science";
  const deptShort = formatDeptName(dept, "compact");
  const year = student.year || "III Year";
  const sem = student.semester || "5th Semester";
  const sessionName = examSettings.session || "Continuous Internal Assessment (CIA-2)";
  const academicYear = examSettings.academicYear || "2026–2027 (Odd Semester)";
  const center = examSettings.center || "Hall D205, Department of AI & DS, Main Block";
  const coeName = examSettings.coe || "Prof. S. R. Ramachandran, Ph.D. (Controller of Examinations)";

  const defaultExams = [
    { date: "15 Sep 2026", time: "10:00 AM - 01:00 PM", code: "AD-506", subject: "Machine Learning" },
    { date: "17 Sep 2026", time: "10:00 AM - 01:00 PM", code: "AD-502", subject: "Big Data Analytics" },
    { date: "19 Sep 2026", time: "10:00 AM - 01:00 PM", code: "AD-501", subject: "Software Engineering" },
    { date: "21 Sep 2026", time: "10:00 AM - 01:00 PM", code: "AD-504", subject: "Applied Design Thinking" },
    { date: "23 Sep 2026", time: "10:00 AM - 01:00 PM", code: "AD-505", subject: "Fundamentals of Cloud Computing" },
    { date: "25 Sep 2026", time: "10:00 AM - 01:00 PM", code: "AD-509", subject: "Explainable AI" },
  ];

  const examList = exams.length > 0 ? exams : defaultExams;

  const examRows = examList
    .map(
      (e, i) => `
      <tr>
        <td style="text-align: center; font-weight: 700; width: 30px;">${i + 1}</td>
        <td style="font-weight: 600; width: 95px;">${e.date}</td>
        <td style="font-size: 9.5px; width: 110px;">${e.time}</td>
        <td style="font-weight: 800; text-align: center; width: 70px;"><code>${e.code || e.subjectCode || "AD-50" + (i + 1)}</code></td>
        <td><strong>${e.subject || e.subjectName || e.title}</strong></td>
        <td style="width: 80px; text-align: center; color: #94a3b8; font-size: 8px;">[ Invigilator Sign ]</td>
      </tr>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Hall Ticket - ${rollNo}</title>
        <style>${BASE_CSS}</style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="inst-title">🎓 EDUNEX INSTITUTE OF TECHNOLOGY</div>
              <div class="inst-sub">Autonomous Institution · Affiliated to Anna University · Coimbatore</div>
              <div class="inst-sub">Office of the Controller of Examinations · Examination Cell</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <span class="doc-badge" style="background: #2563eb;">Official Hall Ticket</span>
              <div style="font-size: 10px; font-weight: 800; color: #1e3a8a; margin-top: 4px;">${sessionName}</div>
              <div style="font-size: 9px; color: #64748b;">Academic Year: ${academicYear}</div>
            </td>
          </tr>
        </table>

        <div class="section-title">Candidate & Cohort Particulars</div>
        <table class="meta-grid">
          <tr>
            <td class="meta-label">Candidate Name</td>
            <td class="meta-val"><strong>${name}</strong></td>
            <td class="meta-label">Register Number</td>
            <td class="meta-val"><code>${regNo}</code></td>
          </tr>
          <tr>
            <td class="meta-label">Roll Number</td>
            <td class="meta-val"><code>${rollNo}</code></td>
            <td class="meta-label">Department / Branch</td>
            <td class="meta-val">${deptShort}</td>
          </tr>
          <tr>
            <td class="meta-label">Degree & Program</td>
            <td class="meta-val">B.Tech in Artificial Intelligence & Data Science</td>
            <td class="meta-label">Semester / Standing</td>
            <td class="meta-val">${sem} (${year})</td>
          </tr>
          <tr>
            <td class="meta-label">Examination Venue / Center</td>
            <td class="meta-val" colspan="3"><strong>${center}</strong></td>
          </tr>
        </table>

        <div class="section-title">Registered Courses & Examination Time Schedule</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: center; width: 30px;">#</th>
              <th style="width: 95px;">Exam Date</th>
              <th style="width: 110px;">Session Timing</th>
              <th style="text-align: center; width: 70px;">Course Code</th>
              <th>Course Name / Subject Title</th>
              <th style="text-align: center; width: 80px;">Verification</th>
            </tr>
          </thead>
          <tbody>
            ${examRows}
          </tbody>
        </table>

        <div class="section-title" style="margin-top: 10px;">Important Instructions to Candidates</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 9.5px; line-height: 1.4; color: #475569;">
          1. Candidates must occupy their designated seats 15 minutes before the commencement of the exam.<br>
          2. No student will be admitted into the examination hall without this official Hall Ticket and College ID Card.<br>
          3. Possession of mobile phones, smartwatches, or programmable calculators in the exam hall is strictly prohibited.<br>
          4. Hall Ticket must be preserved until the publication of end-semester results.
        </div>

        <div class="footer-sig" style="margin-top: 30px;">
          <div class="sig-block">Signature of Candidate</div>
          <div class="sig-block">Chief Superintendent<br>(Examination Center D205)</div>
          <div class="sig-block">${coeName}<br>(Controller of Examinations)</div>
        </div>
      </body>
    </html>
  `;

  return printAndShare(html, `Hall_Ticket_${rollNo}.pdf`, `Hall Ticket - ${name} (${rollNo})`);
}

export async function shareSeatingPlanPdf(planData = {}) {
  const classrooms = planData.classrooms || [];
  const examTitle = planData.examTitle || "End-Semester Examinations 2026";
  const dateStr = planData.date || new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const totalStudents = planData.totalStudents || 0;
  const totalCapacity = planData.totalCapacity || 0;
  const classroomCount = planData.classroomCount || classrooms.length || 4;
  const benchCount = planData.benchCount || 25;
  const studentsPerBench = planData.studentsPerBench || 2;

  const hallTables = classrooms.map((hall) => `
    <div style="margin-bottom: 16px; page-break-inside: avoid;">
      <div style="background: #1e3a8a; color: #ffffff; padding: 6px 10px; font-weight: 800; font-size: 11px; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between;">
        <span>HALL ${hall.roomNumber || hall.name} · ${hall.block || "Academic Complex"}</span>
        <span>Invigilator: ${hall.supervisor || "Staff Invigilator"} | Capacity: ${hall.capacity || (benchCount * studentsPerBench)}</span>
      </div>
      <table class="data-table" style="margin-bottom: 0;">
        <thead>
          <tr>
            <th style="width: 70px;">Bench #</th>
            <th style="width: 140px;">Seat A (Left)</th>
            <th style="width: 140px;">Seat B (Right)</th>
            <th>Roll Number Range</th>
            <th style="width: 80px; text-align: center;">Allocated</th>
          </tr>
        </thead>
        <tbody>
          ${(hall.benches || []).slice(0, 12).map((b, bIdx) => `
            <tr>
              <td style="font-weight: 700;">Bench ${b.benchNo || (bIdx + 1)}</td>
              <td>${b.seatA || "—"}</td>
              <td>${b.seatB || "—"}</td>
              <td style="font-family: monospace;">${b.range || "—"}</td>
              <td style="text-align: center; font-weight: 700; color: #16a34a;">${b.count || studentsPerBench}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div style="padding: 4px 8px; background: #f1f5f9; font-size: 9px; color: #475569; border: 1px solid #cbd5e1; border-top: none; display: flex; justify-content: space-between;">
        <span>Total Allocated for ${hall.roomNumber || hall.name}: <b>${hall.allocatedCount || (hall.students || []).length} Students</b></span>
        <span>Roll Range: <b>${hall.startRoll || "—"} → ${hall.endRoll || "—"}</b></span>
      </div>
    </div>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Master Seating Arrangement Roster</title>
        <style>
          ${BASE_CSS}
          .summary-box {
            display: flex;
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 12px;
          }
          .summary-item {
            flex: 1;
            text-align: center;
          }
          .summary-item .num {
            font-size: 14px;
            font-weight: 800;
            color: #1e3a8a;
          }
          .summary-item .lbl {
            font-size: 8.5px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="inst-title">EDUNEX AUTONOMOUS INSTITUTION OF ENGINEERING & TECH</div>
              <div class="inst-sub">Office of the Controller of Examinations · Automated Seating & Hall Allocation</div>
              <div class="doc-badge">OFFICIAL SEATING MATRIX & INSTRUCTION ROSTER</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <div style="font-size: 11px; font-weight: 800; color: #1e3a8a;">EXAM DATE: ${dateStr}</div>
              <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Session: ${planData.sessionTime || "Morning (09:30 AM - 12:30 PM)"}</div>
              <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 2px;">STATUS: VERIFIED & SEALED</div>
            </td>
          </tr>
        </table>

        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <div><b>Examination:</b> ${examTitle}</div>
          <div><b>Seating Config:</b> ${classroomCount} Halls · ${benchCount} Benches/Hall · ${studentsPerBench} Students/Bench</div>
        </div>

        <div class="summary-box">
          <div class="summary-item"><div class="num">${classroomCount}</div><div class="lbl">Total Classrooms</div></div>
          <div class="summary-item"><div class="num">${totalCapacity}</div><div class="lbl">Gross Seat Capacity</div></div>
          <div class="summary-item"><div class="num">${totalStudents}</div><div class="lbl">Students Allocated</div></div>
          <div class="summary-item"><div class="num" style="color: #16a34a;">${Math.max(0, totalCapacity - totalStudents)}</div><div class="lbl">Vacant / Buffer Seats</div></div>
        </div>

        ${hallTables}

        <div class="footer-sig" style="margin-top: 24px;">
          <div class="sig-block">Prepared by<br>Administrative Exam Coordinator</div>
          <div class="sig-block">Verified by<br>Chief Superintendent (Hall Security)</div>
          <div class="sig-block">Approved by<br>Controller of Examinations</div>
        </div>
      </body>
    </html>
  `;

  return printAndShare(html, `Seating_Plan_${Date.now()}.pdf`, `Seating Arrangement Plan - ${examTitle}`);
}

export async function shareExecutiveReportPdf(reportData = {}) {
  const title = reportData.title || "Campus Executive Intelligence Report";
  const category = reportData.category || "General";
  const period = reportData.period || "Current Academic Term";
  const dept = reportData.dept || "All Departments";
  const dateStr = new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const highlights = reportData.highlights || [];
  const details = reportData.details || {};

  const highlightRows = highlights.map((h) => `
    <tr>
      <td style="font-weight: 700; width: 45%;">${h.label || "Metric"}</td>
      <td style="width: 25%; font-weight: 800; color: #1e3a8a;">${h.value || "—"}</td>
      <td style="width: 30%;">
        <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
          <div style="background: #2563eb; width: ${h.bar || '75%'}; height: 100%;"></div>
        </div>
      </td>
    </tr>
  `).join("");

  const detailRows = Object.entries(details).map(([k, v]) => `
    <tr>
      <td style="font-weight: 700; color: #475569; width: 50%;">${k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</td>
      <td style="font-weight: 800; color: #0f172a;">${v}</td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          ${BASE_CSS}
          .kpi-badge {
            display: inline-block;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1d4ed8;
            padding: 3px 8px;
            border-radius: 4px;
            font-weight: 800;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="inst-title">EDUNEX AUTONOMOUS INSTITUTION OF ENGINEERING & TECH</div>
              <div class="inst-sub">Executive Analytics & Institutional Audit Division</div>
              <div class="doc-badge">OFFICIAL DOMAIN INTELLIGENCE REPORT</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <div style="font-size: 11px; font-weight: 800; color: #1e3a8a;">DATE: ${dateStr}</div>
              <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Scope: ${dept} · Period: ${period}</div>
              <div class="kpi-badge" style="margin-top: 4px;">CATEGORY: ${category.toUpperCase()}</div>
            </td>
          </tr>
        </table>

        <div style="font-size: 14px; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 10px; color: #64748b; margin-bottom: 12px;">Automated Institutional Audit & Statistical Breakdown</div>

        <div class="section-title">Departmental & Performance Breakdown</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Evaluation Parameter</th>
              <th>Score / Realization</th>
              <th>Benchmark Progress</th>
            </tr>
          </thead>
          <tbody>
            ${highlightRows || '<tr><td colspan="3" style="text-align:center;">No breakdown metrics recorded</td></tr>'}
          </tbody>
        </table>

        <div class="section-title" style="margin-top: 14px;">Key Governance & Operational Summary</div>
        <table class="data-table">
          <tbody>
            ${detailRows || '<tr><td colspan="2" style="text-align:center;">Standard operational parameters compliant</td></tr>'}
          </tbody>
        </table>

        <div class="footer-sig" style="margin-top: 30px;">
          <div class="sig-block">Prepared by<br>Senior Analytics Officer</div>
          <div class="sig-block">Audited by<br>Dean of Academic Affairs</div>
          <div class="sig-block">Approved by<br>Principal / Director</div>
        </div>
      </body>
    </html>
  `;

  return printAndShare(html, `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.pdf`, `${title} - EduNex Analytics`);
}




