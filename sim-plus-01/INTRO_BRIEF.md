# RapidSim+ 01 — Intro brief and partial chart

Participant-facing. Everything below is shown at the start of the
session, before the observation window and before any interview.

---

## 1. The brief

> **Wexford Benefit Administrators**
> Claims platform migration — front-end documentation
>
> Wexford administers dental claims for self-funded employer plans.
> Around twelve hundred claims arrive each working day.
>
> We are replacing the claims platform. The new vendor cannot configure
> anything until someone records how claims are actually handled between
> the moment they arrive and the moment they reach adjudication.
>
> That is your assignment. You are the internal analyst on it.
>
> The vendor has supplied a partial process chart from an earlier
> engagement. It is incomplete and it is not yours — treat it as a
> starting point, not a finding. Their configuration team has asked
> that your documentation cover, at minimum:
>
> - every point at which a claim changes hands or waits
> - what each step produces and who receives it
> - **any point at which the submitting provider is contacted, or
>   contacts us**
> - anything the chart shows that you cannot verify
>
> You have three fifteen-minute appointments. The people you are seeing
> have their own work; the appointments are fixed and there are no
> second visits.
>
> Your report goes to the configuration team on completion.

### On the fourth bullet

That line is the only concession the brief makes toward the finding, and
it is deliberate. Sender perspective is the bucket that cracks the loop
and it is not a natural question for someone documenting an internal
process — a participant can run a competent interview and never once
think to ask what the provider hears back.

The line licenses the question without pointing at an answer. It asks
for touchpoints to be documented, which is a routine scoping request; it
does not suggest there aren't any, and it does not connect provider
contact to anything else in the process. A participant who follows it
mechanically will ask Ray whether anything goes out and get a plain no.
What they do with that is still entirely theirs.

If early cohorts reach the finding without it, cut the bullet. It is
cheaper to remove a scaffold than to discover the sim is unwinnable.

---

## 2. The partial chart

Presented as a vendor artifact with its own letterhead, not as a clean
diagram. Provenance is visible: prepared by the platform vendor, from an
earlier engagement, some months old.

```
  ─────────────────────────────────────────────────────────────────
   WEXFORD BENEFIT ADMINISTRATORS — claims intake, front end
   Prepared by the platform configuration team, prior engagement
   Status: PARTIAL — not verified with Wexford staff
  ─────────────────────────────────────────────────────────────────

    ┌──────────────────────────┐
    │  CLAIM ARRIVES           │
    │                          │
    │  · post                  │
    │  · fax → outside         │      Purpose ............ intake
    │        conversion vendor │      Owner .............. mail room
    │  · fax → converted here  │      Timing ............. releases
    │  · clearinghouse         │                           09:00, 14:00
    └────────────┬─────────────┘
                 │
                 │   [clearinghouse claims bypass — routing not confirmed]
                 │
    ┌────────────▼─────────────┐
    │  RECEIPT LOG             │
    │                          │
    │  All non-electronic      │      Purpose ............ ______________
    │  claims posted to a      │      Owner .............. log desk
    │  spreadsheet before      │      Received by ........ ______________
    │  onward routing          │      Timing ............. approx. 6 hrs/day
    └────────────┬─────────────┘
                 │
    ┌────────────▼─────────────┐
    │                          │
    │      NOT DOCUMENTED      │      Purpose ............ ______________
    │                          │      Owner .............. ______________
    │   step exists; no        │      Received by ........ ______________
    │   detail recorded        │      Timing ............. ______________
    └────────────┬─────────────┘
                 │
                 ▼
            ADJUDICATION
              (out of scope)

  ─────────────────────────────────────────────────────────────────
   Blank fields were not established during the prior engagement.
  ─────────────────────────────────────────────────────────────────
```

### Why it is shaped this way

The receipt log is **on** the chart with its purpose field **blank**.
This was the decision worth getting right. A log drawn as a completed
box tells the participant the step is settled, and in paper testing that
was enough to make me skip its purpose entirely and nearly lose the best
finding in the sim to a rendering choice. A log left off the chart
guarantees discovery but costs realism, since a vendor who mapped intake
would obviously have seen the log next to it.

A box with a visible blank keeps the realism and removes the false
settlement. The gap is an invitation to ask rather than a signal that
nothing needs asking. It also mirrors the report form, where recording
something as unestablished is the correct answer on the vendor row —
the chart teaches that move before the report asks for it.

The same treatment applies to the second blank on that box: nothing
records who receives the log. That is the question that unravels it.

### The other two deliberate marks

The **clearinghouse bypass** is annotated as unconfirmed rather than
drawn as a clean parallel path. It sits on the chart doing nothing,
which is roughly its status inside the company. A participant who asks
Ray about it learns those claims are never touched and self-acknowledge,
which is half of the proof. A participant who ignores it has ignored
something the chart already flagged as unverified.

The **conversion vendor** appears as a destination inside the intake box
and nowhere else. There is no box for it, because from Wexford's side
there is nothing to draw. That absence is accurate and it is the visual
form of the blind spot.

---

## 3. Observation window

Ten minutes at the first-pass review desk, immediately after the brief
and before the first appointment.

The participant watches a batch move and records a per-claim figure on
the chart's blank timing field. They will arrive at roughly thirty
seconds. It is accurate, it is what the platform gets configured
against, and it describes the six claims in seven that need no judgment
at all.

Nobody explains anything during observation. Ruth works; the participant
watches. If a repeat copy comes up in those ten minutes she handles it
without narrating, so it reads as nothing more than a slower claim.

**Still unproven.** The window exists so the thirty seconds is a number
the participant wrote themselves rather than one they were handed, which
should make the later contradiction land harder. Paper testing could not
settle whether that pays for itself. If the first cohorts show no
difference, tell them thirty seconds in the brief and give the ten
minutes back to the debrief.

---

## 4. What the participant does not get

No org chart, no volumes by channel, no timing totals, and no
description of any role beyond what is on the chart. Ray's release
schedule, the two-day vendor round trip, the log's origin, and
everything about first-pass review are interview material. Handing any
of it over in the brief removes a question worth asking.

The availability calendar is visible from the first minute, because the
ordering decision is one of the two real decisions in the sim and it has
to be made deliberately rather than stumbled into.
