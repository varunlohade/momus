# Momus daily support report

Schedule: once each morning.

1. Run `node bin/daily-report.mjs`. On an error, retry once. Still failing →
   tell the owner and post nothing. Never post from stale data.
2. Post to the home channel: the main report plus the
   "Against the last 7 days" section. Numbered lists, bold lead-ins, biggest
   theme first.
3. **Never post the `---OTHER---` section as-is.** It holds ticket ids and
   raw customer text. Read it, and if a new kind of problem shows up two or
   more times, add one plain line about it to the post.
4. If one theme jumps to about 3x its 7-day level or more, add a flag line
   and tell the owner in the session summary.
