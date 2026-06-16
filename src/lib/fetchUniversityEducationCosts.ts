import {
  buildUniversityFetchedAmounts,
  getUniversityFeeSchedule,
} from '../data/universityCostReference';
import { buildUniversityReferenceDetail } from './educationReferenceDetail';
import {
  resolveUniversityHousingType,
  SCHOOL_TYPE_LABELS,
} from './educationLabels';
import { getHeadAgeAtEducationStart } from './educationCostContext';
import { resolveResidencePeriodAtHeadAge } from './residenceAtAge';
import { getPrefectureByCode } from './taxSocialRegions';
import type { FamilyMember } from '../types/family';
import type { EducationExpenseEntry, FetchedEducationCosts } from '../types/education';
import type { TaxSocialState } from '../types/taxSocial';

export interface UniversityCostFetchInput {
  entry: EducationExpenseEntry;
  member: FamilyMember;
  headMember: FamilyMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
}

export function fetchUniversityEducationCosts(
  input: UniversityCostFetchInput,
): FetchedEducationCosts {
  const { entry, member, headMember, taxSocialState, referenceDate } = input;

  const headTiming = getHeadAgeAtEducationStart(headMember, member, entry, referenceDate);
  const residence = resolveResidencePeriodAtHeadAge(
    taxSocialState.residencePeriods,
    headTiming.age,
    headTiming.month,
  );

  const prefectureCode = residence?.prefectureCode ?? '40';
  const housingType = resolveUniversityHousingType(
    entry.schoolCategory,
    entry.universityHousingType,
  )!;
  const schedule = getUniversityFeeSchedule(entry.schoolType, housingType);
  const { tuitionAnnual, otherExpenses } = buildUniversityFetchedAmounts(schedule);

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
  costs.referenceDetail = buildUniversityReferenceDetail({
    areaLabel,
    schedule,
    costs,
    schoolType: entry.schoolType,
    schoolTypeLabel: SCHOOL_TYPE_LABELS[entry.schoolType] ?? entry.schoolType,
    housingType,
  });
  return costs;
}
