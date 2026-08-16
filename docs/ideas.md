# What Reckon could do next

Brainstorm, August 2026. Market scan of the Slovenian field plus candidate
functional requirements, each with what it's worth and what it costs.

Nothing here is committed. The ordering at the end is an opinion.

---

## 1. What the neighbours do

| Product | Shape | Price | Where it starts |
| --- | --- | --- | --- |
| **Minimax** | Full cloud accounting: double-entry, VAT, payroll, stock, invoicing | packaged subscription (Invoices tier ≈ 300 invoices/month) | An accountant's tool a freelancer is allowed to use |
| **Račun123** | Fast invoicing, mobile-first, webshop and POS links | from €9.90/month | The invoice |
| **Moj Račun** | Invoicing with a free tier, tax calculators | free tier + paid | The invoice |
| **e-računi.com** | Long-established, broad ERP-ish | paid | The invoice |
| **Čebelca BIZ** | Small-business invoicing | paid | The invoice |

Two things worth taking from that table.

**Everyone starts at the invoice.** They all assume an amount already exists and
treat where it came from as the user's problem — which is exactly the gap
Reckon was built into, and the reason to be careful about drifting toward being
a fifth invoicing app. Webshop links, POS, stock: off-strategy, whatever the
competitors do.

**Invoicing alone is a commodity at €0–10/month.** Reckon's justification is the
line from a logged hour through to the money and the tax on it. Every idea below
should be judged on whether it strengthens that line.

---

## 2. The regulatory clock

These are not features. These are dates.

### FR9 — e-invoices in eSlog XML ★ dated

**B2G, already binding.** Since 1 January 2015, budget users (*proračunski
uporabniki* — schools, municipalities, public institutes) may only receive
invoices electronically, in eSlog XML, routed through UJP: a bank's e-invoice
channel, the UJP portal, or a contracted provider. Direct e-mail to the
institution is not permitted. **A PDF from Reckon cannot legally be sent to a
municipal pool or a school today.** For an s.p. doing rescue and lifeguard work,
that is not a hypothetical client.

**B2B, from 1 January 2028.** ZIERDED, adopted 23 October 2025, makes e-invoice
exchange mandatory between all entities in the business register, including
individuals carrying on an activity. Invoices must be structured XML — eSlog 2.0
or another recognised standard. *A PDF is explicitly not an e-invoice.* Consumers
and cross-border stay optional.

**What this actually requires**, in order of increasing ambition:

1. **eSlog 2.0 XML export.** A download beside *Natisni*; the user uploads it in
   their bank's e-račun screen or the UJP portal. Unblocks public-sector clients
   immediately and satisfies 2028 in the minimum way. The invoice model already
   holds everything the schema wants — issuer, buyer, dates, period, line, total,
   the VAT-exemption clause — so this is a serialiser and a validator, not a
   redesign. **Highest value per unit of work in this whole document.**
2. **A recipient's e-invoice address** on the client record (proračunski
   uporabnik ID / IBAN-based routing), so the XML is addressed correctly.
3. **Direct delivery** via a bank or provider channel. Contracts and credentials;
   a 2027 problem, not a 2026 one.

### FR10 — VAT threshold watch ★★★ cheap

Mandatory VAT registration once taxable turnover passes **€60,000 in any rolling
twelve months** (raised from €50,000 on 1 January 2025). Reckon knows every
invoice and its date; the app can therefore answer *"how close am I?"* better
than the user can, and crossing it unknowingly is expensive.

A line on the invoices screen: `Promet zadnjih 12 mesecev: 38.200,00 € / 60.000 €`
turning amber at 80%. One query over data already loaded.

### FR11 — normiranec parameters, as data ★★ (tax phase)

The regime changed **on 1 January 2026** (ZPZR): the cap for a full normiranec is
**€120,000** (€50,000 for *popoldanski*), and normirani odhodki became two-tier —
**80% up to €60,000 of revenue, 0% above it**, with the excess taxed on the
progressive scale (20%/35%) instead of a flat 20%. Entry and exit are judged on
the **average of two consecutive years**.

This vindicates the earlier decision not to hard-code any of it: the numbers
moved within a year of being written down. Whenever the tax layer returns, these
belong in an editable, dated table — a rate with a validity period, not a
constant.

### FR12 — cash and card would change everything

Fiscal verification (*davčno potrjevanje računov*) binds invoices settled in cash
or by card. Reckon is scoped to bank transfer and therefore exempt. Worth a
**guard rather than a feature**: if a payment method other than transfer is ever
recorded, say plainly that fiscal verification applies and this app does not do
it.

---

## 3. Cheap wins that remove typing

### FR13 — look a client up by davčna številka ★★★

AJPES publishes the Poslovni register with a REST service (`restPrsInfo`,
free registration) that resolves a tax or registration number to the official
name, address and status. Type `29825962`, get *Vikram d.o.o., Vojkovo nabrežje
31a, 6000 Koper* — the eight fields of the client form collapse into one, and the
name on the invoice becomes the registered one rather than the one the user
remembered. The check-digit validation already in `packages/shared` is the
perfect front door for it. **VIES** does the same for EU VAT numbers if a foreign
client ever appears.

### FR14 — recurring invoices ★★

A retainer client billed the same amount monthly is one of the few things every
competitor has and Reckon doesn't. Sits naturally on the existing model: a
schedule that pre-fills `NewInvoiceSheet` on the day, rather than an automaton
that issues documents unattended. **Never issue an invoice without a human
pressing something** — the numbering is sequential and legally meaningful.

### FR15 — several lines on one invoice ★★

`invoice_line` is already in the logical design; the interface renders one
consolidated line. Wanted the first time a fixed fee, a travel cost, or two
different rates appear on one document. No schema change — the relation was
kept for exactly this.

### FR16 — credit note (dobropis) instead of editing ★★★

The gap flagged in the alpha review. Correcting a sent invoice by editing it
leaves no trace; the correct instrument is a credit note referencing the
original, and an audit trail of what changed. This is the difference between a
tool a bookkeeper trusts and one they don't.

---

## 4. Money coming in

### FR17 — match payments from a bank statement ★★★

Import **CAMT.053 XML** (or the bank's CSV) and match credits to open invoices by
reference — the UPN QR already writes the reference, so the match is exact rather
than fuzzy. Marking paid drops from one tap per invoice to one import per month,
and the ledger stops depending on the user remembering to check.

This is the single strongest *"nobody in the hours-first niche does this"*
feature on the list.

### FR18 — reminders for overdue invoices ★★

The app already derives *zapadlo*. What it can't do is act: generate an *opomin*
with the statutory default interest (*zamudne obresti*) calculated from the due
date, ready to send. Needs FR-e-mail to be worth much.

### FR19 — e-mail delivery ★★★

Already specified as FR8.3 and still the most conspicuous hole: today it's print
→ PDF → mail client → attach → find the address. One provider integration
(Resend, Postmark, SES) plus `sent_at`, which is already a column in the design.

---

## 5. The whole picture

### FR20 — expenses ★★

A normiranec doesn't need receipts for tax — but *knowing what the year actually
made* requires them, and an s.p. on actual costs needs them absolutely. The
honest framing: this is the boundary between "billing tool" and "business
picture", and crossing it is what makes Reckon worth more than the €9.90
alternatives.

### FR21 — travel log and kilometrina ★★

Potni nalogi and per-kilometre allowance are bread-and-butter for a Slovenian
s.p. who drives to clients. A trip log is close kin to a session log — date,
route, distance — and reuses the same entry patterns.

### FR22 — the obligations calendar ★★★ (tax phase)

The original reason this project exists: contributions due on the 20th, advance
income tax instalments, the annual assessment. A calendar with *"€ X due on
20 September"* and a record of what was actually paid, reconciled at year end —
that's the `tax_payment` / `tax_assessment` pair from the data model.

### FR23 — read-only access for an accountant ★

Every competitor has accountant collaboration. Cheapest useful version: a
year-end export bundle (CSV + all invoice PDFs + eSlog XMLs) rather than a
second account type.

---

## 6. Field conditions

### FR24 — installable, and usable without signal ★★★

Hours are logged at a pool, at a client's site, in a car park. The app is
mobile-first but not installable and not offline-tolerant: a failed request means
a toast and retyping. A PWA with an outbox that queues entries and syncs on
reconnect fits the shape of the data perfectly — a working session is small,
self-contained, and conflict-free.

### FR25 — nudges ★

*"No hours logged since Tuesday."* *"003/2026 is 7 days overdue."* Cheap once
e-mail exists; a background job and two queries.

### FR26 — rate variants ★

A night, weekend or holiday shift often bills differently. Today one rate per
client; a multiplier per shift type would be honest about how the work is
actually sold.

---

## 7. If I had to pick

**Next three, in order:**

1. **FR9.1 — eSlog XML export.** It has a legal deadline, it is already blocking
   public-sector clients, and the data model needs nothing new.
2. **FR13 — AJPES lookup.** Biggest reduction in typing and in wrong data of
   anything here, for a day's work.
3. **FR17 — bank statement matching.** Turns the second-most-frequent chore into
   a monthly import, and no competitor in this niche does it.

**Then:** FR19 e-mail, FR16 credit notes, FR10 VAT watch, FR24 offline.

**Explicitly not:** POS, webshop integrations, stock, payroll, multi-currency,
double-entry bookkeeping. Every one of them is somebody else's product, and
each would dilute the only claim Reckon has that the others can't make — that a
logged hour and a paid invoice are the same fact seen twice.

---

## Sources

- [ZIERDED / mandatory B2B e-invoicing from 2028 — Epos](https://www.epos.si/novice/dr%C5%BEavni-zbor-sprejel-zakon-zierded-e-ra%C4%8Duni-med-podjetji-obvezni-od-1-januarja-2028)
- [Mandatory B2B e-invoice exchange — Mladipodjetnik.si](https://mladipodjetnik.si/novice-in-dogodki/novice/nov-zakon-obvezna-izmenjava-e-racunov-pri-b2b-poslovanju)
- [B2G e-invoices and UJP routing — Račun123](https://www.racun123.si/blog/ujp-portal-e-racuni)
- [eRačuni — AJPES](https://www.ajpes.si/eRacuni)
- [AJPES restPrsInfo REST service for developers](https://www.ajpes.si/Doc/AJPES/Za_razvijalce/restPrsInfo_Opis_servisa_za_razvijalce.pdf)
- [Poslovni register Slovenije — reuse of data](https://www.ajpes.si/Registri/Poslovni_register/Ponovna_uporaba)
- [Normirani s.p. 2026: thresholds and the two-tier expense rule](https://moj-racun.si/blog/normiran-sp-kaj-morate-vedeti)
- [Normiranec and the €60,000 recalculation](https://poslovni.si/novice/normiran-sp-in-polletni-preracun-prihodkov-kaj-pomeni-dosezenih-60000-evrov-za-vas-status-v-letu-2026)
- [Comparison of Slovenian invoicing programs, 2026](https://www.racun123.si/primerjava-programov-za-racune)
- [Minimax pricing and features overview](https://moj-racun.si/blog/minimax-alternativa)
