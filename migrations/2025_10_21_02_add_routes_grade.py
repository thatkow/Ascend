#!/usr/bin/env python3
import json, sys, os

def main():
    if len(sys.argv) != 3:
        print(f"Usage: {os.path.basename(sys.argv[0])} <input.json> <output.json>")
        sys.exit(1)

    input_file, output_file = sys.argv[1], sys.argv[2]

    # --- Load JSON ---
    with open(input_file) as f:
        db = json.load(f)

    routes = db["data"]["routes"]

    # --- Add grade field ---
    updated = 0
    for route in routes:
        if "grade" not in route:
            route["grade"] = None
            updated += 1

    db["data"]["routes"] = routes

    # --- Save updated JSON ---
    with open(output_file, "w") as f:
        json.dump(db, f, indent=2)

    print(f"✅ Added 'grade': null to {updated} routes.")
    print(f"Saved to {output_file}")

if __name__ == "__main__":
    main()

