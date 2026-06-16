import {
  buildLicensedNurseryFetchedAmounts,
  buildUnlicensedNurseryFetchedAmounts,
  getNurseryFeeSchedule,
  NURSERY_EXTRACURRICULAR_EXPENSES,
} from '../data/nurseryCostReference';
import { getPrefectureByCode } from './taxSocialRegions';
import { createEducationOtherExpense } from './educationDefaults';
import {
  getChildBirthOrder,
  getMultiChildDiscount,
  getHeadAgeAtEducationStart,
  isNurseryInfantAge,
} from './educationCostContext';
import {
  buildLicensedNurseryReferenceDetail,
  buildUnlicensedNurseryReferenceDetail,
} from './educationReferenceDetail';
import {
  formatNurseryIncomeSourceNote,
  resolveNurseryHouseholdIncomeContext,
} from './nurseryHouseholdIncome';
import { resolveResidencePeriodAtHeadAge } from './residenceAtAge';
import type { FamilyMember } from '../types/family';
import type { EducationExpenseEntry, FetchedEducationCosts } from '../types/education';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { TaxSocialState } from '../types/taxSocial';

export interface NurseryCostFetchInput {
  entry: EducationExpenseEntry;
  member: FamilyMember;
  headMember: FamilyMember;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
}

export function fetchNurseryEducationCosts(
  input: NurseryCostFetchInput,
): FetchedEducationCosts {
  const {
    entry,
    member,
    headMember,
    familyMembers,
    incomeByMember,
    taxSocialState,
    referenceDate,
  } = input;

  // 在籍開始時点の世帯主年齢 → 居住地を特定
  const headTiming = getHeadAgeAtEducationStart(headMember, member, entry, referenceDate);
  const residence = resolveResidencePeriodAtHeadAge(
    taxSocialState.residencePeriods,
    headTiming.age,
    headTiming.month,
  );

  const prefectureCode = residence?.prefectureCode ?? '40';

  const schedule = getNurseryFeeSchedule(entry.schoolType);

  const prefecture = getPrefectureByCode(prefectureCode);
  const areaLabel = prefecture?.name ?? '全国';

  // ── 認可外：収入によらず施設への支払い総額をそのまま使用 ──────────────
  if (entry.schoolType === 'unlicensed_childcare') {
    const monthlyFee = isNurseryInfantAge(entry.startAge)
      ? schedule.monthlyTuition3go['D5']  // 認可外は全tier同額。代表値として参照
      : schedule.monthlyTuition2go;
    const { tuitionAnnual, otherExpenses: items } =
      buildUnlicensedNurseryFetchedAmounts(monthlyFee, schedule.snackMonthlyAmount);
    const otherExpenses = [
      ...items.map((item) => ({
        label: item.label,
        enrollmentYear: 0,
        amount: item.monthlyAmount,
        paymentCycle: 'monthly' as const,
      })),
      ...NURSERY_EXTRACURRICULAR_EXPENSES.map((item) => ({
        label: item.label,
        enrollmentYear: 0,
        amount: item.monthlyAmount,
        paymentCycle: 'monthly' as const,
      })),
    ];
    const sourceNote = `${areaLabel}／${schedule.sourceLabel}`;
    const costs: FetchedEducationCosts = {
      entranceFee: schedule.entranceFee,
      tuitionAnnual,
      tuitionPaymentCycle: 'monthly',
      otherExpenses,
      sourceNote,
      referenceDetail: {} as FetchedEducationCosts['referenceDetail'],
    };
    costs.referenceDetail = buildUnlicensedNurseryReferenceDetail({
      areaLabel,
      schedule,
      costs,
      isInfant: isNurseryInfantAge(entry.startAge),
      monthlyFee,
    });
    return costs;
  }

  // ── 認可：世帯の保育料階層（D1〜D10）を収入から推計 ───────────────────
  const incomeContext = resolveNurseryHouseholdIncomeContext({
    member,
    entry,
    familyMembers,
    incomeByMember,
    priorYearIncomeByMember: input.priorYearIncomeByMember,
    referenceDate,
  });

  const baseMonthlyFee = isNurseryInfantAge(entry.startAge)
    ? schedule.monthlyTuition3go[incomeContext.tier]
    : schedule.monthlyTuition2go;

  // ── 多子軽減（令和7年4月〜・所得制限なし）──────────────────────────
  // 0〜2歳の認可保育料のみ対象。3歳以上は既に無償化されているため影響なし。
  const birthOrder = getChildBirthOrder(member, familyMembers);
  const discount = isNurseryInfantAge(entry.startAge)
    ? getMultiChildDiscount(birthOrder)
    : 1.0;
  const monthlyFee = Math.round(baseMonthlyFee * discount);

  const { tuitionAnnual, otherExpenses: otherExpenseItems } =
    buildLicensedNurseryFetchedAmounts(monthlyFee, schedule.snackMonthlyAmount);

  const multiChildNote =
    birthOrder >= 3
      ? '（第3子以降・無償）'
      : birthOrder === 2
        ? '（第2子・半額）'
        : '';
  const incomeNote = `。${formatNurseryIncomeSourceNote(incomeContext)}${multiChildNote}`;

  const otherExpenses = [
    ...otherExpenseItems.map((item) => ({
      label: item.label,
      enrollmentYear: 0,
      amount: item.monthlyAmount,
      paymentCycle: 'monthly' as const,
    })),
    ...NURSERY_EXTRACURRICULAR_EXPENSES.map((item) => ({
      label: item.label,
      enrollmentYear: 0,
      amount: item.monthlyAmount,
      paymentCycle: 'monthly' as const,
    })),
  ];
  const sourceNote = `${areaLabel}／${schedule.sourceLabel}${incomeNote}`;
  const costs: FetchedEducationCosts = {
    entranceFee: schedule.entranceFee,
    tuitionAnnual,
    tuitionPaymentCycle: 'monthly',
    otherExpenses,
    sourceNote,
    referenceDetail: {} as FetchedEducationCosts['referenceDetail'],
  };
  costs.referenceDetail = buildLicensedNurseryReferenceDetail({
    areaLabel,
    schedule,
    costs,
    incomeContext,
    isInfant: isNurseryInfantAge(entry.startAge),
    birthOrder,
    baseMonthlyFee,
    discount,
    monthlyFee,
  });
  return costs;
}

export function applyFetchedEducationCosts(
  entry: EducationExpenseEntry,
  costs: FetchedEducationCosts,
): EducationExpenseEntry {
  return {
    ...entry,
    entranceFee: costs.entranceFee,
    tuitionAnnual: costs.tuitionAnnual,
    tuitionPaymentCycle: costs.tuitionPaymentCycle,
    otherExpenses: costs.otherExpenses.map((item) =>
      createEducationOtherExpense(item),
    ),
  };
}
