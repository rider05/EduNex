import json
import urllib.request
import urllib.error
import time
import sys
import openpyxl

BASE = "https://edunex-backend-rmvx.onrender.com/api/v1"
XLSX = r"D:\edunex\data.xlsx"
DEFAULT_PASSWORD = None  # per student: password = roll number


def api(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw.decode()
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw.decode()
    except Exception as e:
        return None, str(e)


def clean(v):
    if v is None:
        return ""
    return str(v).strip()


def main():
    args = sys.argv[1:]
    limit = None
    dry_run = False
    students_only = "--students-only" in args
    logins_only = "--logins-only" in args
    token = None
    if "--token" in args:
        token = args[args.index("--token") + 1]
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])
    if "--dry-run" in args:
        dry_run = True

    wb = openpyxl.load_workbook(XLSX)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    if limit:
        rows = rows[:limit]
    print(f"Loaded {len(rows)} student rows from {XLSX}")
    if dry_run:
        print("DRY RUN: no writes will be made")

    ok_students = 0
    ok_logins = 0
    fail_students = []
    fail_logins = []

    existing = api("GET", "/students")
    existing_ids = set()
    existing_emails = set()
    if existing[0] == 200:
        for s in existing[1].get("data", []):
            existing_ids.add(str(s.get("id") or s.get("roll") or s.get("rollNo") or "").lower())
            existing_emails.add(str(s.get("email") or "").lower())
    print(f"Existing student records: {len(existing_ids)}")

    for idx, row in enumerate(rows, 1):
        roll = clean(row[6]) or f"24BAI{idx:03d}"
        roll_lower = roll.lower()
        name = clean(row[2])
        email = clean(row[1]).lower()
        gender = clean(row[7]).title()
        mobile = clean(row[14])
        father = clean(row[3]) or clean(row[15])
        father_phone = clean(row[17])
        mother = clean(row[18])
        dob = clean(row[12])
        blood = clean(row[13]).replace(" ", "")
        address = clean(row[20]) or clean(row[19])
        district = clean(row[22])
        marks = row[28]
        hostel = clean(row[29]) or "Hosteler"
        is_hostel = "hostel" in hostel.lower()

        dup = roll_lower in existing_ids or email in existing_emails
        if dup:
            print(f"[{idx}/{len(rows)}] {roll} SKIPPED (already exists)")
            continue

        student_body = {
            "id": roll,
            "roll": roll,
            "rollNo": roll,
            "username": roll_lower,
            "regNo": roll,
            "name": name,
            "email": email,
            "phone": mobile,
            "mobile": mobile,
            "gender": gender,
            "bloodGroup": blood or "O+",
            "dob": dob,
            "department": "Artificial Intelligence & Data Science",
            "departmentCode": "aids",
            "dept": "AI & DS",
            "deptShort": "AI & DS",
            "departmentShort": "AI & DS",
            "program": "B.Tech",
            "degree": "B.Tech in Artificial Intelligence & Data Science",
            "year": "III Year",
            "semester": "5th Semester",
            "section": "A",
            "class": "III - AI & DS 'A'",
            "batch": "2023-2027",
            "lateral": False,
            "hostel": is_hostel,
            "residentialStatus": "Hosteler" if is_hostel else "Day Scholar",
            "fatherName": father,
            "motherName": mother,
            "parentName": father,
            "parentPhone": father_phone or "",
            "parentRelation": "Father",
            "address": address,
            "district": district,
            "school": clean(row[25]) if len(row) > 25 else "",
            "stream": clean(row[26]) if len(row) > 26 else "",
            "medium": clean(row[27]) if len(row) > 27 else "",
            "hscMarks": marks,
            "status": "active",
        }

        if dry_run:
            print(
                f"[{idx}/{len(rows)}] DRY-RUN {roll} {name[:20]:20} would POST student+login"
            )
            continue

        if not logins_only:
            st, res = api("POST", "/students", student_body)
            if st == 201 or st == 200:
                ok_students += 1
            else:
                fail_students.append((roll, name, st, res))

        if not students_only:
            login_username = f"25BAD{idx:03d}"
            auth_body = {
                "username": login_username,
                "password": login_username,
                "role": "student",
                "email": email,
                "profile": {"name": name, "mobile": mobile, "department": "AI & DS"},
            }
            st2, res2 = api("POST", "/auth/register", auth_body, token)
            if st2 in (200, 201):
                ok_logins += 1
                print(f"      created login {login_username}")
            else:
                fail_logins.append((roll, name, st2, res2))
        else:
            st2 = "skipped"

        if (idx % 10 == 0) or (st != 201 and st != 200 and st2 not in (200, 201)):
            print(
                f"[{idx}/{len(rows)}] {roll} {name[:20]:20} students={st} login={st2}"
            )

        time.sleep(0.3)

    print("\n===== SUMMARY =====")
    print(f"Students created: {ok_students}")
    print(f"Login accounts created: {ok_logins}")
    print(f"Student failures: {len(fail_students)}")
    for f in fail_students:
        print("  ", f[0], f[1], "status", f[2], "->", f[3])
    print(f"Login failures: {len(fail_logins)}")
    for f in fail_logins:
        print("  ", f[0], f[1], "status", f[2], "->", f[3])


if __name__ == "__main__":
    main()