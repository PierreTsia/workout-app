#!/usr/bin/env python3
"""Seed exercise content (instructions, youtube_url, image_url) to deployed Supabase."""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "https://favusepjqwpcroiolvaz.supabase.co")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SERVICE_ROLE_KEY:
    print("Usage: SUPABASE_SERVICE_ROLE_KEY=eyJ... python3 scripts/seed-exercise-content.py")
    sys.exit(1)

def parse_seed_sql(path: str) -> list[dict]:
    with open(path) as f:
        content = f.read()

    pattern = re.compile(
        r"\('([^']+)',\s*'([^']+)',\s*'[^']+',\s*true,\s*"
        r"'([^']+)',\s*"
        r"'(\{.*?\})',\s*"
        r"'([^']+)'\)",
        re.DOTALL
    )

    exercises = []
    for m in pattern.finditer(content):
        name = m.group(1)
        json_str = m.group(4).replace("''", "'")
        exercises.append({
            "name": name,
            "youtube_url": m.group(3),
            "instructions": json.loads(json_str),
            "image_url": m.group(5),
        })
    return exercises


def update_exercise(ex: dict) -> bool:
    encoded_name = urllib.parse.quote(ex["name"])
    url = f"{SUPABASE_URL}/rest/v1/exercises?name=eq.{encoded_name}"

    body = json.dumps({
        "youtube_url": ex["youtube_url"],
        "instructions": ex["instructions"],
        "image_url": ex["image_url"],
    }).encode()

    req = urllib.request.Request(url, data=body, method="PATCH")
    req.add_header("Authorization", f"Bearer {SERVICE_ROLE_KEY}")
    req.add_header("apikey", SERVICE_ROLE_KEY)
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")

    try:
        resp = urllib.request.urlopen(req)
        return resp.status == 204
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()}")
        return False


def main():
    seed_path = os.path.join(os.path.dirname(__file__), "..", "supabase", "seed.sql")
    exercises = parse_seed_sql(seed_path)
    print(f"Parsed {len(exercises)} exercises from seed.sql\n")

    success = 0
    fail = 0
    for ex in exercises:
        name = ex["name"]
        print(f"  {name}... ", end="", flush=True)
        if update_exercise(ex):
            print("OK")
            success += 1
        else:
            print("FAILED")
            fail += 1

    print(f"\nDone: {success} updated, {fail} failed")
    if fail > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
