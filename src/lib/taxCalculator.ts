import type { FamilyMember } from '../types/family';
import type { DependentStatus, FilingType, IncomeByMember, IncomeStreamType } from '../types/income';
import {
  calcFukuokaHouseholdNhiPremiumYen,
  calcMemberTotalIncomeForNhiYen,
  type NhiMemberInput,
} from './nationalHealthInsurance';
import {
  getMemberAgeAtYearEnd,
  resolveMemberYearIncomeProfile,
} from './memberYearIncome';
import {
  assessHouseholdResidentTax,
  buildHouseholdResidentTaxContext,
  type ResidentTaxExemptionLevel,
} from './residentTaxExemption';
import { calcSpouseDeductionsFromTotalIncomeYen } from './spouseDeduction';

const MAN_TO_YEN = 10_000;

/** 福岡県ベースの概算定数（2024年度想定・MVP） */
const TAX_CONSTANTS = {
  basicDeductionIncomeTax: 480_000,
  basicDeductionResidentTax: 430_000,
  residentTaxRate: 0.1,
  residentTaxPerCapita: 5_000,
  nationalPensionAnnualYen: 169_800,
  /** 被用者保険（本人負担・健保＋厚年＋雇用概算） */
  employeeSocialInsuranceRate: 0.145,
  /** 健康保険（被用者負担分概算） */
  employeeHealthInsuranceRate: 0.0499,
  /** 厚生年金（被用者負担分概算） */
  employeePensionRate: 0.0915,
  /** 雇用保険（被用者負担分概算） */
  employeeEmploymentInsuranceRate: 0.0036,
  /** 介護保険（40〜64歳・被用者第2号負担分概算） */
  longTermCareRate: 0.016,
  blueReturnDeductionYen: 650_000,
  /** 後期高齢者医療保険（所得割・全国平均概算） */
  lateElderlyHealthInsuranceRate: 0.095,
  /** 後期高齢者医療保険（均等割・全国平均概算） */
  lateElderlyHealthInsuranceFixed: 47_000,
  /** 介護保険料（65歳以上・第1号被保険者・福岡市概算月額×12） */
  longTermCareFirstClassAnnual: 80_000,
} as const;

export interface DependentDeductions {
  incomeTaxYen: number;
  residentTaxYen: number;
}

export interface PersonTaxProfile {
  role: FamilyMember['role'];
  grossIncomeYen: number;
  totalIncomeYen: number;
  /** 課税計算用の合計所得（雑所得20万円以下特例反映） */
  taxableIncomeYen: number;
  dependentStatus: DependentStatus;
  taxDependent: boolean;
  socialInsuranceDependent: boolean;
  streamType: IncomeStreamType | null;
  filingType: FilingType | null;
  /** 公的年金の年間受給額（万円）*/
  annualPensionMan: number;
  hasActiveIncomeBlock: boolean;
  age: number | null;
}

function isTaxIndependent(profile: PersonTaxProfile): boolean {
  return profile.dependentStatus === 'none' || !profile.taxDependent;
}

function isSocialInsuranceIndependent(profile: PersonTaxProfile): boolean {
  return (
    profile.dependentStatus === 'none' || !profile.socialInsuranceDependent
  );
}

export interface SocialInsuranceComponents {
  healthInsurance: number;
  employeesPension: number;
  longTermCare: number;
  employmentInsurance: number;
}

export interface PublicInsuranceComponents {
  nationalPension: number;
  nationalHealthInsurance: number;
  lateElderlyHealth: number;
  lateElderlyLongTermCare: number;
}

export interface TaxSocialBreakdown {
  incomeTaxMan: number;
  residentTaxMan: number;
  /** 社会保険料＋公的保険料の合計（万円） */
  socialInsuranceMan: number;
  socialInsurance: SocialInsuranceComponents;
  publicInsurance: PublicInsuranceComponents;
  totalMan: number;
  /** 世帯の納税義務者がすべて均等割・所得割非課税のとき true */
  isResidentTaxExemptHousehold: boolean;
}

function createEmptySocialInsuranceComponents(): SocialInsuranceComponents {
  return {
    healthInsurance: 0,
    employeesPension: 0,
    longTermCare: 0,
    employmentInsurance: 0,
  };
}

function createEmptyPublicInsuranceComponents(): PublicInsuranceComponents {
  return {
    nationalPension: 0,
    nationalHealthInsurance: 0,
    lateElderlyHealth: 0,
    lateElderlyLongTermCare: 0,
  };
}

function sumSocialInsuranceComponents(
  components: SocialInsuranceComponents,
): number {
  return (
    components.healthInsurance +
    components.employeesPension +
    components.longTermCare +
    components.employmentInsurance
  );
}

function sumPublicInsuranceComponents(
  components: PublicInsuranceComponents,
): number {
  return (
    components.nationalPension +
    components.nationalHealthInsurance +
    components.lateElderlyHealth +
    components.lateElderlyLongTermCare
  );
}

function addSocialInsuranceComponents(
  target: SocialInsuranceComponents,
  source: SocialInsuranceComponents,
): void {
  target.healthInsurance += source.healthInsurance;
  target.employeesPension += source.employeesPension;
  target.longTermCare += source.longTermCare;
  target.employmentInsurance += source.employmentInsurance;
}

function addPublicInsuranceComponents(
  target: PublicInsuranceComponents,
  source: PublicInsuranceComponents,
): void {
  target.nationalPension += source.nationalPension;
  target.nationalHealthInsurance += source.nationalHealthInsurance;
  target.lateElderlyHealth += source.lateElderlyHealth;
  target.lateElderlyLongTermCare += source.lateElderlyLongTermCare;
}

function yenToMan(yen: number): number {
  return Math.round((yen / MAN_TO_YEN) * 10) / 10;
}

/**
 * 公的年金等控除額（円）を計算する（令和2年以降・他の所得1,000万円以下の一般ケース）。
 *
 * 65歳未満:
 *   収入 ≤ 130万    → 60万
 *   130万〜410万    → 収入×25%＋27.5万
 *   410万〜770万    → 収入×15%＋68.5万
 *   770万〜1,000万  → 収入×5%＋145.5万
 *   1,000万超       → 195.5万
 *
 * 65歳以上:
 *   収入 ≤ 330万    → 110万
 *   330万〜410万    → 収入×25%＋27.5万
 *   (以降は同上)
 */
export function calcPublicPensionDeductionYen(
  pensionYen: number,
  age: number,
): number {
  if (pensionYen <= 0) return 0;
  if (age >= 65) {
    if (pensionYen <= 3_300_000) return 1_100_000;
    if (pensionYen <= 4_100_000) return Math.floor(pensionYen * 0.25 + 275_000);
    if (pensionYen <= 7_700_000) return Math.floor(pensionYen * 0.15 + 685_000);
    if (pensionYen <= 10_000_000) return Math.floor(pensionYen * 0.05 + 1_455_000);
    return 1_955_000;
  } else {
    if (pensionYen <= 1_300_000) return 600_000;
    if (pensionYen <= 4_100_000) return Math.floor(pensionYen * 0.25 + 275_000);
    if (pensionYen <= 7_700_000) return Math.floor(pensionYen * 0.15 + 685_000);
    if (pensionYen <= 10_000_000) return Math.floor(pensionYen * 0.05 + 1_455_000);
    return 1_955_000;
  }
}

/** 公的年金等の雑所得（円）= 受給額 − 公的年金等控除額 */
function calcPensionIncomeYen(pensionYen: number, age: number): number {
  return Math.max(0, pensionYen - calcPublicPensionDeductionYen(pensionYen, age));
}

function calcProgressiveIncomeTaxYen(taxableIncomeYen: number): number {
  if (taxableIncomeYen <= 0) return 0;

  const brackets: { limit: number; rate: number; deduction: number }[] = [
    { limit: 1_950_000, rate: 0.05, deduction: 0 },
    { limit: 3_300_000, rate: 0.1, deduction: 97_500 },
    { limit: 6_950_000, rate: 0.2, deduction: 427_500 },
    { limit: 9_000_000, rate: 0.23, deduction: 636_000 },
    { limit: 18_000_000, rate: 0.33, deduction: 1_536_000 },
    { limit: 40_000_000, rate: 0.4, deduction: 2_796_000 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 4_796_000 },
  ];

  for (const bracket of brackets) {
    if (taxableIncomeYen <= bracket.limit) {
      return Math.max(
        0,
        Math.floor(taxableIncomeYen * bracket.rate - bracket.deduction),
      );
    }
  }
  return 0;
}

function isEmployeeSocialInsuranceStream(
  streamType: IncomeStreamType | null,
): boolean {
  return (
    streamType === 'salary_social_insurance' ||
    streamType === 'salary_civil_mutual'
  );
}

function isNationalInsuranceStream(streamType: IncomeStreamType | null): boolean {
  return (
    streamType === 'salary_national_insurance' ||
    streamType === 'business_national_insurance'
  );
}

type SocialInsuranceCategory = 'none' | 'employee' | 'late_elderly' | 'nhi';

function classifySocialInsuranceCategory(
  profile: PersonTaxProfile,
): SocialInsuranceCategory {
  if (!isSocialInsuranceIndependent(profile)) return 'none';

  const age = profile.age ?? 0;
  const hasSalary = profile.grossIncomeYen > 0;
  const hasPension = profile.annualPensionMan > 0;

  if (!hasSalary && !hasPension) return 'none';
  if (age >= 75) return 'late_elderly';

  if (
    isEmployeeSocialInsuranceStream(profile.streamType) ||
    (hasSalary &&
      profile.streamType != null &&
      !isNationalInsuranceStream(profile.streamType) &&
      profile.streamType !== 'miscellaneous_income')
  ) {
    return 'employee';
  }

  if (
    isNationalInsuranceStream(profile.streamType) ||
    profile.streamType === 'miscellaneous_income' ||
    (!hasSalary && hasPension)
  ) {
    return 'nhi';
  }

  return hasSalary ? 'employee' : 'none';
}

function calcEmployeeSocialInsuranceDetailYen(
  profile: PersonTaxProfile,
): { social: SocialInsuranceComponents; totalYen: number } {
  const age = profile.age ?? 0;
  const gross = profile.grossIncomeYen;
  const social: SocialInsuranceComponents = {
    healthInsurance: Math.floor(
      gross * TAX_CONSTANTS.employeeHealthInsuranceRate,
    ),
    employeesPension: Math.floor(gross * TAX_CONSTANTS.employeePensionRate),
    longTermCare: 0,
    employmentInsurance: Math.floor(
      gross * TAX_CONSTANTS.employeeEmploymentInsuranceRate,
    ),
  };

  if (age >= 40 && age < 65) {
    social.longTermCare = Math.floor(gross * TAX_CONSTANTS.longTermCareRate);
  } else if (age >= 65) {
    social.longTermCare = TAX_CONSTANTS.longTermCareFirstClassAnnual;
  }

  return {
    social,
    totalYen: sumSocialInsuranceComponents(social),
  };
}

function calcLateElderlyInsuranceDetailYen(
  profile: PersonTaxProfile,
): { publicInsurance: PublicInsuranceComponents; totalYen: number } {
  const age = profile.age ?? 0;
  const pensionYen = Math.round(profile.annualPensionMan * MAN_TO_YEN);
  const pensionIncYen = calcPensionIncomeYen(pensionYen, age);
  const hasSalary = profile.grossIncomeYen > 0;
  const incomeBase = pensionIncYen + (hasSalary ? profile.totalIncomeYen : 0);

  const publicInsurance: PublicInsuranceComponents = {
    nationalPension: 0,
    nationalHealthInsurance: 0,
    lateElderlyHealth:
      Math.floor(
        Math.max(0, incomeBase) * TAX_CONSTANTS.lateElderlyHealthInsuranceRate,
      ) + TAX_CONSTANTS.lateElderlyHealthInsuranceFixed,
    lateElderlyLongTermCare: TAX_CONSTANTS.longTermCareFirstClassAnnual,
  };

  return {
    publicInsurance,
    totalYen: sumPublicInsuranceComponents(publicInsurance),
  };
}

function toNhiMemberInput(profile: PersonTaxProfile): NhiMemberInput {
  const age = profile.age ?? 0;
  return {
    age,
    totalIncomeYen: calcMemberTotalIncomeForNhiYen({
      totalIncomeYen: profile.totalIncomeYen,
      annualPensionMan: profile.annualPensionMan,
      age,
    }),
    hasSalary: profile.grossIncomeYen > 0,
  };
}

interface MemberSocialInsuranceEntry {
  memberId: string;
  profile: PersonTaxProfile;
}

/**
 * 世帯の社会保険料（年額・円）。
 * 国保は福岡市ベースで世帯単位（2割・5割・7割軽減）で計算し、被保険者へ按分する。
 */
function calcHouseholdSocialInsuranceBreakdown(
  entries: MemberSocialInsuranceEntry[],
): {
  totalYen: number;
  byMemberId: Record<string, number>;
  socialInsurance: SocialInsuranceComponents;
  publicInsurance: PublicInsuranceComponents;
} {
  const byMemberId: Record<string, number> = {};
  const socialInsurance = createEmptySocialInsuranceComponents();
  const publicInsurance = createEmptyPublicInsuranceComponents();
  let total = 0;
  const nhiEntries: MemberSocialInsuranceEntry[] = [];

  for (const entry of entries) {
    const { memberId, profile } = entry;
    const category = classifySocialInsuranceCategory(profile);
    switch (category) {
      case 'employee': {
        const detail = calcEmployeeSocialInsuranceDetailYen(profile);
        addSocialInsuranceComponents(socialInsurance, detail.social);
        byMemberId[memberId] = detail.totalYen;
        total += detail.totalYen;
        break;
      }
      case 'late_elderly': {
        const detail = calcLateElderlyInsuranceDetailYen(profile);
        addPublicInsuranceComponents(publicInsurance, detail.publicInsurance);
        byMemberId[memberId] = detail.totalYen;
        total += detail.totalYen;
        break;
      }
      case 'nhi': {
        nhiEntries.push(entry);
        const pension =
          (profile.age ?? 0) < 60 ? TAX_CONSTANTS.nationalPensionAnnualYen : 0;
        publicInsurance.nationalPension += pension;
        byMemberId[memberId] = pension;
        total += pension;
        break;
      }
      default:
        break;
    }
  }

  if (nhiEntries.length > 0) {
    const nhiMemberInputs = nhiEntries.map((entry) =>
      toNhiMemberInput(entry.profile),
    );
    const { premiumYen } = calcFukuokaHouseholdNhiPremiumYen(nhiMemberInputs);
    publicInsurance.nationalHealthInsurance += premiumYen;
    total += premiumYen;

    const baseShare = Math.floor(premiumYen / nhiEntries.length);
    let remainder = premiumYen - baseShare * nhiEntries.length;
    for (const entry of nhiEntries) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      byMemberId[entry.memberId] =
        (byMemberId[entry.memberId] ?? 0) + baseShare + extra;
    }
  }

  return {
    totalYen: Math.floor(total),
    byMemberId,
    socialInsurance,
    publicInsurance,
  };
}

export function calcDependentDeductionsForChildAge(
  age: number | null,
): DependentDeductions {
  if (age == null) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }
  if (age >= 16 && age <= 18) {
    return { incomeTaxYen: 380_000, residentTaxYen: 330_000 };
  }
  if (age >= 19 && age <= 22) {
    return { incomeTaxYen: 630_000, residentTaxYen: 450_000 };
  }
  return { incomeTaxYen: 0, residentTaxYen: 0 };
}

/**
 * メンバーの続柄・年齢・同居フラグから扶養控除額を算出する。
 *
 * child:
 *   16〜18歳 → 一般扶養（38万/33万）
 *   19〜22歳 → 特定扶養（63万/45万）
 *   その他   → 0
 *
 * other:
 *   70歳以上 + 親/祖父母 + 同居 → 同居老親等控除（58万/45万）
 *   70歳以上（その他）          → 老人扶養控除（48万/38万）
 *   19〜22歳 + 内縁以外         → 特定扶養（63万/45万）
 *   16歳以上（一般）            → 一般扶養（38万/33万）
 *   16歳未満                   → 0
 *
 * ※ 内縁の配偶者（common_law_partner）は親族でないため税法上の扶養控除対象外だが、
 *   ユーザーが明示的に有効化した場合は一般扶養（38万/33万）として計算する。
 */
function calcDependentDeductionForMember(
  member: FamilyMember,
  age: number | null,
): DependentDeductions {
  if (age == null || age < 16) return { incomeTaxYen: 0, residentTaxYen: 0 };

  if (member.role === 'child') {
    return calcDependentDeductionsForChildAge(age);
  }

  if (member.role === 'other') {
    if (age >= 70) {
      const rel = member.otherRelationship;
      const cohabiting = member.isCohabiting ?? false;
      if (cohabiting && (rel === 'parent' || rel === 'grandparent')) {
        return { incomeTaxYen: 580_000, residentTaxYen: 450_000 };
      }
      return { incomeTaxYen: 480_000, residentTaxYen: 380_000 };
    }
    const rel = member.otherRelationship;
    if (age >= 19 && age <= 22 && rel !== 'common_law_partner') {
      return { incomeTaxYen: 630_000, residentTaxYen: 450_000 };
    }
    return { incomeTaxYen: 380_000, residentTaxYen: 330_000 };
  }

  return { incomeTaxYen: 0, residentTaxYen: 0 };
}

/** 扶養親族（child/other）の扶養控除合計を計算する。所得・年金所得チェックあり。 */
function calcDependentMemberDeductions(
  familyMembers: FamilyMember[],
  incomeByMember: IncomeByMember,
  referenceDate: Date,
  calendarYear: number,
  monthStart: number,
  monthEnd: number,
  annualPensionManByMember: Record<string, number>,
): DependentDeductions {
  const INCOME_LIMIT_MAN = 48;
  let incomeTaxYen = 0;
  let residentTaxYen = 0;

  for (const member of familyMembers) {
    if (member.role !== 'child' && member.role !== 'other') continue;

    const profile = resolveMemberYearIncomeProfile(
      member,
      incomeByMember[member.id] ?? [],
      referenceDate,
      calendarYear,
      monthStart,
      monthEnd,
    );

    if (!profile.taxDependent) continue;

    const age = getMemberAgeAtYearEnd(member, referenceDate, calendarYear) ?? 0;

    // 年金所得を加算して合計所得を求め、48万円超なら控除なし
    const pensionMan = annualPensionManByMember[member.id] ?? 0;
    const pensionIncomeYen = calcPensionIncomeYen(
      Math.round(pensionMan * MAN_TO_YEN),
      age,
    );
    const totalIncomeManWithPension =
      profile.totalIncomeMan + pensionIncomeYen / MAN_TO_YEN;

    if (totalIncomeManWithPension > INCOME_LIMIT_MAN) continue;

    const deduction = calcDependentDeductionForMember(member, age);
    incomeTaxYen += deduction.incomeTaxYen;
    residentTaxYen += deduction.residentTaxYen;
  }

  return { incomeTaxYen, residentTaxYen };
}

/** 世帯主の申告に適用する配偶者控除・配偶者特別控除 */
function calcHeadSpouseDeductions(
  head: PersonTaxProfile,
  spouse: PersonTaxProfile | null,
): DependentDeductions {
  if (
    !spouse ||
    spouse.dependentStatus !== 'dependent' ||
    !spouse.taxDependent
  ) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }
  if (!isTaxIndependent(head)) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }

  return calcSpouseDeductionsFromTotalIncomeYen(spouse.totalIncomeYen);
}

/**
 * 個人の所得税・住民税（年額・円）を計算する。
 *
 * 課税所得 = 給与/事業所得 ＋ 年金雑所得 − 社会保険料控除 − 基礎控除 − 各種控除
 *
 * 給与/事業所得  = grossIncomeYen − 給与所得控除（または青色申告特別控除）
 * 年金雑所得     = annualPensionMan × 10,000 − 公的年金等控除額
 */
function calcResidentTaxYen(
  taxableResidentTaxBase: number,
  exemptionLevel: ResidentTaxExemptionLevel,
): number {
  if (exemptionLevel === 'fully_exempt') return 0;

  const incomeLevyYen =
    exemptionLevel === 'income_levy_exempt'
      ? 0
      : Math.floor(taxableResidentTaxBase * TAX_CONSTANTS.residentTaxRate);

  return incomeLevyYen + TAX_CONSTANTS.residentTaxPerCapita;
}

function calcPersonTaxesYen(
  profile: PersonTaxProfile,
  extraIncomeTaxDeductionYen: number,
  extraResidentTaxDeductionYen: number,
  socialInsuranceYenOverride?: number,
  residentTaxExemptionLevel: ResidentTaxExemptionLevel = 'taxable',
): { incomeTaxYen: number; residentTaxYen: number } {
  if (!isTaxIndependent(profile)) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }

  const pensionYen = Math.round(profile.annualPensionMan * MAN_TO_YEN);

  if (profile.taxableIncomeYen <= 0 && pensionYen <= 0) {
    return {
      incomeTaxYen: 0,
      residentTaxYen: calcResidentTaxYen(0, residentTaxExemptionLevel),
    };
  }

  // ── 合計所得（ブロック別計算済み）＋ 公的年金等の雑所得 ─────────────
  const age = profile.age ?? 65;
  const pensionIncomeYen = calcPensionIncomeYen(pensionYen, age);

  // ── 社会保険料控除 ─────────────────────────────────────────────────
  const socialInsuranceYen = socialInsuranceYenOverride ?? 0;

  // ── 課税所得 ───────────────────────────────────────────────────────
  const totalIncomeForTax = profile.taxableIncomeYen + pensionIncomeYen;

  const taxableIncomeTaxBase = Math.max(
    0,
    totalIncomeForTax -
      socialInsuranceYen -
      TAX_CONSTANTS.basicDeductionIncomeTax -
      extraIncomeTaxDeductionYen,
  );
  const taxableResidentTaxBase = Math.max(
    0,
    totalIncomeForTax -
      socialInsuranceYen -
      TAX_CONSTANTS.basicDeductionResidentTax -
      extraResidentTaxDeductionYen,
  );

  const incomeTaxYen = calcProgressiveIncomeTaxYen(taxableIncomeTaxBase);
  const residentTaxYen = calcResidentTaxYen(
    taxableResidentTaxBase,
    residentTaxExemptionLevel,
  );

  return { incomeTaxYen, residentTaxYen };
}

function resolvePersonProfile(
  member: FamilyMember,
  incomeByMember: IncomeByMember,
  referenceDate: Date,
  calendarYear: number,
  monthStart: number,
  monthEnd: number,
  annualPensionMan = 0,
): PersonTaxProfile {
  const yearProfile = resolveMemberYearIncomeProfile(
    member,
    incomeByMember[member.id] ?? [],
    referenceDate,
    calendarYear,
    monthStart,
    monthEnd,
  );

  return {
    role: member.role,
    grossIncomeYen: Math.round(yearProfile.grossIncomeMan * MAN_TO_YEN),
    totalIncomeYen: Math.round(yearProfile.totalIncomeMan * MAN_TO_YEN),
    taxableIncomeYen: Math.round(yearProfile.taxableIncomeMan * MAN_TO_YEN),
    dependentStatus: yearProfile.dependentStatus,
    taxDependent: yearProfile.taxDependent,
    socialInsuranceDependent: yearProfile.socialInsuranceDependent,
    streamType: yearProfile.streamType,
    filingType: yearProfile.filingType,
    annualPensionMan,
    hasActiveIncomeBlock: yearProfile.hasActiveIncomeBlock,
    age: getMemberAgeAtYearEnd(member, referenceDate, calendarYear),
  };
}

export function calcHouseholdTaxSocialMan(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
  /** メンバー別の年間公的年金受給額（万円）。省略時は0として扱う。*/
  annualPensionManByMember?: Record<string, number>;
}): TaxSocialBreakdown {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const annualPensionManByMember = input.annualPensionManByMember ?? {};

  const headMember = input.familyMembers.find((m) => m.role === 'head');
  const spouseMember = input.familyMembers.find((m) => m.role === 'spouse');

  if (!headMember) {
    return {
      incomeTaxMan: 0,
      residentTaxMan: 0,
      socialInsuranceMan: 0,
      socialInsurance: createEmptySocialInsuranceComponents(),
      publicInsurance: createEmptyPublicInsuranceComponents(),
      totalMan: 0,
      isResidentTaxExemptHousehold: false,
    };
  }

  const insurableMembers = input.familyMembers.filter((m) => m.role !== 'pet');
  const memberProfiles = insurableMembers.map((member) => ({
    memberId: member.id,
    profile: resolvePersonProfile(
      member,
      input.incomeByMember,
      input.referenceDate,
      input.calendarYear,
      monthStart,
      monthEnd,
      annualPensionManByMember[member.id] ?? 0,
    ),
  }));

  const headEntry = memberProfiles.find((entry) => entry.memberId === headMember.id);
  const spouseEntry = spouseMember
    ? memberProfiles.find((entry) => entry.memberId === spouseMember.id)
    : undefined;
  const head = headEntry?.profile;
  const spouse = spouseEntry?.profile ?? null;

  if (!head) {
    return {
      incomeTaxMan: 0,
      residentTaxMan: 0,
      socialInsuranceMan: 0,
      socialInsurance: createEmptySocialInsuranceComponents(),
      publicInsurance: createEmptyPublicInsuranceComponents(),
      totalMan: 0,
      isResidentTaxExemptHousehold: false,
    };
  }

  const profilesByMemberId = Object.fromEntries(
    memberProfiles.map((entry) => [entry.memberId, entry.profile]),
  );
  const residentTaxContext = buildHouseholdResidentTaxContext(
    input.familyMembers,
    profilesByMemberId,
  );
  const residentTaxAssessment = assessHouseholdResidentTax(
    input.familyMembers,
    memberProfiles,
    residentTaxContext,
  );
  const exemptionByMemberId = Object.fromEntries(
    residentTaxAssessment.assessments.map((assessment) => [
      assessment.memberId,
      assessment.exemptionLevel,
    ]),
  );

  const socialInsuranceBreakdown =
    calcHouseholdSocialInsuranceBreakdown(memberProfiles);

  const childDeductions = calcDependentMemberDeductions(
    input.familyMembers,
    input.incomeByMember,
    input.referenceDate,
    input.calendarYear,
    monthStart,
    monthEnd,
    annualPensionManByMember,
  );

  const spouseDeductions = calcHeadSpouseDeductions(head, spouse);

  const headTaxes = calcPersonTaxesYen(
    head,
    childDeductions.incomeTaxYen + spouseDeductions.incomeTaxYen,
    childDeductions.residentTaxYen + spouseDeductions.residentTaxYen,
    socialInsuranceBreakdown.byMemberId[headMember.id] ?? 0,
    exemptionByMemberId[headMember.id] ?? 'taxable',
  );

  const spouseTaxes =
    spouse && isTaxIndependent(spouse) && spouse.grossIncomeYen > 0
      ? calcPersonTaxesYen(
          spouse,
          0,
          0,
          spouseMember
            ? socialInsuranceBreakdown.byMemberId[spouseMember.id] ?? 0
            : 0,
          spouseMember ? exemptionByMemberId[spouseMember.id] ?? 'taxable' : 'taxable',
        )
      : { incomeTaxYen: 0, residentTaxYen: 0 };

  const socialInsuranceYen = socialInsuranceBreakdown.totalYen;

  const incomeTaxYen = headTaxes.incomeTaxYen + spouseTaxes.incomeTaxYen;
  const residentTaxYen = headTaxes.residentTaxYen + spouseTaxes.residentTaxYen;

  const incomeTaxMan = yenToMan(incomeTaxYen);
  const residentTaxMan = yenToMan(residentTaxYen);
  const socialInsuranceMan = yenToMan(socialInsuranceYen);
  const socialInsurance: SocialInsuranceComponents = {
    healthInsurance: yenToMan(socialInsuranceBreakdown.socialInsurance.healthInsurance),
    employeesPension: yenToMan(
      socialInsuranceBreakdown.socialInsurance.employeesPension,
    ),
    longTermCare: yenToMan(socialInsuranceBreakdown.socialInsurance.longTermCare),
    employmentInsurance: yenToMan(
      socialInsuranceBreakdown.socialInsurance.employmentInsurance,
    ),
  };
  const publicInsurance: PublicInsuranceComponents = {
    nationalPension: yenToMan(socialInsuranceBreakdown.publicInsurance.nationalPension),
    nationalHealthInsurance: yenToMan(
      socialInsuranceBreakdown.publicInsurance.nationalHealthInsurance,
    ),
    lateElderlyHealth: yenToMan(
      socialInsuranceBreakdown.publicInsurance.lateElderlyHealth,
    ),
    lateElderlyLongTermCare: yenToMan(
      socialInsuranceBreakdown.publicInsurance.lateElderlyLongTermCare,
    ),
  };

  return {
    incomeTaxMan,
    residentTaxMan,
    socialInsuranceMan,
    socialInsurance,
    publicInsurance,
    totalMan: Math.round((incomeTaxMan + residentTaxMan + socialInsuranceMan) * 10) / 10,
    isResidentTaxExemptHousehold: residentTaxAssessment.isExemptHousehold,
  };
}
