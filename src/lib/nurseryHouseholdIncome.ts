import { calcBirthYear, calcYearAtAge } from './birthDate';
import { calcTotalIncomeAmountYen } from './incomeTaxDeductions';
import { resolveMemberYearIncomeProfile } from './memberYearIncome';
import type { FamilyMember } from '../types/family';
import type { EducationExpenseEntry } from '../types/education';
import type {
  IncomeByMember,
  IncomeCategory,
  PriorYearIncomeByMember,
  PriorYearIncomeForNursery,
} from '../types/income';

/**
 * 国基準の保育料階層区分（子ども・子育て支援法に基づく）。
 * 3号認定（0〜2歳）認可保育園の月額保育料は、両親の市民税所得割額合算で決まる。
 */
export type NurseryFeeTier =
  | 'D1'
  | 'D2'
  | 'D3'
  | 'D4'
  | 'D5'
  | 'D6'
  | 'D7'
  | 'D8'
  | 'D9'
  | 'D10';

export type NurseryIncomeResolution =
  | 'unset'
  | 'reference_year'
  | 'current_year_proxy'
  | 'prior_year_override';

export interface NurseryHouseholdIncomeContext {
  tier: NurseryFeeTier;
  /** 推計した世帯の市民税所得割額合算（円）。収入未設定時は null */
  estimatedMunicipalLevy: number | null;
  /** 参照した所得の暦年（入園前年度） */
  incomeReferenceYear: number | null;
  /** Q7で収入が入力済みかどうか */
  incomeConfigured: boolean;
  /** 主な所得参照方法（複数混在時は優先度: override > reference_year > proxy） */
  incomeResolution: NurseryIncomeResolution;
  /** 今年度（基準日の年）。代用時の注記に使用 */
  currentYear: number;
  usedPriorYearOverride: boolean;
  usedCurrentYearProxy: boolean;
  usedReferenceYear: boolean;
}

interface TierEntry {
  tier: NurseryFeeTier;
  maxLevy: number;
}

const LEVY_TIERS: TierEntry[] = [
  { tier: 'D2', maxLevy: 0 },
  { tier: 'D3', maxLevy: 48_600 },
  { tier: 'D4', maxLevy: 60_000 },
  { tier: 'D5', maxLevy: 80_000 },
  { tier: 'D6', maxLevy: 101_000 },
  { tier: 'D7', maxLevy: 133_000 },
  { tier: 'D8', maxLevy: 169_000 },
  { tier: 'D9', maxLevy: 301_000 },
  { tier: 'D10', maxLevy: Infinity },
];

function isSalaryCategory(category: IncomeCategory | null): boolean {
  return (
    category === 'employee' ||
    category === 'civil_servant' ||
    category === 'part_time'
  );
}

function estimateMunicipalLevy(
  totalIncomeMan: number,
  grossIncomeMan: number,
  category: IncomeCategory | null,
): number {
  const totalIncomeYen = totalIncomeMan * 10_000;
  const grossIncomeYen = grossIncomeMan * 10_000;

  const socialInsuranceYen = isSalaryCategory(category)
    ? grossIncomeYen * 0.145
    : totalIncomeYen * 0.10;

  const basicDeductionYen = 430_000;
  const taxableBase = Math.max(
    0,
    totalIncomeYen - socialInsuranceYen - basicDeductionYen,
  );

  const adjustmentCredit = 2_500;
  return Math.max(0, Math.floor(taxableBase * 0.06) - adjustmentCredit);
}

function estimateLevyFromPriorYearOverride(
  override: PriorYearIncomeForNursery,
): number {
  const grossIncomeMan = override.monthlyAmountMan * 12;
  const grossRevenueYen = grossIncomeMan * 10_000;
  const totalIncomeYen = calcTotalIncomeAmountYen({
    grossRevenueYen,
    annualExpenseYen: 0,
    category: override.category,
    filingType: override.category === 'self_employed' ? 'blue_65' : null,
  });
  const totalIncomeMan = totalIncomeYen / 10_000;
  return estimateMunicipalLevy(
    totalIncomeMan,
    grossIncomeMan,
    override.category,
  );
}

function estimateLevyFromYearProfile(
  totalIncomeMan: number,
  grossIncomeMan: number,
  category: IncomeCategory | null,
): number {
  return estimateMunicipalLevy(totalIncomeMan, grossIncomeMan, category);
}

export function calcNurseryFeeTier(levy: number): NurseryFeeTier {
  for (const { tier, maxLevy } of LEVY_TIERS) {
    if (levy <= maxLevy) return tier;
  }
  return 'D10';
}

export function formatNurseryFeeTier(tier: NurseryFeeTier): string {
  switch (tier) {
    case 'D1':
      return 'D1（生活保護世帯）';
    case 'D2':
      return 'D2（非課税世帯）';
    case 'D3':
      return 'D3（所得割〜48,600円）';
    case 'D4':
      return 'D4（所得割〜60,000円）';
    case 'D5':
      return 'D5（所得割〜80,000円）';
    case 'D6':
      return 'D6（所得割〜101,000円）';
    case 'D7':
      return 'D7（所得割〜133,000円）';
    case 'D8':
      return 'D8（所得割〜169,000円）';
    case 'D9':
      return 'D9（所得割〜301,000円）';
    case 'D10':
      return 'D10（所得割301,000円超）';
  }
}

function getParentMembers(members: FamilyMember[]): FamilyMember[] {
  return members.filter((m) => m.role === 'head' || m.role === 'spouse');
}

function resolveEnrollmentCalendarYear(
  member: FamilyMember,
  entry: Pick<EducationExpenseEntry, 'startAge' | 'startMonth'>,
  referenceDate: Date,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return calcYearAtAge(birthYear, member.birthMonth, entry.startAge, entry.startMonth);
}

/** 保育料の所得参照年（在籍開始年の前年） */
export function resolveNurseryIncomeReferenceYear(
  member: FamilyMember,
  entry: Pick<EducationExpenseEntry, 'startAge' | 'startMonth'>,
  referenceDate: Date,
): number {
  return resolveEnrollmentCalendarYear(member, entry, referenceDate) - 1;
}

interface ParentLevyResult {
  levy: number;
  resolution: Exclude<NurseryIncomeResolution, 'unset'>;
}

function resolveParentLevyForNursery(input: {
  parent: FamilyMember;
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  incomeReferenceYear: number;
}): ParentLevyResult | null {
  const override = input.priorYearIncomeByMember[input.parent.id];

  if (override?.differsFromCurrentYear) {
    return {
      levy: estimateLevyFromPriorYearOverride(override),
      resolution: 'prior_year_override',
    };
  }

  const entries = input.incomeByMember[input.parent.id] ?? [];
  const refYearProfile = resolveMemberYearIncomeProfile(
    input.parent,
    entries,
    input.referenceDate,
    input.incomeReferenceYear,
  );

  if (refYearProfile.hasActiveIncomeBlock) {
    return {
      levy: estimateLevyFromYearProfile(
        refYearProfile.totalIncomeMan,
        refYearProfile.grossIncomeMan,
        refYearProfile.category,
      ),
      resolution: 'reference_year',
    };
  }

  const currentYear = input.referenceDate.getFullYear();
  const currentProfile = resolveMemberYearIncomeProfile(
    input.parent,
    entries,
    input.referenceDate,
    currentYear,
  );

  if (currentProfile.hasActiveIncomeBlock) {
    return {
      levy: estimateLevyFromYearProfile(
        currentProfile.totalIncomeMan,
        currentProfile.grossIncomeMan,
        currentProfile.category,
      ),
      resolution: 'current_year_proxy',
    };
  }

  return null;
}

function resolvePrimaryResolution(
  usedPriorYearOverride: boolean,
  usedReferenceYear: boolean,
  usedCurrentYearProxy: boolean,
): NurseryIncomeResolution {
  if (usedPriorYearOverride) return 'prior_year_override';
  if (usedReferenceYear) return 'reference_year';
  if (usedCurrentYearProxy) return 'current_year_proxy';
  return 'unset';
}

export function resolveNurseryHouseholdIncomeContext(input: {
  member: FamilyMember;
  entry: Pick<EducationExpenseEntry, 'startAge' | 'startMonth'>;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
}): NurseryHouseholdIncomeContext {
  const incomeReferenceYear = resolveNurseryIncomeReferenceYear(
    input.member,
    input.entry,
    input.referenceDate,
  );
  const currentYear = input.referenceDate.getFullYear();

  const unsetContext = (
    overrides: Partial<NurseryHouseholdIncomeContext> = {},
  ): NurseryHouseholdIncomeContext => ({
    tier: 'D6',
    estimatedMunicipalLevy: null,
    incomeReferenceYear,
    incomeConfigured: false,
    incomeResolution: 'unset',
    currentYear,
    usedPriorYearOverride: false,
    usedCurrentYearProxy: false,
    usedReferenceYear: false,
    ...overrides,
  });

  let totalLevy = 0;
  let hasAnyParentData = false;
  let usedPriorYearOverride = false;
  let usedCurrentYearProxy = false;
  let usedReferenceYear = false;

  for (const parent of getParentMembers(input.familyMembers)) {
    const result = resolveParentLevyForNursery({
      parent,
      incomeByMember: input.incomeByMember,
      priorYearIncomeByMember: input.priorYearIncomeByMember,
      referenceDate: input.referenceDate,
      incomeReferenceYear,
    });

    if (!result) continue;

    hasAnyParentData = true;
    totalLevy += result.levy;

    switch (result.resolution) {
      case 'prior_year_override':
        usedPriorYearOverride = true;
        break;
      case 'current_year_proxy':
        usedCurrentYearProxy = true;
        break;
      case 'reference_year':
        usedReferenceYear = true;
        break;
    }
  }

  if (!hasAnyParentData) {
    return unsetContext();
  }

  return {
    tier: calcNurseryFeeTier(totalLevy),
    estimatedMunicipalLevy: totalLevy,
    incomeReferenceYear,
    incomeConfigured: true,
    incomeResolution: resolvePrimaryResolution(
      usedPriorYearOverride,
      usedReferenceYear,
      usedCurrentYearProxy,
    ),
    currentYear,
    usedPriorYearOverride,
    usedCurrentYearProxy,
    usedReferenceYear,
  };
}

function formatResolutionMethod(context: NurseryHouseholdIncomeContext): string {
  const parts: string[] = [];
  if (context.usedPriorYearOverride) parts.push('前年度入力');
  if (context.usedReferenceYear) parts.push('Q7期間から算出');
  if (context.usedCurrentYearProxy) {
    parts.push(`${context.currentYear}年収入を代用`);
  }
  return parts.join('・') || 'Q7反映';
}

export function formatNurseryIncomeSourceNote(
  context: NurseryHouseholdIncomeContext,
): string {
  if (!context.incomeConfigured) {
    return '収入未入力のためD6区分（目安）';
  }

  if (context.estimatedMunicipalLevy == null) {
    return `${context.incomeReferenceYear}年の収入未設定のためD6区分（目安）`;
  }

  const tierLabel = formatNurseryFeeTier(context.tier);
  const levyStr = Math.round(context.estimatedMunicipalLevy).toLocaleString('ja-JP');
  const methodNote = formatResolutionMethod(context);

  return `${tierLabel}（${context.incomeReferenceYear}年所得割概算${levyStr}円・${methodNote}）`;
}
