#!/usr/bin/env python3
import json, sys, os, random, string, datetime

def random_id(length=28):
    """Generate random alphanumeric Firestore-style IDs."""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def main():
    if len(sys.argv) != 3:
        print(f"Usage: {os.path.basename(sys.argv[0])} <input_step1.json> <output_step2.json>")
        sys.exit(1)

    input_file, output_file = sys.argv[1], sys.argv[2]

    # --- Load database ---
    with open(input_file) as f:
        db = json.load(f)

    routes = db["data"]["routes"]
    users = db["data"]["users"]
    username_to_uid = {u["username"]: u["id"] for u in users}

    routes_users_scores = {}
    routes_users_betatips = {}

    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    for route in routes:
        route_id = route["id"]
        users_map = route.get("users", {})

        # --- ROUTES_USERS_SCORES: per routeId map of user grades/ascended ---
        score_map = {}
        for uname, udata in users_map.items():
            uid = username_to_uid.get(uname)
            if not uid:
                continue
            if "grade" in udata or "ascended" in udata:
                score_map[uid] = {
                    "grade": udata.get("grade"),
                    "ascended": udata.get("ascended"),
                }
        if score_map:
            routes_users_scores[route_id] = score_map

        # --- ROUTES_USERS_BETATIPS: one document per betatip ---
        for uname, udata in users_map.items():
            uid = username_to_uid.get(uname)
            if not uid:
                continue

            betatip_text = udata.get("betatip")
            if betatip_text:
                betatip_id = random_id()
                routes_users_betatips[betatip_id] = {
                    "routeId": route_id,
                    "userId": uid,
                    "betatip": betatip_text,
                    "createdAt": now_iso,
                    "updatedAt": now_iso,
                    "upvoteCount": 0
                }

        # Remove embedded users from route
        if "users" in route:
            del route["users"]

    # --- Update metadata collections ---
    metadata = db.get("metadata", {})
    collections = set(metadata.get("collections", []))
    collections.update(["routes_users_scores", "routes_users_betatips"])
    metadata["collections"] = sorted(list(collections))
    db["metadata"] = metadata

    # --- Write updated database ---
    db["data"]["routes_users_scores"] = routes_users_scores
    db["data"]["routes_users_betatips"] = routes_users_betatips
    db["data"]["routes"] = routes

    with open(output_file, "w") as f:
        json.dump(db, f, indent=2)

    print("✅ Migration complete:")
    print("   • routes_users_scores (map per routeId)")
    print("   • routes_users_betatips (flat docs with upvoteCount, timestamps)")
    print("   • metadata.collections updated")
    print(f"Saved to {output_file}")

if __name__ == "__main__":
    main()

