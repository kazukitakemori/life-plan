import type { ResidencePeriod } from '../types/taxSocial';

export function resolveResidencePeriodAtHeadAge(
  periods: ResidencePeriod[],
  headAge: number,
  headMonth: number,
): ResidencePeriod | undefined {
  if (periods.length === 0) return undefined;

  const sorted = [...periods].sort((a, b) => {
    if (a.startAge !== b.startAge) return a.startAge - b.startAge;
    return a.startMonth - b.startMonth;
  });

  let active = sorted[0];
  for (const period of sorted) {
    const startsBefore =
      period.startAge < headAge ||
      (period.startAge === headAge && period.startMonth <= headMonth);
    if (startsBefore) {
      active = period;
    } else {
      break;
    }
  }

  return active;
}
