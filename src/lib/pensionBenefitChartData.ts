import { calcBirthYear } from './birthDate';
import { calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan } from './pensionIncome';
import {
  resolveSimulationMonthStart,
  resolveSimulationStartYear,
} from './simulationTiming';
import { calcPensionPaymentFromEntitlements } from './pensionPaymentSchedule';
import {
  createEmptyPensionBreakdown,
  sumGeneralEmployeesDetail,
  sumOldAgeBasicDetail,
  sumPublicServantDetail,
  type PensionBreakdown,
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
  familyAdditions: number;
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
    let familyAdditions = 0;

    const entitlements: PensionBreakdown[] = [];
    entitlements[0] =
      calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan(
        input.member,
        input.memberState,
        input.incomeEntries,
        input.familyMembers,
        input.pensionByMember,
        input.incomeByMember,
        input.referenceDate,
        year - 1,
        12,
      );

    for (let month = 1; month <= 12; month++) {
      entitlements[month] =
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
        );
    }

    const monthStart =
      year === startYear
        ? resolveSimulationMonthStart(input.referenceDate)
        : 1;

    for (let month = monthStart; month <= 12; month++) {
      const payment = calcPensionPaymentFromEntitlements(
        month,
        entitlements[month - 1] ?? createEmptyPensionBreakdown(),
        entitlements[month - 2] ?? createEmptyPensionBreakdown(),
      );
      const oldAge = payment.oldAge;
      basic += sumOldAgeBasicDetail(oldAge.basic);
      general += sumGeneralEmployeesDetail(oldAge.generalEmployees);
      publicServant += sumPublicServantDetail(oldAge.publicServant);
      familyAdditions +=
        oldAge.basic.children +
        oldAge.basic.transfer +
        oldAge.generalEmployees.dependent +
        oldAge.publicServant.dependent;
    }

    points.push({
      calendarYear: year,
      headAge: year - birthYear,
      spouseAge: null,
      oldAgeBasic: roundMan(basic),
      oldAgeEmployeesGeneral: roundMan(general),
      oldAgeEmployeesPublic: roundMan(publicServant),
      familyAdditions: roundMan(familyAdditions),
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
