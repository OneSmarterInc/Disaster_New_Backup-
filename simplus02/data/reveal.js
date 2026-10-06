'use strict';
// Debrief reveal, shown on the projector only after the instructor presses Reveal.
// Historical July 2025 decision, with the later load update explicitly dated.
module.exports = {
  verified: true,
  verifiedOn: '2026-10-01',
  heading: 'What actually happened',
  projectorParagraphs: [
    'Crestline Power is modelled on AEP Ohio. In July 2025, Ohio’s Commission chose between two competing settlements. It adopted the agreement backed by AEP Ohio, Commission staff, consumer advocates and others. The data-centre parties had supported a different agreement: the adopted settlement was not unanimous.',
    'The tariff tied demand charges to minimum billing demand, with a capacity-based minimum capped at 85%. A four-year ramp plus eight years gives a twelve-year contract. Early exit and collateral provisions add commitments of their own. The details matter: 85% is not a percentage of the entire electricity bill.',
    'By February 2026, roughly 30,000 MW of initial interest had led to 5,642 MW of new binding contracts. Those were additional to 12,219 MW contracted earlier. The lesson is how financial commitments change a forecast, and how a regulator chooses a package when the parties cannot all agree.',
  ],
  paragraphs: [
    'Crestline Power is modelled on AEP Ohio. The Commission is the Public Utilities Commission of Ohio.',
    'From March 2023, AEP Ohio paused new data-centre service requests and agreements in central Ohio. The proceeding recorded roughly 600 MW of existing data-centre demand and over 30,000 MW of requests without signed agreements. The July 2025 order directed AEP Ohio to end that moratorium.',
    'There were two competing settlements. On 9 July 2025, the Commission adopted the 23 October 2024 agreement signed by AEP Ohio, Commission staff, the Ohio Consumers’ Counsel, Ohio Energy Group, Walmart and Ohio Partners for Affordable Energy, with a modification to the collateral provisions. It rejected the competing 10 October agreement supported by data-centre interests and others. This was not an agreement signed by every party.',
    'The new tariff applies to new data-centre load above 25 MW and qualifying expansions. Minimum billing demand is the greater of 85% of the highest monthly billing demand in the previous eleven months or a capacity-based minimum. That minimum starts at 15 MW plus 85% of capacity above 25 MW through 75 MW; above 75 MW, it is 57.5 MW plus the additional capacity, capped at 85% of total contract capacity. This determines demand charges, rather than a flat percentage of the entire electricity bill.',
    'A load ramp can last no more than four years, with agreed ramp capacity of at least 50%, 65%, 80% and 90% of final capacity in years one to four. During the ramp, billing demand is at least 85% of that ramp capacity. The initial contract term is the ramp period plus eight years: twelve years for a four-year ramp.',
    'A customer can use the early-exit provision only after five contract years following the ramp, paying thirty-six months of minimum charges after notice of termination. With a three-year ramp, that option becomes available after year eight. Otherwise the initial-term minimum charges remain payable even if service is reduced or stopped.',
    'The customer, including a financial sponsor that co-signs, must meet both the A- S&P and A3 Moody’s credit thresholds and hold audited cash and cash equivalents exceeding ten times the collateral requirement to avoid posting security. Otherwise, security equals 50% of full-term minimum charges, supplied through a qualifying guarantee, a bank letter of credit or cash. Timely payments reduce the requirement by one year’s minimum charges for each energized year.',
    'In its February 2026 update, AEP Ohio reported that the roughly 30,000 MW of expressions of interest led to 13,022.7 MW of paid study requests and 5,642 MW of binding contracts under the new tariff as of 12 February. Those new contracts were additional to 12,219 MW contracted before the tariff, for a total of 17,861 MW. These were projects scheduled to come online through 2035, not electricity already being consumed.',
  ],
  sources: [
    { label: 'PUCO Opinion and Order, 9 July 2025 — case 24-508-EL-ATA', url: 'https://dis.puc.state.oh.us/DocumentRecord.aspx?DocID=badab793-e041-4173-9b6d-436e51f80e5c', locator: 'Paragraphs 42, 45, 46, 121–126 and 158; comparison of the two stipulations on pages 14–22.' },
    { label: 'Filed copy of the PUCO order — Florida PSC, Exhibit D', url: 'https://www.psc.state.fl.us/library/FILINGS/2025/07142-2025/07142-2025.pdf', locator: 'Exhibit D begins on PDF page 74. Used to read the original order when the Ohio docket blocked access.' },
    { label: 'AEP Ohio tariff explanation', url: 'https://www.aepohio.com/company/about/rates/data-center-tariff/', locator: 'Load ramp, contract term, minimum demand, collateral and exit sections.' },
    { label: 'Schedule DCT — AEP Ohio tariff book', url: 'https://www.aepohio.com/lib/docs/ratesandtariffs/Ohio/October_2026_Ohio_Power_Tariff_Book.pdf', locator: 'Sheets 223-1 through 223-7; checked against the provisions adopted in the July 2025 order.' },
    { label: 'AEP Ohio load update, 13 February 2026', url: 'https://www.aepohio.com/company/news/view?releaseID=10753', locator: '5,642 MW of new contracts as of 12 February, additional to 12,219 MW of earlier contracts.' },
  ],
  facilitatorNote: 'The real order is one settlement, not the right one. Ask what each real party gave up, not which table came closest.',
};
