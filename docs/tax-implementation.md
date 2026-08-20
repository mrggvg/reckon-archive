# Tax module — what shipped, and where it departs from the spec

Implementation notes for `tax-and-earnings-spec.md`. Read this before trusting
a figure, and before changing a rate.

---

## 1. The two things the spec said to verify first

**The contribution formula was derived from the filings, not assumed.** Both
real PODO-OPSVZ filings are reproduced to the cent, and the derivation settled
three details the spec left open:

- **Each component is rounded on its own, then summed.** Rounding a group total
  once gives 2,77 for June's STV where the filing says 2,76. The engine rounds
  15,50 % and 8,85 % separately, and so on for every group.
- **The relief applies to PIZ only**, and it halves the *rate* before rounding
  — `base × 0.0775` rather than `round(base × 0.155) / 2`. The two differ by a
  cent, and the filing agrees with the first.
- **The residue is the obvezni zdravstveni prispevek.** June and July differ in
  base but leave exactly 39,36 unexplained in ZZ+DO. That is the flat monthly
  health contribution, not prorated for a partial month. Confirmed
  independently: it is 39,36 from 1 March 2026 until 29 February 2027, and it
  is readjusted every **1 March**, not 1 January — so it is configured with
  effective dates rather than by tax year.

**The relief schedule is confirmed, not inferred.** 50 % for the first twelve
months after a first-ever registration and 30 % for the next twelve, on both
the insured and employer PIZ shares. The spec asked for this to be checked
before shipping; it holds.

**The bracket question resolved.** The spec said 35 % applies above 120.000 of
revenue; other sources say the progressive rates apply above 60.000. Both are
the same rule: above 60.000 nothing is recognised as expense, so the base runs
level with revenue, and the base reaches 72.000 exactly when revenue reaches
120.000 — which is where 35 % starts. The engine bands revenue directly
(4 % / 20 % / 35 %) because that is the same arithmetic said once instead of
twice, and it makes the marginal rate a lookup rather than a derivation. The
published worked example for a popoldanski s.p. (60.000 → 10.100) is a test.

## 2. Deviations from the spec, and why

| Spec | Shipped | Why |
| --- | --- | --- |
| `NUMERIC(10,2)`, decimal strings on the wire | Integer cents in Postgres, euros as numbers in DTOs | The rest of this codebase has always stored money as cents. One convention, applied everywhere, beats two. Cents is still "never floats". |
| `packages/shared/domain/tax.ts` | `packages/shared/src/tax.ts` | The package has no `domain/` directory; this is where its other pure logic lives. |
| Server-rendered QR endpoints (`/qr/:group`) | Codes rendered in the browser from the same payload builder the invoice uses | The QR code was already client-side for invoices. A second implementation on the server would be a second thing to keep correct, for no gain — the payload is the part that matters and it is shared. |
| Separate Earnings tab | A segment inside Davki | Two questions, one place to look: *Obveznosti* and *Zaslužek na uro*. A fifth tab for one screen is not simpler. |
| `contribution_period.is_estimated` and `source` | `source` alone | They encoded the same fact twice. A row exists only when it was filed; everything else is computed on read. |

## 2. What this module is, after the second pass

Not a calculator that tells you what you owe — eDavki does that, for free, and
with more authority than any estimate here can have. This is a **proposal and a
ledger**:

- **Prispevki** are *suggested* from the month it ends, weeks before FURS
  states them, so a month can be paid the day money arrives. What you actually
  paid is recorded against the month, and when the two disagree the app says so
  and asks for the filing — because the difference means its inputs are stale.
- **Dohodnina** is a *pacing suggestion*: what to send now to be square with
  the revenue that has actually landed. It bands correctly past 60.000, so the
  suggestion changes shape by itself if the year turns out bigger.
- Neither figure is presented as authoritative. The filing wins, always, and
  entering one corrects the insurance base every later estimate is built on.

That inversion is what makes the estimates survivable: the base changes each
March and is recalculated from the previous year's profit, and the app cannot
know either — but it can notice that reality disagreed with it, and ask.

## 2a. Known gaps — read this before trusting a figure

| Gap | Effect | Status |
| --- | --- | --- |
| **Popoldanski s.p. contributions** | They pay a flat pavšal (≈113 €/month in 2026: PIZ 49,15 + ZZ 54,53 + DO 6,43), not a share of the insurance base. The full-time engine would have said ~651 €. | **Guarded.** No estimate is produced for `normiranecKind: 'part'`; the tab says so and asks for the filing. Not modelled. |
| **Health contribution before March 2026** | The config's earliest entry is 39,36 from 1 March 2026. A month before that falls back to the same figure, which is too high — it was revised upward on that date. | Only affects a business that was already trading in Jan–Feb 2026. Correct it on the filing. |
| **Years after 2026** | `TAX_YEARS` holds 2026 only; a later year silently uses those rates. | The tab states which year's figures were applied whenever they differ. A 2027 update is one edit to that table. |
| **The insurance base changes on 1 March, not 1 January** | 1.521,62 € is the *minimum* base and holds from 1 March 2026 to 28 February 2027 — 60 % of the 2025 average wage. The profile stores one base and applies it to every month of a year, so the two months either side of a March revision are computed with the wrong one. | **Self-correcting.** A month paid at a different figure raises a mismatch, and recording that month's filing resets the base for every later estimate. Making the base a dated list would fix it in advance rather than after one month. |
| **The base stops being the minimum in year two** | From the second year the base is recalculated from the previous year's profit. Earn more than the minimum implies and the real base — and every contribution — rises above what the app estimates. | **Self-correcting**, the same way: the first month paid at the new figure is flagged, and the filing corrects the base. |
| **Losing normiranec status** | Exceeding the revenue ceiling (120.000 for a full s.p., judged on a two-year average) ends eligibility, and the tax model changes entirely. The engine keeps applying normiranec bands. | Not modelled. The 120.000 threshold is drawn on the chart, but as a rate boundary rather than an eligibility warning. |
| **Closing an s.p.** | There is no closure date, so contributions keep being estimated forever once a start date exists. | Not modelled. |
| **Month boundary** | The "which month is owed" calculation uses the server's clock, so for an hour after midnight on the 1st a server in UTC and a user in Ljubljana can disagree. | Cosmetic, self-corrects. |
| **Effective-rate window contributions** | Apportioned by calendar days across partial months, which is an approximation — contributions are monthly, not daily. | By design; longer windows are the meaningful ones. |
| **`dueThisYear`** | Sums every month of the year, including ones not yet due. | It is an annual total, shown beside "paid this year". |

## 3. Facts still needing confirmation before the codes are trusted

- **The QR recipient name is `FURS`.** The spec asks for the official
  designation from a real payment order; that could not be verified here. The
  IBAN, reference and amount are the fields FURS matches on, and all three are
  taken from the user's own filing.
- **The purpose code is `TAXS`** and the recipient name is `FURS`; neither has been
  checked against a real payment order.
- **No generated code has been scan-tested** against a Slovenian banking app.
  Until one has been, the printed IBAN/reference/amount beside every code are
  the authoritative version — which is why they are always shown, not hidden
  behind the code.

## 4. Where the numbers come from

Everything year-dependent is in `TAX_YEARS` in `packages/shared/src/tax.ts`:
the insurance base, the four rate groups, the health contribution with its
effective dates, the relief tiers, and the revenue bands for both kinds of
normiranec. A 2027 update is an edit to that table.

Two values are the user's rather than the app's, because FURS revises them and
a filing is the authority: the **insurance base** and, when it disagrees with
the computed tier, the **relief override**. Both are in the profile.

## 5. What the module does not do

Unchanged from the spec's own boundaries: no VAT, no fiscal verification, no
actual-cost accounting, no expenses, no income beyond the s.p., and nothing is
submitted anywhere. Every figure is an estimate for planning, and the tab says
so in a notice that cannot be dismissed.
