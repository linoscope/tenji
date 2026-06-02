#!/bin/bash
# Ralph once — a single supervised iteration. Implements one eligible issue.
# Uses acceptEdits so you stay in the loop for non-edit actions. No Docker.
# Usage: ralph/once.sh
cd "$(dirname "$0")/.."

commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
issues=$(gh issue list --label ready-for-agent --state open --json number,title \
          -q '.[] | "#\(.number) \(.title)"' 2>/dev/null || echo "No issues found")
prompt=$(cat ralph/prompt.md)

claude --permission-mode acceptEdits \
  "Previous commits:
$commits

Open ready-for-agent issues:
$issues

$prompt"
