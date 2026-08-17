# Notes on `seminar.md`

Working notes for the seminar report — what I changed from the brief and why, what
still has to be done by hand, and where the document and the repository disagree.
None of this belongs in the submitted document.

## 1. Output format

The brief asked for a .docx produced with the docx skill and converted to PDF; the
final instruction asked for `docs/seminar.md`. The report is therefore written as
Markdown, with the Word-specific requirements preserved as blockquoted conversion
notes at the points where they apply:

- title page layout and page numbering (top of file)
- live table-of-contents field (top of file)
- repeating header row on the non-functional requirements table (§2.2)
- entity-block shading and column widths on the data dictionary (§3.1.2)

To produce the .docx afterwards, the shortest route that keeps the tables intact is
`pandoc docs/seminar.md -o seminar.docx --reference-doc=<template>`, then apply the
four conversion notes by hand, insert the TOC field, and export to PDF from
LibreOffice for a page-break check. The placeholder boxes are drawn as ASCII frames
so they survive that conversion visibly; replace each with a bordered text box or the
actual image.

## 2. Where the document and the repository disagree

The brief's §7 stated that implemented scope covers functional requirement groups 1–8
including e-mail delivery and guided onboarding. The repository does not support that
claim today, so §6.1 of the report gives a per-group status table instead of a blanket
statement. **This is the one substantive departure from the brief** — flagged here so
it can be reverted in one edit if everything lands before submission.

What I checked in the repo on 16 Aug 2026, **before** the persistence work
below landed. Rows marked ✅ have since been closed; re-check the rest before
submitting:

| Report claim | Repository state |
| --- | --- |
| FR2 guided onboarding | Not implemented. What exists is `invoiceReadiness()` in `packages/shared/src/readiness.ts`, which blocks invoice creation until the profile is legally complete. No `onboarding_completed_at`, no ordered flow, no server enforcement. |
| FR8.3 e-mail delivery | Not implemented. No mail transport anywhere in `apps/api`. Invoices are printed or exported to CSV. |
| FR3 tax parameters | `tax_system`, `advance_tax_rate`, `monthly_contribution` are not in the schema and not in the profile form — they were removed in the strip-to-core pass. Still true; §6.1 says so. |
| API covers all modules | ✅ Closed. `router.ts` now mounts `/auth`, `/bootstrap`, `/profile`, `/clients`, `/sessions`, `/invoices`, all behind `requireAuth`. |
| Frontend talks to the API | ✅ Closed. `StoreProvider` loads the ledger from `GET /api/bootstrap` and every mutation is a request; `localStorage` persistence is gone. |
| Eight tables | Still six: `users`, `profiles`, `clients`, `invoices`, `work_sessions`, `session`. No `invoice_line`, `payment`, `tax_payment`, `tax_assessment` — those belong to the design, not yet to the database. **This is the one that will show in the Figure 3 screenshot.** |

The last row is the important one for grading: **the report documents the full designed
model (8 entities), the database currently implements a subset.** That is defensible —
Sections 3 and 4 are a design deliverable, and §6.1 says which parts are built — but if
the pgAdmin screenshot in Figure 3 is taken from the current database it will show six
tables against a data dictionary describing eight, and the difference must either be
closed in the schema first or acknowledged in the figure caption.

Other divergences worth knowing about before defending the document:

- **Interface language — resolved.** The brief's NF13 said the interface was English
  with Slovenian invoice documents. That was wrong about both the intent and the built
  system: the application is Slovenian throughout, by decision. NF13 has been rewritten
  to say so, and to note that the terminology follows Slovenian domain usage rather
  than translating into it. Nothing else in the report referred to the interface
  language, so this was a single-row change.
- **Money representation.** NF5 and §4 say `NUMERIC(10,2)`. The schema stores money as
  integer cents, with a header comment explaining why, and the conversion lives in one
  place (`packages/shared/src/money.ts`). Both satisfy "exact decimal, never floating
  point", so NF5 holds either way, but §4.1 as written still describes `NUMERIC`. Decide
  which one is the design of record before the viva.
- **Password hashing.** NF9 lists bcrypt/argon2/scrypt; the implementation uses scrypt
  from `node:crypto` (`apps/api/src/lib/password.ts`). I added scrypt to the NF9 list so
  the requirement and the implementation match.
- **Overnight sessions.** §4.1 documents `end_time <> start_time` plus modulo-24
  duration. This matches `db/schema.sql`, which computes minutes as a generated column
  with the same midnight-wrap handling — the brief's suggested `end_time > start_time`
  would have been wrong for the domain and is not used.

## 2a. What changed after the report was written

The persistence work described in §6.1 landed after the first draft:

- `db/migrations/` plus `scripts/migrate.mjs` replace the drop-and-recreate
  `schema.sql`. Migrations run in a transaction, are recorded only on commit,
  and are checksummed so an edited file is refused.
- `0002` adds `clients.is_active`; deletion of a referenced client became
  deactivation, which is what FR4.2 always said.
- Invoice numbering moved to the server, assigned under the unique index with a
  savepoint-and-retry rather than a read-then-write.
- `apps/api/test/api.test.ts` — 21 integration tests against a scratch database
  built from the migration files. `npm test` in `apps/api`.
- Login and registration are rate-limited (`AUTH_RATE_LIMIT_MAX`, default 20 per
  quarter hour); the session cookie is named `reckon.sid` and rolls.
- Backup restore is a server-side transaction that remaps the file's own ids.

Two bugs the round trip caught, worth knowing because they are the kind a demo
would surface: `pg` was returning `date` columns as JS `Date`s in the server's
zone, which shifted calendar days; and `z.uuid()` rejected the seed's
hand-written identifiers, which Postgres accepts happily, making seeded rows
unreachable through the API. Both are fixed and covered by tests.

## 2b. The tax module

Implemented from `tax-and-earnings-spec.md`; see `docs/tax-implementation.md`
for what was verified, what was derived from the filings, and the five places
the implementation departs from the spec.

The one thing worth knowing here: the seminar's §6.1 status table now
understates the app. Contributions, income tax, the trajectory chart, the
contribution schedule with per-group payment codes, the payment ledger, the
year-end reconciliation and the effective hourly rate all exist. The data model
in §3 gained `contribution_periods`, `tax_payments` and `tax_assessments`, so
the gap between "eight entities documented, six implemented" is now smaller —
though `invoice_line` and `payment` are still design-only.

## 3. Things the brief did not specify that I decided

- **UUID keys.** The brief offered "UUID or bigserial". I chose UUID and justified it in
  §4.1 on multi-tenant grounds, which matches `db/schema.sql` (`gen_random_uuid()`).
- **Partial index** on unbilled sessions (`WHERE invoice_id IS NULL`) — not in the brief;
  added because that query drives invoice generation and indexing only the null rows is
  the natural fit.
- **`user` merges account and business.** Justified in the ERD narrative on the grounds
  that an s.p. is not a legal person separate from the natural person. Worth being ready
  to defend, since a marker may expect a separate `business`/`company` entity.
- **Requirement numbering.** The brief's groups are numbered FR1–FR8 with individual
  requirements as FR1.1, FR1.2 … so that §6.1 and the notes can refer to a single
  requirement precisely. NFRs are NF1–NF14, numbered sequentially across categories as
  the brief asked.
- **`payment.method` enum** limited to `bank_transfer` and `other`, since §1 scopes the
  system to a freelancer paid exclusively by bank transfer — and that scoping is also
  what keeps fiscal verification (davčno potrjevanje) out of scope.

## 4. Still to be supplied by hand

Every one of these is a marked placeholder box in the document:

1. Entity-relationship diagram — Figure 1 (Figma export)
2. Relational model diagram — Figure 2 (Figma export)
3. pgAdmin screenshot of the physical schema — Figure 3
4. Screen recording of the database being created from migrations — Recording 1
5. Wireframes for each use case — Figure 4 (Figma export)
6. Links: Figma file(s), deployed application, GitHub repository — Source 1
7. Student name on the title page

## 5. Legal references used

Kept deliberately few and only where they carry weight, all verified earlier in this
project rather than recalled loosely:

- **ZDDV-1 art. 82** — mandatory invoice elements; cited for why client name and address
  are `NOT NULL`.
- **ZDDV-1 art. 94** — the small-taxpayer exemption whose clause is printed on every
  invoice (`vat_clause`).
- **Fiscal Verification of Invoices Act (ZDavPR)** — cited in §1 for why *davčno
  potrjevanje* is out of scope: it binds only cash and card settlement.
- **Davčna številka check digit** — mod-11; the schema's regex `^[1-9][0-9]{7}$` checks
  shape only, the check digit is verified in `packages/shared/src/client.ts`.
- **IBAN** — ISO 13616 mod-97, Slovenian form `SI56` + 15 digits.

No figures for normiranec thresholds appear anywhere in the report. Earlier research in
this project could not confirm the 2026 limits against an authoritative source, so the
document deliberately describes the tax layer in structural terms only and states no
rate or threshold that would have to be defended.
