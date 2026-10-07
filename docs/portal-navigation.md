# Portal navigation and refresh recovery

This change keeps the existing static HTML portals and APIs. A shared browser helper,
`platform/public/portal-navigation.js`, stores screen identifiers in URL query
parameters and restores data through existing permission-checked APIs.

## Route map

Existing `.html` routes and the configured clean aliases remain valid.

| Page | Navigation parameters |
| --- | --- |
| Admin | `tab=fac|stu|crs|cat`, `faculty=<id>` |
| Admin panels | `person=<id>`, `edit=<sim-id>`, `copy=<sim-id>`, `reviewers=<sim-id>`, `invite=1`, `add=1`, `maintenance=1` |
| Faculty | `view=home|course|played|student-results`, `tab=crs|sim`, `course=<id>`, `sim=<id>`, `student=<id>` |
| Faculty panels | `look=<sim-id>`, `new=1`, `edit=1`, `add=1` |
| Student | `course=<id>&sim=<id>` for results; `filter=To do|Finished`, `page=<number>` for the listing |
| Admin/faculty list context | `f_<list>=<filter>`, `p_<list>=<page>` |
| Account/sign-in | `next=<encoded internal destination>`; validated against the signed-in role |
| Course entry | `c=<course-code>`; manually entering a code updates the URL |
| Class-session entry | Existing `sim`, `session`, and `course`; `entry=signin|signup` records the entry form |
| Public catalogue | Existing `sim=<id>` links, now with Back/Forward navigation |

A faculty link containing only `?course=<id>` still opens the course.

## Behaviour

- Screen changes add browser-history entries. Saves, data refreshes and polling do
  not add duplicate entries. Refresh restoration performs reads, never replays
  submissions, invitations, access grants, deletions, or simulation launches.
- Searches and scroll positions are stored in browser history state, scoped to
  the authenticated user. Search text is not placed in shareable URLs. Separate
  tabs do not use a shared last-screen setting.
- Refresh reopens the requested editor/panel using saved server data. Unsaved
  drafts, passwords, generated invitation/reset links, temporary messages, help
  disclosures, and roster checkbox selections are not persisted.
- Missing or inaccessible records show an explanation and a way back. Temporary
  load errors retain the URL for retry. Admin database-repair controls remain
  available when the initial overview fails.
- Initial authentication failures caused by a connection/server error show retry;
  an expired session redirects to sign-in with a validated return destination.
- Delayed reads and action responses from a previous navigation are ignored. This
  does not undo an action already accepted by the server.
- Student polling updates results without leaving the selected result screen.
- Browser back/forward-cache restoration rechecks the account before reloading
  the route. Existing backend access checks remain authoritative.
- Portal navigation does not implement unsaved drafts or simulation gameplay/run
  recovery. Simulation launch URLs, callbacks, storage and game engines are unchanged.

## Verification

Validated against branch `feature/local-laptop-setup`, base commit
`2a8c91ac8fdf007cd621d4ff09c9b87f1b28d157`: 57 browser scenarios and
20 existing check commands passed. No live database was used.

Run existing portal checks from the repository root, for example:

```sh
node platform/tools/admin-views-check.js
node platform/tools/faculty-views-check.js
node platform/tools/student-views-check.js
node platform/tools/course-catalogue-check.js
node platform/tools/links-check.js
node platform/tools/routing-check.js
```

The browser regression test uses Playwright, as do existing browser tests in this
repository. It starts a temporary server on a loopback address and intercepts API
requests with disposable fixtures. It never writes to a live database.

```sh
node platform/tools/portal-navigation-browser-check.js
```

Install Playwright in your test environment and its Chromium browser first if
unavailable. `CHROMIUM_PATH` optionally selects an existing Chromium executable.
The tests cover desktop/mobile refresh, tabs and panels, nested detail views,
Back/Forward, direct links, pagination, searches, delayed requests, error retry,
polling, account return, sign-in return validation, course entry and session entry.
Every tested refresh also asserts that no write action is replayed.

These tests validate the real frontend against fixture responses. They do not
certify the production database, every simulation deployment, or the laptop's
untracked launcher. After applying locally, verify the same navigation with your
own Admin, Faculty and Student accounts in separate browser profiles.

No database migration or new production dependency is required. The launcher
must serve JavaScript from `platform/public`, including `portal-navigation.js`;
the previously supplied generic static-file launcher supports this.

## Route consistency follow-up

- Admin tab changes clear the person editor and its temporary reset link. A
  facilitator editor cannot become a student editor after a tab change.
- Edit, Catalogue page and Reviewers are mutually exclusive catalogue panels.
  For a conflicting direct link, precedence is `edit`, then `copy`, then
  `reviewers`. Ignored panel IDs are removed rather than fetched or validated;
  the selected panel still validates its record.
- Admin `faculty=<id>` detail takes precedence over list tabs/panels. Its URL
  normalizes to `tab=fac`, while preserving list filter/pagination context.
- Faculty explicitly accepts `view=home`. Stale course, simulation, student,
  edit and add parameters are discarded for Home. Legacy `?course=<id>` links
  still infer the course view. Incomplete result links still show an error.
- Normalization uses the existing replace-state path, not a new history entry.
  Search, pagination and Back/Forward recovery continue to use existing state.

Verification now includes 66 browser scenarios, including cross-tab editors,
conflicting deep links and catalogue panel switching. Tests use disposable API
fixtures, never the live database. Existing Admin/Faculty/Student view, catalogue
and link checks also pass.

`node platform/tools/routing-check.js` checks 55 exact destinations across 11
configured hosted simulation prefixes, aliases, platform paths and uniqueness of
all 12 local routes. This checks configuration, not remote deployment health.
It explicitly reports the existing missing hosted `/simplus02` mapping. Use
`--require-all-hosted` to make that known gap fail a hosted readiness check.
Do not invent a deployment URL to make that check pass.

With the local suite running, `node tools/local/check.cjs` additionally checks
all 12 health identities, entry pages, slash redirects with query preservation,
prefix boundaries, six portal aliases and their HTML destinations, the legacy
Plus alias and Sim07 demo. These checks passed in an isolated local suite with
real Redis and a PGlite test database adapter. Windows PostgreSQL and complete
gameplay are not covered by that fixture; rerun the check on the laptop.
