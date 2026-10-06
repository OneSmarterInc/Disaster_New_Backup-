# RapidSim+ 01 — Opening sequence

Replaces the single brief screen. Five beats, roughly three minutes,
before the participant is asked to do anything.

---

## What the ABC case does that we were not doing

The classroom deck eases students in across seven beats: what the
company does, who runs it, that you are an analyst, that you were called
in, how the project came to exist, someone's handwritten field notes
from walking the floor, and the finished chart those notes became.

Our version opened on a bordered box reading YOUR ASSIGNMENT. Everything
in between was missing.

The beat worth most is the handwritten scrawl. It is proof that a person
stood in the mail room with a pencil, and it is the beat named at the
outset of this design: somebody has to follow the process before anyone
can talk about it. Showing the participant what that output looks like,
in someone else's hand, immediately before asking them to do their own
observation, is a teaching move the tidy chart cannot make.

**The constraint that stays.** ABC's trigger names a suspicion — the
Controller says internal mail is the delay — and that was removed on
purpose, because a participant handed a hypothesis spends their access
confirming it. Storytelling does not require a suspicion. It requires a
project with a history and people who did work. Every beat below is
narrative and none of it names a problem.

---

## Beat 1 — The company

> **Wexford Benefit Administrators**
>
> Wexford administers dental benefits for self-funded employers —
> companies that pay their own claims and hire someone else to run them.
> About four hundred plans, a little over two hundred staff, one
> building outside Hartford.
>
> Around twelve hundred claims arrive every working day. A dentist's
> office sends one in, somebody at Wexford works out whether the plan
> covers it and what it pays, and money moves. Most of it is routine.
> Almost all of it is paper, or was until fairly recently.

No process detail. Just enough that a participant with no insurance
background knows what the building is for.

## Beat 2 — The project

> Wexford is replacing its claims platform. The contract is signed, the
> vendor's configuration team starts in six weeks, and the go-live date
> has been circulated.
>
> A platform cannot be configured against a description of how work is
> supposed to happen. It has to be built against how the work actually
> happens — every handoff, every wait, everything that leaves the
> building and comes back. That documentation does not exist. Nobody has
> ever had a reason to write it down.

The pressure is a deadline, not a complaint. Nobody is unhappy.

## Beat 3 — You

> You are an analyst at Wexford. You have been pulled off your own work
> for two days to produce the front-end documentation, from the moment a
> claim arrives to the moment it reaches adjudication.
>
> You were given the assignment in a four-minute conversation. Nobody
> told you what to look for, because as far as anyone here is concerned
> there is nothing to look for. There is a migration, and somebody has
> to write down how the old way works before the new way replaces it.

The sentence about nobody telling you what to look for does the job
ABC's Controller does, in reverse. It orients without pointing.

## Beat 4 — What has already been done

> The vendor sent an analyst last spring to start the mapping. She spent
> one morning here, walked the front end, and left. Whatever was
> supposed to bring her back never did.
>
> Two things survive from that morning. Her field notes, and the partial
> chart somebody typed up from them.

Then the artifact:

```
  ─────────────────────────────────────────────────────────
   Field notes — Wexford, front end
   L. Marchetti, platform config.   Tues am.
  ─────────────────────────────────────────────────────────

   MAIL ROOM — w/ Ray
     post arrives 8:00 + 11:30, stacks on table
     fax server running all day, prints on arrival
     releases 09:00 and 14:00 ONLY. nothing between.
     ~300 post / ~400 fax out to conversion vendor /
       ~150 fax done here / ~350 clearinghouse
     clearinghouse never comes through this room at all

     ?? some faxes go OUT to the vendor, some done here
        asked twice, no rule. ASK SOMEONE ELSE

   LOG DESK — Terry
     every non-electronic claim posted to a sheet
     date / provider / patient / control no.
     6 batches. takes most of his day.
     WHAT IS IT FOR — didn't get to this

   NEXT DESK
     someone checks claims before adjudication
     ran out of morning. nothing recorded.

   ─── back Thurs to finish ───
```

Then the tidy chart, as it already renders, blanks intact.

**Why the notes earn their place.** They establish that a person was
here and ran out of time, which makes the blanks a consequence of a
morning rather than a design choice. They model what observation output
actually looks like — abbreviated, uneven, full of things worth chasing
— right before the participant does their own. And the two question
marks are the previous analyst's unfinished business rather than hints:
one records that a routing rule has no explanation, which is true and
stays unexplained; the other records that nobody established what the
log is for, which is exactly what the blank field on the chart already
says. Neither claims anything is wrong.

The last line is the small heartbreak. She never came back on Thursday.

## Beat 5 — Your access

> Karen in operations arranged your appointments and was pleasant and
> immovable about them. Fifteen minutes each. These are people with a
> day's work waiting, she said, and they are doing you a favour. No
> second visits.
>
> She could only make two orders work. Terry at nine, then Ray, then
> Ruth — or Ruth at nine, then Terry, then Ray. Ruth is in a plan review
> mid-morning, and Ray does not come off the floor until the second
> slot.
>
> Down the corridor, a fax machine is going.

Putting the two legal orders in Karen's voice makes the sequencing
decision diegetic. At present it reads as a menu of valid paths, which
is a game affordance; from her it reads as a calendar being what it is.

---

## Screen sequence

| Screen | Beat | Advance |
|---|---|---|
| 1 | Company and project (1 + 2) | Continue |
| 2 | You, and the four coverage points (3) | Continue |
| 3 | Field notes (4) | Continue |
| 4 | Partial chart (4) | Continue |
| 5 | Karen, and the order choice (5) | Choose an order |

Splitting the notes and the chart across two screens matters. Read
together they blur into one document; read in sequence the chart is
visibly derived from the notes, and the participant can see what
survived the typing up and what did not.

---

## Two fixes to what is already built

**The chart over-signals.** Every box currently carries Purpose, Owner
and Timing, with unestablished fields in amber. Adjudication has three
of them and it is merely out of scope. When four boxes are full of
amber, none of them means anything, and the blank that matters — the
receipt log's purpose — stops reading as an invitation to ask. Give
adjudication a flat terminus with no fields, and let the undocumented
step carry its gap in the title rather than three times underneath.

**The sidebar undoes the story.** "Interview Sources" and "Not
scheduled" are game vocabulary. They should be people with roles — Ray
Duffy, intake — with appointment times once an order is chosen.

---

## What still must not appear

No named complaint, no backlog figure, nothing described as late or
slow, no mention of anyone being unhappy. Any of these hands over a
hypothesis and the participant spends fifteen minutes confirming it.

No sympathetic framing of the three people before they are met. Ruth
especially has to be met cold, because how the participant approaches
her is the decision this sim is built around.

---

# The observation window

Ten minutes at the review desk, between the opening and the first
appointment. It exists so the thirty seconds is a number the participant
wrote down themselves rather than one they were handed, which is what
makes Ruth's later line — that the average describes nothing she
actually does — land against their own measurement.

It also now pays off the opening. The participant has just read someone
else's field notes from a morning of watching, and is about to produce
their own.

## The batch

Twenty claims, deterministic, identical for every participant so a
faculty member can debrief a whole room against one shared observation.

| | |
|---|---|
| 17 claims | 12 seconds each |
| 3 claims | 105, 132 and 159 seconds |
| Total | 600 seconds over 20 claims |
| Honest estimate | **30 seconds** |

Real time, no compression. Ten minutes of observation is ten minutes.

That average is exact, and it is the figure the platform gets configured
against. It is also correct, which is the whole trouble with it.

## What the participant is given

An elapsed clock and a count of completed claims. Nothing else.

No per-claim timer, ever. With a clock and a count they can divide, which
is what an observer with a notepad would actually do — and dividing is
what silently averages the three long claims into the seventeen short
ones. Handing them a per-claim figure would remove both the work and the
trap.

At the end, the chart's blank Timing field. They type a number. Whatever
they write is what they carry: no correction, no score, no reveal.

## The three long claims

Roughly one in seven, matching what Ruth says later. They are **visible
and unexplained**, which was the decision that mattered most in
designing this.

If they were invisible, the participant could not later be shown that
they watched the thing they failed to ask about. If they were labelled —
a flag, a status change, a caption — the participant would notice the
category and the trap would not spring. So a long claim simply sits
there. Nothing announces it.

Partway through each one, a second sheet surfaces beside the first. No
caption, no label. It is there because that is what she is doing. A
participant who notices and later asks what the second sheet was has
earned the entire sim, and the design should reward that rather than
prevent it.

Positions 4, 11 and 17. Not first — a long claim opening the window sets
the wrong expectation. Not last — attention has usually gone by then.

## For the debrief

The instructor knows the true figure is 12 seconds for six claims in
seven and about two and a half minutes for the seventh. Most
participants will record something between 25 and 35 and be right, and
being right is the point: the number they wrote is accurate, it is what
the vendor configures against, and it describes seven and a half minutes
of an eighty-minute batch.

Ask the room what they saw at claims four, eleven and seventeen. Some
will have noticed. Almost nobody will have asked Ruth about it.


---

# The interview screen

Fifteen minutes, one source, hard stop. `interview-preview.html`.

## Two things the review harness got wrong for participants

**It printed the classification under every answer.** "sender's view",
"efficiency framing", "open-ended". That hands over the taxonomy and
teaches participants to hunt for categories instead of thinking about
what they want to know. The classification is instructor material and
belongs only in the transcript view.

**It coloured the closing question's ledger block red.** The entire
design rests on closing Ruth feeling like nothing at all — she stays
warm, she agrees with them, and they leave believing she was helpful. A
red block on screen at the moment it happens destroys that, and destroys
the debrief with it. Red is for the instructor transcript, afterwards.

## The ledger

Each question leaves a block sized by what it consumed. Blocks alternate
between two shades of the same blue purely so adjacent ones are
distinguishable — no colour anywhere carries meaning about the kind of
question asked. Hovering a block shows the time it cost and nothing else.

A generic opener therefore appears as one block twice the width of any
other. That is a fact about the clock, not a label, and it is the only
feedback the participant gets about question quality during play.

## What the participant sees per exchange

Their question in mono, the time it cost, and the answer in serif.
Nothing else. No bucket, no posture, no marker of any kind. A question
that permanently closes a source renders identically to one that
changes nothing: same shape, same ninety seconds, same warm reply.

## The rail

The three people with their appointment times, the current one in amber,
finished ones dimmed. It keeps the calendar present without becoming a
menu, and it is a standing reminder that the next two appointments are
already scheduled and cannot be rearranged.

## Window end

"The appointment is over. She has gone back to work." Not "window
closed". The constraint is three colleagues doing you a favour, and the
copy should keep saying so.

Leaving early is available and costs the remaining time. Some
participants will do it, and a window ended with nine minutes unspent is
worth as much at debrief as one spent badly.
