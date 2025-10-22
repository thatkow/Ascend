#!/usr/bin/env python3
"""
migrate_routes_schema.py
------------------------
Migrates Ascend Firestore JSON exports to the new routes schema.

Transformations:
1. Map routes.ascents user IDs → usernames (from users[] list)
   - Remove ascents for IDs not found in users.
2. Merge betatips into routes.users entries under `betatip`.
3. Rename `ascents` → `users`.
4. Convert routes.points (list) + pathType (string)
   → routes.points (map of { pathType: [points] }).
"""

import json
import sys
from pathlib import Path

def migrate_routes_schema(input_path: str, output_path: str):
    # Load data
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    users = {u["id"]: u["username"] for u in data["data"]["users"]}
    routes = data["data"].get("routes", [])

    for route in routes:
        ascents = route.get("ascents", {})
        betatips = route.pop("betatips", {})
        mapped_users = {}

        # Map ascents to usernames
        for uid, details in ascents.items():
            username = users.get(uid)
            if username:
                mapped_users[username] = details

        # Merge betatips into users
        for username, tip in betatips.items():
            if username not in mapped_users:
                mapped_users[username] = {}
            mapped_users[username]["betatip"] = tip

        # Replace ascents → users
        route.pop("ascents", None)
        route["users"] = mapped_users

        # Convert points to keyed map
        path_type = route.pop("pathType", None)
        points = route.get("points", [])
        if isinstance(points, list):
            key = path_type if path_type else "default"
            route["points"] = {key: points}

    # Save result
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"✅ Migration complete.\nOutput written to: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python migrate_routes_schema.py <input.json> <output.json>")
        sys.exit(1)

    in_file = Path(sys.argv[1]).expanduser().resolve()
    out_file = Path(sys.argv[2]).expanduser().resolve()

    migrate_routes_schema(str(in_file), str(out_file))

