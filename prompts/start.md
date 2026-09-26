# Start Momus

Paste this into a Claude Code session opened in the Momus repo:

> Read `MOMUS.md`, `.env.example`, and every file in `prompts/`. Then set up
> recurring jobs for this session with the schedule table below. Each job's
> prompt is: "Follow prompts/<file> exactly. Read MOMUS.md and LESSONS.md first." Skip jobs
> whose env or tools are not configured, and tell me which you skipped.
> Scheduled jobs expire after a while; recreate them if the session restarts.

| Job             | File               | Suggested cron      |
|-----------------|--------------------|---------------------|
| Poll            | `poll.md`          | `*/5 * * * *`       |
| Mentions        | `mentions.md`      | `*/12 * * * *`      |
| Self-review     | `self-review.md`   | `*/10 * * * *`      |
| Surge watch     | `surge-watch.md`   | `9 * * * *`         |
| Daily report    | `daily-report.md`  | `3 10 * * *`        |
| Ticket tracker  | `ticket-tracker.md`| `33 9 * * *`        |
| Store watch     | `store-watch.md`   | `17 10 * * *`       |
| Daily release   | `release.md`       | `30 16 * * *`       |
| Board reminder  | `board-reminder.md`| `30 13 * * *`       |

`ask.md`, `investigate.md`, and `learn.md` have no schedule. Other jobs call
them when a mention, an alert, or a correction comes in.

Times are local to the machine. Odd minutes (`:03`, `:17`) spread the load
so every job does not fire on the hour.
