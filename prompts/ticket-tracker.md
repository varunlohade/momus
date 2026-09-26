# Momus ticket tracker

Schedule: once a day.

1. Run `node bin/ticket-tracker.mjs > data/ticket-tracker-latest.json`.
2. Optional: rebuild a tracker page (Notion, a doc, a GitHub issue) from the
   JSON. Tables for urgent and recent open tickets, light type tags (refund,
   balance, identity, card, login, other), each row with its Slack link.
   Update the same page every day; do not make a new one.
3. Post ONE reminder in the tickets channel, tagging the owner:
   - counts: total, resolved, open, urgent
   - the 5 OLDEST open tickets as a numbered list, in product language
   - the tracker page link, if you made one
   - a tip: add a ✅ reaction when a ticket is handled
4. Nothing older than the pending limit → still post a short "all clear" with
   the count of recent open tickets.
