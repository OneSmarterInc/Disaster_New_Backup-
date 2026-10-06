# Wexford identity — non-destructive rollout

Wexford / RapidSim+ now announces `rapidsimplus-01`. Midland remains
`rapid-03-midland`. Routes, deployment project names, course assignments, grants,
student runs and historical database rows are not rewritten by this change.

`rapid-03-bench` was reused: its records may belong to Bench Is Clear, Wexford, or
both. Do not infer the scenario from the ID or a count alone. `rapid-sim-03` is
also retained as a legacy Wexford launch identifier.

## Compatibility before a reviewed migration

Platform registration no longer deletes `replaces` rows, even when an old
Midland/Wexford deployment sends that field. It returns `aliasesRemoved: []` and
`aliasesRetained` for review. This prevents transcript cascades and count/delete
races, including when a legacy row currently appears unused.

The new Wexford catalogue row is created **unpublished**, under the platform's
existing policy. Old published entries and old course links keep working.
Wexford accepts signed launches for its canonical and legacy IDs, while rejecting
tokens for another simulation. Completion reports retain their launch ID; the
transcript envelope is matched to that same ID so the platform accepts it without
misfiling legacy launches under the new row. Existing saved state is not deleted.

## Required operational review

In an authorized platform environment, with its existing database connection:

```sh
cd platform
node tools/audit-sim-identity.js
```

This is read-only. It reports catalogue metadata plus dependencies in
`course_sims`, `launches`, `completions`, `previews`, `sim_access`, and `transcripts`.
An absent transcript table is reported explicitly, not counted as a verified zero.
Counts are observations, not permission to delete records.

Before publishing the canonical entry for new courses, inspect the legacy
records' timestamps, content and deployment history to distinguish the scenarios.
Preserve existing course assignments and entitlements until their migration is
explicitly reviewed. Take a database backup before any approved historical move.
Do not delete, rename or bulk re-key the old row as part of this release.

This code change supplies compatibility and an inventory tool; it does **not**
run a production migration, publish a new entry, retire an old entry, or certify
that production contains no legacy records.
