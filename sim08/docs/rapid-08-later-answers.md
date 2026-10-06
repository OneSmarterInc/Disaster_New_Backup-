# Eighteen Months Later — rep answers and go-live plan

Id `rapid-08-later` · draft for review · pairs with rapid-08-later-scenario.md

Every question goes to all three reps. Answers are shown side by side in the order
Kestrel (Gavin Hale), Tailwind (Lena Marsh), Pawtime (Neil Becker). Tags in square
brackets are instructor-only and never reach the student view.

---

## Questions that feel like diligence

**1. What's your platform architecture, and where is our data hosted?**

Kestrel: "Cloud-native and multi-tenant, hosted in two US regions with automatic failover. Your data never leaves the country."
Tailwind: "Fully cloud, on a major US provider, with nightly backups and point-in-time restore."
Pawtime: "It's all in the cloud, US data centres, backed up every night. You won't need a server in the closet."

**2. What's your uptime commitment, and what happens when you miss it?**

Kestrel: "99.95 per cent, written into the contract, with service credits if we miss it. We haven't missed it in three years."
Tailwind: "99.9 per cent contractual. If we fall short, the credit comes off your next invoice."
Pawtime: "99.9. If we miss it you get a credit. Honestly, we've never had to pay one out."

**3. What's on your product roadmap for the next two years?**

Kestrel: "AI-assisted triage notes, a client mobile app, and deeper lab integration over the next eighteen months."
Tailwind: "Better no-show prediction, and a rules library so new customers can start from templates."
Pawtime: "Online payment at booking and a nicer reminder editor. We keep it small on purpose."

**4. What security certifications do you hold?**

Kestrel: "SOC 2 Type II, annual penetration testing, encryption at rest and in transit, role-based access throughout."
Tailwind: "SOC 2 Type II and encryption end to end. I can send the report under NDA."
Pawtime: "SOC 2 Type II as of last year, encryption everywhere. Happy to send the report over."

**5. Can you give us three reference customers?**

Kestrel: "Absolutely. Three large groups, including a twelve-clinic practice in the Southeast. Their practice managers love it."
Tailwind: "Yes, three practices about your size. I'll put you in touch with the owners."
Pawtime: "Sure. Three practices that have been with us for years. They're all single-clinic, but they'll tell you how easy it is." [Pawtime partial]

**6. What does it integrate with: lab results, payments, reminders?**

Kestrel: "All of those, plus imaging and pharmacy. Over forty integrations out of the box."
Tailwind: "Labs, payments and reminders natively. Anything else through our open API."
Pawtime: "Payments and reminders are built in. Labs through a partner connector."

**7. What's the full five-year cost, including everything not in the quote?**

Kestrel: "Licence and implementation as quoted. Most practices your size also budget for extra front-desk cover in the first quarter, somewhere around $25,000 to $30,000." [Kestrel partial]
Tailwind: "The quote, plus a small partner fee if you want rule changes after go-live. Call it $3,000 a year."
Pawtime: "What's on the quote is what you pay. No surprises."

**8. How do you move our existing appointments and client records across?**

Kestrel: "Our migration team moves everything. You validate a sample before cutover."
Tailwind: "Our implementation partner handles it and runs a test load first."
Pawtime: "You export a spreadsheet from your current system and we import it. Most practices are done in an afternoon."

## Questions that predict adoption

**9. Who at our practice has to change how they work, and by how much?**

Kestrel: "Everyone at the front desk moves to a new booking flow, and the vets get a new day view. It's a real change. It's also a better way of working."
Tailwind: "Less than you'd think. Routine booking looks the way it does today, and the rules handle the rest once they're set up."
Pawtime: "Hardly anyone changes anything. It looks and works a lot like what you've got now." [Pawtime partial]

**10. What are the first three months like for the person at the front desk?**

Kestrel: "Candidly, check-in runs slower for two or three months. Super users get two days of training. The front desk gets a ninety-minute video. Practices that fund extra cover through that stretch come out fine." [Kestrel direct]
Tailwind: "They'll book routine visits from day one. It's the same screen they'd expect."
Pawtime: "Pretty painless. Most front desks are comfortable inside a week."

**11. In your system, who handles emergencies, walk-ins and same-day squeezes?**

Kestrel: "There's an emergency flag and an override queue. Your practice manager decides who works it."
Tailwind: "That's all configurable. You define how emergencies, walk-ins and squeezes are handled, and the system enforces it. The practices that name someone to own that before go-live do well. The ones that don't tend to feel it." [Tailwind direct]
Pawtime: "The front desk books them into whatever slot is open, same as now."

**12. What happens to the things our staff do by hand today?**

Kestrel: "The whiteboard and the phone calls go away. Everything sits in one calendar across all four clinics."
Tailwind: "Anything that follows a rule, the system takes over. Anything that's a judgement call, somebody still has to make, and that person has to be written into the rules." [Tailwind direct]
Pawtime: "Each clinic has its own calendar, so the calling around would stay as it is. A few customers keep a shared sheet of openings between sites." [Pawtime direct]

**13. Can we talk to a front-desk person at a reference customer, not the manager?**

Kestrel (Keisha, front desk at a reference group): "The first two months were rough. We ran a paper sign-in sheet beside it until we caught up, and a couple of our sites still do." [Kestrel direct]
Tailwind (Marco, front desk at a reference practice): "Routine booking was easy. Emergencies were a mess until our manager finally sat down and wrote the rules. That took about four months." [Tailwind partial]
Pawtime (Jen, front desk at a reference practice): "Love it. We're one clinic, so it's just us, and it's simple."

## Demonstration requests

**14. Show us a booking for a client with no phone number on file.**

Kestrel: The screen won't save. A red banner asks for a supervisor override code. Gavin enters his admin code and moves on. [Kestrel partial]
Tailwind: The booking saves with an amber "follow up" flag.
Pawtime: The booking saves. A small note says reminders won't be sent.

**15. Show us booking a patient into a different clinic from the one you're logged into.**

Kestrel: Gavin picks Northgate from a dropdown and books. Done in seconds.
Tailwind: Lena switches location in the header and books. Done in seconds.
Pawtime: Neil logs out, logs back in to the Northgate account, and books. "Each clinic's its own account. On our Group plan you get a shared view across clinics. That's $290 more a month." [Pawtime direct]

**16. Show us what the screen does when someone enters it wrong.**

Kestrel: A validation message with an error code. The clerk has to fix it before moving on.
Tailwind: It saves and drops into a review queue "for a supervisor". Asked which supervisor: "Whoever you configure." [Tailwind partial]
Pawtime: An undo button. Simple.

---

## Route summary (instructor-only)

| Risk | Direct | Partial |
|---|---|---|
| Kestrel: front-desk training gap | 10, 13 | 7, 14 |
| Tailwind: nobody owns exceptions | 11, 12 | 13, 16 |
| Pawtime: no shared calendar | 12, 15 | 5, 9 |

A team counts as having found its vendor's risk with one direct route, or two partial
routes. One partial alone isn't enough.

## Go-live plan (shown only after the team commits to a vendor, pick one)

A. Fund extra front-desk cover for the first three months (about $28,000). Matches Kestrel.
B. Name an owner for emergencies, walk-ins and squeezes, and have them write the rules
before go-live. No cost. Matches Tailwind.
C. Buy the vendor's multi-site tier before go-live. Matches Pawtime ($290 a month more).
Neutral for Kestrel and Tailwind, which already include it.
D. Run the old scheduler in parallel for three months, just in case. Matches nothing.
It feels like the safe choice, and it's where the shadow system starts.

Budget effect: Kestrel plus A comes to about $239,000 against a $240,000 ceiling, so
the right preparation for the best-fit vendor uses nearly all the money. Pawtime plus C
comes to about $35,900.
