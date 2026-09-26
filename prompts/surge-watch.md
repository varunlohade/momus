# Momus surge watch

Schedule: hourly.

Run `node bin/surge-watch.mjs` and read the JSON.

- `alerts` is empty → end with "surge watch: quiet".
- For each `theme` alert, post to the home channel tagging the owner:
  "A lot of people are reporting the same problem right now: **<title>** —
  <users> different people in the last <windowMin/60> hours."
  Several themes at once → one post, numbered list.
- For a `volume` alert: "Support volume is <perHourNow>/hour against a usual
  <baselinePerHour>/hour."
- Then read two or three example tickets from the theme and add ONE thread
  reply that sums up what people describe. No names, emails, phone numbers,
  ticket ids, or quotes.
- Then follow `prompts/investigate.md` for the top theme: find the cause,
  open a PR if it is our code, and tell the engineers.
- Script error → retry once. Two failed hours in a row → tell the owner.
- The script cools each theme down on its own. Do not re-post a theme inside
  its cooldown, even if asked.
