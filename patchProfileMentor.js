const fs = require('fs');
const filePath = 'd:\\edunex\\app\\screens\\students\\ProfileScreen.js';
let code = fs.readFileSync(filePath, 'utf8');

const targetSnippet = `      if (apiStudent || sessionUser) {
        const rollSeed = apiStudent?.rollNo || sessionUser?.rollNo || sessionUser?.username || "velu";

        setUser((prev) => {
          const initialNick =
      console.warn("Profile load error:", _e);
    } finally {`;

const replacementSnippet = `      if (apiStudent || sessionUser) {
        const rollSeed = apiStudent?.rollNo || sessionUser?.rollNo || sessionUser?.username || "velu";

        setUser((prev) => {
          const initialNick =
            apiStudent?.nickname ||
            sessionUser?.nickname ||
            prev.nickname ||
            getDeterministicNickname(rollSeed);

          return {
            ...prev,
            name: apiStudent?.name || sessionUser?.profile?.name || sessionUser?.name || prev.name || "Velu",
            nickname: initialNick,
            id: apiStudent?.rollNo || apiStudent?.id || prev.id || "STU-2024-AIDS01",
            regNo: apiStudent?.regNo || prev.regNo || "718124104001",
            email: apiStudent?.email || sessionUser?.email || prev.email || "velu@edunex.edu",
            phone: apiStudent?.phone || sessionUser?.mobile || prev.phone || "+91 98000 10001",
            program: apiStudent?.department || prev.program || "B.Tech - Artificial Intelligence & Data Science",
            address: apiStudent?.parent?.address || apiStudent?.address || prev.address || "15, Gandhipuram, Coimbatore",
            bloodGroup: apiStudent?.bloodGroup || prev.bloodGroup || "—",
            batch: apiStudent?.batch || prev.batch || "2024–2028",
            department: apiStudent?.department || prev.department || "Artificial Intelligence & Data Science",
            semester: apiStudent?.semester || prev.semester || "5th Semester",
            dob: apiStudent?.dob || prev.dob || "15 May 2004",
            advisor:
              (typeof apiStudent?.advisor === "string" ? apiStudent.advisor : apiStudent?.advisor?.name) ||
              apiStudent?.mentorName ||
              apiStudent?.mentor ||
              sessionUser?.advisor ||
              sessionUser?.mentor ||
              prev.advisor ||
              "Ms. Z. Ananth Angel",
            mentorEmail:
              apiStudent?.mentorEmail ||
              apiStudent?.advisorEmail ||
              (typeof apiStudent?.advisor === "object" ? apiStudent.advisor?.email : "") ||
              sessionUser?.mentorEmail ||
              prev.mentorEmail ||
              "ananthangel@edunex.edu",
            mentorPhone:
              apiStudent?.mentorPhone ||
              apiStudent?.advisorPhone ||
              prev.mentorPhone ||
              "+91 98000 10008",
            residentialStatus:
              apiStudent?.residentialStatus ||
              (typeof apiStudent?.hostel === "boolean"
                ? apiStudent.hostel
                  ? "Hosteler"
                  : "Day Scholar (Inside)"
                : apiStudent?.hostel) ||
              prev.residentialStatus ||
              "Day Scholar (Inside)",
            hostel:
              apiStudent?.residentialStatus ||
              (typeof apiStudent?.hostel === "boolean"
                ? apiStudent.hostel
                  ? "Hosteler"
                  : "Day Scholar (Inside)"
                : apiStudent?.hostel) ||
              prev.hostel ||
              "Day Scholar (Inside)",
            fatherName: apiStudent?.parent?.name || prev.fatherName || "Kumar",
            fatherPhone: apiStudent?.parent?.phone || apiStudent?.parent?.mobile || prev.fatherPhone || "+91 98000 10003",
            motherName: apiStudent?.motherName || apiStudent?.parent?.motherName || prev.motherName || "Revathi",
            emergencyContact: apiStudent?.emergencyContact || apiStudent?.parent?.phone || prev.emergencyContact || "+91 98000 10003",
          };
        });
      } else {
        const local = await AsyncStorage.getItem(PROFILE_DATA_KEY);
        if (local) setUser(JSON.parse(local));
      }
    } catch (_e) {
      console.warn("Profile load error:", _e);
    } finally {`;

if (code.includes(targetSnippet)) {
  code = code.replace(targetSnippet, replacementSnippet);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Successfully patched ProfileScreen.js with mentor data!');
} else {
  console.log('Target snippet not found in ProfileScreen.js');
}
