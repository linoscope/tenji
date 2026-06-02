#!/usr/bin/env bash
# Ralph loop: run a fresh headless Claude per iteration until the backlog is dry.
# Usage: bash ralph.sh [max-iterations]   (default 15)
set -euo pipefail
cd "$(dirname "$0")"

MAX="${1:-15}"
rm -f ralph/STOP

for i in $(seq 1 "$MAX"); do
  if [ -f ralph/STOP ]; then
    echo "=== Ralph stopping: $(cat ralph/STOP) ==="
    exit 0
  fi
  echo "================ Ralph iteration $i / $MAX ================"
  claude -p "$(cat ralph/PROMPT.md)" --dangerously-skip-permissions
done

echo "=== Ralph hit the $MAX-iteration cap; re-run to continue if work remains. ==="
