import type { ContributionMonth } from './types';

/**
 * Which months of contributions are still owed, and which are done.
 *
 * A month falls due once it has ended — in August what is owed is July — so
 * anything after `dueMonth` is a forecast rather than a debt and is left off
 * the list entirely. What remains is split: still owing, newest first, because
 * the most recent month is the one to act on; and settled, kept out of the way.
 *
 * Pure, and separate from the view, so the rule can be tested without
 * rendering anything.
 */
export function splitContributionMonths(
  months: ContributionMonth[],
  dueMonth: number | null,
): { due: ContributionMonth[]; settled: ContributionMonth[] } {
  if (dueMonth === null) return { due: [], settled: [] };

  const ended = months.filter((m) => m.month <= dueMonth);
  const isSettled = (m: ContributionMonth) =>
    Object.values(m.settled.groups).every(Boolean);

  return {
    due: ended.filter((m) => !isSettled(m)).reverse(),
    settled: ended.filter(isSettled).reverse(),
  };
}
