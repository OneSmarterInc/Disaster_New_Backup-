# RapidSim 02 — tree handoff

`rapid-sim-02-tree.tar.gz` unpacks to `sim-02/`. Copied from `sim/` at commit `ed0eb36` and edited from there. Drop it in the repo root alongside `sim/` and `platform/`, and give it its own Vercel project with Root Directory `sim-02/`.

Everything parses, the client boots against a stubbed DOM, and the build guard reports a clean audit. Nothing has been run against a live API key.

## Vercel setup

Same environment variables as RapidSim 01: `ANTHROPIC_API_KEY`, `ACCESS_CODE`, `FACULTY_CODES`, `LAUNCH_SECRET` (must match the platform's exactly), and the Upstash Redis integration for sessions.

If you change Root Directory after the first deploy, redeploy with the build cache disabled or you get the old output.

## What changed from `sim/`

`lib/scenario.js` is entirely new — different incident, different cast. `api/scene.js`, `api/chat.js`, `api/debrief.js`, `api/help.js`, `src/engine.js`, `src/shell.html`, `build.js`, `package.json` and both HTML files have edits. `lib/guard.js`, `lib/launch.js`, `lib/store.js` and `api/session.js` are untouched apart from one label.

Two structural additions worth knowing about:

**`sceneFor(phase, state)` takes run state.** The third moment has two variants depending on whether the student preserved the search index before a scheduled overnight job overwrote it. Variant content lives in `PHASES` as beats and telemetry rows carrying an `only` tag; `sceneFor` filters on tags computed from state. The client receives the same plain shape it always did, so this is invisible downstream. `api/scene.js` recomputes the flag from the recorded positions rather than trusting what the client sends, so a reload can't land someone in the wrong variant.

**Disclosure detection moved to the server.** See below — this one matters for RapidSim 01 too.

## Two bugs found in `sim/` while doing this

**The build guard has been passing on a file that leaks.** `build.js` in `sim/` checks for the string `'Q3 cost review'`. The thing that actually ships to the browser is the detection regex in `engine.js`, which reads `/q3|cost review|overrul|.../` — different wording, so the check never fires. Anyone reading page source at Hour 4 can see the phrases the sim is watching for, which gives away what Sophia is carrying before they have asked her anything.

Fixed here by moving detection into `api/chat.js`: the endpoint tests the generated line against `S.LADDER.re` and returns a boolean alongside the text, so the markers stay server-side. `askCharacter` now returns `{ text, ladder }` rather than a string. Worth porting the same change back to `sim/`.

**Prohibitions that name the secret they forbid.** In `sim/`, Kate's and Sophia's prohibition lists both name `svc-bkp-legacy` in order to forbid mentioning it, which tells the model the fact exists and leaves it hedging around something it supposedly doesn't know. Same pattern was in my first draft here and is now reworded. Not urgent, but it's a design smell worth knowing about.

## `tools/boot-check.js`

Boots the built bundle against a stubbed DOM. Node syntax checks don't catch load-time errors and the repo has a history of them, so run `node build.js && node tools/boot-check.js` before any deploy.

## Not done

The **classifier for the conversational branch route** is specified but not written. Right now the third-moment variant keys only off the explicit `preserve` action. The intended behaviour is that telling a character to hold the overnight job in conversation should count too, adjudicated by one call at each phase close. Spec is in `rapid-sim-02-engine-changes.md`, section 3 — the important parts are that a question is not an instruction, holding something else is not holding this, and it defaults to preserved on failure.

The **fallback bank** in `lib/scenario.js` is written but untested. It only runs when the API is unreachable.

**Nothing has been played end to end.** The characters have been tested on paper, not in the built sim.

## Catalogue registration

Register through the admin page, unpublished. Values are in the instance document, section 9. The id is `rapid-02-relay`.
