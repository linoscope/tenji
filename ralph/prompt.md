# ISSUES

The backlog lives in **GitHub Issues** on `linoscope/tenji`. The currently open
`ready-for-agent` issues are passed to you at the start of context. Use
`gh issue view <n>` to read a full issue body and its acceptance criteria.

- Ignore issue **#1** — it is the parent epic, not a slice.
- An issue is **eligible** only if every issue listed in its "Blocked by" section is
  CLOSED. Check each blocker with `gh issue view <n> --json state`.
- The user has opted to attempt the one HITL issue (#7) as well, so treat all slices as workable.
- Do NOT trust the injected issue list for blocker status — it only shows numbers and titles.
  Determine eligibility yourself by reading each open issue's "Blocked by" via `gh`.

Emit `<promise>NO MORE TASKS</promise>` ONLY when, after checking every open
`ready-for-agent` issue, **none** is eligible (each has at least one still-open blocker), or
none are open at all. In that case make no changes and stop.

**Finishing your one task is NOT a reason to emit the promise.** After you merge your task,
just stop silently — the loop restarts you, and the next run re-checks eligibility. When in
doubt, do NOT emit the promise; let the loop run again.

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

ONLY WORK ON A SINGLE TASK — merge exactly one issue, then stop. Do NOT go on to a second
issue in the same run, even if more are eligible. The loop will restart you fresh for the next one.
