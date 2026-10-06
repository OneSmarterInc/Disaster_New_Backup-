# Sim-07 — Would You Have Bought It?  Build spec v0.2 (for review)

Status: design complete, figures verified against primary filings where possible, no code yet.
Proposed id `rapid-07-bought`, route `/sim07`, repo folder `sim07/`. Build pattern: copy Midland (`rapid-03-midland`) and Would You Approve This? (`rapid-05-approve`).

## 1. Card copy

- Title: Would You Have Bought It?
- Card line: The year 2000, and you can only see what they could see.
- Teaches: what was knowable at the time · how hindsight rewrites a judgement

## 2. The rule that does the teaching

The information set is frozen at September 2000. Nothing before the reveal points forward. The companies are never named before Stage 3.

## 3. Decisions log

| # | Decision | Choice |
|---|---|---|
| 1 | Naming | Unnamed, real figures, named at Stage 3 only |
| 2 | Price | Fixed $50M, binary buy / decline |
| 3 | 2005 sequel | Included inside the five-year stage |
| 4 | Advisers | Four: finance (decline), stores (decline), online (buy), studio relations (wait) |
| 5 | Late fees | Plain line in the revenue breakdown, no commentary; no broadband figures |
| 6 | Timeout | Counts as decline; student still writes one line on why they hadn't decided |
| 7 | Reveal pacing | Instructor releases stages; auto-advance fallback if no console connected |
| 8 | Side-by-side | Instructor picks two from a private presenter view; "suggest a pair" fallback |
| 9 | Team mode | Private votes, majority decides, tie = decline; every member writes own justification |
| 10 | Card copy | As section 1 |
| 11 | Late-fee lawsuits | Included among routine legal notes, not spotlighted |

## 4. Briefing content (student sees, pre-reveal)

All figures are ones the buyer's CEO could have known in September 2000. Sources in section 11.

### Your company
- The country's largest video rental chain. Roughly 7,000+ stores worldwide.
- Revenue 1999: $4.46B, up about 15% on 1998. Tracking toward about $5B for 2000.
- Operating income 1999: about $122M. Net result 1999: a loss of about $69M, after goodwill charges from a past acquisition.
- Long-term debt: about $1.1B.
- Revenue breakdown line: extended-viewing ("late") fees, about 16% of revenue. No commentary.
- DVD is still small: under 10% of rental revenue.
- Public since August 1999; majority owned by a media parent.

### The offer
- A four-year-old California company that rents DVDs by mail on a flat monthly fee, no due dates, no late fees.
- Price: $50M, fixed. The founders propose that their team runs your online business as part of the deal.

### The seller
- Revenue 1999: $5.0M. Net loss 1999: $29.8M. Accumulated deficit: $41.3M.
- Paying subscribers: about 120,000 at March 2000, growing fast (confirm a late-summer figure, see 11).
- Most new customers come through free-trial coupons packed in DVD player boxes.
- One distribution centre. Relies on the postal service both ways.
- Filed to go public in April 2000; withdrew the offering in July 2000 as tech stocks fell.

### The market
- DVD players in about 5.4 million US homes at the end of 1999. Industry forecast: about 39 million by 2004.
- Tech stocks have fallen sharply since March. Many internet start-ups are closing or looking for buyers.
- The mood: the internet hype was overblown. That view is correct.

### Routine legal notes (fine print; decided: include, unspotlighted)
- Revenue-sharing antitrust suit brought by independent stores.
- Store-manager overtime class action (California).
- Customer class actions over extended-viewing fee policies.

### Line on the setting screen
"Some of you may think you recognise this situation. Decide on the evidence in front of you, not on anything you think you remember."

## 5. Advisers (draft voice; shuffled order per student)

Fictional names. No real executive names anywhere.

- Marcus Hale, CFO — decline. "They lost $30 million on $5 million of revenue last year, and they pulled their IPO in July because nobody would buy it. Fifty million is ten times last year's sales for a company that pays to acquire every customer with a free trial. We have $1.1 billion of debt and a net loss of our own. I'd need a reason to spend this, and I don't see one."
- Dana Whitlock, EVP Store Operations — decline. "People decide what to watch at six o'clock on a Friday. They want the new release tonight, not in three days. Our stores are where the habit lives, and we're within a short drive of most of the country. A mail service is a niche for people who plan ahead."
- Priya Anand, VP Online & New Ventures — buy. "Our website is weak and we don't know how to run a subscription business. Fifty million is about 1% of our revenue. If this goes nowhere, we've lost a rounding error. If it works, we own it instead of competing with it. I'm not predicting anything. I'm saying the option is cheap."
- Tom Keller, EVP Studio Relations & Distribution — wait. "Our economics rest on revenue-sharing deals built for stores. Their model buys discs wholesale and ships from one warehouse. Integration would be messy. Watch them for a year. If it works, buy it then."

Guard: no adviser line may mention streaming, broadband, the future of DVD beyond the published forecast, or the seller's later growth.

## 6. Student flow (decision clock: 10 min, configurable)

1. Setting (about 1 min). Role, date, the recognition line above.
2. Briefing sheet (about 3 min).
3. Advisers (about 4 min). Four cards, any order, order shuffled per student.
4. Decision (about 2 min). Buy / Decline. Justification required (minimum one full sentence; enforce a word floor in config). Confirm step: "This decision is binding."
5. Timeout. Recorded as decline with `lapsed: true`. Student gets one prompt: "The offer lapsed. In one sentence, why hadn't you decided?"
6. Recognition question. "Did you recognise these companies?" Yes / No / Not sure. Required before the reveal.
7. Hold screen until the instructor releases Stage 1.

The student view never shows another student's choice, a count, or a score.

## 7. Reveal (student view)

The student's own justification is pinned at the top of every stage, word for word, with their choice.

- Stage 1 — 2002. The seller goes public in May 2002 with about 600,000 subscribers; revenue that year about $150M. Your company is still growing. The decision still looks fine.
- Stage 2 — 2005. The seller passes 4 million subscribers. Your company launched its own mail service in 2004 and dropped late fees in January 2005, at an estimated cost of about $400M between lost fees and the new service, with nothing rebuilt underneath the stores.
- Stage 3 — 2010. Your company files for bankruptcy in September 2010. The seller has about 20 million subscribers and has moved on to streaming. Names appear here, and only here: "Your company was Blockbuster. The seller was Netflix."
- Close. No verdict, no score. Their justification, then "Your instructor will take it from here."

## 8. Instructor console

Two views from one session: a presenter view (laptop, private) and a projector view (display URL, public). Nothing shown on the projector carries a student name.

| Phase | Projector | Presenter adds |
|---|---|---|
| Lobby | Session code, joined count | Mode, settings |
| Deciding | Clock, decided vs still deciding (split hidden) | Same |
| After clock | Split: bought / declined (lapsed shown within declined); recognition × choice table | Full anonymous justification list; pick two to pin |
| Side-by-side | Two pinned justifications, one bought, one declined, large type | "Suggest a pair" (longest contrasting) |
| Reveal | Current stage title; release buttons are presenter-only | Release Stage 1 / 2 / 3 |
| Debrief | Optional spine prompts | Show / hide prompts |

Fallback: if no console heartbeat, stages auto-advance at 90 seconds each.

Debrief spine prompts (optional on projector): disagreement first (ask who bought and what they saw, then a decliner responds, before Stage 1); naming second (hindsight bias; bad decision vs bad outcome; right about the market, wrong about the company); the turn last (a decision you made on incomplete information, and what would have to be true for it to look foolish later).

## 9. Session creation

- Mode is required, no default: Individual or Team. Help text: "Individual works best for this sim; each student owns a judgement."
- Team mode: private votes, majority decides, tie counts as decline. Every member writes and sees their own justification. Projector shows team outcomes plus individual vote counts.
- Settings in config: decision clock length, word floor, auto-advance interval.
- Nothing in the materials names a course, semester, weekday or institution.

## 10. Build notes

- Content lives in `sim07/data/config.js` (briefing, advisers, stages, copy, thresholds). No content in code.
- Node.js, no external dependencies; Upstash Redis sessions (30-day TTL); signed launch tokens and registration / completion callbacks as in Sim 02.
- `SIM_URL` set explicitly on the Vercel project. Confirm `deploymentEnabled: false` is absent from `vercel.json`.
- Build gate (refuses to ship):
  - placeholder content anywhere in config;
  - any of these strings in pre-reveal content (setting, briefing, advisers, decision, recognition, hold screens): Blockbuster, Netflix, Hastings, Randolph, Antioco, Viacom, Los Gatos, Dallas, McKinney, streaming, broadband, video-on-demand. Stage 3 is the only allowed location for the company names;
  - retired id reuse (`rapid-03-bench`);
  - the guard's string list must be tested against the actual render path for each pre-reveal screen, not a copy of the text.
- Tests: timeout path, team tie, recognition required before reveal, projector payload contains no names or ids, auto-advance fallback, pinned justification identical across stages.

## 11. Figures and sources

Verified from primary filings:
- Buyer revenue 1999 $4,463.5M, 2000 $4,960.1M; operating income 1999 $121.7M; net loss 1999 $69.2M; long-term debt 1999 $1,138.4M; IPO August 1999 (Blockbuster 10-K FY2001).
- Buyer DVD share of rental revenue 6.9% in 2000 (same).
- Customer class actions over extended-viewing policies filed from February 1999 (same, Legal Proceedings).
- Seller revenue 1999 $5.0M; net loss $29.8M; accumulated deficit $41.3M; over 120,000 paying subscribers at 31 March 2000; DVD households 5.4M end 1999, forecast 39.4M by 2004; one distribution centre in San Jose (Netflix S-1, April 2000).
- Seller's end-2004 subscribers 2.6M; Q1 2005 3.02M (Netflix earnings releases).

Secondary sources, to confirm before build:
- Late fees about $800M, 16% of 2000 revenue (widely reported; Blockbuster's own 2005 investor deck put extended-viewing fees at about 13% of rental revenue in Q3 2004).
- IPO withdrawn July 2000; public May 2002 with about 600,000 subscribers; 2002 revenue about $152M.
- Late-fee removal and online launch costs: about $200M + $200M (reported estimates).
- End-2005 subscribers (about 4.2M) and end-2010 subscribers (about 20M): pull from Netflix 10-Ks.
- Seller subscriber count at September 2000.

## 12. Open questions

1. (Resolved: late-fee class actions included among routine legal notes.)
2. Handover said the buyer was "profitable." It had an operating profit and a net loss. Proposed: state both, as in section 4.
3. The chapter's "$600 million a year" for the 2005 change doesn't match the reported $400M estimate. Worth checking in the book as well as here.
