#!/usr/bin/env python3
"""
merge_roles_usernames_to_users.py

Migrate Firestore JSON export by merging the `roles` and `usernames`
collections into a unified `users` collection:
    /users/{uid} = { createdAt, updatedAt, username, role }

Usage:
    python merge_roles_usernames_to_users.py input.json output.json
"""

import sys
import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path


def merge_roles_usernames(input_file: str, output_file: str):
    # Load JSON
    with open(input_file, "r") as f:
        data = json.load(f)

    new_data = deepcopy(data)
    now = datetime.utcnow().isoformat() + "Z"

    roles = {r["id"]: r for r in data["data"].get("roles", [])}
    usernames = {u["id"]: u for u in data["data"].get("usernames", [])}

    users = []
    for uid, uname_doc in usernames.items():
        role_doc = roles.get(uid, {})
        users.append({
            "id": uid,
            "createdAt": uname_doc.get("createdAt", now),
            "updatedAt": uname_doc.get("updatedAt", now),
            "username": uname_doc.get("username"),
            "role": role_doc.get("role", None)
        })

    # Add new users collection
    new_data["data"]["users"] = users

    # Remove old collections
    new_data["data"].pop("roles", None)
    new_data["data"].pop("usernames", None)

    # Update metadata list
    collections = new_data["metadata"].get("collections", [])
    collections = [c for c in collections if c not in ("roles", "usernames")]
    if "users" not in collections:
        collections.append("users")
    new_data["metadata"]["collections"] = collections

    # Save output
    with open(output_file, "w") as f:
        json.dump(new_data, f, indent=2)

    print(f"✅ Migration complete. Saved to: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python merge_roles_usernames_to_users.py input.json output.json")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    merge_roles_usernames(str(input_path), str(output_path))

