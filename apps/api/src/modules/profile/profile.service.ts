import { fromCents, toCents, type TaxProfileInput } from '@reckon/shared';
import { NotFoundError } from '../../lib/AppError.js';
import { toProfileDto } from '../../lib/mappers.js';
import { profileRepo, type ProfileWrite, type TaxProfileRow } from './profile.repo.js';

/** The tax position as the interface holds it: euros, not cents. */
function toTaxDto(row: TaxProfileRow) {
  return {
    businessStartDate: row.business_start_date,
    contributionBase: fromCents(row.contribution_base_cents),
    contributionReliefOverride:
      row.contribution_relief_override === null
        ? null
        : Number(row.contribution_relief_override),
    normiranecKind: row.normiranec_kind,
    declaredMonthlyEstimate:
      row.declared_monthly_estimate_cents === null
        ? null
        : fromCents(row.declared_monthly_estimate_cents),
    officialInstallment:
      row.official_installment_cents === null
        ? null
        : fromCents(row.official_installment_cents),
    officialInstallmentFrequency: row.official_installment_frequency,
    dohodninaIban: row.dohodnina_iban,
    // Offered rather than stored until the user confirms it: FURS matches the
    // payment on this reference, so a guess must at least be a visible one.
    dohodninaReference:
      row.dohodnina_reference || (row.tax_number ? `SI19 ${row.tax_number}-40002` : ''),
    weeklyHours: row.weekly_hours,
    // Empty until confirmed; the form offers the standard ones to confirm.
    contributionAccounts: {
      piz: { iban: row.piz_iban, reference: row.piz_reference },
      zzDo: { iban: row.zz_do_iban, reference: row.zz_do_reference },
      stv: { iban: row.stv_iban, reference: row.stv_reference },
      zap: { iban: row.zap_iban, reference: row.zap_reference },
    },
  };
}

export const profileService = {
  async get(userId: string) {
    const row = await profileRepo.find(userId);
    if (!row) throw new NotFoundError('Profil ni najden');
    return toProfileDto(row);
  },

  async save(userId: string, input: ProfileWrite) {
    return toProfileDto(await profileRepo.save(userId, input));
  },

  async getTax(userId: string) {
    const row = await profileRepo.findTax(userId);
    if (!row) throw new NotFoundError('Profil ni najden');
    return toTaxDto(row);
  },

  async saveTax(userId: string, input: TaxProfileInput) {
    const row = await profileRepo.saveTax(userId, {
      businessStartDate: input.businessStartDate,
      contributionBaseCents: toCents(input.contributionBase),
      contributionReliefOverride: input.contributionReliefOverride,
      normiranecKind: input.normiranecKind,
      declaredMonthlyEstimateCents:
        input.declaredMonthlyEstimate === null
          ? null
          : toCents(input.declaredMonthlyEstimate),
      officialInstallmentCents:
        input.officialInstallment === null ? null : toCents(input.officialInstallment),
      officialInstallmentFrequency: input.officialInstallmentFrequency,
      dohodninaIban: input.dohodninaIban,
      dohodninaReference: input.dohodninaReference,
      weeklyHours: input.weeklyHours,
      contributionAccounts: input.contributionAccounts,
    });
    return toTaxDto(row);
  },
};
