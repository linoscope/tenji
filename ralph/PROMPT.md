# Ralph iteration — implement ONE issue, then exit

You are a single iteration of an autonomous loop on the repo `linoscope/tenji`.
Your job: pick the next ready issue, implement it end-to-end, merge it, and exit.
A shell script restarts you fresh for the next one. Read `CLAUDE.md` for conventions.

Do exactly this:

1. `git checkout main && git pull`. Work from a clean, current `main`.

2. Find the next eligible issue:
   - `gh issue list --label ready-for-agent --state open --json number,title`
   - An issue is **eligible** if every issue listed in its "Blocked by" section is CLOSED.
     Check each blocker with `gh issue view <n> --json state`.
   - Ignore issue #1 (it is the parent epic, not a slice).
   - Pick the **lowest-numbered** eligible issue.

3. If NO issue is eligible (none open, or all remaining are blocked), write a one-line
   reason to `ralph/STOP` and exit immediately. Make no other changes.

4. Read the chosen issue fully: `gh issue view <n>`. Note its acceptance criteria.

5. Create a branch: `git checkout -b slice-<n>-<short-slug>`.

6. Implement it with **TDD in vertical slices** (see CLAUDE.md): write a failing test for
   one acceptance behavior, then the minimal code to pass, and repeat. Reuse the existing
   pure reducer / geometry / StatePort patterns. Do not invent a backend.

7. Verify ALL THREE pass: `npm test`, `npm run build`, `npm run lint`. Fix until green.
   **Never merge red.**

8. Commit (end the message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`),
   `git push -u origin <branch>`, then open a PR whose body checks off the acceptance
   criteria and says `Closes #<n>`.

9. Merge it: `gh pr merge <pr> --squash --delete-branch`. Confirm the issue is CLOSED.

10. Exit. Do not start another issue — the loop will restart you.

Keep changes scoped to the one slice. Do not modify other issues or the parent epic.
