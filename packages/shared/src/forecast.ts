/**
 * Where the year is heading, from where it has been.
 *
 * Deliberately the simplest thing that can be explained out loud: money in so
 * far, plus invoices already issued, plus the average month repeated for the
 * months still to come. A freelancer with a handful of invoices a year is not
 * served by anything cleverer, and a figure that cannot be explained is a
 * figure that cannot be argued with — which matters, because this one is used
 * to decide what to charge.
 */

export interface YearForecast {
  /** Money that has actually arrived this year. */
  receivedCents: number;
  /** Issued and awaiting payment. */
  outstandingCents: number;
  /** The floor: what the year holds even if no further work is done. */
  committedCents: number;
  /** Average month so far, over months actually traded. */
  monthlyAverageCents: number;
  monthsTraded: number;
  monthsRemaining: number;
  /** Where the year lands if the average month repeats. */
  projectedCents: number;
}

export function forecastYear({
  receivedCents,
  outstandingCents,
  monthsTraded,
  monthsRemaining,
}: {
  receivedCents: number;
  outstandingCents: number;
  monthsTraded: number;
  monthsRemaining: number;
}): YearForecast {
  const committedCents = receivedCents + outstandingCents;
  // A business that started this month has no average to speak of yet, and
  // dividing by its zero months would be worse than admitting that.
  const monthlyAverageCents =
    monthsTraded > 0 ? Math.round(receivedCents / monthsTraded) : 0;

  return {
    receivedCents,
    outstandingCents,
    committedCents,
    monthlyAverageCents,
    monthsTraded,
    monthsRemaining,
    projectedCents: committedCents + monthlyAverageCents * Math.max(0, monthsRemaining),
  };
}

/**
 * How many months of the year the business actually traded, and how many are
 * left.
 *
 * Counted from the registration date rather than 1 January: averaging a
 * partial first year across months the business did not exist in would halve
 * the average and understate everything built on it. A year in the past has
 * nothing left to forecast.
 */
export function yearSpan({
  year,
  todayIso,
  startIso,
}: {
  year: number;
  todayIso: string;
  startIso: string | null;
}): { monthsTraded: number; monthsRemaining: number } {
  const thisYear = Number(todayIso.slice(0, 4));
  const thisMonth = Number(todayIso.slice(5, 7));

  const startsThisYear = startIso !== null && Number(startIso.slice(0, 4)) === year;
  const firstMonth = startsThisYear ? Number(startIso!.slice(5, 7)) : 1;

  // A year gone by is entirely known; a year not yet begun has nothing in it.
  if (year < thisYear) return { monthsTraded: 13 - firstMonth, monthsRemaining: 0 };
  if (year > thisYear) return { monthsTraded: 0, monthsRemaining: 0 };

  return {
    monthsTraded: Math.max(0, thisMonth - firstMonth + 1),
    monthsRemaining: 12 - thisMonth,
  };
}
