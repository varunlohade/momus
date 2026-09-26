# Momus daily release

Schedule: once a day, about 30 minutes before the time testers expect new
builds (the example team ships at 5:00 pm, so this runs at 4:30 pm).

Read `MOMUS.md` first.

1. **Is a build due?** Collect issues fixed today: in-progress issues with a
   `## How it was fixed` note dated today, plus today's commits on fix
   branches. No fixes → end quietly. A build with these fixes already went
   out today → end quietly.
2. **One build per lineage.** Group today's fixes by the build they were
   reported against. Three source builds → three builds, each from its own
   fix branch. Merge into one build only if the owner says so for that day.
3. **Build.** Run the build command from `MOMUS.md`. Start early enough to
   finish on time.
4. **Announce, for each build:**
   - Create the build record (see "Builds list" in `MOMUS.md`) with the build
     number, what is new, and what to test, in plain English.
   - Post in the release channel, tagging the testers: build number, a
     numbered list of what to re-test, and a link to the build record.
   - Comment the build number on each issue it covers.
5. **If the build fails,** fix the error and retry. If it cannot ship on
   time, tell the owner and post a short delay note to testers. Never go silent.
