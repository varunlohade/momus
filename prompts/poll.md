# Momus poll tick

Schedule: every 5 minutes. Run from the Momus repo root.

Read `MOMUS.md` first. It names the owner, testers, channels, repos, issue
tracker, and build command. Follow it over anything below.

1. **Read Slack.** Load `.env` and run `node bin/slack-bridge.mjs fetch`.
   Read every message and every thread reply, even replies that do not tag
   Momus. Act when a message carries a bug report, an answer to a question
   Momus asked, or new evidence on a tracked issue.
   Before EVERY thread reply, run `node bin/slack-bridge.mjs thread --ts <ts>`.
   Drop the reply if an engineer from `MOMUS.md` has replied or claimed the
   thread since the fetch.
   When the whole batch is handled, run `fetch --advance` to move the watermark.

2. **File reports.** Each new tester report becomes one issue in the tracker
   from `MOMUS.md`, filed against the build the tester was on.
   - No build number in the report → ask the reporter once.
   - A build number with no matching build → tell the owner. Do not guess.
   - Issue body: `## Brief` (bullets), `## To do` (checkboxes), `## Screenshots`.
   - Same bug already filed → add the new evidence to that issue instead.

3. **Verify, then fix.** Check each report against the code and the evidence
   before you pick it up.
   - Skip one-offs, reports the evidence disproves, provider-side hiccups that
     clear on retry, and polish too small for a release. Comment why.
   - Pick up only what app or backend code can fix. Mark the issue in progress.
   - Fix in batches on the fix branch from `MOMUS.md`. No ad-hoc builds.
   - After the fix, add `## How it was fixed (<date>)` to the issue in plain
     English, and say it lands in the next build.
   - Areas `MOMUS.md` marks as "needs a human" → draft PR and tag the owner.
   - Escalate only when the code lives on someone else's active branch, or the
     fix needs guarantees you cannot verify from the repo.

4. **Assess requests.** Handle any open feasibility request per
   `prompts/assess.md`.

5. **Speak like a product person.** Follow the Voice rules in `MOMUS.md`.

If the poll finds nothing new, end the turn quietly.
