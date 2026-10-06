# Flexee RapidSims — who goes where

Three deployments. One platform where everyone signs in, and one per simulation which nobody types by hand.

| | |
|---|---|
| Platform | https://rapidsims.flexee.org |
| RapidSim 01 | https://flexee-rapid-sim-01-vercel.vercel.app |
| RapidSim 02 | https://flexee-rapid-sim-02.vercel.app |

The simulation addresses matter only for standalone use and for running a live class. Students never see them.

---

## Administrator

Everything at **https://rapidsims.flexee.org/admin.html**

Sign in at the platform root and you land there. Three tabs.

**Faculty** lists every facilitator with their course and student counts. Invite someone and you get a one-time link to send yourself — there is no email service. Open a person to see their courses, the students inside them, who has paid and who has played, and to disable, reset or delete the account.

**All courses** is every course across every facilitator in one table, with enrolment, access and launch counts.

**Catalogue** is where simulations are registered. Each carries a number, an id, a title, a launch address and a published flag. An unpublished one is invisible to everyone except administrators — unless you name someone under "Who can see it before it's published", which is how a simulation gets reviewed before it ships.

Also here: bringing the database up to date after a release, and wiping test data.

Other pages you may need: **/migrate.html** if the console itself will not load after a schema change, and **/account.html** for your own details.

---

## Facilitator

Everything at **https://rapidsims.flexee.org/faculty.html**

They sign in at the platform root with the account you invited, and land here.

**Your simulations** — every simulation they are using across all their courses, with how many students have started and finished each.

**Your courses** — each with its join code, enrolment count and how many have access.

**Available simulations** — the catalogue as they see it. Published ones, plus any draft an administrator has granted them. Each offers a seven-day preview so they can play it before committing a class.

Opening a course gives them the enrolment link to send students, the simulations in that course with started and finished counts, and the roster. The roster is where access is granted — individually or a whole section at once, with a note for reconciling against a purchase order. Also "See who has played", listing every student with their status, how long they took and what the simulation reported back.

**Both simulations appear in the same place.** Nothing about the interface changes when there are two rather than one; each gets its own card in the course with its own actions.

Separately, each simulation has its own live session console for running a class in the moment:

https://flexee-rapid-sim-01-vercel.vercel.app/faculty.html?code=ACCESS_CODE
https://flexee-rapid-sim-02.vercel.app/faculty.html?code=ACCESS_CODE

That is a different thing from the platform faculty page. It creates a five-character session code, puts people into groups, holds a shared clock the instructor can freeze, and shows every group's positions side by side. It knows only about its own simulation, so there is one per simulation.

---

## Student

Everything at **https://rapidsims.flexee.org**

They never type a simulation address.

They arrive on the enrolment link their instructor sent — **/join.html?c=CODE** — which names the course and the instructor, and signs them up in one step. After that they land on **/student.html**, which lists their courses and the simulations in each.

Until the instructor releases them, each simulation shows a greyed button and a line saying they are enrolled and waiting. That page refreshes itself every twelve seconds, so it changes on its own when access is granted rather than needing a reload.

Pressing **Start** launches them into whichever simulation. No access code, no second password — the platform signs a short-lived token and the simulation trusts it. Faculty pressing the same button land in that simulation's session console instead, because the token says who they are.

At the end they can download a transcript. Nothing they said is stored anywhere; the platform learns only that they finished, how long it took, and a short summary the simulation chose to report.

---

## The order things happen in

1. Administrator registers a simulation in the catalogue, unpublished.
2. Administrator grants a facilitator review access to it.
3. Facilitator previews it, decides, and adds it to a course.
4. Facilitator sends the enrolment link.
5. Students enrol and wait.
6. Facilitator gives them access once registration is settled.
7. Students play. The simulation reports each completion back.
8. Facilitator sees who has played; administrator sees it across everyone.
9. Administrator publishes the simulation when it is ready for everyone.

---

## Checked end to end

Every step above has been exercised as one chain against the real handler code: registration, invitation, review access made visible only to the person named, both simulations in a single course, enrolment, a student correctly held before release, a launch token each simulation verified, and both completions returning and being stored — with a completion lacking a matching launch refused.

What that does not cover is a browser. Layout, timing and anything visual still need a person clicking, which is what the tester's manual is for.
