#!/bin/bash
# run_all_migrations.sh
# Automates the Ascend migration chain in sequence.
# Usage:
#   ./run_all_migrations.sh <input_json>

set -e  # Exit immediately if a command fails

# Ensure an input argument was provided
if [ -z "$1" ]; then
  echo "❌ Error: No input file provided."
  echo "Usage: $0 <input_json>"
  exit 1
fi

INPUT="$1"

# Verify input file exists
if [ ! -f "$INPUT" ]; then
  echo "❌ Error: Input file '$INPUT' not found."
  exit 1
fi

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Migration scripts in order
MIGRATIONS=(
  "2025_10_20_01_merge_roles_usernames_to_users.py"
  "2025_10_20_02_migrate_routes_schema.py"
  "2025_10_21_01_regen_route_ids.py"
  "2025_10_21_02_add_routes_grade.py"
  "2025_10_21_03_combined_routes_users.py"
  "2025_10_22_01_migrate_scores_to_routes.py"
)

PREV_OUTPUT="$INPUT"
i=1

echo "🚀 Starting migrations..."
for SCRIPT in "${MIGRATIONS[@]}"; do
  OUT_FILE="$BASE_DIR/${i}.json"
  echo ""
  echo "▶️  Running migration $i: $SCRIPT"
  python3 "$BASE_DIR/$SCRIPT" "$PREV_OUTPUT" "$OUT_FILE"
  echo "✅ Migration $SCRIPT complete. Output: $OUT_FILE"
  PREV_OUTPUT="$OUT_FILE"
  ((i++))
done

echo ""
echo "🎉 All migrations completed successfully!"
echo "Final output: $PREV_OUTPUT"

