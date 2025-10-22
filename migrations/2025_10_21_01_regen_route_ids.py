#!/usr/bin/env python3
import json, random, string, sys, os

def random_id(length=28):
    """Generate random alphanumeric ID."""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def main():
    if len(sys.argv) != 3:
        print(f"Usage: {os.path.basename(sys.argv[0])} <input.json> <output.json>")
        sys.exit(1)

    input_file, output_file = sys.argv[1], sys.argv[2]

    with open(input_file) as f:
        db = json.load(f)

    routes = db["data"]["routes"]
    new_routes = []
    id_map = {}

    for route in routes:
        old_id = route["id"]
        new_id = random_id()
        id_map[old_id] = new_id

        new_route = dict(route)
        new_route["id"] = new_id
        new_routes.append(new_route)

    db["data"]["routes"] = new_routes

    with open(output_file, "w") as f:
        json.dump(db, f, indent=2)

    print("✅ Step 1 complete — regenerated route IDs.\n")
    print("Route ID mapping:")
    for old, new in id_map.items():
        print(f"{old} → {new}")
    print(f"\nSaved to {output_file}")

if __name__ == "__main__":
    main()

