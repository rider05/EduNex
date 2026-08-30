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
  const days = leave.days || leave.duration || "2 Days";
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

