import {
  buildHighSchoolFetchedAmounts,
  getHighSchoolFeeSchedule,
} from '../data/highSchoolCostReference';
import { buildHighSchoolReferenceDetail } from './educationReferenceDetail';
import { SCHOOL_TYPE_LABELS } from './educationLabels';
import { getHeadAgeAtEducationStart } from './educationCostContext';
import { resolveResidencePeriodAtHeadAge } from './residenceAtAge';
import { getPrefectureByCode } from './taxSocialRegions';
import type { FamilyMember } from '../types/family';
import type { EducationExpenseEntry, FetchedEducationCosts } from '../types/education';
import type { TaxSocialState } from '../types/taxSocial';

export interface HighSchoolCostFetchInput {
  entry: EducationExpenseEntry;
  member: FamilyMember;
  headMember: FamilyMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
}

export function fetchHighSchoolEducationCosts(
  input: HighSchoolCostFetchInput,
): FetchedEducationCosts {
  const { entry, member, headMember, taxSocialState, referenceDate } = input;

  const headTiming = getHeadAgeAtEducationStart(headMember, member, entry, referenceDate);
  const residence = resolveResidencePeriodAtHeadAge(
    taxSocialState.residencePeriods,
    headTiming.age,
    headTiming.month,
  );

  const prefectureCode = residence?.prefectureCode ?? '40';
  const schedule = getHighSchoolFeeSchedule(entry.schoolType);
  const { tuitionAnnual, otherExpenses } = buildHighSchoolFetchedAmounts(schedule);

  const prefecture = getPrefectureByCode(prefectureCode);
  const areaLabel = prefecture?.name ?? '全国';

  const mappedOtherExpenses = otherExpenses.map((item) => ({
    label: item.label,
    enrollmentYear: 0,
    amount: item.amount,
    paymentCycle: item.paymentCycle,
  }));
  const sourceNote = `${areaLabel}／${schedule.sourceLabel}`;
  const costs: FetchedEducationCosts = {
    entranceFee: schedule.entranceFee,
    tuitionAnnual,
    tuitionPaymentCycle: 'monthly',
    otherExpenses: mappedOtherExpenses,
    sourceNote,
    referenceDetail: {} as FetchedEducationCosts['referenceDetail'],
  };
  costs.referenceDetail = buildHighSchoolReferenceDetail({
    areaLabel,
    schedule,
    costs,
    schoolType: entry.schoolType,
    schoolTypeLabel: SCHOOL_TYPE_LABELS[entry.schoolType] ?? entry.schoolType,
  });
  return costs;
}
