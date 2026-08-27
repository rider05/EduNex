$ErrorActionPreference = "Stop"
$BaseUrl = "https://edunex-backend-rmvx.onrender.com/api/v1/timetable"

function New-DaySchedule {
    param(
        [string]$DayName,
        [hashtable[]]$Periods
    )
    return @{ day = $DayName; periods = $Periods }
}

function New-Period {
    param(
        [string]$Time,
        [string]$Subject,
        [string]$Type,
        [string]$Accent
    )
    return @{ time = $Time; subject = $Subject; type = $Type; accent = $Accent }
}

function New-DeptSchedule {
    param(
        [string[]]$Subjects,
        [string[]]$Colors
    )
    $s = $Subjects; $c = $Colors

    $Mon = @(
        (New-Period -Time "09:00 - 09:50" -Subject $s[0] -Type "lecture" -Accent $c[0]),
        (New-Period -Time "09:50 - 10:40" -Subject $s[1] -Type "lecture" -Accent $c[1]),
        (New-Period -Time "10:40 - 11:00" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "11:00 - 11:50" -Subject $s[2] -Type "lecture" -Accent $c[2]),
        (New-Period -Time "11:50 - 12:40" -Subject $s[3] -Type "lecture" -Accent $c[3]),
        (New-Period -Time "12:40 - 01:30" -Subject "Lunch" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "01:30 - 03:00" -Subject $s[4] -Type "lab" -Accent $c[4]),
        (New-Period -Time "03:00 - 03:15" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "03:15 - 04:15" -Subject $s[5] -Type "lecture" -Accent $c[5])
    )
    $Tue = @(
        (New-Period -Time "09:00 - 09:50" -Subject $s[1] -Type "lecture" -Accent $c[1]),
        (New-Period -Time "09:50 - 10:40" -Subject $s[2] -Type "lecture" -Accent $c[2]),
        (New-Period -Time "10:40 - 11:00" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "11:00 - 11:50" -Subject $s[0] -Type "lecture" -Accent $c[0]),
        (New-Period -Time "11:50 - 12:40" -Subject $s[3] -Type "lecture" -Accent $c[3]),
        (New-Period -Time "12:40 - 01:30" -Subject "Lunch" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "01:30 - 03:00" -Subject $s[5] -Type "lab" -Accent $c[5]),
        (New-Period -Time "03:00 - 03:15" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "03:15 - 04:15" -Subject $s[6] -Type "lecture" -Accent $c[6])
    )
    $Wed = @(
        (New-Period -Time "09:00 - 09:50" -Subject $s[2] -Type "lecture" -Accent $c[2]),
        (New-Period -Time "09:50 - 10:40" -Subject $s[3] -Type "lecture" -Accent $c[3]),
        (New-Period -Time "10:40 - 11:00" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "11:00 - 11:50" -Subject $s[1] -Type "lecture" -Accent $c[1]),
        (New-Period -Time "11:50 - 12:40" -Subject $s[0] -Type "lecture" -Accent $c[0]),
        (New-Period -Time "12:40 - 01:30" -Subject "Lunch" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "01:30 - 03:00" -Subject $s[6] -Type "lab" -Accent $c[6]),
        (New-Period -Time "03:00 - 03:15" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "03:15 - 04:15" -Subject $s[4] -Type "lecture" -Accent $c[4])
    )
    $Thu = @(
        (New-Period -Time "09:00 - 09:50" -Subject $s[3] -Type "lecture" -Accent $c[3]),
        (New-Period -Time "09:50 - 10:40" -Subject $s[0] -Type "lecture" -Accent $c[0]),
        (New-Period -Time "10:40 - 11:00" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "11:00 - 11:50" -Subject $s[2] -Type "lecture" -Accent $c[2]),
        (New-Period -Time "11:50 - 12:40" -Subject $s[1] -Type "lecture" -Accent $c[1]),
        (New-Period -Time "12:40 - 01:30" -Subject "Lunch" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "01:30 - 03:00" -Subject $s[4] -Type "lab" -Accent $c[4]),
        (New-Period -Time "03:00 - 03:15" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "03:15 - 04:15" -Subject $s[5] -Type "lecture" -Accent $c[5])
    )
    $Fri = @(
        (New-Period -Time "09:00 - 09:50" -Subject $s[0] -Type "lecture" -Accent $c[0]),
        (New-Period -Time "09:50 - 10:40" -Subject $s[3] -Type "lecture" -Accent $c[3]),
        (New-Period -Time "10:40 - 11:00" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "11:00 - 11:50" -Subject $s[1] -Type "lecture" -Accent $c[1]),
        (New-Period -Time "11:50 - 12:40" -Subject $s[2] -Type "lecture" -Accent $c[2]),
        (New-Period -Time "12:40 - 01:30" -Subject "Lunch" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "01:30 - 03:00" -Subject $s[6] -Type "lab" -Accent $c[6]),
        (New-Period -Time "03:00 - 03:15" -Subject "Break" -Type "break" -Accent "#94a3b8"),
        (New-Period -Time "03:15 - 04:15" -Subject $s[4] -Type "lecture" -Accent $c[4])
    )

    return @(
        (New-DaySchedule -DayName "Monday"    -Periods $Mon),
        (New-DaySchedule -DayName "Tuesday"   -Periods $Tue),
        (New-DaySchedule -DayName "Wednesday" -Periods $Wed),
        (New-DaySchedule -DayName "Thursday"  -Periods $Thu),
        (New-DaySchedule -DayName "Friday"    -Periods $Fri)
    )
}

# --- Department definitions ---
$DepartmentDefs = @(
    @{
        Code = "AIDS"; Name = "AI & Data Science"
        Subjects = @("Data Structures & Algorithms", "Python Programming", "Discrete Mathematics", "Digital Logic", "DSA Lab", "DBMS", "Probability & Statistics")
        Colors   = @("#6366f1", "#8b5cf6", "#a78bfa", "#7c3aed", "#4f46e5", "#c084fc", "#ddd6fe")
    },
    @{
        Code = "CSE"; Name = "Computer Science & Engineering"
        Subjects = @("Programming in C", "Engineering Mathematics", "Digital Logic Design", "Basic Electronics", "C Programming Lab", "English Communication", "Engineering Physics")
        Colors   = @("#0ea5e9", "#0284c7", "#38bdf8", "#7dd3fc", "#0369a1", "#bae6fd", "#0c4a6e")
    },
    @{
        Code = "AIML"; Name = "AI & Machine Learning"
        Subjects = @("Introduction to AI", "Linear Algebra", "Machine Learning Foundations", "Computer Architecture", "AI Lab", "Data Mining", "Statistical Learning")
        Colors   = @("#f43f5e", "#e11d48", "#fb7185", "#fda4af", "#be123c", "#fecdd3", "#881337")
    },
    @{
        Code = "CSBS"; Name = "Cyber Security"
        Subjects = @("Fundamentals of Cyber Security", "Network Security", "Operating Systems", "Cryptography", "Cyber Security Lab", "Ethical Hacking", "Information Assurance")
        Colors   = @("#f97316", "#ea580c", "#fb923c", "#fdba74", "#c2410c", "#fed7aa", "#7c2d12")
    },
    @{
        Code = "IT"; Name = "Information Technology"
        Subjects = @("Web Technologies", "Data Structures", "Computer Networks", "Software Engineering", "Web Dev Lab", "Cloud Computing", "Operating Systems")
        Colors   = @("#10b981", "#059669", "#34d399", "#6ee7b7", "#047857", "#a7f3d0", "#064e3b")
    },
    @{
        Code = "ECE"; Name = "Electronics & Communication Engineering"
        Subjects = @("Analog Electronics", "Signals & Systems", "Electromagnetic Theory", "Communication Systems", "Electronics Lab", "VLSI Design", "Microprocessors")
        Colors   = @("#eab308", "#ca8a04", "#facc15", "#fde047", "#a16207", "#fef08a", "#713f12")
    },
    @{
        Code = "EEE"; Name = "Electrical & Electronics Engineering"
        Subjects = @("Circuit Theory", "Electrical Machines", "Power Systems", "Control Systems", "Electrical Lab", "Power Electronics", "Instrumentation")
        Colors   = @("#14b8a6", "#0d9488", "#2dd4bf", "#5eead4", "#0f766e", "#99f6e4", "#134e4a")
    },
    @{
        Code = "MECH"; Name = "Mechanical Engineering"
        Subjects = @("Engineering Mechanics", "Thermodynamics", "Fluid Mechanics", "Manufacturing Processes", "Workshop Practice", "Strength of Materials", "Machine Drawing")
        Colors   = @("#a855f7", "#9333ea", "#c084fc", "#d8b4fe", "#7e22ce", "#e9d5ff", "#581c87")
    },
    @{
        Code = "MCT"; Name = "Mechatronics"
        Subjects = @("Mechatronics Fundamentals", "Sensors & Transducers", "PLC & Automation", "Robotics", "Mechatronics Lab", "Hydraulics & Pneumatics", "Embedded Systems")
        Colors   = @("#ec4899", "#db2777", "#f472b6", "#f9a8d4", "#be185d", "#fbcfe8", "#831843")
    },
    @{
        Code = "VLSI"; Name = "VLSI Design & Technology"
        Subjects = @("VLSI Design Fundamentals", "CMOS VLSI Circuits", "Digital System Design", "Semiconductor Physics", "VLSI Lab", "ASIC Design", "Verification Methodologies")
        Colors   = @("#3b82f6", "#2563eb", "#60a5fa", "#93c5fd", "#1d4ed8", "#bfdbfe", "#1e3a5f")
    }
)

# ==============================
# Step 1: Delete all existing timetables
# ==============================
Write-Host "`n=== Deleting existing timetable entries ===" -ForegroundColor Yellow
try {
    $existing = Invoke-RestMethod -Uri $BaseUrl -Method Get
    $docs = $existing.data
    if ($docs -and $docs.Count -gt 0) {
        foreach ($doc in $docs) {
            $deleteUrl = "$BaseUrl/$($doc._id)"
            try {
                Invoke-RestMethod -Uri $deleteUrl -Method Delete | Out-Null
                Write-Host "  Deleted: $($doc.departmentCode) ($($doc._id))" -ForegroundColor Red
            } catch {
                Write-Host "  Failed to delete $($doc.departmentCode): $_" -ForegroundColor Red
            }
        }
        Write-Host "  Total deleted: $($docs.Count)" -ForegroundColor Green
    } else {
        Write-Host "  No existing timetables found." -ForegroundColor Gray
    }
} catch {
    Write-Host "  Error fetching existing timetables: $_" -ForegroundColor Red
}

# ==============================
# Step 2: POST each department timetable
# ==============================
Write-Host "`n=== Creating new timetables ===" -ForegroundColor Yellow
$successCount = 0
$failCount = 0

foreach ($dept in $DepartmentDefs) {
    Write-Host "`n[$($dept.Code)] $($dept.Name)..." -ForegroundColor Cyan

    try {
        $schedule = New-DeptSchedule -Subjects $dept.Subjects -Colors $dept.Colors

        $body = @{
            departmentCode = $dept.Code
            departmentName = $dept.Name
            year           = 1
            section        = "A"
            schedule       = $schedule
        } | ConvertTo-Json -Depth 10

        Invoke-RestMethod -Uri $BaseUrl -Method Post -ContentType "application/json" -Body $body | Out-Null
        Write-Host "  OK - Timetable created for $($dept.Code)" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "  FAILED - $($dept.Code): $_" -ForegroundColor Red
        $failCount++
    }
}

Write-Host "`n=== Complete ===" -ForegroundColor Yellow
Write-Host "  Success: $successCount / $($DepartmentDefs.Count)" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "  Failed:  $failCount / $($DepartmentDefs.Count)" -ForegroundColor Red
}
