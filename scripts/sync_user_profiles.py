import json
import sys
import time
import urllib.error
import urllib.request

BASE = "https://edunex-backend-rmvx.onrender.com/api/v1"


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


def get_all(path):
    page = 1
    items = []
    while True:
        st, res = api("GET", path + ("&" if "?" in path else "?") + f"page={page}&limit=100")
        if st not in (200, 201):
            raise RuntimeError(f"GET {path} failed: {st} {res}")
        data = res.get("data", [])
        items.extend(data)
        total = int(res.get("total", 0))
        if len(items) >= total or not data:
            break
        page += 1
    return items


META_SKIP = {"_id", "__v", "createdAt", "updatedAt"}


def build_profile(s):
    profile = {}
    for k, v in s.items():
        if k in META_SKIP:
            continue
        profile[k] = v
    if "mobile" not in profile:
        profile["mobile"] = s.get("phone") or ""
    if "class" not in profile:
        profile["class"] = s.get("deptShort") or ""
    return profile


def main():
    args = sys.argv[1:]
    limit = None
    dry_run = "--dry-run" in args
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])

    print("Fetching student records…")
    students = get_all("/students")
    students = [s for s in students if (s.get("email") or "").strip()]
    by_email = {str(s.get("email")).strip().lower(): s for s in students}
    by_suffix = {}
    for s in students:
        sid = str(s.get("id") or s.get("rollNo") or s.get("roll") or "")
        by_suffix[sid[-3:].lower()] = s
    print(f"  students with email: {len(by_email)}")

    print("Fetching user accounts…")
    users = get_all("/users")
    student_users = [u for u in users if str(u.get("role") or "").lower() == "student"]
    print(f"  student-role users: {len(student_users)}")

    if limit:
        student_users = student_users[:limit]
    if dry_run:
        print("DRY RUN: no writes will be made")

    synced = 0
    unmatched = []
    failed = []

    for i, u in enumerate(student_users, 1):
        uid = str(u.get("id") or "")
        uname = str(u.get("username") or "")
        email = str(u.get("email") or "").strip().lower()

        s = by_email.get(email)
        if not s:
            # Fallback: match by trailing sequence digits, e.g. 24bad001 -> 24BAI001
            suffix = uname[-3:]
            s = by_suffix.get(suffix)
        if not s:
            unmatched.append((uname, email))
            print(f"[{i}/{len(student_users)}] {uname} NO MATCH ({email})")
            continue

        profile = build_profile(s)
        print(f"[{i}/{len(student_users)}] {uname:10} -> {profile['rollNo']} {profile['name'][:22]}")

        if dry_run:
            synced += 1
            continue

        st, res = api("PATCH", f"/users/{uid}", {"profile": profile})
        if st in (200, 201):
            synced += 1
        else:
            failed.append((uname, st, res))
            print(f"      FAILED ({st}) {res}")
        time.sleep(0.15)

    print("\n===== SUMMARY =====")
    print(f"Profiles synced: {synced}")
    print(f"Unmatched: {len(unmatched)}")
    for u in unmatched:
        print("  ", u[0], u[1])
    print(f"Failed: {len(failed)}")
    for f in failed:
        print("  ", f)


if __name__ == "__main__":
    main()