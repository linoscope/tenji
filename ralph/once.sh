#!/bin/bash
# Ralph once — a single iteration. Implements one eligible issue.
# Uses --dangerously-skip-permissions (no prompts), same as afk.sh. No Docker.
# Usage: ralph/once.sh
cd "$(dirname "$0")/.."

commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
issues=$(gh issue list --label ready-for-agent --state open --json number,title \
          -q '.[] | "#\(.number) \(.title)"' 2>/dev/null || echo "No issues found")
prompt=$(cat ralph/prompt.md)

claude --dangerously-skip-permissions \
  "Previous commits:
$commits

Open ready-for-agent issues:
$issues

$prompt"
