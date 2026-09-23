import { calcBirthYear, getMemberAgeMonth } from './birthDate';
import { calcHouseholdMonthlyChildAllowanceMan } from './childAllowance';
import {
  calcMonthlyEarnedIncomeBreakdown,
  type CashFlowInput,
} from './cashFlow';
import { calcHouseholdTaxYearResult } from './householdTaxYear';
import { calcAnnualAmountMan } from './incomeAmount';
import { resolveLevyPaymentFactorForYear, resolveSimulationStartYear } from './simulationTiming';
import {
  createIncomeEntry,
  createSideBusinessIncomeEntry,
  migrateIncomeEntry,
} from './incomeDefaults';
import { canAddSideBusinessIncome } from './incomeGuidance';
import type { AddIncomeOption } from './incomeLabels';
import { getMemberTabLabel } from './memberDisplay';
import { isPensionSpouseLikeMember } from './familyDefaults';
import { resolveMemberYearIncomeProfile } from './memberYearIncome';
import { buildMemberYearIncomeProfileFromOverride } from './priorYearIncomeResolution';
import {
  addCalendarMonths,
  type CalendarYearMonth,
} from './housingLoanAmortization';
import { createDefaultPensionMemberState } from './pensionDefaults';
import {
  calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan,
  calcMonthlyPensionEntitlementBreakdownMan,
} from './pensionIncome';
import { calcPensionPaymentFromEntitlements } from './pensionPaymentSchedule';
import {
  calcCoverageSurvivorBasicDetailMonthlyMan,
  calcSurvivorBasicYenPerYear,
  listEligibleSurvivorBasicChildren,
} from './survivorBasicPension';
import {
  calcCoverageSurvivorEmployeesDetail,
  hasConfirmedLongTermSurvivorQualification,
  isEmployeesInsuredAt,
  isSurvivorEmployeesSpouseIncomeRequirementRemovedAt,
  resolveSurvivorPremiumRequirementAssessment,
} from './survivorEmployeesPension';
import {
  createEmptyPensionBreakdown,
  createEmptySurvivorEmployeesDetail,
  sumIncomeBreakdown,
  sumPensionBreakdown,
  sumOldAgeBasicDetail,
  sumOldAgeEmployeesPension,
  sumOldAgePension,
  type PensionBreakdown,
} from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type {
  IncomeByMember,
  IncomeEntry,
  IncomePeriod,
} from '../types/income';
import type {
  RequiredCoverageDesignStage,
  RequiredCoverageMemberWorkDesign,
  RequiredCoverageState,
  RequiredCoverageSubject,
  RequiredCoverageWorkDesigns,
  RequiredCoverageWorkMode,
} from '../types/requiredCoverage';

const WORK_MODES: RequiredCoverageWorkMode[] = ['keep', 'stop', 'redesign'];

function createId(): string {
  return crypto.randomUUID();
}

function calendarIndex(year: number, month: number): number {
  return year * 12 + month;
}

function indexToYearMonth(idx: number): CalendarYearMonth {
  const year = Math.floor((idx - 1) / 12);
  const month = ((idx - 1) % 12) + 1;
  return { year, month };
}

function prevCalendarIndex(idx: number): number {
  const prev = addCalendarMonths(indexToYearMonth(idx), -1);
  return calendarIndex(prev.year, prev.month);
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function roundMan(value: number): number {
  return Math.round(value);
}

export type SurvivorLivelihoodIncomeAssessmentStatus =
  | 'met'
  | 'not_met'
  | 'unconfirmed';

export interface SurvivorLivelihoodIncomeAssessment {
  status: SurvivorLivelihoodIncomeAssessmentStatus;
  incomeReferenceYear: number;
  grossRevenueMan: number | null;
  totalIncomeMan: number | null;
  resolution: 'prior_year_override' | 'q7_reference_year' | 'unavailable';
}

/**
 * 遺族年金の生計維持に使う収入要件を、現在保存されているQ7情報から概算する。
 * 収入850万円未満 または 所得655.5万円未満なら「確認できる範囲で満たす」。
 * 基準以上でも、おおむね5年以内の収入低下見込み等の個別認定があり得るため、
 * この関数だけで法的な不該当を確定するものではない。
 */
export function resolveSurvivorLivelihoodIncomeAssessment(input: {
  recipient: FamilyMember;
  /** 死亡前の前年収入判定に使うQ7収入 */
  incomeByMember: IncomeByMember;
  /** 死亡後おおむね5年以内の収入低下見込みに使う収入。未指定時はQ7を使用。 */
  futureIncomeByMember?: IncomeByMember;
  priorYearIncomeByMember?: CashFlowInput['priorYearIncomeByMember'];
  referenceDate: Date;
  death: CalendarYearMonth;
}): SurvivorLivelihoodIncomeAssessment {
  const incomeReferenceYear = input.death.year - 1;
  const simulationStartYear = input.referenceDate.getFullYear();
  const override = input.priorYearIncomeByMember?.[input.recipient.id];

  let grossRevenueMan: number | null = null;
  let totalIncomeMan: number | null = null;
  let resolution: SurvivorLivelihoodIncomeAssessment['resolution'] =
    'unavailable';

  if (
    incomeReferenceYear === simulationStartYear - 1 &&
    override?.differsFromCurrentYear
  ) {
    const profile = buildMemberYearIncomeProfileFromOverride(override);
    grossRevenueMan = profile.grossRevenueMan;
    // Q7の前年度上書きは「月額・収入区分」しか持たず、
    // 自営業等の必要経費や雑所得等の所得計算材料までは保存していない。
    // 給与系だけは給与所得控除から所得を概算できるが、それ以外は
    // 850万円以上のときに655.5万円以上と断定しない。
    const canEstimateTotalIncomeFromOverride =
      override.category === 'employee' ||
      override.category === 'civil_servant' ||
      override.category === 'part_time';
    totalIncomeMan = canEstimateTotalIncomeFromOverride
      ? profile.totalIncomeMan
      : null;
    resolution = 'prior_year_override';
  } else {
    const entries = input.incomeByMember[input.recipient.id] ?? [];
    if (entries.length > 0) {
      const profile = resolveMemberYearIncomeProfile(
        input.recipient,
        entries,
        input.referenceDate,
        incomeReferenceYear,
        1,
        12,
      );
      if (profile.hasActiveIncomeBlock) {
        grossRevenueMan = profile.grossRevenueMan;
        totalIncomeMan = profile.totalIncomeMan;
        resolution = 'q7_reference_year';
      }
    }
  }

  if (grossRevenueMan == null) {
    return {
      status: 'unconfirmed',
      incomeReferenceYear,
      grossRevenueMan,
      totalIncomeMan,
      resolution,
    };
  }

  if (grossRevenueMan < 850 || (totalIncomeMan != null && totalIncomeMan < 655.5)) {
    return {
      status: 'met',
      incomeReferenceYear,
      grossRevenueMan,
      totalIncomeMan,
      resolution,
    };
  }

  // 収入850万円以上でも所得額を確定できない場合は、
  // 所得655.5万円未満の可能性が残るため不該当と断定しない。
  if (totalIncomeMan == null) {
    return {
      status: 'unconfirmed',
      incomeReferenceYear,
      grossRevenueMan,
      totalIncomeMan,
      resolution,
    };
  }

  // 基準以上でも、おおむね5年以内に基準未満へ下がる見込みがあれば
  // 生計維持として認定され得る。Q7でその可能性が見える場合は不該当と断定しない。
  const futureEntries =
    input.futureIncomeByMember?.[input.recipient.id] ??
    input.incomeByMember[input.recipient.id] ??
    [];
  if (futureEntries.length === 0) {
    return {
      status: 'unconfirmed',
      incomeReferenceYear,
      grossRevenueMan,
      totalIncomeMan,
      resolution,
    };
  }
  for (let year = input.death.year; year <= input.death.year + 5; year += 1) {
    const profile = resolveMemberYearIncomeProfile(
      input.recipient,
      futureEntries,
      input.referenceDate,
      year,
      1,
      12,
    );
    if (
      !profile.hasActiveIncomeBlock ||
      profile.grossRevenueMan < 850 ||
      profile.totalIncomeMan < 655.5
    ) {
      return {
        status: 'unconfirmed',
        incomeReferenceYear,
        grossRevenueMan,
        totalIncomeMan,
        resolution,
      };
    }
  }

  return {
    status: 'not_met',
    incomeReferenceYear,
    grossRevenueMan,
    totalIncomeMan,
    resolution,
  };
}

function isOnOrAfterSurvivorReformDate(date: CalendarYearMonth): boolean {
  return date.year > 2028 || (date.year === 2028 && date.month >= 4);
}

export function createDefaultMemberWorkDesign(): RequiredCoverageMemberWorkDesign {
  return { mode: 'keep', entries: [] };
}

export function createDefaultWorkDesigns(): RequiredCoverageWorkDesigns {
  return { head: {}, spouse: {} };
}

function isWorkMode(value: unknown): value is RequiredCoverageWorkMode {
  return (
    typeof value === 'string' &&
    WORK_MODES.includes(value as RequiredCoverageWorkMode)
  );
}

function cloneIncomeEntry(entry: IncomeEntry): IncomeEntry {
  return {
    ...entry,
    id: createId(),
    periods: entry.periods.map((period) => ({
      ...period,
      id: createId(),
      bonuses: period.bonuses.map((bonus) => ({ ...bonus, id: createId() })),
    })),
    retirementAllowances: entry.retirementAllowances.map((item) => ({
      ...item,
      id: createId(),
    })),
  };
}

function clipPeriodToStart(
  period: IncomePeriod,
  startAge: number,
  startMonth: number,
): IncomePeriod | null {
  const startIdx = ageMonthIndex(startAge, startMonth);
  if (ageMonthIndex(period.endAge, period.endMonth) < startIdx) return null;
  if (ageMonthIndex(period.startAge, period.startMonth) >= startIdx) {
    return period;
  }
  return { ...period, startAge, startMonth };
}

export function clipIncomeEntriesToCoverageStart(
  entries: IncomeEntry[],
  member: FamilyMember,
  referenceDate: Date,
  coverageStart: CalendarYearMonth,
): IncomeEntry[] {
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    coverageStart.year,
    coverageStart.month,
  );
  if (!ageMonth) return entries;
  return entries
    .map((entry) => {
      const periods = entry.periods
        .map((period) =>
          clipPeriodToStart(period, ageMonth.age, ageMonth.month),
        )
        .filter((period): period is IncomePeriod => period != null);
      return { ...entry, periods };
    })
    .filter((entry) => entry.periods.length > 0);
}

function migrateMemberWorkDesign(
  raw: unknown,
  memberRole?: FamilyMember['role'],
): RequiredCoverageMemberWorkDesign {
  const defaults = createDefaultMemberWorkDesign();
  if (!raw || typeof raw !== 'object') return defaults;
  const value = raw as Partial<RequiredCoverageMemberWorkDesign>;
  return {
    mode: isWorkMode(value.mode) ? value.mode : defaults.mode,
    entries: Array.isArray(value.entries)
      ? value.entries.map((entry) => migrateIncomeEntry(entry, memberRole))
      : [],
  };
}

export function migrateCoverageWorkDesigns(
  raw: unknown,
  familyMembers: FamilyMember[] = [],
): RequiredCoverageWorkDesigns {
  const defaults = createDefaultWorkDesigns();
  if (!raw || typeof raw !== 'object') return defaults;
  const value = raw as Partial<RequiredCoverageWorkDesigns>;
  const roleById = new Map(
    familyMembers.map((member) => [member.id, member.role] as const),
  );
  const migrateSubject = (
    subjectRaw: Record<string, unknown> | undefined,
  ): Record<string, RequiredCoverageMemberWorkDesign> => {
    if (!subjectRaw || typeof subjectRaw !== 'object') return {};
    const next: Record<string, RequiredCoverageMemberWorkDesign> = {};
    for (const [memberId, design] of Object.entries(subjectRaw)) {
      next[memberId] = migrateMemberWorkDesign(design, roleById.get(memberId));
    }
    return next;
  };
  return {
    head: migrateSubject(value.head as Record<string, unknown> | undefined),
    spouse: migrateSubject(
      value.spouse as Record<string, unknown> | undefined,
    ),
  };
}

export function listCoverageWorkMembers(
  familyMembers: FamilyMember[],
  subject: RequiredCoverageSubject,
): FamilyMember[] {
  return familyMembers.filter(
    (member) =>
      (member.role === 'head' || member.role === 'spouse') &&
      member.role !== subject,
  );
}

export function getCoverageMemberWorkDesign(
  state: Pick<RequiredCoverageState, 'workDesigns'>,
  subject: RequiredCoverageSubject,
  memberId: string,
): RequiredCoverageMemberWorkDesign {
  return (
    state.workDesigns?.[subject]?.[memberId] ?? createDefaultMemberWorkDesign()
  );
}

export function patchCoverageMemberWorkDesign(
  state: RequiredCoverageState,
  subject: RequiredCoverageSubject,
  memberId: string,
  patch: Partial<RequiredCoverageMemberWorkDesign>,
): RequiredCoverageState {
  const current = getCoverageMemberWorkDesign(state, subject, memberId);
  return {
    ...state,
    workDesigns: {
      ...createDefaultWorkDesigns(),
      ...state.workDesigns,
      [subject]: {
        ...(state.workDesigns?.[subject] ?? {}),
        [memberId]: {
          ...current,
          ...patch,
        },
      },
    },
  };
}

export function createCoverageWorkIncomeEntry(
  member: FamilyMember,
  option: Pick<AddIncomeOption, 'category' | 'variant'>,
  coverageStart: CalendarYearMonth,
  referenceDate: Date,
): IncomeEntry {
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    coverageStart.year,
    coverageStart.month,
  );
  const startAge = ageMonth?.age ?? member.age ?? 40;
  const startMonth = ageMonth?.month ?? coverageStart.month;
  const entry =
    option.variant === 'side_business'
      ? createSideBusinessIncomeEntry(
          member.id,
          startAge,
          startMonth,
          member,
        )
      : createIncomeEntry(
          member.id,
          option.category,
          startAge,
          startMonth,
          member,
        );
  const endAge = Math.max(60, startAge);
  return {
    ...entry,
    isNewIncomeFromStart: true,
    periods: entry.periods.map((period, index) => {
      if (index !== 0) return period;
      const next: IncomePeriod = {
        ...period,
        startAge,
        startMonth,
        endAge,
        endMonth: 3,
        dependentStatus: 'none',
        taxDependent: false,
        socialInsuranceDependent: false,
      };
      return {
        ...next,
        annualAmountMan: calcAnnualAmountMan(
          next.monthlyAmountMan,
          next.bonuses,
        ),
      };
    }),
  };
}

export function copyCurrentIncomeAsWorkDraft(
  entries: IncomeEntry[],
  member: FamilyMember,
  referenceDate: Date,
  coverageStart: CalendarYearMonth,
): IncomeEntry[] {
  return clipIncomeEntriesToCoverageStart(
    entries.map(cloneIncomeEntry),
    member,
    referenceDate,
    coverageStart,
  );
}

export function canAddCoverageSideBusiness(entries: IncomeEntry[]): boolean {
  return canAddSideBusinessIncome(entries);
}

export function resolveCoverageIncomeByMember(
  input: Pick<CashFlowInput, 'familyMembers' | 'incomeByMember'>,
  state: Pick<RequiredCoverageState, 'workDesigns'>,
  subject: RequiredCoverageSubject,
  designStage: RequiredCoverageDesignStage = 'detail',
): IncomeByMember {
  const deceased = input.familyMembers.find((member) => member.role === subject);
  const result: IncomeByMember = {};
  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;
    if (deceased && member.id === deceased.id) {
      result[member.id] = [];
      continue;
    }
    if (member.role === 'head' || member.role === 'spouse') {
      if (designStage === 'simple') {
        result[member.id] = input.incomeByMember[member.id] ?? [];
        continue;
      }
      const design = getCoverageMemberWorkDesign(state, subject, member.id);
      if (design.mode === 'stop') {
        result[member.id] = [];
        continue;
      }
      if (design.mode === 'redesign') {
        result[member.id] = design.entries.map((entry) =>
          migrateIncomeEntry(entry, member.role),
        );
        continue;
      }
    }
    result[member.id] = input.incomeByMember[member.id] ?? [];
  }
  return result;
}

export interface RequiredCoverageIncomeMemberTotal {
  memberId: string;
  label: string;
  amount: number;
  mode: RequiredCoverageWorkMode;
}

export interface RequiredCoverageIncomeTotals {
  /** 額面収入の合計（税・社保控除前。CF表の収入合計と同じ考え方） */
  total: number;
  /** 額面の就労収入 */
  earned: number;
  /** @deprecated earned と同値（額面） */
  earnedGross: number;
  /** 残る世帯の所得税・住民税・社会保険料（支出側に載せる） */
  taxSocial: number;
  survivorBasic: number;
  childAllowance: number;
  /** 額面の老齢基礎年金（残る世帯主・配偶者の Q8 見込み） */
  oldAgeBasic: number;
  /** @deprecated oldAgeBasic と同値（額面） */
  oldAgeBasicGross: number;
  /** 額面の老齢厚生年金（残る世帯主・配偶者の Q8 見込み） */
  oldAgeEmployees: number;
  /** @deprecated oldAgeEmployees と同値（額面） */
  oldAgeEmployeesGross: number;
  /** 遺族厚生年金（非課税） */
  survivorEmployees: number;
  survivorEmployeesGross: number;
  survivorPension: number;
  byMember: RequiredCoverageIncomeMemberTotal[];
  byYear: Record<number, number>;
  byYearEarned: Record<number, number>;
  byYearSurvivorBasic: Record<number, number>;
  byYearSurvivorEmployees: Record<number, number>;
  byYearSurvivorEmployeesBasic: Record<number, number>;
  byYearMiddleAgedWidowAdd: Record<number, number>;
  byYearChildAllowance: Record<number, number>;
  byYearOldAgeBasic: Record<number, number>;
  byYearOldAgeEmployees: Record<number, number>;
  byYearTaxSocial: Record<number, number>;
  survivorBasicYenPerYearStart: number;
  eligibleChildCountStart: number;
}

export function emptyCoverageIncomeTotals(): RequiredCoverageIncomeTotals {
  return {
    total: 0,
    earned: 0,
    earnedGross: 0,
    taxSocial: 0,
    survivorBasic: 0,
    childAllowance: 0,
    oldAgeBasic: 0,
    oldAgeBasicGross: 0,
    oldAgeEmployees: 0,
    oldAgeEmployeesGross: 0,
    survivorEmployees: 0,
    survivorEmployeesGross: 0,
    survivorPension: 0,
    byMember: [],
    byYear: {},
    byYearEarned: {},
    byYearSurvivorBasic: {},
    byYearSurvivorEmployees: {},
    byYearSurvivorEmployeesBasic: {},
    byYearMiddleAgedWidowAdd: {},
    byYearChildAllowance: {},
    byYearOldAgeBasic: {},
    byYearOldAgeEmployees: {},
    byYearTaxSocial: {},
    survivorBasicYenPerYearStart: 0,
    eligibleChildCountStart: 0,
  };
}

function buildCoverageTaxHousehold(
  familyMembers: FamilyMember[],
  subject: RequiredCoverageSubject,
): FamilyMember[] {
  const deceased = familyMembers.find((member) => member.role === subject);
  const remaining = familyMembers.filter(
    (member) => member.role !== 'pet' && member.id !== deceased?.id,
  );
  if (remaining.some((member) => member.role === 'head')) return remaining;
  const spouse = remaining.find((member) => member.role === 'spouse');
  if (spouse) {
    return remaining.map((member) =>
      member.id === spouse.id ? { ...member, role: 'head' } : member,
    );
  }
  if (remaining.length === 0) return remaining;
  return remaining.map((member, index) =>
    index === 0 ? { ...member, role: 'head' } : member,
  );
}

function accumulateCoverageTaxSocialByYear(
  input: CashFlowInput,
  incomeByMember: IncomeByMember,
  subject: RequiredCoverageSubject,
  start: CalendarYearMonth,
  end: CalendarYearMonth,
  annualPensionManByMemberByYear: Record<number, Record<string, number>> = {},
): Record<number, number> {
  const household = buildCoverageTaxHousehold(input.familyMembers, subject);
  const taxHead = household.find((member) => member.role === 'head');
  if (!taxHead) return {};

  const taxIncomeByMember: IncomeByMember = {};
  const priorYearIncomeByMember: NonNullable<
    CashFlowInput['priorYearIncomeByMember']
  > = {};
  for (const member of household) {
    taxIncomeByMember[member.id] = incomeByMember[member.id] ?? [];
    const prior = input.priorYearIncomeByMember?.[member.id];
    if (prior) priorYearIncomeByMember[member.id] = prior;
  }

  const simulationStartYear = resolveSimulationStartYear(input.referenceDate);
  const byYear: Record<number, number> = {};
  for (let year = start.year; year <= end.year; year += 1) {
    const monthStart = year === start.year ? start.month : 1;
    const monthEnd = year === end.year ? end.month : 12;
    const taxYear = calcHouseholdTaxYearResult({
      familyMembers: household,
      incomeByMember: taxIncomeByMember,
      priorYearIncomeByMember,
      referenceDate: input.referenceDate,
      calendarYear: year,
      monthStart,
      monthEnd,
      levyPaymentFactor: resolveLevyPaymentFactorForYear({
        calendarYear: year,
        startYear: simulationStartYear,
        head: taxHead,
        incomeByMember: taxIncomeByMember,
        referenceDate: input.referenceDate,
      }),
      simulationStartYear,
      annualPensionManByMember:
        annualPensionManByMemberByYear[year] ?? {},
      housingState: input.housingState,
      loanState: input.loanState,
      insuranceState: input.insuranceState,
      vehicleState: input.vehicleState,
    });
    byYear[year] = taxYear.household.totalMan;
  }
  return byYear;
}

function buildCoveragePensionHousehold(
  familyMembers: FamilyMember[],
  subject: RequiredCoverageSubject,
): FamilyMember[] {
  const deceased = familyMembers.find((member) => member.role === subject);
  return familyMembers.filter(
    (member) => member.role !== 'pet' && member.id !== deceased?.id,
  );
}

function extractOldAgePaymentParts(breakdown: PensionBreakdown): {
  basic: number;
  employees: number;
} {
  return {
    basic: sumOldAgeBasicDetail(breakdown.oldAge.basic),
    employees: sumOldAgeEmployeesPension(breakdown.oldAge),
  };
}

function extractSurvivorEmployeesPaymentParts(breakdown: PensionBreakdown): {
  basic: number;
  middleAged: number;
  employees: number;
} {
  const detail = breakdown.survivor.employees;
  const basic =
    detail.basic +
    detail.children +
    detail.occupational +
    detail.transitional +
    detail.payment;
  const middleAged = detail.middleAged;
  return { basic, middleAged, employees: basic + middleAged };
}

interface CoveragePensionTaxMonth {
  allOldAgeMan: Record<string, number>;
}

function calcCoveragePensionEntitlementMonth(
  input: Pick<CashFlowInput, 'pensionByMember' | 'referenceDate' | 'incomeByMember' | 'familyMembers'>,
  incomeByMember: IncomeByMember,
  household: FamilyMember[],
  calendarYear: number,
  calendarMonth: number,
  subject: RequiredCoverageSubject,
  death: CalendarYearMonth,
  survivorEmployeesFamilyMembers: FamilyMember[] = input.familyMembers,
): { entitlement: PensionBreakdown; tax: CoveragePensionTaxMonth } {
  const entitlement = calcMonthlyPensionEntitlementBreakdownMan(
    household,
    input.pensionByMember,
    incomeByMember,
    input.referenceDate,
    calendarYear,
    calendarMonth,
  );
  entitlement.survivor.employees = createEmptySurvivorEmployeesDetail();
  const survivorAuto = calcCoverageSurvivorEmployeesDetail({
    familyMembers: survivorEmployeesFamilyMembers,
    subject,
    pensionByMember: input.pensionByMember,
    originalIncomeByMember: input.incomeByMember,
    coverageIncomeByMember: incomeByMember,
    referenceDate: input.referenceDate,
    death,
    year: calendarYear,
    month: calendarMonth,
  });
  entitlement.survivor.employees = survivorAuto.detail;
  const allOldAgeMan: Record<string, number> = {};

  for (const member of household) {
    const memberState =
      input.pensionByMember[member.id] ?? createDefaultPensionMemberState();
    const memberBreakdown =
      calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan(
        member,
        memberState,
        incomeByMember[member.id] ?? [],
        household,
        input.pensionByMember,
        incomeByMember,
        input.referenceDate,
        calendarYear,
        calendarMonth,
      );
    allOldAgeMan[member.id] = sumOldAgePension(memberBreakdown.oldAge);
  }

  return {
    entitlement,
    tax: { allOldAgeMan },
  };
}

function addCoverageAnnualPensionMan(
  map: Record<number, Record<string, number>>,
  year: number,
  memberId: string,
  amount: number,
): void {
  if (amount <= 0) return;
  const yearPension = map[year] ?? {};
  yearPension[memberId] = (yearPension[memberId] ?? 0) + amount;
  map[year] = yearPension;
}

export function accumulateCoverageIncome(
  input: CashFlowInput,
  incomeByMember: IncomeByMember,
  state: Pick<RequiredCoverageState, 'workDesigns'>,
  subject: RequiredCoverageSubject,
  start: CalendarYearMonth,
  end: CalendarYearMonth,
): RequiredCoverageIncomeTotals {
  const startIdx = calendarIndex(start.year, start.month);
  const endIdx = calendarIndex(end.year, end.month);
  if (endIdx < startIdx) return emptyCoverageIncomeTotals();

  const workers = input.familyMembers.filter((member) => member.role !== 'pet');
  const survivorSpouse =
    subject === 'head'
      ? input.familyMembers.find((member) => isPensionSpouseLikeMember(member))
      : input.familyMembers.find((member) => member.role === 'head');
  const spouseLivelihoodIncomeAssessment = survivorSpouse
    ? resolveSurvivorLivelihoodIncomeAssessment({
        recipient: survivorSpouse,
        incomeByMember: input.incomeByMember,
        priorYearIncomeByMember: input.priorYearIncomeByMember,
        referenceDate: input.referenceDate,
        death: start,
      })
    : null;
  const spouseIncomeClearlyNotMet =
    spouseLivelihoodIncomeAssessment?.status === 'not_met';
  const deceased = input.familyMembers.find((member) => member.role === subject);
  const deceasedState = deceased
    ? input.pensionByMember[deceased.id] ?? createDefaultPensionMemberState()
    : null;
  const deceasedEntries = deceased
    ? input.incomeByMember[deceased.id] ?? []
    : [];
  const deceasedAge = deceased
    ? getMemberAgeMonth(
        deceased,
        input.referenceDate,
        start.year,
        start.month,
      )
    : null;
  const deceasedEmployeesInsured =
    deceased && deceasedAge
      ? isEmployeesInsuredAt(
          deceasedEntries,
          deceasedAge.age,
          deceasedAge.month,
          calcBirthYear(
            deceased.age,
            deceased.birthMonth,
            input.referenceDate,
          ),
          deceased.birthMonth ?? 1,
        )
      : false;
  const survivorPremiumAssessment =
    deceased && deceasedState
      ? resolveSurvivorPremiumRequirementAssessment(
          deceased,
          deceasedState,
          input.referenceDate,
          start,
        )
      : null;
  const survivorBasicDeathRequirementMet =
    deceasedState != null &&
    (hasConfirmedLongTermSurvivorQualification(deceasedState) ||
      ((deceasedAge?.age ?? 99) < 65 &&
        survivorPremiumAssessment?.status === 'met' &&
        // 20〜59歳は国民年金の強制加入年齢。60〜64歳は、少なくとも
        // 厚生年金加入中と確認できる場合に自動判定する。
        ((deceasedAge?.age ?? 99) < 60 || deceasedEmployeesInsured)));

  const reformAtDeath = isOnOrAfterSurvivorReformDate(start);
  const livelihoodIncomeAssessmentByMember = new Map<
    string,
    SurvivorLivelihoodIncomeAssessment
  >();
  const getLivelihoodIncomeAssessment = (
    member: FamilyMember,
  ): SurvivorLivelihoodIncomeAssessment => {
    const cached = livelihoodIncomeAssessmentByMember.get(member.id);
    if (cached) return cached;
    const assessment = resolveSurvivorLivelihoodIncomeAssessment({
      recipient: member,
      incomeByMember: input.incomeByMember,
      priorYearIncomeByMember: input.priorYearIncomeByMember,
      referenceDate: input.referenceDate,
      death: start,
    });
    livelihoodIncomeAssessmentByMember.set(member.id, assessment);
    return assessment;
  };

  // 生計維持の収入要件は配偶者だけでなく、子・父母・孫・祖父母にもある。
  // 「明らかに基準を満たさない」と確認できる候補だけ受給順位から外す。
  // 不明な場合は、必要保障額を制度上の個別認定で断定しないため候補に残す。
  const survivorEmployeesBaseFamilyMembers = input.familyMembers.filter(
    (member) => {
      if (member.role === 'pet' || member.id === deceased?.id) return true;
      // 配偶者の850万円基準は、2028年改正の有期給付へ移った時点で
      // 月ごとに撤廃されるため、ここでは一旦残して後で判定する。
      if (survivorSpouse && member.id === survivorSpouse.id) return true;
      return getLivelihoodIncomeAssessment(member).status !== 'not_met';
    },
  );
  const resolveSurvivorEmployeesFamilyMembers = (
    year: number,
    month: number,
  ): FamilyMember[] => {
    if (!survivorSpouse || !spouseIncomeClearlyNotMet) {
      return survivorEmployeesBaseFamilyMembers;
    }
    const remaining = survivorEmployeesBaseFamilyMembers.filter(
      (member) => member.id !== deceased?.id && member.role !== 'pet',
    );
    const incomeRequirementRemoved =
      isSurvivorEmployeesSpouseIncomeRequirementRemovedAt(
        survivorSpouse,
        remaining,
        input.referenceDate,
        start,
        { year, month },
      );
    return incomeRequirementRemoved
      ? survivorEmployeesBaseFamilyMembers
      : survivorEmployeesBaseFamilyMembers.filter(
          (member) => member.id !== survivorSpouse.id,
        );
  };

  // 遺族基礎年金の収入要件は2028年改正後も維持される。
  // 改正後は高収入の配偶者を外した上で、要件を満たす子自身が受給できる。
  const survivorBasicFamilyMembers = input.familyMembers.filter((member) => {
    if (member.role === 'pet' || member.id === deceased?.id) return true;
    if (
      member.role !== 'child' &&
      !(
        member.role === 'other' &&
        member.otherRelationship === 'grandchild'
      ) &&
      member.id !== survivorSpouse?.id
    ) {
      return true;
    }
    return getLivelihoodIncomeAssessment(member).status !== 'not_met';
  });
  const eligibleChildCountStart = listEligibleSurvivorBasicChildren(
    survivorBasicFamilyMembers,
    input.referenceDate,
    start.year,
    start.month,
  ).length;
  const survivorBasicBlockedByIneligibleParent =
    Boolean(survivorSpouse) &&
    spouseIncomeClearlyNotMet &&
    !reformAtDeath &&
    eligibleChildCountStart > 0;
  const survivorBasicYenPerYearStart =
    survivorBasicDeathRequirementMet &&
    !survivorBasicBlockedByIneligibleParent
      ? calcSurvivorBasicYenPerYear(
          eligibleChildCountStart,
          Boolean(survivorSpouse) && !spouseIncomeClearlyNotMet,
          undefined,
          start.year,
          start.month,
        )
      : 0;
  const byMemberAmounts: Record<string, number> = {};
  const byYearEarned: Record<number, number> = {};
  const byYearSurvivorBasic: Record<number, number> = {};
  const byYearChildAllowance: Record<number, number> = {};
  const byYearSurvivorEmployees: Record<number, number> = {};
  const byYearSurvivorEmployeesBasic: Record<number, number> = {};
  const byYearMiddleAgedWidowAdd: Record<number, number> = {};
  const byYearOldAgeBasic: Record<number, number> = {};
  const byYearOldAgeEmployees: Record<number, number> = {};
  // 課税対象の公的年金（老齢のみ。遺族年金は非課税のため含めない）
  const annualPensionAllOldAgeByYear: Record<number, Record<string, number>> =
    {};
  const pensionHousehold = buildCoveragePensionHousehold(
    input.familyMembers,
    subject,
  );
  const pensionMonthCache = new Map<
    number,
    { entitlement: PensionBreakdown; tax: CoveragePensionTaxMonth }
  >();
  const getPensionMonth = (idx: number) => {
    const cached = pensionMonthCache.get(idx);
    if (cached) return cached;
    const { year, month } = indexToYearMonth(idx);
    const next = calcCoveragePensionEntitlementMonth(
      input,
      incomeByMember,
      pensionHousehold,
      year,
      month,
      subject,
      start,
      resolveSurvivorEmployeesFamilyMembers(year, month),
    );
    pensionMonthCache.set(idx, next);
    return next;
  };
  let survivorBasic = 0;
  let childAllowance = 0;
  let survivorEmployeesGross = 0;
  let oldAgeBasicGross = 0;
  let oldAgeEmployeesGross = 0;

  for (let idx = startIdx; idx <= endIdx; idx += 1) {
    const year = Math.floor((idx - 1) / 12);
    const month = ((idx - 1) % 12) + 1;
    const earnedInput = {
      familyMembers: workers,
      incomeByMember,
      referenceDate: input.referenceDate,
    };
    const monthEarned = sumIncomeBreakdown(
      calcMonthlyEarnedIncomeBreakdown(earnedInput, year, month),
    );
    const survivorBasicEntitlement = (calendarIdx: number): PensionBreakdown => {
      const target = indexToYearMonth(calendarIdx);
      const entitlement = createEmptyPensionBreakdown();
      if (!survivorBasicDeathRequirementMet) return entitlement;
      // 遺族基礎年金は死亡月の翌月分から発生する。
      if (calendarIdx <= startIdx) return entitlement;

      if (survivorBasicBlockedByIneligibleParent) {
        return entitlement;
      }
      const basicDetail = calcCoverageSurvivorBasicDetailMonthlyMan(
        survivorBasicFamilyMembers,
        subject,
        input.referenceDate,
        target.year,
        target.month,
      );
      const employeesDetail = calcCoverageSurvivorEmployeesDetail({
        familyMembers: resolveSurvivorEmployeesFamilyMembers(
          target.year,
          target.month,
        ),
        subject,
        pensionByMember: input.pensionByMember,
        originalIncomeByMember: input.incomeByMember,
        coverageIncomeByMember: incomeByMember,
        referenceDate: input.referenceDate,
        death: start,
        year: target.year,
        month: target.month,
      }).detail;

      // 2028年4月以降の子の加算は、基礎・厚生の両方に該当する場合
      // 厚生年金側を優先して同じ子を二重加算しない。
      if (employeesDetail.children > 0) {
        basicDetail.children = 0;
      }
      entitlement.survivor.basic = basicDetail;
      return entitlement;
    };
    const survivorBasicPayment = calcPensionPaymentFromEntitlements(
      month,
      survivorBasicEntitlement(prevCalendarIndex(idx)),
      survivorBasicEntitlement(prevCalendarIndex(prevCalendarIndex(idx))),
    );
    const monthBasic = sumPensionBreakdown(survivorBasicPayment);
    const monthChildAllowance = calcHouseholdMonthlyChildAllowanceMan(
      input.familyMembers,
      input.referenceDate,
      year,
      month,
    );
    const pensionPayment = calcPensionPaymentFromEntitlements(
      month,
      getPensionMonth(prevCalendarIndex(idx)).entitlement,
      getPensionMonth(prevCalendarIndex(prevCalendarIndex(idx))).entitlement,
    );
    const { basic: monthOldAgeBasic, employees: monthOldAgeEmployees } =
      extractOldAgePaymentParts(pensionPayment);
    const {
      basic: monthSurvivorEmployeesBasic,
      middleAged: monthMiddleAgedWidow,
      employees: monthSurvivorEmployees,
    } = extractSurvivorEmployeesPaymentParts(pensionPayment);
    // 税計算へ渡す老齢年金も、CFの現金収入と同じ偶数月・前2か月分の
    // 実支払ベースにそろえる。遺族年金は tax.allOldAgeMan に含めていない。
    if (month % 2 === 0) {
      const oneMonthAgoTax =
        getPensionMonth(prevCalendarIndex(idx)).tax.allOldAgeMan;
      const twoMonthsAgoTax =
        getPensionMonth(
          prevCalendarIndex(prevCalendarIndex(idx)),
        ).tax.allOldAgeMan;
      const memberIds = new Set([
        ...Object.keys(oneMonthAgoTax),
        ...Object.keys(twoMonthsAgoTax),
      ]);
      for (const memberId of memberIds) {
        addCoverageAnnualPensionMan(
          annualPensionAllOldAgeByYear,
          year,
          memberId,
          (oneMonthAgoTax[memberId] ?? 0) +
            (twoMonthsAgoTax[memberId] ?? 0),
        );
      }
    }
    survivorBasic += monthBasic;
    childAllowance += monthChildAllowance;
    survivorEmployeesGross += monthSurvivorEmployees;
    oldAgeBasicGross += monthOldAgeBasic;
    oldAgeEmployeesGross += monthOldAgeEmployees;
    byYearEarned[year] = (byYearEarned[year] ?? 0) + monthEarned;
    byYearSurvivorBasic[year] =
      (byYearSurvivorBasic[year] ?? 0) + monthBasic;
    byYearChildAllowance[year] =
      (byYearChildAllowance[year] ?? 0) + monthChildAllowance;
    byYearSurvivorEmployees[year] =
      (byYearSurvivorEmployees[year] ?? 0) + monthSurvivorEmployees;
    byYearSurvivorEmployeesBasic[year] =
      (byYearSurvivorEmployeesBasic[year] ?? 0) + monthSurvivorEmployeesBasic;
    byYearMiddleAgedWidowAdd[year] =
      (byYearMiddleAgedWidowAdd[year] ?? 0) + monthMiddleAgedWidow;
    byYearOldAgeBasic[year] =
      (byYearOldAgeBasic[year] ?? 0) + monthOldAgeBasic;
    byYearOldAgeEmployees[year] =
      (byYearOldAgeEmployees[year] ?? 0) + monthOldAgeEmployees;

    for (const member of workers) {
      const memberMonth = sumIncomeBreakdown(
        calcMonthlyEarnedIncomeBreakdown(
          {
            familyMembers: workers,
            incomeByMember: {
              [member.id]: incomeByMember[member.id] ?? [],
            },
            referenceDate: input.referenceDate,
          },
          year,
          month,
        ),
      );
      byMemberAmounts[member.id] =
        (byMemberAmounts[member.id] ?? 0) + memberMonth;
    }
  }

  const byMember = workers
    .map((member) => ({
      memberId: member.id,
      label: getMemberTabLabel(member),
      amount: roundMan(byMemberAmounts[member.id] ?? 0),
      mode: getCoverageMemberWorkDesign(state, subject, member.id).mode,
    }))
    .filter((row) => row.amount !== 0 || row.mode !== 'keep');

  const earnedGross = roundMan(
    Object.values(byMemberAmounts).reduce((sum, value) => sum + value, 0),
  );
  const byYearTaxSocialRaw = accumulateCoverageTaxSocialByYear(
    input,
    incomeByMember,
    subject,
    start,
    end,
    annualPensionAllOldAgeByYear,
  );
  const byYearTaxSocial: Record<number, number> = {};
  for (const [year, value] of Object.entries(byYearTaxSocialRaw)) {
    byYearTaxSocial[Number(year)] = roundMan(value);
  }
  const taxSocial = roundMan(
    Object.values(byYearTaxSocial).reduce((sum, value) => sum + value, 0),
  );
  const survivorBasicRounded = roundMan(survivorBasic);
  const childAllowanceRounded = roundMan(childAllowance);
  const oldAgeBasicRounded = roundMan(oldAgeBasicGross);
  const oldAgeEmployeesRounded = roundMan(oldAgeEmployeesGross);
  const survivorEmployeesRounded = roundMan(survivorEmployeesGross);
  const byYear: Record<number, number> = {};
  for (const year of new Set([
    ...Object.keys(byYearEarned),
    ...Object.keys(byYearSurvivorBasic),
    ...Object.keys(byYearChildAllowance),
    ...Object.keys(byYearSurvivorEmployeesBasic),
    ...Object.keys(byYearMiddleAgedWidowAdd),
    ...Object.keys(byYearOldAgeBasic),
    ...Object.keys(byYearOldAgeEmployees),
  ])) {
    const key = Number(year);
    byYearEarned[key] = roundMan(byYearEarned[key] ?? 0);
    byYearSurvivorBasic[key] = roundMan(byYearSurvivorBasic[key] ?? 0);
    byYearChildAllowance[key] = roundMan(byYearChildAllowance[key] ?? 0);
    byYearSurvivorEmployees[key] = roundMan(byYearSurvivorEmployees[key] ?? 0);
    byYearSurvivorEmployeesBasic[key] = roundMan(
      byYearSurvivorEmployeesBasic[key] ?? 0,
    );
    byYearMiddleAgedWidowAdd[key] = roundMan(
      byYearMiddleAgedWidowAdd[key] ?? 0,
    );
    byYearOldAgeBasic[key] = roundMan(byYearOldAgeBasic[key] ?? 0);
    byYearOldAgeEmployees[key] = roundMan(byYearOldAgeEmployees[key] ?? 0);
    byYear[key] = roundMan(
      (byYearEarned[key] ?? 0) +
        (byYearOldAgeBasic[key] ?? 0) +
        (byYearOldAgeEmployees[key] ?? 0) +
        (byYearSurvivorBasic[key] ?? 0) +
        (byYearSurvivorEmployees[key] ?? 0) +
        (byYearChildAllowance[key] ?? 0),
    );
  }

  return {
    total: roundMan(
      earnedGross +
        oldAgeBasicRounded +
        oldAgeEmployeesRounded +
        survivorBasicRounded +
        survivorEmployeesRounded +
        childAllowanceRounded,
    ),
    earned: earnedGross,
    earnedGross,
    taxSocial,
    survivorBasic: survivorBasicRounded,
    childAllowance: childAllowanceRounded,
    oldAgeBasic: oldAgeBasicRounded,
    oldAgeBasicGross: oldAgeBasicRounded,
    oldAgeEmployees: oldAgeEmployeesRounded,
    oldAgeEmployeesGross: oldAgeEmployeesRounded,
    survivorEmployees: survivorEmployeesRounded,
    survivorEmployeesGross: survivorEmployeesRounded,
    survivorPension: survivorBasicRounded + survivorEmployeesRounded,
    byMember,
    byYear,
    byYearEarned,
    byYearSurvivorBasic,
    byYearChildAllowance,
    byYearOldAgeBasic,
    byYearOldAgeEmployees,
    byYearTaxSocial,
    byYearSurvivorEmployees,
    byYearSurvivorEmployeesBasic,
    byYearMiddleAgedWidowAdd,
    survivorBasicYenPerYearStart,
    eligibleChildCountStart,
  };
}
