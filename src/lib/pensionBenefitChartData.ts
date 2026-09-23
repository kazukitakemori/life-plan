import { calcBirthYear } from './birthDate';
import { calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan } from './pensionIncome';
import { resolveSimulationStartYear } from './simulationTiming';
import {
  sumGeneralEmployeesDetail,
  sumOldAgeBasicDetail,
  sumPublicServantDetail,
} from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry } from '../types/income';
import type { PensionByMember, PensionMemberState } from '../types/pension';

export const PENSION_BENEFIT_CHART_END_AGE = 95;

export interface PensionBenefitChartPoint {
  calendarYear: number;
  headAge: number;
  spouseAge: null;
  oldAgeBasic: number;
  oldAgeEmployeesGeneral: number;
  oldAgeEmployeesPublic: number;
}

function roundMan(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildPensionBenefitChartPoints(input: {
  member: FamilyMember;
  memberState: PensionMemberState;
  incomeEntries: IncomeEntry[];
  familyMembers: FamilyMember[];
  pensionByMember: PensionByMember;
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  endAge?: number;
}): PensionBenefitChartPoint[] {
  const endAge = input.endAge ?? PENSION_BENEFIT_CHART_END_AGE;
  const birthYear = calcBirthYear(
    input.member.age,
    input.member.birthMonth,
    input.referenceDate,
  );
  const startYear = resolveSimulationStartYear(input.referenceDate);
  const endYear = birthYear + endAge;
  const points: PensionBenefitChartPoint[] = [];

  for (let year = startYear; year <= endYear; year++) {
    let basic = 0;
    let general = 0;
    let publicServant = 0;

    for (let month = 1; month <= 12; month++) {
      const oldAge =
        calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan(
          input.member,
          input.memberState,
          input.incomeEntries,
          input.familyMembers,
          input.pensionByMember,
          input.incomeByMember,
          input.referenceDate,
          year,
          month,
        ).oldAge;
      basic += sumOldAgeBasicDetail(oldAge.basic);
      general += sumGeneralEmployeesDetail(oldAge.generalEmployees);
      publicServant += sumPublicServantDetail(oldAge.publicServant);
    }

    points.push({
      calendarYear: year,
      headAge: year - birthYear,
      spouseAge: null,
      oldAgeBasic: roundMan(basic),
      oldAgeEmployeesGeneral: roundMan(general),
      oldAgeEmployeesPublic: roundMan(publicServant),
    });
  }

  return points;
}

export function sumPensionBenefitChartPoint(
  point: PensionBenefitChartPoint,
): number {
  return roundMan(
    point.oldAgeBasic +
      point.oldAgeEmployeesGeneral +
      point.oldAgeEmployeesPublic,
  );
}

export function firstReceivingYearTotalMan(
  points: PensionBenefitChartPoint[],
): number {
  for (const point of points) {
    const total = sumPensionBenefitChartPoint(point);
    if (total > 0) return total;
  }
  return 0;
}

export function peakPensionBenefitYearMan(
  points: PensionBenefitChartPoint[],
): number {
  let peak = 0;
  for (const point of points) {
    peak = Math.max(peak, sumPensionBenefitChartPoint(point));
  }
  return peak;
}

export function pensionBenefitAtAgeMan(
  points: PensionBenefitChartPoint[],
  age: number,
): number {
  const hit = points.find((p) => p.headAge === age);
  if (hit) return sumPensionBenefitChartPoint(hit);
  const later = points.find((p) => p.headAge >= age);
  return later ? sumPensionBenefitChartPoint(later) : 0;
}

export function hasAnyPensionBenefit(
  points: PensionBenefitChartPoint[],
): boolean {
  return points.some((p) => sumPensionBenefitChartPoint(p) > 0);
}
