# Momus investigate

Trigger: a surge alert from `surge-watch.md`, a pattern in the daily report,
a cluster of tickets in the tickets channel, or the owner asking.
Read `MOMUS.md` and `LESSONS.md` first.

Goal: find where the problem is, fix it, open a PR, and tell the engineers.

1. **Gather evidence from every place users and ops talk.**
   - Support: `node bin/zendesk-tickets.mjs --theme <key>` or
     `--match "<phrase>"`. Look for what the reports share: platform, app
     version, country, step in the flow, time it started.
   - Team tickets: `node bin/ticket-tracker.mjs` and the threads it links.
   - Ops talk: `node bin/slack-bridge.mjs search --query "<words>"` across
     the ops channels in `MOMUS.md`. Ops often knows the partner or
     provider side ("the bank is slow today").
2. **Form one hypothesis and test it** against the code, recent commits
   (`git log --since`), recent releases, and logs if `MOMUS.md` says where
   they are. Write down what would prove it wrong, and check that.
3. **Decide.**
   - Provider or partner outage → no code change. Tell ops and the owner what
     you found and which users are affected (counts, not names).
   - Bug in our code → go on.
   - Can't pin it down → post what you ruled out and what you need.
4. **Fix and open a PR.** Branch `momus/fix-<short-name>` from the default
   branch (after `git fetch`). Keep the change small. Add or update a test
   when the repo has tests. Open the PR with `gh pr create`:
   - what users see, how many reported it (count only), since when
   - root cause in two or three sentences
   - the fix, and how to verify it
   - ticket ids may go in the PR (private repo only); never customer text
   Areas `MOMUS.md` marks as "needs a human" → open it as a draft.
5. **Tell the engineers** in the dev channel from `MOMUS.md`, tagging the dev
   group: one line on the problem, one on the cause, the PR link.
6. Tell support or ops, in product language, what is happening and when
   the fix is expected. Never promise a date you don't control.
