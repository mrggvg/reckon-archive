# Reckon: an information system for time tracking, invoicing and tax monitoring for a Slovenian sole proprietor

**Course:** Systems III — seminar report
**Student:** _[name]_
**Year:** 2025/26
**Method of completion:** individual project — analysis, logical and physical design, and implementation of a working client–server application

---

> **Title page note (for the .docx conversion).** The block above becomes the title page: project title centred, student name, year and method of completion beneath it, followed by a page break. The table of contents that follows must be inserted as a live Word field (References → Table of Contents → Automatic Table), not typed, so that page numbers update after the final edit. Page numbers go in the footer, starting at 1 on the Problem statement page.

## Table of contents

1. Problem statement
2. Functional and non-functional requirements of the new system
   - 2.1 Functional requirements
   - 2.2 Non-functional requirements
3. Logical design
   - 3.1 Data modelling
     - 3.1.1 Entity relationship diagram
     - 3.1.2 Data dictionary
     - 3.1.3 Relational model
4. Physical design
   - 4.1 Physical data model
5. Wireframe diagrams
6. System architecture and implementation

---

# 1. Problem statement

In Slovenia, a large share of independent professionals operate as a *samostojni podjetnik* (s.p.), a sole proprietorship. Unlike an employee, an s.p. is personally responsible for the entire administrative cycle that surrounds the work itself: recording the hours actually worked, converting those hours into a legally compliant invoice, delivering that invoice to the client, monitoring whether it has been paid, and setting aside and remitting the correct amounts to the Financial Administration of the Republic of Slovenia (FURS). None of these tasks produce income directly, yet each carries real financial and legal consequences when done poorly.

In practice these tasks are spread across disconnected tools. A freelancer typically records hours in a spreadsheet or notes application, retypes totals into a document template to produce an invoice, tracks payment status separately or from memory, and estimates tax informally or defers the question to an accountant at year end. Because the same fact — an hour worked — is re-entered in several places, each re-entry is an opportunity for the hours worked, the amount invoiced, and the amount declared to drift apart. Because an s.p. pays income tax in advance (*akontacija dohodnine*) and fixed monthly social security contributions (*prispevki*) throughout the year, a freelancer who does not track these obligations continuously can be surprised by the annual assessment (*dohodninska odločba*) and discover a shortfall only once it is due.

A market review of existing Slovenian software confirmed that this integration does not currently exist. Invoicing platforms aimed at sole proprietors — Moj Račun, Račun123, Minimax, S.P. Izračun and others — are mature, free at their core tier, and legally robust, but they all begin at the point where an amount to invoice is already known and treat its origin as the user's problem. Where time tracking exists in this space at all, as in Minimax's *evidenca delovnega časa*, it is built for employers recording employees' attendance for payroll purposes, structurally unconnected to invoicing and irrelevant to a sole proprietor billing their own hours to clients. Where tax reconciliation for flat-rate taxpayers (*normiranci*) exists, as in Minimax's year-end processing tools, it is embedded in a full double-entry bookkeeping suite aimed at accountants, not a lightweight, continuously updated view a freelancer can check mid-year on a phone. No product reviewed carries a recorded working hour through to an invoice and through to a running picture of tax owed, in one system.

This project addresses that specific gap for a Slovenian s.p. who bills business clients for services on an hourly basis, is not registered for VAT, and is paid exclusively by bank transfer. The system covers the path from recording a working session to issuing a compliant invoice, monitoring its payment, and maintaining a running estimate of the two distinct obligations — advance income tax and social security contributions — that make up a sole proprietor's tax burden during the year.

Explicitly outside the scope are double-entry bookkeeping, expense and asset management, payroll for employees, VAT return preparation, and fiscal verification of cash receipts (*davčno potrjevanje računov*), which under the Fiscal Verification of Invoices Act applies only to invoices settled in cash or by card and therefore does not apply to a freelancer paid exclusively by bank transfer.

---

# 2. Functional and non-functional requirements of the new system

## 2.1 Functional requirements

The functional requirements are organised into eight groups. Each group corresponds to a coherent area of system behaviour and is implemented as a distinct feature module in the application architecture described in Section 6.

### FR1 — Authentication and account isolation

- FR1.1 A visitor can register an account with an e-mail address and password, and can log in and log out. Passwords are stored hashed, never in plain text.
- FR1.2 All data — profile, clients, working sessions, invoices, tax records — belongs to exactly one user, and a user must never be able to read or modify another user's records. This is enforced on every request, not only in the interface.
- FR1.3 A user's session persists across visits until the user explicitly logs out or the session expires.

### FR2 — Guided onboarding

- FR2.1 A new user cannot access any part of the system beyond authentication, profile editing, client editing, and the onboarding flow itself until onboarding is complete.
- FR2.2 Onboarding requires, in order: completing the business profile; adding at least one client; and either importing existing invoices or explicitly confirming that none exist.
- FR2.3 Completion is recorded once, explicitly, and is not silently re-triggered by later edits to profile or client data.
- FR2.4 The requirement is enforced by the server on every request, not only by hiding navigation in the interface.

### FR3 — Business profile management

- FR3.1 A user can record and edit the identifying details of their sole proprietorship: business name, address, tax number, registration number, and bank account (IBAN).
- FR3.2 A user records their VAT status. When the user is not VAT-registered, the system stores the statutory exemption clause that is reproduced on every invoice.
- FR3.3 A user records the parameters needed for tax estimation: taxation system (flat-rate/*normiranec* or actual costs), the advance income tax rate to set aside, and the fixed monthly social security contribution.
- FR3.4 A user may record the last invoice number already issued outside the system, so that numbers generated by the system continue an existing sequence rather than restarting it.

### FR4 — Client management

- FR4.1 A user can create, view, edit, and deactivate clients, each with company name, address, tax number, and an agreed hourly rate.
- FR4.2 A client with linked working sessions or invoices cannot be deleted outright, so that historical invoices remain complete. Such a client can be deactivated instead, which removes it from selection lists without removing it from past records.

### FR5 — Recording of working hours

- FR5.1 A user can record a working session: date, start time, end time, client, and an optional note. Duration is always calculated from the start and end times, never entered directly.
- FR5.2 Sessions can be created, edited, and deleted, except that a session already linked to an issued invoice cannot be deleted, nor can its date, times, or client be changed.
- FR5.3 Sessions can be reviewed as a chronological list and filtered by client and date range, with running totals for hours logged and hours not yet invoiced.

### FR6 — Invoice generation from recorded hours

- FR6.1 A user selects a client and a set of that client's not-yet-invoiced sessions — individually, or by selecting a date range which the server resolves to the matching not-yet-invoiced sessions for that client — and generates an invoice.
- FR6.2 The system computes the total from the selected sessions' durations and the client's hourly rate at the time of generation, assigns the next sequential invoice number in the format NNN/YYYY, and marks the selected sessions as invoiced and linked to the new invoice.
- FR6.3 The generated invoice document contains every element legally required of an invoice issued by a taxable person who is not registered for VAT: sequential number, issue date, place of issue, due date, name, address and tax number of both parties, description and period of the service, the amount payable, and the statutory VAT exemption clause.

### FR7 — Import of invoices issued outside the system

- FR7.1 A user can record an invoice issued before adopting the system, or issued manually outside it, through a form capturing the same fields as a generated invoice: number, client, dates, description, period, and amount. Such an invoice has no linked working sessions.
- FR7.2 The system enforces uniqueness of invoice numbers per user, regardless of whether an invoice was generated by the system or imported into it.

### FR8 — Invoice records, payment tracking, and delivery

- FR8.1 All invoices — generated and imported — are shown together in a single list, with number, client, dates, amount, and payment status.
- FR8.2 A user can mark an invoice as paid, recording the payment date, and can reverse this. The system derives status as paid, unpaid, or overdue from the payment record and the due date; status is never stored directly as an editable field.
- FR8.3 A user can send an invoice document to the client's e-mail address directly from the system with a single action.
- FR8.4 A user can delete an invoice; any working sessions linked to it revert to not-yet-invoiced.

> **Note on a ninth capability.** Continuous monitoring of advance income tax and social security contributions against actual payments, with year-end reconciliation against the FURS assessment, is part of the full system design. It is supported by the `tax_payment` and `tax_assessment` entities in the data model (Section 3.1) and by the corresponding tables in the physical design (Section 4), but belongs to a later development phase. Section 6 states explicitly what is implemented at the time of writing and what is planned. The capability is retained in the data model from the start so that adding it later requires no structural change to existing tables.

## 2.2 Non-functional requirements

*Table 1: Non-functional requirements, categorised.*

| No. | Category | Requirement |
| --- | --- | --- |
| NF1 | Performance | Every interaction, including invoice generation from a selection of up to 200 sessions, must complete within one second on a typical connection. |
| NF2 | Performance | The system must remain responsive with several years of accumulated data — approximately 3,000 sessions, 300 invoices and 50 clients per user — across multiple concurrent users. |
| NF3 | Information | Invoices must contain every element required of a non-VAT-registered taxable person's invoice under the Value Added Tax Act (ZDDV-1), including the statutory exemption clause. |
| NF4 | Information | Invoice numbers must form an unbroken sequence per user per calendar year; the system must not permit two invoices with the same number for the same user. |
| NF5 | Information | Monetary amounts are held as exact decimal values, never floating-point, to two decimal places; durations are held to the minute. |
| NF6 | Economy | The system must run at zero cost to its users at the intended scale, using free tiers of managed hosting and database providers. |
| NF7 | Control and security | Every request is authenticated, and every data access is scoped to the authenticated user at the database query level, not merely filtered in the response. |
| NF8 | Control and security | A working session or invoice line that has been billed cannot be deleted without the deletion being an explicit, reversible action that also reverts the related record's state (for example, un-invoicing a session). |
| NF9 | Control and security | Passwords are hashed with a modern algorithm (bcrypt, argon2 or scrypt); session identifiers are unpredictable and are invalidated on logout. |
| NF10 | Efficiency | Any given fact is entered once: a working hour must not need re-entry to appear on an invoice, and an invoice must not need re-entry to inform a tax estimate. |
| NF11 | Service | The system is a mobile-first web application usable on a phone, since hours are typically logged away from a desk. |
| NF12 | Service | The system supports multiple independent users on shared infrastructure, each seeing only their own records. |
| NF13 | Service | The interface language is Slovenian throughout, as are the invoice documents themselves. The system's users are Slovenian sole proprietors and its documents are read by Slovenian clients and their accountants, so terminology follows established domain usage — *davčna številka*, *rok plačila*, *klavzula DDV* — rather than translations of it. |
| NF14 | Service | The system exposes its backend functionality as a versioned RESTful HTTP API, independent of any particular frontend client. |

> **Formatting note for the .docx conversion.** This table's header row must be set to repeat across page breaks (Table Properties → Row → *Repeat as header row at the top of each page*). Numbering runs sequentially across the whole table rather than restarting per category.

---

# 3. Logical design

## 3.1 Data modelling

The data model consists of eight entities: `user`, `client`, `working_session`, `invoice`, `invoice_line`, `payment`, `tax_payment` and `tax_assessment`. This satisfies the course requirement of a minimum of five entities.

### 3.1.1 Entity relationship diagram

```
┌─ PLACEHOLDER ─────────────────────────────────────────────────────────────┐
│                                                                           │
│   *Insert the entity-relationship diagram here (Figma export, PNG/SVG).*  │
│   *Show all eight entities with primary keys, foreign keys and*           │
│   *cardinalities as described in the narrative below.*                    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

*Figure 1: Entity-relationship diagram of the Reckon data model. Source: [insert Figma link]*

**Narrative.** The model is organised around a single owning entity and a single billable fact.

`user` is the owner of everything else. It represents both an authentication identity and the sole proprietorship itself, since in Slovenian law the two are the same legal person: an s.p. is not a separate entity from the natural person operating it, and merging them avoids a one-to-one relationship that would carry no information. Every other entity in the model reaches `user` either directly or through exactly one intermediate entity, and the identifier of the owning user is carried explicitly on every user-owned table so that authorisation can be expressed as a single predicate in every query (see NF7).

Each `user` has many `client` records — the companies for which work is performed. The relationship is one-to-many and mandatory on the client side: a client cannot exist without an owner.

Each `client` has many `working_session` records, and each `working_session` belongs to exactly one client. A session is the atomic billable fact of the system: one continuous period of work, on one date, for one client. It is the only place in the model where a working hour is recorded, which is what allows requirement NF10 to hold.

The relationship between `working_session` and `invoice` is the central design decision of the model. A working session belongs to **at most one** invoice: the foreign key `invoice_id` on `working_session` is nullable, and a null value means the session has been recorded but not yet billed. Conversely, an invoice may have **zero** linked sessions, which accommodates invoices imported under FR7 that were issued before the system was adopted and whose underlying hours were never recorded in it. This optionality on both sides is what allows the same invoice list, the same numbering sequence and the same payment tracking to serve generated and imported invoices alike, rather than splitting them into two parallel structures.

Each `invoice` has many `invoice_line` records. Although the interface currently renders a single consolidated line — "services rendered for the period X to Y", the form a Slovenian hourly-billed service invoice normally takes — the relationship is modelled as a true one-to-many so that multi-item invoices become possible without a structural change (see Section 3.1.3).

Each `invoice` has many `payment` records. Modelling payment as a separate entity rather than a pair of nullable columns on `invoice` supports partial payment and gives each payment its own date, amount and method, while allowing payment status to be derived rather than stored (Section 3.1.3).

Finally, `tax_payment` and `tax_assessment` belong to `user` **directly**, not to any individual invoice. This reflects the actual legal mechanism: a sole proprietor does not pay tax per invoice. Advance income tax and social security contributions are paid monthly against an aggregate liability computed from total revenue in the tax period, and the annual assessment reconciles the total advance paid against the total finally assessed. Attaching either entity to `invoice` would encode a relationship that does not exist in the domain and would make aggregate reconciliation harder rather than easier.

### 3.1.2 Data dictionary

*Table 2: Data dictionary for all eight entities.*

| Entity | Entity description | Attribute | Attribute description | Domain | Default | Constraint |
| --- | --- | --- | --- | --- | --- | --- |
| **user** | An account holder and the sole proprietorship they operate; the owner of all other records. | id | Surrogate primary key. | UUID | `gen_random_uuid()` | PK, NOT NULL |
| user | | email | Login identity and contact address. | VARCHAR(255) | — | NOT NULL, UNIQUE (case-insensitive) |
| user | | password_hash | Hash of the account password; the plaintext is never stored. | VARCHAR(255) | — | NOT NULL |
| user | | business_name | Registered name of the s.p., including the "s.p." suffix, as printed on invoices. | VARCHAR(200) | `''` | — |
| user | | address | Registered business address (street, house number, postal code, city). | VARCHAR(300) | `''` | — |
| user | | tax_number | Slovenian tax number (*davčna številka*) of the issuer. | CHAR(8) | `''` | 8 digits, first digit ≥ 1, valid mod-11 check digit |
| user | | registration_number | AJPES registration number (*matična številka*). | VARCHAR(10) | `''` | 7 digits, or 10 with the unit suffix |
| user | | iban | Bank account into which clients pay; also encoded in the UPN QR code. | VARCHAR(34) | `''` | ISO 13616 mod-97 valid; Slovenian form `SI56` + 15 digits |
| user | | is_vat_payer | Whether the user is registered for VAT. | BOOLEAN | `false` | NOT NULL |
| user | | vat_clause | Statutory clause stating why VAT is not charged; printed on every invoice. | VARCHAR(300) | `''` | Required when `is_vat_payer` is false |
| user | | tax_system | Taxation system in use. | ENUM('normiranec', 'actual_costs') | `'normiranec'` | NOT NULL |
| user | | advance_tax_rate | Proportion of revenue set aside for advance income tax. | NUMERIC(5,4) | `0.0000` | ≥ 0 and ≤ 1 |
| user | | monthly_contribution | Fixed monthly social security contribution (*prispevki*). | NUMERIC(10,2) | `0.00` | ≥ 0 |
| user | | place_of_issue | Place of issue printed on invoices (*kraj izdaje*). | VARCHAR(100) | `''` | — |
| user | | default_description | Default service description pre-filled on new invoices. | VARCHAR(300) | `''` | — |
| user | | onboarding_completed_at | Instant at which onboarding was completed; null while incomplete. | TIMESTAMPTZ | NULL | — |
| user | | created_at | Instant the account was created. | TIMESTAMPTZ | `now()` | NOT NULL |
| **client** | A company for which the user performs services and to which invoices are addressed. | id | Surrogate primary key. | UUID | `gen_random_uuid()` | PK, NOT NULL |
| client | | user_id | Owning user. | UUID | — | FK → user(id), NOT NULL, ON DELETE CASCADE |
| client | | company_name | Legal name of the client, as printed on the invoice. | VARCHAR(200) | — | NOT NULL, non-empty (ZDDV-1 art. 82) |
| client | | address | Client's registered address. | VARCHAR(300) | — | NOT NULL, non-empty (ZDDV-1 art. 82) |
| client | | tax_number | Client's Slovenian tax number. | CHAR(8) | `''` | 8 digits with valid mod-11 check digit when present |
| client | | hourly_rate | Currently agreed rate in EUR per hour. | NUMERIC(10,2) | — | NOT NULL, > 0 |
| client | | email | Address to which invoice documents are sent. | VARCHAR(255) | `''` | Valid e-mail format when present |
| client | | phone | Contact telephone number. | VARCHAR(50) | `''` | — |
| client | | is_active | Whether the client appears in selection lists; deactivation replaces deletion. | BOOLEAN | `true` | NOT NULL |
| **working_session** | One continuous period of work for one client on one date; the atomic billable fact. | id | Surrogate primary key. | UUID | `gen_random_uuid()` | PK, NOT NULL |
| working_session | | user_id | Owning user; carried explicitly so every query scopes on one predicate. | UUID | — | FK → user(id), NOT NULL, ON DELETE CASCADE |
| working_session | | client_id | Client the work was performed for. | UUID | — | FK → client(id), NOT NULL, ON DELETE RESTRICT |
| working_session | | invoice_id | Invoice the session was billed on; null while unbilled. | UUID | NULL | FK → invoice(id), ON DELETE SET NULL |
| working_session | | session_date | Calendar date on which the work was performed. | DATE | — | NOT NULL |
| working_session | | start_time | Clock time work began, 24-hour. | TIME | — | NOT NULL |
| working_session | | end_time | Clock time work ended, 24-hour. | TIME | — | NOT NULL, `end_time <> start_time` |
| working_session | | note | Free text describing the work or the role performed. | VARCHAR(500) | `''` | — |
| **invoice** | An issued invoice, whether generated from sessions or imported from outside the system. | id | Surrogate primary key. | UUID | `gen_random_uuid()` | PK, NOT NULL |
| invoice | | user_id | Owning user and issuer. | UUID | — | FK → user(id), NOT NULL, ON DELETE CASCADE |
| invoice | | client_id | Client the invoice is addressed to. | UUID | — | FK → client(id), NOT NULL, ON DELETE RESTRICT |
| invoice | | invoice_number | Sequential number in the form NNN/YYYY. | VARCHAR(20) | — | NOT NULL, UNIQUE per user, matches `^\d{1,}/\d{4}$` |
| invoice | | issue_date | Date of issue (*datum izdaje*). | DATE | `CURRENT_DATE` | NOT NULL |
| invoice | | due_date | Payment deadline (*rok plačila*). | DATE | — | NOT NULL, ≥ `issue_date` |
| invoice | | service_from | First date of the billed service period. | DATE | — | NOT NULL |
| invoice | | service_to | Last date of the billed service period. | DATE | — | NOT NULL, ≥ `service_from` |
| invoice | | total_amount | Total payable in EUR. | NUMERIC(10,2) | — | NOT NULL, ≥ 0 |
| invoice | | applied_rate | Hourly rate applied at generation time; null for imported invoices. | NUMERIC(10,2) | NULL | > 0 when present |
| invoice | | is_imported | Whether the invoice was issued outside the system and recorded afterwards. | BOOLEAN | `false` | NOT NULL |
| invoice | | sent_at | Instant the document was e-mailed to the client; null if never sent. | TIMESTAMPTZ | NULL | — |
| **invoice_line** | One billed item on an invoice. | id | Surrogate primary key. | UUID | `gen_random_uuid()` | PK, NOT NULL |
| invoice_line | | invoice_id | Invoice the line belongs to. | UUID | — | FK → invoice(id), NOT NULL, ON DELETE CASCADE |
| invoice_line | | description | Description of the service billed. | VARCHAR(300) | — | NOT NULL |
| invoice_line | | quantity | Quantity billed, in hours. | NUMERIC(10,2) | — | NOT NULL, > 0 |
| invoice_line | | unit_price | Price per unit in EUR. | NUMERIC(10,2) | — | NOT NULL, > 0 |
| invoice_line | | line_total | `quantity × unit_price`, stored for auditability of the issued document. | NUMERIC(10,2) | — | NOT NULL, ≥ 0 |
| **payment** | A payment received against an invoice. | id | Surrogate primary key. | UUID | `gen_random_uuid()` | PK, NOT NULL |
| payment | | invoice_id | Invoice the payment settles. | UUID | — | FK → invoice(id), NOT NULL, ON DELETE CASCADE |
| payment | | paid_on | Date the payment was received. | DATE | — | NOT NULL |
| payment | | amount | Amount received in EUR. | NUMERIC(10,2) | — | NOT NULL, > 0 |
| payment | | method | How the payment was made. | ENUM('bank_transfer', 'other') | `'bank_transfer'` | NOT NULL |
| **tax_payment** | A payment made by the user to FURS, against aggregate liability rather than any single invoice. | id | Surrogate primary key. | UUID | `gen_random_uuid()` | PK, NOT NULL |
| tax_payment | | user_id | Owning user. | UUID | — | FK → user(id), NOT NULL, ON DELETE CASCADE |
| tax_payment | | paid_on | Date the payment was made. | DATE | — | NOT NULL |
| tax_payment | | amount | Amount paid in EUR. | NUMERIC(10,2) | — | NOT NULL, > 0 |
| tax_payment | | payment_type | Which obligation the payment settles. | ENUM('advance_income_tax', 'contributions', 'other') | — | NOT NULL |
| tax_payment | | note | Free text, e.g. the period the payment covers. | VARCHAR(300) | `''` | — |
| **tax_assessment** | The annual assessment issued by FURS (*dohodninska odločba*), against which advances are reconciled. | id | Surrogate primary key. | UUID | `gen_random_uuid()` | PK, NOT NULL |
| tax_assessment | | user_id | Owning user. | UUID | — | FK → user(id), NOT NULL, ON DELETE CASCADE |
| tax_assessment | | tax_year | Calendar year the assessment relates to. | SMALLINT | — | NOT NULL, UNIQUE per user, ≥ 2000 |
| tax_assessment | | assessed_amount | Total tax finally assessed for the year, in EUR. | NUMERIC(10,2) | — | NOT NULL, ≥ 0 |
| tax_assessment | | received_on | Date the assessment was received. | DATE | — | NOT NULL |

> **Formatting note for the .docx conversion.** In Word, shade the first row of each entity block (the rows in bold above) with a light grey fill so entity boundaries are visible at a glance, and repeat the header row across pages. Set the *Attribute* and *Domain* columns wide enough that identifiers such as `advance_tax_rate` and `ENUM('advance_income_tax', …)` do not break mid-word; landscape orientation for this table's pages is acceptable if needed.

### 3.1.3 Relational model

```
┌─ PLACEHOLDER ─────────────────────────────────────────────────────────────┐
│                                                                           │
│   *Insert the relational model diagram here (Figma export, PNG/SVG):*     │
│   *the eight relations with primary keys underlined, foreign keys*        │
│   *marked, and referential arrows between them.*                          │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

*Figure 2: Relational model in third normal form. Source: [insert Figma link]*

**Normalisation.** The model is in third normal form, and three decisions in particular are worth setting out, because each one resolves a tension between normalisation and the requirements of the domain.

**First normal form** holds trivially: every attribute in Table 2 is atomic. The one place where a repeating group was tempting is the address, which could have been a single free-text field. It is instead decomposed into street, postal code and city, because ZDDV-1 requires a complete address on the invoice and the postal code is validated independently.

**Second normal form** holds because every relation has a single-attribute surrogate primary key, so no non-key attribute can depend on part of a composite key. Surrogate keys were preferred over natural ones throughout — in particular over `invoice_number`, which is unique only *per user* and would otherwise have required a composite natural key propagated into `invoice_line`, `payment` and `working_session`.

**Third normal form** required one genuine judgement, on rates and totals. `client.hourly_rate` is the currently agreed rate; `invoice.applied_rate` and `invoice_line.unit_price` record the rate that was actually charged. This looks like redundancy, and under a strict reading it is a transitive dependency — the rate appears derivable from the client. It is not: an invoice is a legal document describing a past transaction, and a later renegotiation of the client's rate must not retroactively alter the amount on an invoice already issued and paid. The value on the invoice is therefore not a copy of the client's rate but an independent historical fact that happened to be equal to it on the day of issue. `invoice_line.line_total` and `invoice.total_amount` are stored on the same reasoning: they are what the issued document says, not a value to be recomputed later from data that may have moved.

**Payment status is derived, never stored.** There is no `status` column on `invoice`. Status is computed from the presence of `payment` rows and the relation between `due_date` and the current date: paid when settled, overdue when unsettled past the due date, unpaid otherwise. Storing it would create an attribute dependent on other attributes plus the passage of time — a value that is correct when written and silently wrong the next morning. This satisfies FR8.2 by construction rather than by discipline.

**`invoice_line` is retained as a true one-to-many relation** even though the interface currently produces exactly one line per invoice. Collapsing it into columns on `invoice` would denormalise a genuine one-to-many relationship for a short-term convenience, and would have to be undone the first time an invoice needs a second item — for example a fixed fee alongside hourly work, or a separately itemised travel cost. The relation costs one join today and avoids a schema migration later.

---

# 4. Physical design

## 4.1 Physical data model

The logical model is realised in **PostgreSQL 17**. The choices below follow from the requirements in Section 2.2 rather than from defaults.

**Keys.** Primary keys are `UUID` values generated by `gen_random_uuid()`. UUIDs were chosen over `bigserial` because identifiers appear in client-side URLs and API paths, and a sequential integer key would let one user infer the existence and volume of another user's records — a weakness in a multi-tenant system (NF7, NF12). The cost is a wider key and non-sequential index inserts, which at the data volumes stated in NF2 is not material.

**Money and time.** All monetary columns are `NUMERIC(10,2)`. Floating-point types are excluded: binary floating point cannot represent typical decimal amounts exactly, and the rounding error, though small, would eventually make a printed invoice total disagree with the sum of its lines (NF5). `NUMERIC(10,2)` accommodates amounts up to 99,999,999.99, far beyond the scale of a sole proprietorship. Session dates use `DATE` and session times use `TIME`, not `TIMESTAMP`: a working session is recorded as wall-clock time in one place, so binding it to an absolute instant would introduce a time zone into a value that has none, and would shift recorded hours across daylight-saving boundaries. Instants that are genuinely absolute — `created_at`, `sent_at`, `onboarding_completed_at` — use `TIMESTAMPTZ`.

**Uniqueness.** A unique composite index on `(user_id, invoice_number)` enforces NF4 at the level of the database rather than the application, so a concurrent double submission cannot produce two invoices with the same number. Account identity is enforced by a unique index on `lower(email)`, making the login address case-insensitive without depending on the `citext` extension.

**Indexes.** Every foreign key column is indexed: PostgreSQL does not create these automatically, and without them a delete on the parent forces a sequential scan of every child table. A composite index on `(user_id, session_date)` supports the calendar and date-range retrieval described in FR5.3 and FR6.1, which are the system's most frequent reads. A partial index on `working_session (user_id, client_id) WHERE invoice_id IS NULL` serves the "not yet invoiced" query that drives invoice generation, indexing only the rows that query can return.

**Referential integrity.** `ON DELETE RESTRICT` between `invoice` and `client` implements FR4.2: a client that appears on an issued invoice cannot be removed, because doing so would leave a legal document unable to name its addressee. `ON DELETE SET NULL` between `working_session` and `invoice` implements FR8.4: deleting an invoice returns its sessions to the unbilled pool rather than destroying the record of work performed. `ON DELETE CASCADE` is used only from `user` downwards, and from `invoice` to `invoice_line` and `payment`, where the child has no meaning without its parent.

**Check constraints.** Domain rules that must never be violated are expressed as `CHECK` constraints rather than left to application code: `total_amount >= 0`, `quantity > 0`, `due_date >= issue_date`, `service_to >= service_from`, and regular-expression checks on `tax_number` (`^[1-9][0-9]{7}$`), `postal_code` (`^[1-9][0-9]{3}$`) and `iban` (`^SI56[0-9]{15}$`).

The session duration constraint deserves a note. The obvious form, `CHECK (end_time > start_time)`, is wrong for this domain: a shift from 22:00 to 02:00 is a real working session and would be rejected. The schema instead constrains `end_time <> start_time` and computes duration as `(end_time - start_time + INTERVAL '24 hours') % INTERVAL '24 hours'`, which yields four hours for the overnight case and the expected value otherwise. This keeps a session to a maximum of 24 hours, which is the correct bound for a single continuous period of work.

**Encoding and collation.** The database is created with `UTF8` encoding and a Slovenian-aware collation, so that `č`, `š` and `ž` are stored, compared and sorted correctly in business names, client names and invoice descriptions.

**Schema management.** The schema is maintained as version-controlled SQL rather than generated by an ORM, so that the physical design documented here is the literal and auditable definition of the database (see Section 6).

```
┌─ PLACEHOLDER ─────────────────────────────────────────────────────────────┐
│                                                                           │
│   *Insert a pgAdmin (or equivalent) screenshot of the physical schema*    │
│   *here: the eight tables with their columns, keys and relationships.*    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

*Figure 3: Physical schema as created in PostgreSQL, shown in pgAdmin.*

```
┌─ PLACEHOLDER ─────────────────────────────────────────────────────────────┐
│                                                                           │
│   *Insert a link to a short screen recording showing the database being*  │
│   *created from the migration scripts.*                                   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

*Recording 1: Creation of the database from the version-controlled migration scripts. Source: [insert link]*

---

# 5. Wireframe diagrams

The wireframes below cover the principal use cases of the system: registration and login, the onboarding sequence, business profile editing, client management, recording a working session, reviewing recorded hours, generating an invoice from selected sessions, importing an existing invoice, and the invoice list with payment tracking.

```
┌─ PLACEHOLDER ─────────────────────────────────────────────────────────────┐
│                                                                           │
│   *Insert the wireframe diagrams here (Figma export), one figure per*     │
│   *use case, each with its own caption. Mobile and desktop layouts*       │
│   *should both be shown for screens whose layout differs between them.*   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

*Figure 4: Wireframe diagrams for the system's principal use cases. Source: [insert Figma link]*

---

# 6. System architecture and implementation

Reckon is implemented as a three-tier client–server system, structured as a single monorepo with independently deployable frontend and backend.

**Frontend.** A React single-page application built with Vite and TypeScript, communicating with the backend exclusively through its REST API. The interface is mobile-first (NF11), since working hours are typically recorded away from a desk.

**Backend.** A Node.js/Express REST API, also written in TypeScript, organised into feature modules — auth, profile, clients, sessions, invoices, payments, tax — each separated into three layers: a routing layer handling HTTP concerns only, a service layer holding business rules and transaction boundaries, and a repository layer containing SQL only. Authentication uses server-side sessions rather than tokens, which is appropriate because the system has a single first-party client and no third-party API consumers; session records are stored in the database and invalidated on logout (NF9). Every data-access query is scoped by the authenticated user's id at the repository layer, so isolation does not depend on a caller remembering to filter (NF7).

**Database.** PostgreSQL, with the schema managed through version-controlled SQL rather than an ORM, so that the physical design documented in Section 4 is the literal, auditable source of the database structure rather than a description of something generated elsewhere.

**Shared package.** Validation schemas and pure business logic — invoice numbering, duration and money arithmetic, tax-number and IBAN validation, and the Slovenian UPN QR payload format — live in a package imported by both the frontend and the backend. A rule is therefore defined once and enforced identically on both sides, rather than written twice and allowed to diverge.

## 6.1 Implementation status at the time of writing

The project is being built in deliberate phases, and this section states plainly what exists and what does not.

*Table 3: Implementation status by functional requirement group.*

| Group | Capability | Status at time of writing |
| --- | --- | --- |
| FR1 | Authentication and account isolation | Implemented — registration, login, logout, hashed passwords, server-side sessions, per-user scoping in the API |
| FR2 | Guided onboarding | Designed; not yet implemented as an ordered flow. The application enforces a narrower rule, on the server as well as in the interface: an invoice cannot be issued until the profile contains every field one legally requires |
| FR3 | Business profile management | Implemented and persisted through the API for the identity, address, tax number, registration number, IBAN, VAT status and invoice-numbering fields. The tax-estimation parameters (`tax_system`, `advance_tax_rate`, `monthly_contribution`) are part of the data model in Section 3 but are not yet in the physical schema or the interface, since they belong to the tax phase |
| FR4 | Client management | Implemented. A client referenced by hours or invoices is deactivated rather than deleted, so the history stays complete; only a client nothing points at is removed outright |
| FR5 | Recording of working hours | Implemented — manual entry of date, start, end, client and note, with duration always computed (including shifts crossing midnight), plus list and calendar views with running totals. A session already on an invoice cannot be edited or deleted; the rule is enforced in the SQL that performs the update, not only in the interface |
| FR6 | Invoice generation from recorded hours | Implemented as a single database transaction: the selected sessions are locked, priced at the client's current rate, and attached to the new invoice. The number is assigned under the unique index rather than read and then written, so simultaneous requests produce consecutive numbers instead of a collision. The document carries every element required by ZDDV-1 together with a UPN QR payment code |
| FR7 | Import of invoices issued outside the system | Implemented |
| FR8 | Invoice records and payment tracking | Implemented, except FR8.3 (e-mail delivery), which is not yet built; invoices are printed or exported to CSV and sent by the user. Deleting an invoice returns its hours to the unbilled pool |
| — | Continuous tax monitoring and year-end reconciliation | Designed into the data model (`tax_payment`, `tax_assessment`) and the physical schema; scheduled as the next development phase |

Everything above is persisted in PostgreSQL through the API; the browser holds no copy of the ledger beyond the one it is currently displaying. The schema is applied by version-controlled migrations, each run in its own transaction and recorded only if that transaction commits, with applied files checksummed so that editing one after the fact is refused rather than silently diverging.

The behaviour that the interface cannot be trusted to enforce is covered by an integration test suite that runs against a real PostgreSQL instance created from those same migration files: that one account can reach nothing belonging to another, by listing or by identifier; that hours already invoiced cannot be moved or deleted; that five invoices generated at the same moment receive five distinct consecutive numbers; that a duplicate invoice number is refused on import; and that restoring a backup replaces an account's records in full or not at all.

This staged approach was deliberate. Tax estimates are only trustworthy if the invoice and payment records feeding them are already reliable, so the record-keeping loop — hours in, invoice out, payment tracked — is being completed and put into daily personal use before the tax layer is built on top of it. Building the tax layer first would have produced a figure that looks authoritative and is not.

```
┌─ PLACEHOLDER ─────────────────────────────────────────────────────────────┐
│                                                                           │
│   *Optional: insert a link to the deployed application and/or the*        │
│   *GitHub repository.*                                                    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

*Source 1: Deployed application and source repository. [insert links]*
