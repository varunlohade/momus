# Ask Momus

Used by `mentions.md` whenever someone @mentions Momus with a question or a
request. Read `MOMUS.md` and `LESSONS.md` first.

Work out which kind of ask it is, then follow that section. If it is none of
these, answer briefly from evidence or say you can't help with that.

## 1. "Something is wrong on this build — am I doing it wrong?"

1. Get the build number and device. Missing → ask once.
2. Check whether this is a known issue in the tracker, or already fixed on a
   later build. If fixed, say which build has the fix.
3. Otherwise check the code at that build's commit (`git fetch` first) and any
   screenshot or recording they attached.
4. Answer in product language: either the steps to do it right, or "this is a
   bug" — then file it per `poll.md` step 2.

## 2. "Give me a build" (of a branch, a PR, or with some fix)

1. Only people listed under **Can request builds** in `MOMUS.md` can ask.
   Anyone else → politely say who can.
2. Work out the branch. A PR → its head branch. "With the fix for X" → the
   fix branch holding it. Not sure → ask; never guess.
3. The branch must exist on origin. Never build uncommitted or local-only work.
4. React 👀, reply "Building <branch> now", then run
   `bin/build-ios.sh <branch>`. It builds from a fresh copy of origin,
   drives Xcode, and uploads to TestFlight.
5. When it finishes, reply in the thread: the build number, the branch, the
   short commit, and what is in it in plain words. Say TestFlight takes a few
   minutes to process.
6. It fails → fix the build error only if it is clearly a build setup issue;
   otherwise reply with what failed in plain words and tag the engineers.
7. Limits: one build per requester at a time. Never submit to App Store
   review. Building from any branch is fine; pushing to a protected one is not.

## 3. "Why did we decide X?" / "Why does it work this way?"

1. Search where decisions leave traces:
   - code history: `git log -S "<term>"`, `git log --grep`, `git blame` on the
     relevant lines, then `gh pr view <n> --comments` for the PR that made it
   - the tracker: `gh issue list --search "<term>" --state all`
   - Slack: `node bin/slack-bridge.mjs search --query "<words>" --asker <their user id> --exclude <read-only channels>`
2. **Only cite what the asker can already see.** The `--asker` flag keeps
   Slack results to channels they belong to. Never quote read-only or
   leadership channels, DMs, or private PR discussions they are not part of.
   If the real reason lives somewhere they can't see, say "that was decided
   by <role>; ask them" — do not paraphrase it.
3. Answer: what was decided, when, why (in one or two sentences), and links
   to the PR, issue, or thread. Nothing found → say so plainly. Never invent
   a reason.
