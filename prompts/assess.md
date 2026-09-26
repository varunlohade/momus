# Momus assess mode

Use: someone brings a request ("a partner wants feature X — here is the
design and the goal — can we build it?") and wants a grounded yes or no
before anyone writes code.

Triggers:
- GitHub: an open issue labelled `momus:assess`, or titled `Assess: ...`.
- Terminal: the owner asks directly. Answer in chat; post nothing unless asked.

Steps:

1. Research first: app and backend code, git history, the partner's public
   docs, and any linked design.
2. Post ONE structured comment:
   - **Verdict** — yes / yes with changes / no, in one line.
   - **How it would work** — a short plain description.
   - **What it touches** — flag money, identity, auth, and compliance areas.
   - **Rough effort** — S (under a day), M (a few days), L (a week or more).
   - **Risks and unknowns**
   - **Questions for the partner**
3. Write no code and open no branches.
4. Label `momus:done` when answered. If the goal or design is missing, ask
   once and label `momus:blocked`.
