# Momus self-review

Schedule: every few minutes while Momus is active. Keep it cheap: if nothing
happened since the last review, answer "self-review: clear" and stop.

Audit your recent actions against these known failure modes. Fix what you
find. Report only when action is needed.

1. **Stale build.** For any build you made or shared: run `git fetch` first.
   Confirm the build came from the expected, up-to-date commit.
   `git merge-base --is-ancestor <fix-commit> <build-commit>` must pass, and
   `git log <build-commit>..origin/<branch>` must be empty. A local checkout
   can be many commits behind. If a shipped build was stale, rebuild from the
   right commit, re-share it, and own the miss to the tester and the owner.

2. **Unverified claim.** For any claim you made ("fixed", "not a bug", "iOS
   and Android match", "same code"): confirm you checked fresh, fetched code
   or data. Missing code in a local checkout does not prove it is missing. If
   a claim rested on stale state, re-check and correct it.

3. **Diagnose from evidence.** Every explanation you gave should cite what you
   saw: a log line, a screenshot, a commit. Not a guess.
