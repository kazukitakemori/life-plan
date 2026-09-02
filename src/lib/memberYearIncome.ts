import { resolveMemberBirthMonth } from './familyDefaults';
import {
  calcBirthYear,
  absoluteMonthIndexFromPeriodAgeMonth,
  isAgeCalendarMonthInRange,
} from './birthDate';
import {
  calcBusinessIncomeBreakdownYenFromPairs,
  calcPeriodGrossRevenueMan,
  calcSalaryBreakdownYenFromPairs,
  calcTotalIncomeManFromProfile,
  type BusinessIncomeBreakdownYen,
} from './incomeTaxDeductions';
import {
  calcCombinedIncomeFromPairs,
  type EntryPeriodPair,
} from './memberCombinedIncome';
import {
  isTaxFreeIncome,
  resolveBonusStreamKey,
  resolveOtherIncomeKey,
  resolveSalaryStreamKey,
  treatsPeriodAsBusinessIncome,
  treatsPeriodAsSalaryIncome,
} from './incomeBreakdown';
import {
  clampPeriodDependentToMember,
  getMemberDependentDefaults,
  usesQ1DependentDefaults,
} from './memberDependentDefaults';
import { resolveAutoPeriodDependent } from './periodDependentResolution';
import {
  BONUS_PAYMENT_COUNT_THRESHOLD,
  capHealthStandardBonusTotalYen,
  resolveHealthStandardRemunerationYen,
  resolvePensionStandardBonusYen,
  resolvePensionStandardRemunerationYen,
  truncateStandardBonusYen,
} from './standardRemuneration';
import type { FamilyMember } from '../types/family';
import type {
  DependentStatus,
  FilingType,
  IncomeCategory,
  IncomeEntry,
  IncomePeriod,
  IncomeStreamType,
} from '../types/income';

const MAN_TO_YEN = 10_000;

export interface SalaryBonusBreakdownOptions {
  /**
   * 選択型DC加入者掛金（万円／暦月）。
   * 標準報酬月額の算定報酬からのみ控除する（給与所得の年額は減らない）。
   */
  selectiveDcManForMonth?: (calendarMonth: number) => number;
}

function yearsElapsedSince(
  birthYear: number,
  _birthMonth: number | null | undefined,
  fromAge: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): number {
  const fromMonths = absoluteMonthIndexFromPeriodAgeMonth(
    birthYear,
    fromAge,
    fromMonth,
  );
  const toMonths = toYear * 12 + toMonth;
  return Math.max(0, Math.floor((toMonths - fromMonths) / 12));
}

function getMemberAgeMonth(
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): { age: number; month: number } | null {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  let age = calendarYear - birthYear;
  if (calendarMonth < resolveMemberBirthMonth(member)) {
    age -= 1;
  }
  if (age < 0) {
    return null;
  }
  return { age, month: calendarMonth };
}

function getPeriodIncomeFactor(
  period: IncomePeriod,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;
  if (
    !isAgeCalendarMonthInRange(
      ageMonth.age,
      ageMonth.month,
      period.startAge,
      period.startMonth,
      period.endAge,
      period.endMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
  ) {
    return 0;
  }

  const yearsElapsed = yearsElapsedSince(
    birthYear,
    member.birthMonth,
    period.startAge,
    period.startMonth,
    calendarYear,
    calendarMonth,
  );

  const increaseRate = period.annualIncreaseRate ?? 0;
  return Math.pow(1 + increaseRate / 100, yearsElapsed);
}

function calcPeriodGrossIncomeManForMonth(
  entry: IncomeEntry,
  period: IncomePeriod,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const factor = getPeriodIncomeFactor(
    period,
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (factor === 0) return 0;

  if (isTaxFreeIncome(entry.category, period.streamType)) {
    return 0;
  }

  let monthlyMan = 0;

  if (treatsPeriodAsSalaryIncome(entry.category, period.streamType)) {
    const salaryKey = resolveSalaryStreamKey(period.streamType);
    if (salaryKey) {
      monthlyMan += Math.max(0, period.monthlyAmountMan * factor);
    }
    const bonusKey = resolveBonusStreamKey(period.streamType);
    if (bonusKey) {
      for (const bonus of period.bonuses) {
        if (bonus.paymentMonth === calendarMonth) {
          monthlyMan += bonus.amountMan * factor;
        }
      }
    }
    return monthlyMan;
  }

  const otherKey = resolveOtherIncomeKey(entry.category, period.streamType);
  if (!otherKey) return 0;

  let grossMan = period.monthlyAmountMan * factor;
  if (
    treatsPeriodAsBusinessIncome(entry.category, period.streamType) &&
    entry.expenseManPerMonth != null
  ) {
    grossMan -= entry.expenseManPerMonth * factor;
  }
  return Math.max(0, grossMan);
}

export interface ActiveIncomeSlice {
  entry: IncomeEntry;
  period: IncomePeriod;
  grossIncomeMan: number;
}

export interface MemberYearIncomeProfile {
  grossIncomeMan: number;
  /** 額面収入（経費控除前・万円） */
  grossRevenueMan: number;
  /** 年間経費（万円） */
  annualExpenseMan: number;
  /** 税務上の合計所得金額（万円） */
  totalIncomeMan: number;
  /** 課税計算用の合計所得金額（万円・雑所得20万円以下特例反映） */
  taxableIncomeMan: number;
  dependentStatus: DependentStatus;
  taxDependent: boolean;
  socialInsuranceDependent: boolean;
  category: IncomeCategory | null;
  streamType: IncomeStreamType | null;
  filingType: FilingType | null;
  hasActiveIncomeBlock: boolean;
}

export function collectActiveIncomeSlices(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
  monthStart = 1,
  monthEnd = 12,
): ActiveIncomeSlice[] {
  const activeSlices: ActiveIncomeSlice[] = [];

  for (let month = monthStart; month <= monthEnd; month++) {
    for (const entry of entries) {
      for (const period of entry.periods) {
        const grossIncomeMan = calcPeriodGrossIncomeManForMonth(
          entry,
          period,
          member,
          referenceDate,
          calendarYear,
          month,
        );
        if (grossIncomeMan > 0) {
          activeSlices.push({ entry, period, grossIncomeMan });
        }
      }
    }
  }

  return activeSlices;
}

/** 暦年の一部月のみ収入がある場合、実際の額面に基づいて所得を算出する */
function calcIncomeFromActiveSlices(
  activeSlices: ActiveIncomeSlice[],
  uniquePairs: EntryPeriodPair[],
  calendarYear: number,
): { totalIncomeMan: number; taxableIncomeMan: number } {
  const hasSalaryIncome = uniquePairs.some(({ entry, period }) =>
    treatsPeriodAsSalaryIncome(entry.category, period.streamType),
  );

  const grossRevenueByPair = new Map<string, number>();
  for (const slice of activeSlices) {
    const key = `${slice.entry.id}:${slice.period.id}`;
    grossRevenueByPair.set(
      key,
      (grossRevenueByPair.get(key) ?? 0) + slice.grossIncomeMan,
    );
  }

  let totalIncomeMan = 0;
  let taxableIncomeMan = 0;

  for (const { entry, period } of uniquePairs) {
    const key = `${entry.id}:${period.id}`;
    const grossRevenueMan = grossRevenueByPair.get(key) ?? 0;
    if (grossRevenueMan <= 0) continue;

    const isBusiness = treatsPeriodAsBusinessIncome(
      entry.category,
      period.streamType,
    );
    const isSalary = treatsPeriodAsSalaryIncome(entry.category, period.streamType);
    const fullYearGrossMan = calcPeriodGrossRevenueMan(period);
    const expenseScale =
      isBusiness && fullYearGrossMan > 0
        ? grossRevenueMan / fullYearGrossMan
        : 0;
    const annualExpenseMan = isBusiness
      ? (entry.expenseManPerMonth ?? 0) * 12 * expenseScale
      : 0;

    const periodTotalIncomeMan = calcTotalIncomeManFromProfile({
      grossRevenueMan,
      annualExpenseMan,
      category: isBusiness
        ? 'self_employed'
        : isSalary
          ? 'employee'
          : entry.category,
      filingType: isBusiness ? entry.filingType : null,
      calendarYear,
    });

    totalIncomeMan += periodTotalIncomeMan;

    const grossRevenueYen = Math.round(grossRevenueMan * 10_000);
    if (
      hasSalaryIncome &&
      period.streamType === 'miscellaneous_income' &&
      grossRevenueYen <= 200_000
    ) {
      continue;
    }
    taxableIncomeMan += periodTotalIncomeMan;
  }

  return { totalIncomeMan, taxableIncomeMan };
}

/**
 * 指定暦年のいずれかの月で収入がある entry/period ペア（重複除去）。
 * 将来・過去の別キャリア期間は含めない。
 */
export function collectIncomePeriodPairsActiveInCalendarYear(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
): EntryPeriodPair[] {
  const activeSlices = collectActiveIncomeSlices(
    member,
    entries,
    referenceDate,
    calendarYear,
    1,
    12,
  );
  const seen = new Set<string>();
  const pairs: EntryPeriodPair[] = [];
  for (const slice of activeSlices) {
    const key = `${slice.entry.id}:${slice.period.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ entry: slice.entry, period: slice.period });
  }
  return pairs;
}

/**
 * 当該暦年の年額読み替え（annualize）を使わず、暦月実績にすべきか。
 *
 * 有効な収入期間が2つ以上ある年（給与→事業、給与→給与、事業→事業、通年併存など）は、
 * 各期間の12か月年額を合算すると実収入の約2倍になるため月次へフォールバックする。
 * 単一期間のみの年は継続収入の12か月年額読み替えを継続する。
 */
export function shouldUseMonthlyIncomeInsteadOfAnnualBasis(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
): boolean {
  const pairs = collectIncomePeriodPairsActiveInCalendarYear(
    member,
    entries,
    referenceDate,
    calendarYear,
  );
  return pairs.length > 1;
}

/**
 * @deprecated {@link shouldUseMonthlyIncomeInsteadOfAnnualBasis} を使用してください。
 * 給与と事業の併存だけでなく、同種の年中切替も含む判定に置き換わりました。
 */
export function isCareerChangeYearIncome(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
): boolean {
  return shouldUseMonthlyIncomeInsteadOfAnnualBasis(
    member,
    entries,
    referenceDate,
    calendarYear,
  );
}

/**
 * 税計算用の給与年収。当該暦年に有効な給与期間のみ。
 * annualize=true なら期間の12か月年額（継続収入の読み替え）、false なら暦月実績。
 */
export function calcMemberSalaryBreakdownYenForTaxYear(input: {
  member: FamilyMember;
  entries: IncomeEntry[];
  referenceDate: Date;
  calendarYear: number;
  annualize: boolean;
}): { grossSalaryRevenueYen: number; salaryIncomeYen: number } {
  if (!input.annualize) {
    const activeSlices = collectActiveIncomeSlices(
      input.member,
      input.entries,
      input.referenceDate,
      input.calendarYear,
      1,
      12,
    );
    const salarySlices = activeSlices.filter(({ entry, period }) =>
      treatsPeriodAsSalaryIncome(entry.category, period.streamType),
    );
    if (salarySlices.length === 0) {
      return { grossSalaryRevenueYen: 0, salaryIncomeYen: 0 };
    }
    const seen = new Set<string>();
    const uniquePairs: EntryPeriodPair[] = [];
    for (const slice of salarySlices) {
      const key = `${slice.entry.id}:${slice.period.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniquePairs.push({ entry: slice.entry, period: slice.period });
    }
    const { totalIncomeMan } = calcIncomeFromActiveSlices(
      salarySlices,
      uniquePairs,
      input.calendarYear,
    );
    const grossSalaryRevenueYen = Math.round(
      salarySlices.reduce((sum, s) => sum + s.grossIncomeMan, 0) * MAN_TO_YEN,
    );
    return {
      grossSalaryRevenueYen,
      salaryIncomeYen: Math.round(totalIncomeMan * MAN_TO_YEN),
    };
  }

  if (
    shouldUseMonthlyIncomeInsteadOfAnnualBasis(
      input.member,
      input.entries,
      input.referenceDate,
      input.calendarYear,
    )
  ) {
    return calcMemberSalaryBreakdownYenForTaxYear({
      ...input,
      annualize: false,
    });
  }

  const pairs = collectIncomePeriodPairsActiveInCalendarYear(
    input.member,
    input.entries,
    input.referenceDate,
    input.calendarYear,
  ).filter(({ entry, period }) =>
    treatsPeriodAsSalaryIncome(entry.category, period.streamType),
  );
  return calcSalaryBreakdownYenFromPairs(pairs, input.calendarYear);
}

/**
 * 税計算用の事業所得内訳。当該暦年に有効な事業期間のみ。
 */
export function calcMemberBusinessIncomeBreakdownYenForTaxYear(input: {
  member: FamilyMember;
  entries: IncomeEntry[];
  referenceDate: Date;
  calendarYear: number;
  annualize: boolean;
}): BusinessIncomeBreakdownYen | null {
  if (
    input.annualize &&
    shouldUseMonthlyIncomeInsteadOfAnnualBasis(
      input.member,
      input.entries,
      input.referenceDate,
      input.calendarYear,
    )
  ) {
    return calcMemberBusinessIncomeBreakdownYenForTaxYear({
      ...input,
      annualize: false,
    });
  }

  if (!input.annualize) {
    const activeSlices = collectActiveIncomeSlices(
      input.member,
      input.entries,
      input.referenceDate,
      input.calendarYear,
      1,
      12,
    );
    const businessSlices = activeSlices.filter(({ entry, period }) =>
      treatsPeriodAsBusinessIncome(entry.category, period.streamType),
    );
    if (businessSlices.length === 0) return null;

    const seen = new Set<string>();
    const uniquePairs: EntryPeriodPair[] = [];
    for (const slice of businessSlices) {
      const key = `${slice.entry.id}:${slice.period.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniquePairs.push({ entry: slice.entry, period: slice.period });
    }

    let grossRevenueYen = 0;
    let annualExpenseYen = 0;
    let businessIncomeYen = 0;
    const grossByPair = new Map<string, number>();
    for (const slice of businessSlices) {
      const key = `${slice.entry.id}:${slice.period.id}`;
      grossByPair.set(key, (grossByPair.get(key) ?? 0) + slice.grossIncomeMan);
    }
    for (const { entry, period } of uniquePairs) {
      const key = `${entry.id}:${period.id}`;
      const grossRevenueMan = grossByPair.get(key) ?? 0;
      if (grossRevenueMan <= 0) continue;
      const fullYearGrossMan = calcPeriodGrossRevenueMan(period);
      const expenseScale =
        fullYearGrossMan > 0 ? grossRevenueMan / fullYearGrossMan : 0;
      const annualExpenseMan =
        (entry.expenseManPerMonth ?? 0) * 12 * expenseScale;
      const periodIncomeMan = calcTotalIncomeManFromProfile({
        grossRevenueMan,
        annualExpenseMan,
        category: 'self_employed',
        filingType: entry.filingType,
        calendarYear: input.calendarYear,
      });
      grossRevenueYen += Math.round(grossRevenueMan * MAN_TO_YEN);
      annualExpenseYen += Math.round(annualExpenseMan * MAN_TO_YEN);
      businessIncomeYen += Math.round(periodIncomeMan * MAN_TO_YEN);
    }
    if (grossRevenueYen <= 0) return null;
    return {
      grossRevenueYen,
      annualExpenseYen,
      filingDeductionYen: Math.max(
        0,
        grossRevenueYen - annualExpenseYen - businessIncomeYen,
      ),
      businessIncomeYen,
    };
  }

  const pairs = collectIncomePeriodPairsActiveInCalendarYear(
    input.member,
    input.entries,
    input.referenceDate,
    input.calendarYear,
  );
  return calcBusinessIncomeBreakdownYenFromPairs(pairs, input.calendarYear);
}

/**
 * 所得税の年収（給与）と同じ期間ベース年額で所得プロファイルを組み立てる。
 * 前年所得の読み替え（current_year_proxy）で使用する。
 *
 * 当該暦年に有効な期間だけを対象にする（将来の事業期間などを合算しない）。
 * 同一暦年に複数期間がある年（キャリア切替・同種の年中切替・併存）は暦月実績にフォールバックする。
 */
export function buildMemberIncomeProfileFromIncomeTaxAnnualBasis(
  member: FamilyMember,
  entries: IncomeEntry[],
  calendarYear = 2026,
  referenceDate?: Date,
): MemberYearIncomeProfile | null {
  if (!referenceDate) {
    // 呼び出し側が referenceDate を渡さない場合は暦年1/1を仮置き（年齢換算は不正確になり得る）
    referenceDate = new Date(calendarYear, 0, 1);
  }

  if (
    shouldUseMonthlyIncomeInsteadOfAnnualBasis(
      member,
      entries,
      referenceDate,
      calendarYear,
    )
  ) {
    return resolveMemberYearIncomeProfile(
      member,
      entries,
      referenceDate,
      calendarYear,
      1,
      12,
    );
  }

  const pairs = collectIncomePeriodPairsActiveInCalendarYear(
    member,
    entries,
    referenceDate,
    calendarYear,
  );
  if (pairs.length === 0) {
    return null;
  }

  const salaryBreakdown = calcSalaryBreakdownYenFromPairs(
    pairs.filter(({ entry, period }) =>
      treatsPeriodAsSalaryIncome(entry.category, period.streamType),
    ),
    calendarYear,
  );
  const { totalIncomeMan, taxableIncomeMan } =
    calcCombinedIncomeFromPairs(pairs, calendarYear);
  const grossRevenueMan = pairs.reduce(
    (sum, { period }) => sum + calcPeriodGrossRevenueMan(period),
    0,
  );
  const grossIncomeMan =
    salaryBreakdown.grossSalaryRevenueYen > 0
      ? salaryBreakdown.grossSalaryRevenueYen / MAN_TO_YEN
      : grossRevenueMan;

  const dominant = pairs.reduce((best, pair) =>
    calcPeriodGrossRevenueMan(pair.period) >
    calcPeriodGrossRevenueMan(best.period)
      ? pair
      : best,
  );
  const isBusiness = treatsPeriodAsBusinessIncome(
    dominant.entry.category,
    dominant.period.streamType,
  );
  const annualExpenseMan = isBusiness
    ? (dominant.entry.expenseManPerMonth ?? 0) * 12
    : 0;

  let dependentStatus: DependentStatus = 'none';
  let taxDependent = false;
  let socialInsuranceDependent = false;
  for (const { entry, period } of pairs) {
    const clamped = usesQ1DependentDefaults(member)
      ? clampPeriodDependentToMember(period, member)
      : period;
    if (clamped.dependentStatus !== 'dependent') continue;
    dependentStatus = 'dependent';
    const resolved = resolveAutoPeriodDependent(
      member,
      entry,
      clamped,
      entries,
      calendarYear,
    );
    if (resolved.taxDependent) taxDependent = true;
    if (resolved.socialInsuranceDependent) socialInsuranceDependent = true;
  }

  return {
    grossIncomeMan,
    grossRevenueMan,
    annualExpenseMan,
    totalIncomeMan,
    taxableIncomeMan,
    dependentStatus,
    taxDependent:
      dependentStatus === 'dependent' ? taxDependent : false,
    socialInsuranceDependent:
      dependentStatus === 'dependent' ? socialInsuranceDependent : false,
    category: dominant.entry.category,
    streamType: dominant.period.streamType,
    filingType: dominant.entry.filingType,
    hasActiveIncomeBlock: true,
  };
}

export function resolveMemberYearIncomeProfile(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
  monthStart = 1,
  monthEnd = 12,
): MemberYearIncomeProfile {
  const activeSlices = collectActiveIncomeSlices(
    member,
    entries,
    referenceDate,
    calendarYear,
    monthStart,
    monthEnd,
  );

  if (activeSlices.length === 0) {
    return {
      grossIncomeMan: 0,
      grossRevenueMan: 0,
      annualExpenseMan: 0,
      totalIncomeMan: 0,
      taxableIncomeMan: 0,
      ...getMemberDependentDefaults(member),
      category: null,
      streamType: null,
      filingType: null,
      hasActiveIncomeBlock: false,
    };
  }

  const grossIncomeMan = activeSlices.reduce(
    (sum, slice) => sum + slice.grossIncomeMan,
    0,
  );

  const dominantSlice = activeSlices.reduce((best, slice) =>
    slice.grossIncomeMan > best.grossIncomeMan ? slice : best,
  );

  const seenPairs = new Set<string>();
  const uniquePairs: EntryPeriodPair[] = [];
  for (const slice of activeSlices) {
    const key = `${slice.entry.id}:${slice.period.id}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    uniquePairs.push({ entry: slice.entry, period: slice.period });
  }

  const { totalIncomeMan, taxableIncomeMan } =
    calcIncomeFromActiveSlices(activeSlices, uniquePairs, calendarYear);

  let dependentStatus: DependentStatus = 'none';
  let taxDependent = false;
  let socialInsuranceDependent = false;
  for (const { entry, period } of uniquePairs) {
    const clamped = usesQ1DependentDefaults(member)
      ? clampPeriodDependentToMember(period, member)
      : period;
    if (clamped.dependentStatus !== 'dependent') continue;
    dependentStatus = 'dependent';
    const resolved = resolveAutoPeriodDependent(
      member,
      entry,
      clamped,
      entries,
      calendarYear,
    );
    if (resolved.taxDependent) taxDependent = true;
    if (resolved.socialInsuranceDependent) socialInsuranceDependent = true;
  }

  const isBusiness = treatsPeriodAsBusinessIncome(
    dominantSlice.entry.category,
    dominantSlice.period.streamType,
  );
  const fullYearGrossMan = calcPeriodGrossRevenueMan(dominantSlice.period);
  const expenseScale =
    isBusiness && fullYearGrossMan > 0 ? grossIncomeMan / fullYearGrossMan : 0;
  const annualExpenseMan = isBusiness
    ? (dominantSlice.entry.expenseManPerMonth ?? 0) * 12 * expenseScale
    : 0;

  return {
    grossIncomeMan,
    grossRevenueMan: grossIncomeMan,
    annualExpenseMan,
    totalIncomeMan,
    taxableIncomeMan,
    dependentStatus,
    taxDependent:
      dependentStatus === 'dependent' ? taxDependent : false,
    socialInsuranceDependent:
      dependentStatus === 'dependent' ? socialInsuranceDependent : false,
    category: dominantSlice.entry.category,
    streamType: dominantSlice.period.streamType,
    filingType: dominantSlice.entry.filingType,
    hasActiveIncomeBlock: true,
  };
}

export function getMemberAgeAtYearEnd(
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
): number | null {
  return getMemberAgeMonth(member, referenceDate, calendarYear, 12)?.age ?? null;
}

export interface MonthlyRemunerationBreakdownYen {
  month: number;
  remunerationYen: number;
  standardHealthYen: number;
  standardPensionYen: number;
}

export interface BonusPaymentBreakdownYen {
  month: number;
  remunerationYen: number;
  standardHealthYen: number;
  standardPensionYen: number;
}

export interface MemberSalaryBonusBreakdownYen {
  annualSalaryYen: number;
  annualBonusYen: number;
  /** 厚生年金用の代表標準報酬月額（主たる月の等級） */
  standardMonthlyRemunerationYen: number;
  /** 健康保険用の代表標準報酬月額 */
  standardMonthlyRemunerationHealthYen: number;
  monthlyRemunerations: MonthlyRemunerationBreakdownYen[];
  bonusPayments: BonusPaymentBreakdownYen[];
  standardHealthBonusTotalYen: number;
  /** 年間の賞与支給回数 */
  bonusPaymentCount: number;
  /** 4回以上のため賞与を毎月の報酬に按分している */
  bonusTreatedAsRemuneration: boolean;
  /** 按分時の月あたり賞与額（円） */
  monthlyBonusShareYen: number;
}

function distributeAnnualBonusToMonthsYen(
  annualBonusYen: number,
  monthStart: number,
  monthEnd: number,
): Map<number, number> {
  const monthCount = monthEnd - monthStart + 1;
  if (monthCount <= 0 || annualBonusYen <= 0) return new Map();

  const baseShare = Math.floor(annualBonusYen / monthCount);
  let remainder = annualBonusYen - baseShare * monthCount;
  const shares = new Map<number, number>();

  for (let month = monthStart; month <= monthEnd; month++) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    shares.set(month, baseShare + extra);
  }

  return shares;
}

function pickRepresentativeStandardYen(
  monthlyRemunerations: MonthlyRemunerationBreakdownYen[],
  field: 'standardPensionYen' | 'standardHealthYen',
): number {
  if (monthlyRemunerations.length === 0) return 0;
  const dominant = monthlyRemunerations.reduce((best, current) =>
    current.remunerationYen > best.remunerationYen ? current : best,
  );
  return dominant[field];
}

function buildMonthlyRemunerationsFromSalaryMap(
  monthlySalaryYen: Map<number, number>,
  monthStart: number,
  monthEnd: number,
  options?: SalaryBonusBreakdownOptions,
): MonthlyRemunerationBreakdownYen[] {
  const monthlyRemunerations: MonthlyRemunerationBreakdownYen[] = [];
  for (let month = monthStart; month <= monthEnd; month++) {
    const grossYen = monthlySalaryYen.get(month) ?? 0;
    const selectiveDcYen = Math.round(
      Math.max(0, options?.selectiveDcManForMonth?.(month) ?? 0) * MAN_TO_YEN,
    );
    const remunerationYen = Math.max(0, grossYen - selectiveDcYen);
    if (remunerationYen <= 0 && grossYen <= 0) continue;
    if (remunerationYen <= 0) continue;
    monthlyRemunerations.push({
      month,
      remunerationYen,
      standardHealthYen: resolveHealthStandardRemunerationYen(remunerationYen),
      standardPensionYen: resolvePensionStandardRemunerationYen(remunerationYen),
    });
  }
  return monthlyRemunerations;
}

/** 給与収入を月額・賞与に分けて年額（円）で返す。社会保険料の内訳表示に使用。 */
export function calcMemberSalaryBonusBreakdownYen(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
  monthStart = 1,
  monthEnd = 12,
  options?: SalaryBonusBreakdownOptions,
): MemberSalaryBonusBreakdownYen {
  let annualSalaryYen = 0;
  let annualBonusYen = 0;
  const monthlySalaryYen = new Map<number, number>();
  const bonusPayments: BonusPaymentBreakdownYen[] = [];

  for (let month = monthStart; month <= monthEnd; month++) {
    for (const entry of entries) {
      for (const period of entry.periods) {
        if (isTaxFreeIncome(entry.category, period.streamType)) continue;
        if (!treatsPeriodAsSalaryIncome(entry.category, period.streamType)) {
          continue;
        }

        const factor = getPeriodIncomeFactor(
          period,
          member,
          referenceDate,
          calendarYear,
          month,
        );
        if (factor === 0) continue;

        if (resolveSalaryStreamKey(period.streamType)) {
          const salaryYen = Math.round(
            period.monthlyAmountMan * factor * MAN_TO_YEN,
          );
          annualSalaryYen += salaryYen;
          monthlySalaryYen.set(
            month,
            (monthlySalaryYen.get(month) ?? 0) + salaryYen,
          );
        }
        if (resolveBonusStreamKey(period.streamType)) {
          for (const bonus of period.bonuses) {
            if (bonus.paymentMonth === month) {
              const bonusYen = Math.round(bonus.amountMan * factor * MAN_TO_YEN);
              annualBonusYen += bonusYen;
              bonusPayments.push({
                month,
                remunerationYen: bonusYen,
                standardHealthYen: truncateStandardBonusYen(bonusYen),
                standardPensionYen: resolvePensionStandardBonusYen(bonusYen),
              });
            }
          }
        }
      }
    }
  }

  const bonusPaymentCount = bonusPayments.length;
  const bonusTreatedAsRemuneration =
    bonusPaymentCount >= BONUS_PAYMENT_COUNT_THRESHOLD && annualBonusYen > 0;
  let monthlyBonusShareYen = 0;

  if (bonusTreatedAsRemuneration) {
    const bonusShares = distributeAnnualBonusToMonthsYen(
      annualBonusYen,
      monthStart,
      monthEnd,
    );
    monthlyBonusShareYen = bonusShares.get(monthStart) ?? 0;
    for (const [month, shareYen] of bonusShares) {
      monthlySalaryYen.set(month, (monthlySalaryYen.get(month) ?? 0) + shareYen);
    }
  }

  const monthlyRemunerations = buildMonthlyRemunerationsFromSalaryMap(
    monthlySalaryYen,
    monthStart,
    monthEnd,
    options,
  );

  const standardHealthBonusTotalYen = bonusTreatedAsRemuneration
    ? 0
    : capHealthStandardBonusTotalYen(
        bonusPayments.reduce((sum, payment) => sum + payment.standardHealthYen, 0),
      );

  return {
    annualSalaryYen,
    annualBonusYen,
    standardMonthlyRemunerationYen: pickRepresentativeStandardYen(
      monthlyRemunerations,
      'standardPensionYen',
    ),
    standardMonthlyRemunerationHealthYen: pickRepresentativeStandardYen(
      monthlyRemunerations,
      'standardHealthYen',
    ),
    monthlyRemunerations,
    bonusPayments: bonusTreatedAsRemuneration ? [] : bonusPayments,
    standardHealthBonusTotalYen,
    bonusPaymentCount,
    bonusTreatedAsRemuneration,
    monthlyBonusShareYen,
  };
}

/**
 * Q7の12か月給与・賞与を暦年に依存せず12か月分に展開する。
 * 年収ベース（前年所得の読み替え等）の社会保険料試算に使用。
 *
 * 同一暦年に複数の収入期間がある場合は呼び出さず、
 * {@link calcMemberSalaryBonusBreakdownYen}（暦月実績）を使うこと。
 * @param activePairs 指定時はそのペアに含まれる給与期間のみ（将来期間の混入防止）
 */
export function buildQ7AnnualSalaryBonusSplitYen(
  entries: IncomeEntry[],
  activePairs?: EntryPeriodPair[],
  options?: SalaryBonusBreakdownOptions,
): MemberSalaryBonusBreakdownYen | null {
  let annualSalaryYen = 0;
  let annualBonusYen = 0;
  const monthlySalaryYen = new Map<number, number>();
  const bonusPayments: BonusPaymentBreakdownYen[] = [];

  const pairKeySet =
    activePairs != null
      ? new Set(activePairs.map(({ entry, period }) => `${entry.id}:${period.id}`))
      : null;

  for (const entry of entries) {
    for (const period of entry.periods) {
      if (pairKeySet && !pairKeySet.has(`${entry.id}:${period.id}`)) {
        continue;
      }
      if (isTaxFreeIncome(entry.category, period.streamType)) continue;
      if (!treatsPeriodAsSalaryIncome(entry.category, period.streamType)) {
        continue;
      }
      if (calcPeriodGrossRevenueMan(period) <= 0) continue;

      if (resolveSalaryStreamKey(period.streamType)) {
        const salaryYen = Math.round(period.monthlyAmountMan * MAN_TO_YEN);
        annualSalaryYen += salaryYen * 12;
        for (let month = 1; month <= 12; month++) {
          monthlySalaryYen.set(
            month,
            (monthlySalaryYen.get(month) ?? 0) + salaryYen,
          );
        }
      }
      if (resolveBonusStreamKey(period.streamType)) {
        for (const bonus of period.bonuses) {
          const bonusYen = Math.round(bonus.amountMan * MAN_TO_YEN);
          annualBonusYen += bonusYen;
          bonusPayments.push({
            month: bonus.paymentMonth,
            remunerationYen: bonusYen,
            standardHealthYen: truncateStandardBonusYen(bonusYen),
            standardPensionYen: resolvePensionStandardBonusYen(bonusYen),
          });
        }
      }
    }
  }

  if (annualSalaryYen <= 0 && annualBonusYen <= 0) {
    return null;
  }

  const monthStart = 1;
  const monthEnd = 12;
  const bonusPaymentCount = bonusPayments.length;
  const bonusTreatedAsRemuneration =
    bonusPaymentCount >= BONUS_PAYMENT_COUNT_THRESHOLD && annualBonusYen > 0;
  let monthlyBonusShareYen = 0;

  if (bonusTreatedAsRemuneration) {
    const bonusShares = distributeAnnualBonusToMonthsYen(
      annualBonusYen,
      monthStart,
      monthEnd,
    );
    monthlyBonusShareYen = bonusShares.get(monthStart) ?? 0;
    for (const [month, shareYen] of bonusShares) {
      monthlySalaryYen.set(month, (monthlySalaryYen.get(month) ?? 0) + shareYen);
    }
  }

  const monthlyRemunerations = buildMonthlyRemunerationsFromSalaryMap(
    monthlySalaryYen,
    monthStart,
    monthEnd,
    options,
  );

  const standardHealthBonusTotalYen = bonusTreatedAsRemuneration
    ? 0
    : capHealthStandardBonusTotalYen(
        bonusPayments.reduce((sum, payment) => sum + payment.standardHealthYen, 0),
      );

  return {
    annualSalaryYen,
    annualBonusYen,
    standardMonthlyRemunerationYen: pickRepresentativeStandardYen(
      monthlyRemunerations,
      'standardPensionYen',
    ),
    standardMonthlyRemunerationHealthYen: pickRepresentativeStandardYen(
      monthlyRemunerations,
      'standardHealthYen',
    ),
    monthlyRemunerations,
    bonusPayments: bonusTreatedAsRemuneration ? [] : bonusPayments,
    standardHealthBonusTotalYen,
    bonusPaymentCount,
    bonusTreatedAsRemuneration,
    monthlyBonusShareYen,
  };
}
