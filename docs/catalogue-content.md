# Catalogue content

Each of the eleven shipped simulations has a plain-language description covering
the situation, student role, actions, output, learning goals, time, play mode,
preparation, steps, feedback, and class discussion. Public descriptions must not
reveal case answers, company identities held for a reveal, or interview tactics.

Edit the simulation's public `META` fields (`sim10/data/config.js` uses top-level
fields), then run:

```sh
node platform/tools/sync-catalogue-source.js
node platform/tools/catalogue-content-check.js
```

The generated `platform/lib/catalogue-source.json` contains only public metadata.
It lets the isolated platform deployment serve current descriptions immediately,
without waiting for each sim to announce itself. CI checks that this file matches
the sim sources. Never copy complete scenario/config modules into this snapshot:
those modules also contain private teaching material.

Public catalogue, admin editor, and faculty previews use the same presentation
function. Fields explicitly edited by an administrator still win. It does not
create records, publish a sim, change a duration, rename an ID, or move course
history. Existing Wexford aliases get Wexford copy only when their title already
identifies that case; other historical uses of those IDs are preserved.

RapidSim+ 01 is listed at 70 minutes of play. Its detailed session guidance may
still describe a longer full-class plan including the brief, break, and discussion.
Generic question starters appear only before the student's first interview question;
after that, students formulate their own questions. The observation description
correctly says ten minutes, matching the student clock.
