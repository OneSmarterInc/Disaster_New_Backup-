# Platform — pre-publication review access

Written against `main` at `ed0eb36`. Nothing here is committed.

## Why

RapidSim 02 is coming, and every one after it will need the same thing: a period where the sim is registered, deployed and working, but not visible to anyone except the people reviewing it. Today that period has no home in the platform. RapidSim 01 was reviewed by handing out the sim's own access code, which works and bypasses the platform entirely — so nothing is recorded, entitlement doesn't apply, and the reviewer sees the sim rather than the thing a faculty member would actually experience.

The decision is that a sim is registered unpublished, sits there while we get it right, and appears in the catalogue when Vikram flips the flag. Publication is his call, not the builder's.

## What already works

The `published` flag is respected everywhere it needs to be, which I checked rather than assumed:

- `api/auth.js` `catalogue` — the public landing page, anonymous
- `api/faculty.js` line 36 — faculty home catalogue
- `api/faculty.js` line 119 — course detail catalogue
- `api/faculty.js` `start_preview` — refuses a preview of an unpublished sim
- `api/student.js` `dashboard` — students only see published sims in their courses

Registration through `admin.js` `save_sim` already defaults to unpublished, and `admin.html` already has a Publish / Unpublish toggle and a draft pill. So the flag itself needs no work.

## One gap worth fixing while we're here

`faculty.js` `add_sim` does not check publication. It inserts straight into `course_sims` with whatever `simId` the client sends. The foreign key means the sim has to exist, but not that it's published.

In practice nothing escapes, because the student dashboard filters on `published = true`, so a draft sim attached to a course is invisible to students. But it means the platform's own data can hold a course pointing at a draft sim, and it becomes a real hole the moment review access exists — a reviewer granted access could attach a draft sim to a live course. Add the same existence check `start_preview` uses.

## What to build

A grant table. An admin gives a named person access to a named unpublished sim, and that person sees it as though it were published.

```sql
CREATE TABLE IF NOT EXISTS sim_access (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id      TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  granted_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sim_id)
);
CREATE INDEX IF NOT EXISTS sim_access_user_idx ON sim_access(user_id);
```

No expiry column, deliberately. A trial expires because it is a trial. A review grant ends when the sim is published, or when an admin revokes it. Putting a seven-day clock on a reviewer means their access lapses mid-review, which is a small insult to someone doing us a favour.

`note` is there so the admin list reads as "Chuck, reviewing before we ship" rather than as two opaque ids.

Remember `lib/schema.js` is the bundled copy — the SQL has to go in both it and `schema.sql`, per the Vercel bundling problem already noted in the repo.

### Query changes

Each of these becomes "published, or granted to this user". Five places, and the shape is the same in all of them:

```sql
WHERE (si.published = true OR EXISTS (
  SELECT 1 FROM sim_access sa WHERE sa.sim_id = si.id AND sa.user_id = ${me.id}
))
```

- `faculty.js` line 36 — so the sim appears in their catalogue
- `faculty.js` line 119 — same, on the course detail view
- `faculty.js` `start_preview` — so they can start a preview of it
- `faculty.js` `add_sim` — the new check, granted-aware from the start
- `student.js` `dashboard` — so a reviewer's own students can reach it, if the review involves running it with a class

Leave `auth.js` `catalogue` strictly filtered. That endpoint is the anonymous landing page and there is no user to check a grant against.

### Admin actions

Three, on the pattern of the existing `save_sim` case:

- `grant_sim_access` — user id, sim id, optional note. Upsert on the unique pair.
- `revoke_sim_access` — by grant id.
- `sim_access_list` — grants for a given sim, joined to user name and email, for the admin panel.

And in `save_sim`: when a sim transitions to published, delete its grants. They have no meaning once everyone can see it, and leaving them behind means the table slowly fills with rows nobody reads.

### Admin UI

In the sim detail panel in `admin.html`, under the publish toggle: the list of people with access, each with a revoke button, and a way to add someone by email. The draft pill should say how many people are reviewing it, because a sim sitting in draft for a month with nobody on it is a thing worth noticing at a glance.

## What not to do

Do not reuse `previews` for this. It is tempting — it is already a per-user, per-sim, time-limited grant and it would cost no new schema. But a preview means a faculty member evaluating something we have decided is finished, and a review grant means the opposite. Same mechanism, opposite meaning. Conflating them means the admin view cannot tell a trial from a review, and the seven-day expiry starts applying to something that should not expire on a timer.

## How to check it works

Register a sim unpublished. Confirm it is absent from the landing page, absent from the faculty catalogue, and cannot be previewed or added to a course. Grant access to one faculty account. Confirm it appears for that account and remains absent for another. Confirm a preview can be started and a launch works end to end. Publish it, and confirm the grants are gone and the sim is visible to everyone. Then unpublish it and confirm it disappears again without taking the course attachment with it.

## Note on sim deployments

The sim side needs nothing. A sim verifies a launch token and has no idea whether it is published. All of this is platform-side, which is the right place for it.
