import type { PoolClient } from 'pg';
import { formatInvoiceNumber, parseInvoiceNumber } from '@reckon/shared';
import { pool } from '../../db/pool.js';
import type { ProfileRow } from '../../lib/mappers.js';

const COLUMNS = `full_name, street, postal_code, city, tax_number, reg_number,
                 iban, account_holder, vat_payer, default_description,
                 next_invoice_number, place_of_issue, vat_clause`;

export interface ContributionAccounts {
  piz_iban: string;
  piz_reference: string;
  zz_do_iban: string;
  zz_do_reference: string;
  stv_iban: string;
  stv_reference: string;
  zap_iban: string;
  zap_reference: string;
}

export interface TaxProfileRow extends ContributionAccounts {
  business_start_date: string | null;
  contribution_base_cents: number;
  contribution_relief_override: string | null;
  normiranec_kind: 'full' | 'part';
  declared_monthly_estimate_cents: number | null;
  official_installment_cents: number | null;
  official_installment_frequency: 'monthly' | 'quarterly' | null;
  dohodnina_iban: string;
  dohodnina_reference: string;
  weekly_hours: number;
  tax_number: string;
}

export interface TaxProfileWrite {
  contributionAccounts: {
    piz: { iban: string; reference: string };
    zzDo: { iban: string; reference: string };
    stv: { iban: string; reference: string };
    zap: { iban: string; reference: string };
  };
  businessStartDate: string | null;
  contributionBaseCents: number;
  contributionReliefOverride: number | null;
  normiranecKind: 'full' | 'part';
  declaredMonthlyEstimateCents: number | null;
  officialInstallmentCents: number | null;
  officialInstallmentFrequency: 'monthly' | 'quarterly' | null;
  dohodninaIban: string;
  dohodninaReference: string;
  weeklyHours: number;
}

export interface ProfileWrite {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  regNumber: string;
  iban: string;
  accountHolder: string;
  vatPayer: 'DA' | 'NE';
  defaultDesc: string;
  nextInvoiceNumber: string;
  placeOfIssue: string;
  vatClause: string;
}

export const profileRepo = {
  async find(userId: string): Promise<ProfileRow | null> {
    const { rows } = await pool.query<ProfileRow>(
      `SELECT ${COLUMNS} FROM profiles WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  },

  /** Upsert, so a profile row missing for any reason repairs itself on save. */
  async save(userId: string, p: ProfileWrite): Promise<ProfileRow> {
    const { rows } = await pool.query<ProfileRow>(
      `INSERT INTO profiles (
         user_id, full_name, street, postal_code, city, tax_number, reg_number,
         iban, account_holder, vat_payer, default_description,
         next_invoice_number, place_of_issue, vat_clause, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = excluded.full_name,
         street = excluded.street,
         postal_code = excluded.postal_code,
         city = excluded.city,
         tax_number = excluded.tax_number,
         reg_number = excluded.reg_number,
         iban = excluded.iban,
         account_holder = excluded.account_holder,
         vat_payer = excluded.vat_payer,
         default_description = excluded.default_description,
         next_invoice_number = excluded.next_invoice_number,
         place_of_issue = excluded.place_of_issue,
         vat_clause = excluded.vat_clause,
         updated_at = now()
       RETURNING ${COLUMNS}`,
      [
        userId, p.name, p.street, p.postalCode, p.city, p.taxNumber, p.regNumber,
        p.iban, p.accountHolder, p.vatPayer === 'DA', p.defaultDesc,
        p.nextInvoiceNumber, p.placeOfIssue, p.vatClause,
      ],
    );
    return rows[0] as ProfileRow;
  },

  /**
   * Moves the numbering floor past a number that has just been issued.
   *
   * Without this the series is derived from the invoices that still exist, so
   * deleting the newest one hands its number to the next invoice — and if the
   * deleted one had already been sent, two different documents are in the world
   * under the same number. A high-water mark can only ever move forward.
   */
  async advanceNextNumber(
    client: PoolClient,
    userId: string,
    issued: { seq: number; year: number },
  ): Promise<void> {
    const declared = await this.declaredNextNumber(client, userId);
    const parsed = parseInvoiceNumber(declared);
    const floor = parsed && parsed.year === issued.year ? parsed.seq : 0;
    if (issued.seq + 1 <= floor) return;

    await client.query(
      `UPDATE profiles SET next_invoice_number = $2, updated_at = now()
       WHERE user_id = $1`,
      [userId, formatInvoiceNumber(issued.seq + 1, issued.year)],
    );
  },

  /**
   * The issuer's tax position, which only the tax module reads.
   *
   * Kept apart from the invoice profile deliberately: these fields describe
   * what the business owes, not what its invoices say.
   */
  async findTax(userId: string): Promise<TaxProfileRow | null> {
    const { rows } = await pool.query<TaxProfileRow>(
      `SELECT business_start_date, contribution_base_cents,
              contribution_relief_override, normiranec_kind,
              declared_monthly_estimate_cents, official_installment_cents,
              official_installment_frequency, dohodnina_iban, dohodnina_reference,
              weekly_hours, tax_number,
              piz_iban, piz_reference, zz_do_iban, zz_do_reference,
              stv_iban, stv_reference, zap_iban, zap_reference
       FROM profiles WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  },

  async saveTax(userId: string, t: TaxProfileWrite): Promise<TaxProfileRow> {
    const { rows } = await pool.query<TaxProfileRow>(
      `UPDATE profiles SET
         business_start_date = $2,
         contribution_base_cents = $3,
         contribution_relief_override = $4,
         normiranec_kind = $5,
         declared_monthly_estimate_cents = $6,
         official_installment_cents = $7,
         official_installment_frequency = $8,
         dohodnina_iban = $9,
         dohodnina_reference = $10,
         weekly_hours = $11,
         piz_iban = $12, piz_reference = $13,
         zz_do_iban = $14, zz_do_reference = $15,
         stv_iban = $16, stv_reference = $17,
         zap_iban = $18, zap_reference = $19,
         updated_at = now()
       WHERE user_id = $1
       RETURNING business_start_date, contribution_base_cents,
                 contribution_relief_override, normiranec_kind,
                 declared_monthly_estimate_cents, official_installment_cents,
                 official_installment_frequency, dohodnina_iban, dohodnina_reference,
                 weekly_hours, tax_number,
                 piz_iban, piz_reference, zz_do_iban, zz_do_reference,
                 stv_iban, stv_reference, zap_iban, zap_reference`,
      [
        userId, t.businessStartDate, t.contributionBaseCents, t.contributionReliefOverride,
        t.normiranecKind, t.declaredMonthlyEstimateCents, t.officialInstallmentCents,
        t.officialInstallmentFrequency, t.dohodninaIban, t.dohodninaReference,
        t.weeklyHours,
        t.contributionAccounts.piz.iban, t.contributionAccounts.piz.reference,
        t.contributionAccounts.zzDo.iban, t.contributionAccounts.zzDo.reference,
        t.contributionAccounts.stv.iban, t.contributionAccounts.stv.reference,
        t.contributionAccounts.zap.iban, t.contributionAccounts.zap.reference,
      ],
    );
    return rows[0] as TaxProfileRow;
  },

  /**
   * Remembers the accounts from a filing when the profile has none yet.
   *
   * The first time a real PODO-OPSVZ is recorded, its accounts and references
   * become the ones every later estimate is paid with — learned from the
   * user's own document rather than assumed.
   */
  async learnContributionAccounts(
    userId: string,
    a: ContributionAccounts,
  ): Promise<void> {
    await pool.query(
      `UPDATE profiles SET
         piz_iban = CASE WHEN piz_iban = '' THEN $2 ELSE piz_iban END,
         piz_reference = CASE WHEN piz_reference = '' THEN $3 ELSE piz_reference END,
         zz_do_iban = CASE WHEN zz_do_iban = '' THEN $4 ELSE zz_do_iban END,
         zz_do_reference = CASE WHEN zz_do_reference = '' THEN $5 ELSE zz_do_reference END,
         stv_iban = CASE WHEN stv_iban = '' THEN $6 ELSE stv_iban END,
         stv_reference = CASE WHEN stv_reference = '' THEN $7 ELSE stv_reference END,
         zap_iban = CASE WHEN zap_iban = '' THEN $8 ELSE zap_iban END,
         zap_reference = CASE WHEN zap_reference = '' THEN $9 ELSE zap_reference END
       WHERE user_id = $1`,
      [
        userId, a.piz_iban, a.piz_reference, a.zz_do_iban, a.zz_do_reference,
        a.stv_iban, a.stv_reference, a.zap_iban, a.zap_reference,
      ],
    );
  },

  /** Reads the numbering floor inside an open transaction. */
  async declaredNextNumber(client: PoolClient, userId: string): Promise<string> {
    const { rows } = await client.query<{ next_invoice_number: string }>(
      `SELECT next_invoice_number FROM profiles WHERE user_id = $1`,
      [userId],
    );
    return rows[0]?.next_invoice_number ?? '';
  },
};
