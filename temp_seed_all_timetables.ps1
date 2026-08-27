$ErrorActionPreference = "Stop"
$baseUrl = "https://edunex-backend-rmvx.onrender.com/api/v1"

Write-Host "=== Timetable Seeder ===" -ForegroundColor Cyan
Write-Host "Target: $baseUrl`n" -ForegroundColor Gray

$departments = @(
    @{ Code = "AIDS"; Name = "AI & Data Science";              Color = "#8B5CF6"; Subjects = @("Data Structures", "Python Programming", "Data Structures & Visualization", "OOP in Java", "AI Fundamentals", "DBMS", "Probability & Statistics", "Placement Training") }
    @{ Code = "CSE";  Name = "Computer Science & Engineering"; Color = "#16A34A"; Subjects = @("Programming in C", "Digital Logic Design", "Operating Systems", "DBMS", "Computer Networks", "Engineering Mathematics", "Physics", "English") }
    @{ Code = "AIML"; Name = "AI & Machine Learning";          Color = "#F59E0B"; Subjects = @("Intro to AI", "Python Programming", "Data Structures", "Machine Learning Basics", "Deep Learning", "Engineering Mathematics", "Physics", "English") }
    @{ Code = "CSBS"; Name = "Cyber Security";                 Color = "#EF4444"; Subjects = @("Cyber Security Fundamentals", "Cryptography", "Network Security", "Ethical Hacking", "Digital Logic Design", "C Programming", "Physics", "English") }
    @{ Code = "IT";   Name = "Information Technology";         Color = "#3B82F6"; Subjects = @("Computer Fundamentals", "Java Programming", "Data Structures", "Web Technologies", "DBMS", "Engineering Mathematics", "Physics", "English") }
    @{ Code = "ECE";  Name = "Electronics & Communication Engineering"; Color = "#EC4899"; Subjects = @("Basic Electronics", "Digital Logic Design", "Signals & Systems", "Communication Systems", "VLSI Introduction", "Engineering Mathematics", "Physics", "English") }
    @{ Code = "EEE";  Name = "Electrical & Electronics Engineering";   Color = "#F97316"; Subjects = @("Basic Electrical Engineering", "Circuit Theory", "Power Systems", "Control Systems", "Electrical Machines", "Engineering Mathematics", "Physics", "English") }
    @{ Code = "MECH"; Name = "Mechanical Engineering";         Color = "#6366F1"; Subjects = @("Thermodynamics", "Fluid Mechanics", "Manufacturing Processes", "Strength of Materials", "Engineering Dynamics", "Engineering Mathematics", "Physics", "English") }
    @{ Code = "MCT";  Name = "Mechatronics";                   Color = "#14B8A6"; Subjects = @("Mechatronics Introduction", "Sensors & Transducers", "Actuators", "Control Systems", "Robotics", "Engineering Mathematics", "Physics", "English") }
    @{ Code = "VLSI"; Name = "VLSI Design & Technology";       Color = "#A855F7"; Subjects = @("VLSI Design Fundamentals", "CMOS Circuit Design", "ASIC Design", "Digital Design", "FPGA Programming", "Engineering Mathematics", "Physics", "English") }
)

$years = @(1, 2, 3, 4)
$sections = @("A", "B")
$days = @("Monday", "Tuesday", "Wednesday", "Thursday", "Friday")

$teacherPool = @(
    @("Prof. A. Nair", "Prof. B. Kumar", "Prof. C. Reddy", "Prof. D. Singh", "Prof. E. Das", "Prof. F. Iyer", "Prof. G. Menon", "Prof. H. Sharma"),
    @("Prof. R. Gupta", "Prof. S. Patel", "Prof. T. Bose", "Prof. U. Joshi", "Prof. V. Rao", "Prof. W. Mishra", "Prof. X. Kaur", "Prof. Y. Verma"),
    @("Prof. K. Pillai", "Prof. L. Chatterjee", "Prof. M. Banerjee", "Prof. N. Saxena", "Prof. O. Tiwari", "Prof. P. Mehta", "Prof. Q. Pandey", "Prof. R. Kapoor"),
    @("Prof. S. Sinha", "Prof. T. Roy", "Prof. U. Ghosh", "Prof. V. Dutta", "Prof. W. Saha", "Prof. X. Sen", "Prof. Y. Mitra", "Prof. Z. Basu"),
    @("Prof. D. Jain", "Prof. E. Khanna", "Prof. F. Malhotra", "Prof. G. Kapoor", "Prof. H. Bhatia", "Prof. I. Chopra", "Prof. J. Taneja", "Prof. K. Suri"),
    @("Prof. L. Sehgal", "Prof. M. Sethi", "Prof. N. Gambhir", "Prof. O. Kulkarni", "Prof. P. Deshpande", "Prof. Q. Hande", "Prof. R. Lele", "Prof. S. Natu"),
    @("Prof. T. Borge", "Prof. U. Naik", "Prof. V. Lotlikar", "Prof. W. Pagi", "Prof. X. Dessai", "Prof. Y. Faner", "Prof. Z. Carvalho", "Prof. A. Rebello"),
    @("Prof. B. Pinto", "Prof. C. D'Souza", "Prof. D. Noronha", "Prof. E. Menezes", "Prof. F. Sequeira", "Prof. G. Mascarenhas", "Prof. H. Lobo", "Prof. I. Fernandes"),
    @("Prof. J. Alvares", "Prof. K. Braganza", "Prof. L. Colaco", "Prof. M. Vaz", "Prof. N. Pereira", "Prof. O. Gomes", "Prof. P. Rozario", "Prof. Q. Concessao"),
    @("Prof. R. Mahto", "Prof. S. Oraon", "Prof. T. Lakra", "Prof. U. Kerketta", "Prof. V. Tirkey", "Prof. W. Purty", "Prof. X. Toppo", "Prof. Y. Hansdak")
)

$roomPool = @(
    @("AIDS-101", "AIDS-102", "AIDS-103", "AIDS-Lab1", "AIDS-Lab2", "AIDS-201", "AIDS-202", "AIDS-203"),
    @("CSE-301", "CSE-302", "CSE-303", "CSE-Lab1", "CSE-Lab2", "CSE-304", "CSE-305", "CSE-306"),
    @("AIML-401", "AIML-402", "AIML-403", "AIML-Lab1", "AIML-Lab2", "AIML-404", "AIML-405", "AIML-406"),
    @("CSBS-501", "CSBS-502", "CSBS-503", "CSBS-Lab1", "CSBS-Lab2", "CSBS-504", "CSBS-505", "CSBS-506"),
    @("IT-601", "IT-602", "IT-603", "IT-Lab1", "IT-Lab2", "IT-604", "IT-605", "IT-606"),
    @("ECE-701", "ECE-702", "ECE-703", "ECE-Lab1", "ECE-Lab2", "ECE-704", "ECE-705", "ECE-706"),
    @("EEE-801", "EEE-802", "EEE-803", "EEE-Lab1", "EEE-Lab2", "EEE-804", "EEE-805", "EEE-806"),
    @("MECH-901", "MECH-902", "MECH-903", "MECH-Lab1", "MECH-Lab2", "MECH-904", "MECH-905", "MECH-906"),
    @("MCT-1001", "MCT-1002", "MCT-1003", "MCT-Lab1", "MCT-Lab2", "MCT-1004", "MCT-1005", "MCT-1006"),
    @("VLSI-1101", "VLSI-1102", "VLSI-1103", "VLSI-Lab1", "VLSI-Lab2", "VLSI-1104", "VLSI-1105", "VLSI-1106")
)

function New-BreakPeriod {
    param([string]$Time, [string]$Duration)
    return @{
        time = $Time; duration = $Duration; subject = "Break"
        teacher = ""; room = ""; color = "#95A5A6"; type = "Break"; isBreak = $true
    }
}

function New-ClassPeriod {
    param(
        [string]$Time, [string]$Duration, [string]$Subject,
        [string]$Teacher, [string]$Room, [string]$Color
    )
    $t = "Theory"
    if ($Subject -match "Lab|Workshop|Practical") { $t = "Lab" }
    return @{
        time = $Time; duration = $Duration; subject = $Subject
        teacher = $Teacher; room = $Room; color = $Color; type = $t; isBreak = $false
    }
}

function Build-DaySchedule {
    param([string[]]$Subjects, [string[]]$Teachers, [string[]]$Rooms, [string]$AccentColor)

    $s = @()
    $s += (New-ClassPeriod -Time "9:00 AM"  -Duration "50m" -Subject $Subjects[0] -Teacher $Teachers[0] -Room $Rooms[0] -Color $AccentColor)
    $s += (New-ClassPeriod -Time "9:50 AM"  -Duration "50m" -Subject $Subjects[1] -Teacher $Teachers[1] -Room $Rooms[1] -Color $AccentColor)
    $s += (New-BreakPeriod -Time "10:40 AM" -Duration "20m")
    $s += (New-ClassPeriod -Time "11:00 AM" -Duration "50m" -Subject $Subjects[2] -Teacher $Teachers[2] -Room $Rooms[2] -Color $AccentColor)
    $s += (New-ClassPeriod -Time "11:50 AM" -Duration "50m" -Subject $Subjects[3] -Teacher $Teachers[3] -Room $Rooms[3] -Color $AccentColor)
    $s += (New-BreakPeriod -Time "12:40 PM" -Duration "65m")
    $s += (New-ClassPeriod -Time "1:45 PM"  -Duration "45m" -Subject $Subjects[4] -Teacher $Teachers[4] -Room $Rooms[4] -Color $AccentColor)
    $s += (New-ClassPeriod -Time "2:30 PM"  -Duration "45m" -Subject $Subjects[5] -Teacher $Teachers[5] -Room $Rooms[5] -Color $AccentColor)

    return $s
}

# ============================================================
# STEP 1: Delete all existing timetables
# ============================================================
Write-Host "--- Step 1: Deleting all existing timetables ---" -ForegroundColor Yellow

try {
    $existing = Invoke-RestMethod -Uri "$baseUrl/timetable" -Method GET -ContentType "application/json"
    $entries = @()
    if ($existing -is [array]) { $entries = $existing } else { $entries = @($existing) }
    if ($entries.Count -eq 0) {
        Write-Host "  No existing timetables found.`n" -ForegroundColor Gray
    } else {
        Write-Host "  Found $($entries.Count) existing timetables. Deleting..." -ForegroundColor Gray
        $deleted = 0
        foreach ($entry in $entries) {
            $id = $null
            if ($entry._id) { $id = $entry._id } elseif ($entry.id) { $id = $entry.id }
            if ($id) {
                try {
                    Invoke-RestMethod -Uri "$baseUrl/timetable/$id" -Method DELETE -ContentType "application/json" | Out-Null
                    $deleted++
                } catch {
                    Write-Host "  Failed to delete ${id}: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
        Write-Host "  Deleted $deleted / $($entries.Count) entries.`n" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Proceeding with creation anyway...`n" -ForegroundColor Gray
}

# ============================================================
# STEP 2: Create all timetable entries (10 depts x 4 years x 2 sections = 80)
# ============================================================
Write-Host "--- Step 2: Creating 80 timetable entries ---" -ForegroundColor Yellow

$totalCreated = 0
$totalFailed  = 0

$deptIndex = 0
foreach ($dept in $departments) {
    $teachers = $teacherPool[$deptIndex]
    $rooms    = $roomPool[$deptIndex]

    foreach ($year in $years) {
        foreach ($section in $sections) {
            $isSectionB = ($section -eq "B")

            $schedule = @{}
            for ($d = 0; $d -lt $days.Count; $d++) {
                $daySubs = @()
                $dayTch  = @()
                $dayRms  = @()

                for ($p = 0; $p -lt 6; $p++) {
                    $idx = ($p + $d) % $dept.Subjects.Count
                    $tIdx = ($p + $d) % $teachers.Count
                    $rIdx = ($p + $d) % $rooms.Count
                    $daySubs += $dept.Subjects[$idx]
                    $dayTch  += $teachers[$tIdx]
                    $rName = $rooms[$rIdx]
                    if ($isSectionB) { $rName = "${rName}B" }
                    $dayRms += $rName
                }

                $schedule[$days[$d]] = (Build-DaySchedule -Subjects $daySubs -Teachers $dayTch -Rooms $dayRms -AccentColor $dept.Color)
            }

            $body = @{
                departmentCode = $dept.Code
                departmentName = $dept.Name
                year           = $year
                section        = $section
                schedule       = $schedule
            } | ConvertTo-Json -Depth 10

            $label = "$($dept.Code) Yr$year Sec$section"
            try {
                Invoke-RestMethod -Uri "$baseUrl/timetable" -Method POST -Body $body -ContentType "application/json" | Out-Null
                Write-Host "  Created $label" -ForegroundColor Green
                $totalCreated++
            } catch {
                Write-Host "  FAILED  $label - $($_.Exception.Message)" -ForegroundColor Red
                $totalFailed++
            }
        }
    }
    $deptIndex++
}

# ============================================================
# STEP 3: Final count
# ============================================================
Write-Host "`n--- Step 3: Verification ---" -ForegroundColor Yellow
try {
    $final = Invoke-RestMethod -Uri "$baseUrl/timetable" -Method GET -ContentType "application/json"
    $finalCount = if ($final -is [array]) { $final.Count } else { 1 }
    Write-Host "  Total timetables in database: $finalCount" -ForegroundColor Cyan
} catch {
    Write-Host "  Could not fetch final count: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "  Created: $totalCreated" -ForegroundColor Green
Write-Host "  Failed:  $totalFailed" -ForegroundColor Red
