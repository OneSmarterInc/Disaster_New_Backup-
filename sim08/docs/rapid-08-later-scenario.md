# Eighteen Months Later — scenario draft

Id `rapid-08-later` · Sim-08 · team mode suited
Card line: You choose in twenty minutes. You find out a year and a half later.
Status: draft for review. Rep answers in rapid-08-later-answers.md. Report texts come next.

---

## Setting (designer notes)

Brookfield Veterinary runs four clinics across one metro area: Main Street (the
busiest), Northgate, Elm Park and Riverside. Each clinic runs its own copy of a desktop
scheduler that was installed years ago and whose vendor ends support next spring. The
clinics can't see each other's calendars, so moving a patient between sites means a
phone call.

The person at the counter is Rosa Pruitt, front-desk lead at Main Street for fourteen
years. Rosa runs the emergency whiteboard behind the desk, knows which vets will take a
same-day squeeze, and calls the other clinics when Main Street is full. None of that is
written down. It lives in Rosa's head and on the whiteboard, and it works.

Students are the selection committee. The practice board has approved a three-year
ceiling of $240,000.

## Student briefing (shown at start, about 90 seconds to read)

Brookfield Veterinary has four clinics and a scheduling system that's about to lose
support. Each clinic keeps its own calendar, so when Main Street is full the front desk
phones around to find an opening somewhere else. Clients want to book online. The vets
want fewer no-shows. The board wants one system across all four sites, and it's approved
up to $240,000 over three years.

You're the committee choosing that system. Three vendors made the shortlist, and each has
sent a proposal and a representative. You'll see each vendor's prepared demonstration.
After that you can put six questions to the vendors from the menu, and each question goes
to all three. Choose carefully, because you can't ask everything and the clock won't wait.

When time runs out, your team commits to one vendor. Then the practice goes live, and you
find out what happened.

## The three vendors

| | Kestrel Practice Suite | Tailwind Scheduling | Pawtime |
|---|---|---|---|
| Rep | Gavin Hale | Lena Marsh | Neil Becker |
| Rep's manner | Polished, strong on architecture, vague on go-live | Consultative, says "it's configurable" often | Friendly, plain-spoken, undersells |
| Scope | Full practice management; scheduling is one module | Scheduling only, highly configurable | Scheduling only, simple |
| Implementation | Vendor-led, 12 weeks, all four sites cut over at once | Partner-led, 8 weeks, rules configured by the client | Self-serve, 2 weeks |
| Implementation fee | $96,000 | $48,000 | $6,000 |
| Monthly | $3,200 | $1,650 | $540 |
| Three-year quoted total | $211,200 | $107,400 | $25,440 |
| How much staff change | High: new booking flow end to end | Medium | Low: looks like the old screen |
| Hidden adoption risk | Front desk gets a 90-minute video; check-in slows for months | Nobody owns emergencies, walk-ins or squeezes in the new rules | Each clinic is a separate account; no shared calendar |
| What it becomes if missed | Front desk keeps paper sign-in "for now" | Rosa's whiteboard survives beside the system | A shared spreadsheet of openings across sites |

No vendor is best across the board. Kestrel fits best and costs most. Pawtime is cheapest
and easiest to learn and doesn't actually solve the multi-site problem. Tailwind is the
reasonable middle, and its risk is the hardest to see.

## Prepared demonstration (free, shown to every team)

Each vendor books a routine wellness visit for a dog with complete records at the clinic
the rep is logged into, sends a reminder, and shows the day view. All three are flawless.

## Question menu (six of sixteen, each goes to all three vendors)

The menu is shown in this order and unlabelled. The groupings are for us only.

Questions that feel like diligence:

1. What's your platform architecture, and where is our data hosted?
2. What's your uptime commitment, and what happens when you miss it?
3. What's on your product roadmap for the next two years?
4. What security certifications do you hold?
5. Can you give us three reference customers?
6. What does it integrate with: lab results, payments, reminders?
7. What's the full five-year cost, including everything not in the quote?
8. How do you move our existing appointments and client records across?

Questions that predict adoption:

9. Who at our practice has to change how they work, and by how much?
10. What are the first three months like for the person at the front desk?
11. In your system, who handles emergencies, walk-ins and same-day squeezes?
12. What happens to the things our staff do by hand today?
13. Can we talk to a front-desk person at a reference customer, not the manager?

Demonstration requests (ask the rep to show something off the prepared path):

14. Show us a booking for a client with no phone number on file.
15. Show us booking a patient into a different clinic from the one you're logged into.
16. Show us what the screen does when someone enters it wrong.

## What surfaces each hidden risk (instructor-only)

See rapid-08-later-answers.md for the full route table and the found-the-risk rule
(one direct route, or two partial routes).

## After commitment: go-live plan and outcome grid

Once a team commits to a vendor it picks one go-live preparation from four (A extra
front-desk cover, B exceptions owner, C multi-site tier, D run the old system in
parallel). The list is hidden until commitment so it can't hint at questions.

| Found the risk? | Right preparation? | Eighteen-month outcome |
|---|---|---|
| Yes | Yes | Adopted |
| No | Yes (lucky) | Half-adopted: the fix was funded, aimed at the wrong thing |
| Yes | No | Half-adopted: the team knew and didn't act |
| No | No | Shadow system runs the practice |

## Timing

Briefing 2 min · prepared demos 3 min · question window 9 min · commit vendor 2 min ·
go-live plan 1 min · eighteen-month report 3 min. About 20 minutes of play.
