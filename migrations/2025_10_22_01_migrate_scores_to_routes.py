#!/usr/bin/env python3
import json
import sys

def migrate_routes_scores(input_path, output_path):
    with open(input_path, "r") as f:
        data = json.load(f)

    routes_users_scores = data["data"].get("routes_users_scores", {})
    routes = {r["id"]: r for r in data["data"]["routes"]}

    for route_id, users in routes_users_scores.items():
        if route_id not in routes:
            print(f"⚠️ Route {route_id} not found in routes list, skipping.")
            continue

        # Build 'scores' array
        scores = []
        for user_id, vals in users.items():
            scores.append({
                "userId": user_id,
                "grade": vals.get("grade"),
                "ascended": vals.get("ascended")
            })

        route = routes[route_id]
        route["scores"] = scores

        # Remove the top-level 'grade' field if it exists
        route.pop("grade", None)

    # Remove original mapping
    data["data"]["routes"] = list(routes.values())
    data["data"].pop("routes_users_scores", None)

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"✅ Migration complete. Output written to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: migrate_scores_to_routes.py <input.json> <output.json>")
        sys.exit(1)

    migrate_routes_scores(sys.argv[1], sys.argv[2])

