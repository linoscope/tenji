# ISSUES

The backlog lives in **GitHub Issues** on `linoscope/tenji`. The currently open
`ready-for-agent` issues are passed to you at the start of context. Use
`gh issue view <n>` to read a full issue body and its acceptance criteria.

- Ignore issue **#1** — it is the parent epic, not a slice.
- An issue is **eligible** only if every issue listed in its "Blocked by" section is
  CLOSED. Check each blocker with `gh issue view <n> --json state`.
- The user has opted to attempt the one HITL issue (#7) as well, so treat all slices as workable.

If there is **no eligible issue** (none open, or all remaining are blocked), output exactly
`<promise>NO MORE TASKS</promise>` and stop. Make no changes.

# TASK SELECTION

Pick the **lowest-numbered eligible** issue. Work on exactly one.

# EXPLORATION

Explore the repo first. Read `CLAUDE.md` for the stack, architecture seams, and conventions.
Review the passed recent commits to understand what the previous iterations built.

# IMPLEMENTATION

Use `/tdd` to complete the task: write a failing test for one acceptance behavior, then the
minimal code to pass it, and repeat — vertical slices, not all-tests-up-front. Reuse the
existing pure reducer / geometry / StatePort patterns. Do not add a backend.

# FEEDBACK LOOPS

Before integrating, all of these must pass:

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Fix until green. Never integrate red.

# INTEGRATION (PR + auto-merge)

1. Branch: `git checkout -b slice-<n>-<short-slug>` off an up-to-date `main`.
2. Commit. The message must include key decisions, files changed, and any notes for the next
   iteration, and must end with the trailer:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
3. `git push -u origin <branch>`, then open a PR whose body checks off the acceptance criteria
   and says `Closes #<n>`.
4. Merge it: `gh pr merge <pr> --squash --delete-branch`. Confirm the issue is CLOSED and
   `main` is updated.

# FINAL RULES

ONLY WORK ON A SINGLE TASK. Then stop — the loop will restart you fresh for the next one.
