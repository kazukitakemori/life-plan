import { calcPeriodAnnualAmountFromMonthly } from './incomeAmount';
import type { IncomePeriod } from '../types/income';

export function nextPeriodStart(prev: {
  endAge: number;
  endMonth: number;
}): {
  startAge: number;
  startMonth: number;
} {
  let { endAge, endMonth } = prev;
  endMonth += 1;
  if (endMonth > 12) {
    endMonth = 1;
    endAge += 1;
  }
  return { startAge: endAge, startMonth: endMonth };
}

function cloneBonuses(period: IncomePeriod): IncomePeriod['bonuses'] {
  return period.bonuses.map((bonus) => ({
    ...bonus,
    id: crypto.randomUUID(),
  }));
}

export function createFollowUpPeriod(
  prev: IncomePeriod,
  id: string,
  maxEndAge = 90,
): IncomePeriod {
  const start = nextPeriodStart(prev);
  const endAge = Math.min(Math.max(start.startAge, prev.endAge + 5), maxEndAge);
  const bonuses = cloneBonuses(prev);
  const monthlyAmountMan = prev.monthlyAmountMan;
  const nextPeriod: IncomePeriod = {
    id,
    startAge: start.startAge,
    startMonth: start.startMonth,
    endAge,
    endMonth: prev.endMonth,
    streamType: prev.streamType,
    monthlyAmountMan,
    bonuses,
    annualAmountMan: 0,
    dependentStatus: prev.dependentStatus,
    taxDependent: prev.taxDependent,
    socialInsuranceDependent: prev.socialInsuranceDependent,
    spouseContingencyRate: prev.spouseContingencyRate,
    annualIncreaseRate: prev.annualIncreaseRate,
    lumpSumRestoreEndAge: null,
    lumpSumRestoreEndMonth: null,
  };
  return {
    ...nextPeriod,
    annualAmountMan: calcPeriodAnnualAmountFromMonthly(nextPeriod),
  };
}
