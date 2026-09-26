# [Build 42] Send button stays grey after picking a contact

Reported by Sam in #momus.

## Brief
- iPhone, build 42.
- Pick a contact on the Send screen → the Send button stays disabled.
- Going back and picking the same contact again enables it.

## To do
- [ ] Reproduce on build 42
- [ ] Fix so the button enables on the first pick
- [ ] Add to the next build's re-test list

## Screenshots
send-grey.png (in the Slack thread)

## How it was fixed (2026-01-01)
The Send screen checked whether a contact was chosen before the choice had
finished saving, so the first pick looked empty. It now waits for the pick
to finish. This lands in the next build.
