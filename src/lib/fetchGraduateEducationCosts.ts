import {
  buildGraduateFetchedAmounts,
  getGraduateFeeSchedule,
} from '../data/graduateCostReference';
import { buildGraduateReferenceDetail } from './educationReferenceDetail';
import {
  resolveGraduateProgramType,
  resolveUniversityHousingType,
  SCHOOL_TYPE_LABELS,
} from './educationLabels';
import { getHeadAgeAtEducationStart } from './educationCostContext';
import { resolveResidencePeriodAtHeadAge } from './residenceAtAge';
import { getPrefectureByCode } from './taxSocialRegions';
import type { FamilyMember } from '../types/family';
import type { EducationExpenseEntry, FetchedEducationCosts } from '../types/education';
import type { TaxSocialState } from '../types/taxSocial';

export interface GraduateCostFetchInput {
  entry: EducationExpenseEntry;
  member: FamilyMember;
  headMember: FamilyMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
}

export function fetchGraduateEducationCosts(
  input: GraduateCostFetchInput,
): FetchedEducationCosts {
  const { entry, member, headMember, taxSocialState, referenceDate } = input;

  const headTiming = getHeadAgeAtEducationStart(headMember, member, entry, referenceDate);
  const residence = resolveResidencePeriodAtHeadAge(
    taxSocialState.residencePeriods,
    headTiming.age,
    headTiming.month,
  );

  const prefectureCode = residence?.prefectureCode ?? '40';
  const programType = resolveGraduateProgramType(
    entry.schoolCategory,
    entry.graduateProgramType,
  )!;
  const housingType = resolveUniversityHousingType(
    entry.schoolCategory,
    entry.universityHousingType,
  )!;
  const schedule = getGraduateFeeSchedule(
    entry.schoolType,
    programType,
    housingType,
  );
  const { tuitionAnnual, otherExpenses } = buildGraduateFetchedAmounts(schedule);

  const prefecture = getPrefectureByCode(prefectureCode);
  const areaLabel = prefecture?.name ?? '全国';

  const mappedOtherExpenses = otherExpenses.map((item) => ({
    label: item.label,
    enrollmentYear: item.enrollmentYear ?? 0,
    amount: item.amount,
    paymentCycle: item.paymentCycle,
  }));
  const sourceNote = `${areaLabel}／${schedule.sourceLabel}`;
  const costs: FetchedEducationCosts = {
    entranceFee: schedule.entranceFee,
    tuitionAnnual,
    tuitionPaymentCycle: 'semiannual',
    otherExpenses: mappedOtherExpenses,
    sourceNote,
    referenceDetail: {} as FetchedEducationCosts['referenceDetail'],
  };
  costs.referenceDetail = buildGraduateReferenceDetail({
    areaLabel,
    schedule,
    costs,
    schoolType: entry.schoolType,
    schoolTypeLabel: SCHOOL_TYPE_LABELS[entry.schoolType] ?? entry.schoolType,
    programType,
    housingType,
  });
  return costs;
}
