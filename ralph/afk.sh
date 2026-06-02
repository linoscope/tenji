#!/bin/bash
# Ralph AFK loop — a fresh headless Claude per iteration until the backlog is dry.
# Each iteration implements ONE eligible ready-for-agent issue (PR + squash auto-merge).
# Stops when the model emits <promise>NO MORE TASKS</promise>. No Docker.
# Usage: ralph/afk.sh <iterations>
set -eo pipefail

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

cd "$(dirname "$0")/.."

# jq filter to stream assistant text to the terminal as it arrives
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
# jq filter to extract the final result text
final_result='select(.type == "result").result // empty'

for ((i=1; i<=$1; i++)); do
  echo "================ Ralph iteration $i / $1 ================"
  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
  issues=$(gh issue list --label ready-for-agent --state open --json number,title \
            -q '.[] | "#\(.number) \(.title)"' 2>/dev/null || echo "No issues found")
  prompt=$(cat ralph/prompt.md)

  claude \
    --verbose \
    --print \
    --output-format stream-json \
    --dangerously-skip-permissions \
    "Previous commits:
$commits

Open ready-for-agent issues:
$issues

$prompt" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    echo "Ralph complete after $i iterations."
    exit 0
  fi
done

echo "Ralph hit the $1-iteration cap; re-run if work remains."
