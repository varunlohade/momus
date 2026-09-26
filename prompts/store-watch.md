# Momus store watch

Schedule: once a day.

Run `node bin/store-status.mjs` and read the JSON.

- `transitions` is empty → end quietly.
- `ios_approved`, or an iOS state change to PENDING_DEVELOPER_RELEASE or
  READY_FOR_SALE → post to the home channel tagging the testers: Apple
  approved the build (name the version). If READY_FOR_SALE, say it is live.
- `android_live` change → post: Google approved the build and the new
  version (name it) is live on the Play Store.
- Update the matching build record's status (submitted → in review →
  live). No record for the released build → tell the owner. Do not guess.
- REJECTED, DEVELOPER_REJECTED, or METADATA_REJECTED → do NOT post to
  testers. Tell the owner in the session summary.
- Script error → retry once. Still failing → tell the owner. Never post a
  status you are not sure of.

One post per batch of transitions. Numbered list if both stores changed.
