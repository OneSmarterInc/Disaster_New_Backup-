# Flexee RapidSim 01 — Vercel deployment

The scenario is deliberately split. `public/index.html` is the interface only — the clock, the commitment mechanics, the transcript. It contains no character contracts, no knowledge sets, no scene text beyond the current moment, and no resolution. A student who opens the page source learns nothing about how the incident ends.

Everything that matters lives in `lib/scenario.js`, which is bundled with the serverless functions and never served to a browser. `api/scene.js` releases one phase of scene content at a time, `api/chat.js` assembles each character's prompt and returns only their line, and `api/debrief.js` holds the resolution and all the evaluation. Your Anthropic key stays in the environment and never reaches anyone's browser.

That split does two jobs. It stops a curious student spoiling the ending for themselves, and it means anyone who copies the HTML gets an empty shell — the scenario is the intellectual property, and it isn't in the file they can take.

## Deploying

The fastest route is the CLI. Install it once with `npm i -g vercel`, then from this folder run `vercel` and accept the defaults. It'll give you a preview URL. When you're happy, `vercel --prod` promotes it.

Before it will work you need two environment variables set in the Vercel dashboard, under Settings then Environment Variables for the project.

`ANTHROPIC_API_KEY` is your key from console.anthropic.com. This is the only place it exists.

`ACCESS_CODE` is any word you choose. Anyone without it gets turned away by the server. Leave it unset and the sim is open to whoever finds the URL, which will eventually be someone you didn't invite.

Redeploy after setting them, since environment variables are read at deploy time.

The alternative is connecting a Git repository, which Vercel will then redeploy on every push. Same environment variables either way.

## Sending it out

Give people the URL and the code separately, or put the code in the link as `https://your-project.vercel.app/#code=northbeam`. The page strips it from the address bar on load, though it'll still be in whatever message you sent, so treat a link like that as shareable with anyone you'd be happy playing.

If someone lands without a code they get a prompt rather than a broken page, and they can enter it under the gear icon in the top right.

## Cost

A full twenty-minute run is a few cents. Each character reply is a small call, and the debrief adds four more. A class of thirty is comfortably under a couple of dollars.

Vercel's free tier will carry faculty review and a single class without trouble. Worth noting the Hobby plan is meant for non-commercial use, so if this becomes part of a paid teaching product you'll want the Pro plan.

## Running it locally

`vercel dev` from this folder gives you the same thing on localhost, reading from `.env.local`. Copy `.env.example` to `.env.local` and fill it in.

Opening `public/index.html` directly in a browser no longer works, because there's no server to supply the scenario. Use `vercel dev` for local work.

## If something breaks

Vercel's Runtime Logs, under the project's Logs tab, show whatever the function printed. A 500 usually means `ANTHROPIC_API_KEY` isn't set or was set after the last deploy. A 401 from the sim means the access code didn't match. If the sim says it's in scripted mode, it couldn't reach the function at all and is running on prepared lines — the flow still works but the characters can't respond to anything unanticipated, so don't evaluate it in that state.


## Facilitated sessions

The sim runs standalone at the root URL. For a class, the faculty console is at `/faculty.html`.

This needs somewhere to keep session state, because serverless functions don't remember anything between requests. In the Vercel dashboard open the project, go to Storage, and create a KV / Upstash Redis store attached to this project. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you. Redeploy afterwards. Without it the sim still works solo and the faculty console reports that storage isn't set up.

Faculty access is controlled by `FACULTY_CODES`, one entry per person as `Name:code`, comma separated:

```
FACULTY_CODES=Chuck Rivera:chuck-8811,Dana Okoye:dana-4420,Vikram Sethi:vs-3390
```

Each person gets their own code, sessions are owned by whoever created them, and one facilitator can't open or drive another's session. To add someone, append an entry and redeploy. To revoke someone, delete their entry and redeploy — everyone else is unaffected.

The older single `FACULTY_CODE` still works as a shared fallback if both are set, which is useful while migrating. Remove it once everyone has their own.

The flow: open `/faculty.html`, enter the facilitator code, create a session, and read out the five-character code or share the join link. Students land on a name screen, then wait. You shuffle them into groups of one to three, press start, and the incident begins for everyone.

While it runs you can freeze the clock, which puts a hold screen over every student's sim without losing anything, and resume when the discussion is done. Groups who finish are held on a waiting screen until you release the debrief — worth holding until the room has committed out loud, because the conversation is better while nobody knows who was right.

The Compare tab shows every group's reading, action and tripwire for one moment at a time, plus who got the coverage admission and when. That last row is the best single indicator of how well a group ran it.

Sessions delete themselves after 48 hours. Nothing is stored about a student except the name they type.


## Editing the sim

The browser file `public/index.html` is generated — don't edit it by hand. The
sources are in `src/`:

`shell.html` is the markup and stylesheet, `client-scenario.js` is a deliberately
empty stub (the real scenario lives server-side), and `engine.js` is the client
logic.

After changing any of them run `node build.js`, which stitches them together and
refuses to write the file if any scenario content has leaked into it.

The scenario itself — ground truth, character contracts, knowledge sets, the
debrief — lives in `lib/scenario.js` and is only ever read by the serverless
functions. It must never be imported by anything under `public/`.


## Launching from the platform

The sim can be entered two ways. Standalone, with the shared `ACCESS_CODE`.
Or from the platform, which signs a short-lived token and sends the person here
with `?lt=…` on the URL.

`lib/launch.js` verifies that token against `LAUNCH_SECRET`, which must match the
platform's. A valid token replaces the access code entirely and tells the sim who
is playing: anyone arriving as faculty is sent straight to the session console,
students go into the sim. The token is stripped from the address bar on arrival.

The sim never calls the platform and shares no database with it. The signature is
the whole contract.
