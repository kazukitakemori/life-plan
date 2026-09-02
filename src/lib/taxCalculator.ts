import {
  calcRetirementIncomeTaxBreakdown,
} from './retirementIncomeTax';
import type { FamilyMember } from '../types/family';
import type { DependentStatus, FilingType, IncomeByMember, IncomeEntry, IncomeStreamType, PriorYearIncomeByMember } from '../types/income';
import type { PensionByMember } from '../types/pension';
import { memberHasNewIncomeFromStartById } from './incomeStartFlags';
import { memberUsesAnnualBasisForIncomeTax } from './otherCashFlowLinkage';
import type { OtherProrationContext } from './otherCashFlowLinkage';
import {
  buildOtherProrationContext,
  prorateAnnualLevyYen,
} from './otherCashFlowLinkage';
import type { SavingsState } from '../types/savings';
import { calcMemberSelectiveDcManForMonth } from './dcContribution';
import {
  buildMemberIncomeProfileFromIncomeTaxAnnualBasis,
  calcMemberBusinessIncomeBreakdownYenForTaxYear,
  calcMemberSalaryBonusBreakdownYen,
  calcMemberSalaryBreakdownYenForTaxYear,
  collectIncomePeriodPairsActiveInCalendarYear,
  getMemberAgeAtYearEnd,
  buildQ7AnnualSalaryBonusSplitYen,
  shouldUseMonthlyIncomeInsteadOfAnnualBasis,
  resolveMemberYearIncomeProfile,
  type MemberSalaryBonusBreakdownYen,
  type SalaryBonusBreakdownOptions,
} from './memberYearIncome';
import {
  calcIncomeAdjustmentDeductionYen,
  calcSalaryIncomeDeductionYen,
  filingTypeDeductionYen,
  type BusinessIncomeBreakdownYen,
} from './incomeTaxDeductions';
import { getMemberTabLabel } from './memberDisplay';
import {
  allocateNhiPremiumAmongMembers,
  calcFukuokaHouseholdNhiBreakdown,
  calcPensionIncomeForNhiYen,
  resolveNhiMemberAgeFlags,
  type NhiHouseholdBreakdown,
  type NhiMemberInput,
} from './nationalHealthInsurance';
import {
  LATE_ELDERLY_HEALTH_INCOME_RATE,
  LATE_ELDERLY_HEALTH_PER_CAPITA_YEN,
  calcLateElderlyHealthHouseholdBreakdown,
  type LateElderlyHealthHouseholdBreakdown,
} from './lateElderlyHealthInsurance';
import { FUKUOKA_HEALTH_INSURANCE_RATES_R8, FUKUOKA_PENSION_INSURANCE_RATE } from '../data/fukuokaStandardRemunerationR8';
import {
  assessHouseholdResidentTax,
  buildHouseholdResidentTaxContext,
  type ResidentTaxExemptionLevel,
} from './residentTaxExemption';
import { qualifiesForIncomeAdjustmentDeduction } from './incomeAdjustmentDeduction';
import {
  calcBasicDeductionIncomeTaxYen,
  calcBasicDeductionResidentTaxYen,
} from './basicDeduction';
import {
  calcPersonalDeductionDiffYen,
  calcResidentTaxWithAdjustmentYen,
} from './residentTaxAdjustment';
import {
  calcSpouseDeductions,
  getSpouseTotalIncomeLimitYen,
  resolveSpouseDeductionKind,
  type SpouseDeductionKind,
} from './spouseDeduction';
import {
  resolveLevyIncomeReferenceYear,
  resolveMemberPriorYearIncome,
  resolveMemberPriorYearIncomeProfile,
  resolveResidentTaxLevyMonthRange,
  resolveResidentTaxLevyPhase,
  residentTaxLevyUsesAnnualIncomeBasis,
  usesPriorCalendarYearForResidentTaxLevy,
  type PriorYearIncomeResolution,
  type ResidentTaxLevyPhase,
} from './priorYearIncomeResolution';
import { NATIONAL_PENSION_ANNUAL_YEN } from './pensionConstants';
import { calcMemberLifeInsuranceDeductionYen, calcMemberAnnualLifeInsurancePremiumManByKind } from './lifeInsuranceDeduction';
import { calcMemberIdecoContributionDeductionYen } from './idecoContributionDeduction';
import {
  calcRecipientInsuranceIncomeTaxDetail,
  createEmptyInsuranceIncomeTaxDetail,
  sumInsuranceIncomeTaxableYen,
  type InsuranceIncomeTaxDetail,
} from './insuranceIncomeTax';
import type { HousingState } from '../types/housing';
import type { InsuranceState } from '../types/insurance';
import type { VehicleState } from '../types/vehicle';
import {
  calcBonusInsurancePremiumYen,
  calcEmployeeInsurancePremiumFromSalaryAndBonusYen,
  calcSalaryInsurancePremiumForSimulationMonthsYen,
  isEmployeesPensionLiableAtRemunerationMonth,
  type EmployeeSocialInsuranceDeductionContext,
} from './employeeSocialInsuranceDeduction';
import type { SpouseDeductionReferenceContext } from './taxBreakdownReferenceDetail';
import { premiumsManToYen } from './taxBreakdownReferenceDetail';
import type { LifeInsurancePremiumByKindMan } from './lifeInsuranceDeduction';
import { calcMemberAnnualPensionManByMember } from './pensionIncome';
import type { MemberYearIncomeProfile } from './memberYearIncome';
import {
  calcOtherIncomeExcludingPensionYen,
  calcPensionMiscIncomeYen,
  calcPublicPensionDeductionYen,
} from './publicPensionDeduction';

export {
  calcOtherIncomeExcludingPensionYen,
  calcPensionMiscIncomeYen,
  calcPublicPensionDeductionYen,
  describePublicPensionDeductionFormula,
  describePublicPensionOtherIncomeTierLabel,
  resolvePublicPensionOtherIncomeTier,
} from './publicPensionDeduction';

const MAN_TO_YEN = 10_000;

function usesAnnualIncomeTaxBasis(
  member: FamilyMember,
  incomeByMember: IncomeByMember,
  monthStart: number,
  monthEnd: number,
  calendarYear: number,
  referenceDate: Date,
  simulationStartYear: number = referenceDate.getFullYear(),
): boolean {
  return memberUsesAnnualBasisForIncomeTax(
    member,
    incomeByMember,
    monthStart,
    monthEnd,
    { calendarYear, referenceDate, simulationStartYear },
  );
}

const FUKUOKA_R8_HEALTH = FUKUOKA_HEALTH_INSURANCE_RATES_R8;

/** 福岡県ベースの概算定数（協会けんぽ福岡支部 R8_40fukuoka 準拠） */
const TAX_CONSTANTS = {
  residentTaxRate: 0.1,
  residentTaxPerCapita: 5_000,
  nationalPensionAnnualYen: NATIONAL_PENSION_ANNUAL_YEN,
  /** 被用者保険（本人負担・健保＋厚年＋雇用概算） */
  employeeSocialInsuranceRate: 0.145,
  /** 健康保険（医療・支援＋子ども子育て支援金・被保険者負担分） */
  employeeHealthInsuranceRate:
    (FUKUOKA_R8_HEALTH.medicalSupport + FUKUOKA_R8_HEALTH.childcare) / 2,
  /** 厚生年金（被用者負担分。総率の折半） */
  employeePensionRate: FUKUOKA_PENSION_INSURANCE_RATE / 2,
  /** 雇用保険（労働者負担分。一般の事業 0.5%） */
  employeeEmploymentInsuranceRate: 0.005,
  /** 介護保険（40〜64歳・第2号被保険者・被保険者負担分。総率1.62%の折半） */
  longTermCareRate: FUKUOKA_R8_HEALTH.nursingCare / 2,
  blueReturnDeductionYen: 650_000,
  /** 後期高齢者医療保険（所得割・福岡市国保の医療＋支援分） */
  lateElderlyHealthInsuranceRate: LATE_ELDERLY_HEALTH_INCOME_RATE,
  /** 後期高齢者医療保険（均等割・福岡市国保の医療＋支援分・軽減前） */
  lateElderlyHealthInsuranceFixed: LATE_ELDERLY_HEALTH_PER_CAPITA_YEN,
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
  longTermCare: number;
  lateElderlyHealth: number;
}

export interface TaxSocialBreakdown {
  incomeTaxMan: number;
  residentTaxMan: number;
  giftTaxMan: number;
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
    longTermCare: 0,
    lateElderlyHealth: 0,
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

function yenToMan(yen: number): number {
  return Math.round((yen / MAN_TO_YEN) * 10) / 10;
}

/** キャッシュフロー表と同じ万円丸めで円に戻す（表示値の唯一のソース） */
export function taxYenToCashFlowYen(yen: number): number {
  return Math.round(yenToMan(yen) * MAN_TO_YEN);
}

/** キャッシュフロー表と同じ万円丸めで所得税按分額（円）を返す */
function incomeTaxCashFlowYenFromAnnual(
  annualIncomeTaxYen: number,
  levyPaymentFactor: number,
): number {
  const basisYen =
    levyPaymentFactor >= 1
      ? annualIncomeTaxYen
      : prorateAnnualLevyYen(annualIncomeTaxYen, levyPaymentFactor);
  return taxYenToCashFlowYen(basisYen);
}

function residentTaxCashFlowYenFromAnnual(
  annualResidentTaxYen: number,
  levyPaymentFactor: number,
): number {
  const basisYen =
    levyPaymentFactor >= 1
      ? annualResidentTaxYen
      : prorateAnnualLevyYen(annualResidentTaxYen, levyPaymentFactor);
  return taxYenToCashFlowYen(basisYen);
}

function calcProgressiveIncomeTaxYen(taxableIncomeYen: number): number {
  const bracket = getProgressiveIncomeTaxBracket(taxableIncomeYen);
  return bracket.taxYen;
}

export function getProgressiveIncomeTaxBracket(taxableIncomeYen: number): {
  rate: number;
  deduction: number;
  taxYen: number;
} {
  if (taxableIncomeYen <= 0) {
    return { rate: 0, deduction: 0, taxYen: 0 };
  }

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
      return {
        rate: bracket.rate,
        deduction: bracket.deduction,
        taxYen: Math.max(
          0,
          Math.floor(taxableIncomeYen * bracket.rate - bracket.deduction),
        ),
      };
    }
  }
  return { rate: 0, deduction: 0, taxYen: 0 };
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

function calcInsurancePremiumFromSalaryAndBonusYen(
  incomeSplit: MemberSalaryBonusBreakdownYen,
  rate: number,
  purpose: 'health' | 'pension' | 'employment',
): number {
  if (incomeSplit.monthlyRemunerations.length > 0) {
    const salaryPart = incomeSplit.monthlyRemunerations.reduce((sum, month) => {
      const baseYen =
        purpose === 'health'
          ? month.standardHealthYen
          : purpose === 'pension'
            ? month.standardPensionYen
            : month.remunerationYen;
      return sum + Math.floor(baseYen * rate);
    }, 0);

    const bonusPart =
      incomeSplit.bonusTreatedAsRemuneration &&
      (purpose === 'health' || purpose === 'pension')
        ? 0
        : purpose === 'health'
          ? Math.floor(incomeSplit.standardHealthBonusTotalYen * rate)
          : purpose === 'pension'
            ? incomeSplit.bonusPayments.reduce(
                (sum, payment) =>
                  sum + Math.floor(payment.standardPensionYen * rate),
                0,
              )
            : Math.floor(incomeSplit.annualBonusYen * rate);

    return salaryPart + bonusPart;
  }

  const standardMonthly =
    purpose === 'health'
      ? incomeSplit.standardMonthlyRemunerationHealthYen
      : incomeSplit.standardMonthlyRemunerationYen;
  const salaryPart = Math.floor(standardMonthly * rate) * 12;
  const bonusBaseYen =
    incomeSplit.bonusTreatedAsRemuneration &&
    (purpose === 'health' || purpose === 'pension')
      ? 0
      : purpose === 'health'
        ? incomeSplit.standardHealthBonusTotalYen
        : purpose === 'pension'
          ? incomeSplit.bonusPayments.reduce(
              (sum, payment) => sum + payment.standardPensionYen,
              0,
            )
          : incomeSplit.annualBonusYen;
  const bonusPart = Math.floor(bonusBaseYen * rate);
  return salaryPart + bonusPart;
}

function calcHealthPremiumComponentYen(
  incomeSplit: MemberSalaryBonusBreakdownYen | undefined,
  grossIncomeYen: number,
  totalRate: number,
  deductionContext?: EmployeeSocialInsuranceDeductionContext,
): number {
  if (totalRate <= 0) return 0;
  const employeeRate = totalRate / 2;
  if (deductionContext) {
    return calcEmployeeInsurancePremiumFromSalaryAndBonusYen(
      deductionContext,
      employeeRate,
      'health',
    );
  }
  if (incomeSplit) {
    return calcInsurancePremiumFromSalaryAndBonusYen(
      incomeSplit,
      employeeRate,
      'health',
    );
  }
  return Math.floor(grossIncomeYen * employeeRate);
}

function calcEmploymentInsuranceYen(
  incomeSplit: MemberSalaryBonusBreakdownYen | undefined,
  grossIncomeYen: number,
  deductionContext?: EmployeeSocialInsuranceDeductionContext,
): number {
  const rate = TAX_CONSTANTS.employeeEmploymentInsuranceRate;
  if (deductionContext) {
    return calcEmployeeInsurancePremiumFromSalaryAndBonusYen(
      deductionContext,
      rate,
      'employment',
    );
  }
  if (incomeSplit) {
    return Math.floor(
      (incomeSplit.annualSalaryYen + incomeSplit.annualBonusYen) * rate,
    );
  }
  return Math.floor(grossIncomeYen * rate);
}

function socialInsuranceDeductionFromEmployeeAmounts(amounts: {
  employeesPensionYen: number;
  annualHealthMedicalSupportYen: number;
  annualHealthChildcareYen: number;
  annualHealthNursingYen: number;
  employmentInsuranceYen: number;
}): MemberTaxBreakdownData['incomeTax']['socialInsuranceDeduction'] {
  return {
    employeesPension: amounts.employeesPensionYen,
    healthInsurance:
      amounts.annualHealthMedicalSupportYen +
      amounts.annualHealthChildcareYen +
      amounts.annualHealthNursingYen,
    longTermCare: 0,
    nationalPension: 0,
    nationalHealthInsurance: 0,
    employmentInsurance: amounts.employmentInsuranceYen,
  };
}

/** 税の社会保険料控除表示用。介護分は健康保険に含める */
function mergeEmployeeHealthInsuranceDeduction(
  deduction: MemberTaxBreakdownData['incomeTax']['socialInsuranceDeduction'],
): MemberTaxBreakdownData['incomeTax']['socialInsuranceDeduction'] {
  if (deduction.longTermCare <= 0) {
    return deduction;
  }
  return {
    ...deduction,
    healthInsurance: deduction.healthInsurance + deduction.longTermCare,
    longTermCare: 0,
  };
}

/** 厚生年金・健康保険・雇用保険タブと同じ標準報酬月額ベースの内訳 */
function resolveEmployeeInsuranceBreakdownForMember(input: {
  member: FamilyMember;
  profile: PersonTaxProfile;
  socialInsuranceCalcContext: SocialInsuranceCalcContext;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  incomeEntries?: IncomeEntry[];
  employmentAnnualIncomeYenOverride?: number;
  /** Q7の12か月給与を暦年に依存せず展開して保険料を算出（前年所得読み替えの社保控除など） */
  useQ7AnnualPremiumBasis?: boolean;
  /**
   * true のとき Q7 年収ベースは維持しつつ、保険料合算は simulation の monthStart〜monthEnd のみ。
   * 初年度 CF の被用者社保を収入月数に合わせる用途（税の社保控除は別途年額）。
   */
  limitPremiumToSimulationMonths?: boolean;
}): {
  employeeCategory: ReturnType<typeof classifySocialInsuranceCategory>;
  incomeSplit: MemberSalaryBonusBreakdownYen | undefined;
  employeeDetail: ReturnType<typeof calcEmployeeSocialInsuranceDetailYen> | null;
  standardMonthlyRemunerationYen: number;
  standardMonthlyRemunerationHealthYen: number;
  standardHealthBonusYen: number;
  annualPensionFromSalaryYen: number;
  annualPensionFromBonusYen: number;
  annualHealthMedicalSupportYen: number;
  annualHealthChildcareYen: number;
  annualHealthNursingYen: number;
  employmentAnnualIncomeYen: number;
  employmentAnnualPremiumYen: number;
  socialInsuranceDeduction: MemberTaxBreakdownData['incomeTax']['socialInsuranceDeduction'];
  socialInsuranceTotalYen: number;
} {
  const {
    member,
    profile,
    socialInsuranceCalcContext,
    calendarYear,
    monthStart,
    monthEnd,
  } = input;
  const age = profile.age ?? 65;
  const employeeCategory = classifySocialInsuranceCategory(profile);
  const emptyAmounts = {
    employeesPensionYen: 0,
    annualHealthMedicalSupportYen: 0,
    annualHealthChildcareYen: 0,
    annualHealthNursingYen: 0,
    employmentInsuranceYen: 0,
  };

  if (employeeCategory !== 'employee') {
    const socialInsuranceDeduction =
      socialInsuranceDeductionFromEmployeeAmounts(emptyAmounts);
    return {
      employeeCategory,
      incomeSplit: undefined,
      employeeDetail: null,
      standardMonthlyRemunerationYen: 0,
      standardMonthlyRemunerationHealthYen: 0,
      standardHealthBonusYen: 0,
      annualPensionFromSalaryYen: 0,
      annualPensionFromBonusYen: 0,
      annualHealthMedicalSupportYen: 0,
      annualHealthChildcareYen: 0,
      annualHealthNursingYen: 0,
      employmentAnnualIncomeYen: 0,
      employmentAnnualPremiumYen: 0,
      socialInsuranceDeduction,
      socialInsuranceTotalYen: 0,
    };
  }

  const useAnnualPremiumMonths =
    Boolean(input.useQ7AnnualPremiumBasis) &&
    !input.limitPremiumToSimulationMonths;
  const premiumMonthStart = useAnnualPremiumMonths ? 1 : monthStart;
  const premiumMonthEnd = useAnnualPremiumMonths ? 12 : monthEnd;
  const contextForMonths: SocialInsuranceCalcContext = {
    ...socialInsuranceCalcContext,
    calendarYear,
    monthStart: premiumMonthStart,
    monthEnd: premiumMonthEnd,
  };
  const paycheckContext: EmployeesPensionPremiumContext = {
    member,
    referenceDate: socialInsuranceCalcContext.referenceDate,
    calendarYear,
    monthStart: premiumMonthStart,
    monthEnd: premiumMonthEnd,
  };
  let incomeSplit: MemberSalaryBonusBreakdownYen | undefined;
  if (input.useQ7AnnualPremiumBasis && input.incomeEntries) {
    const preferMonthly = shouldUseMonthlyIncomeInsteadOfAnnualBasis(
      member,
      input.incomeEntries,
      socialInsuranceCalcContext.referenceDate,
      calendarYear,
    );
    if (preferMonthly) {
      // 複数期間が同一年にある場合は月額×12展開せず暦月実績を使う
      incomeSplit =
        calcMemberSalaryBonusBreakdownYen(
          member,
          input.incomeEntries,
          socialInsuranceCalcContext.referenceDate,
          calendarYear,
          1,
          12,
          selectiveDcSalaryOptions(
            member,
            socialInsuranceCalcContext.referenceDate,
            calendarYear,
            socialInsuranceCalcContext.savingsState,
          ),
        ) ?? undefined;
    } else {
      incomeSplit =
        buildQ7AnnualSalaryBonusSplitYen(
          input.incomeEntries,
          collectIncomePeriodPairsActiveInCalendarYear(
            member,
            input.incomeEntries,
            socialInsuranceCalcContext.referenceDate,
            calendarYear,
          ),
          selectiveDcSalaryOptions(
            member,
            socialInsuranceCalcContext.referenceDate,
            calendarYear,
            socialInsuranceCalcContext.savingsState,
          ),
        ) ?? undefined;
    }
  }
  if (!incomeSplit) {
    incomeSplit = resolveMemberIncomeSplitYen(member.id, contextForMonths);
  }
  const employeeDeductionContext = buildEmployeeSocialInsuranceDeductionContext(
    member,
    contextForMonths,
    paycheckContext,
    incomeSplit,
  );
  const employeeDetail = calcEmployeeSocialInsuranceDetailYen(
    profile,
    incomeSplit,
    paycheckContext,
    contextForMonths,
  );

  const grossIncomeYen =
    input.useQ7AnnualPremiumBasis && input.incomeEntries
      ? calcMemberSalaryBreakdownYenForTaxYear({
          member,
          entries: input.incomeEntries,
          referenceDate: socialInsuranceCalcContext.referenceDate,
          calendarYear,
          annualize: true,
        }).grossSalaryRevenueYen
      : profile.grossIncomeYen;
  const annualSalaryYen = incomeSplit?.annualSalaryYen ?? grossIncomeYen;
  const annualBonusYen = incomeSplit?.annualBonusYen ?? 0;
  const employmentAnnualIncomeYen =
    input.employmentAnnualIncomeYenOverride ??
    annualSalaryYen + annualBonusYen;
  const employmentAnnualPremiumYen =
    input.employmentAnnualIncomeYenOverride != null && useAnnualPremiumMonths
      ? Math.round(
          input.employmentAnnualIncomeYenOverride *
            TAX_CONSTANTS.employeeEmploymentInsuranceRate,
        )
      : (employeeDetail?.social.employmentInsurance ?? 0);
  const standardMonthlyRemunerationYen =
    incomeSplit?.standardMonthlyRemunerationYen ??
    (grossIncomeYen > 0 ? Math.round(grossIncomeYen / 12) : 0);
  const standardMonthlyRemunerationHealthYen =
    incomeSplit?.standardMonthlyRemunerationHealthYen ??
    standardMonthlyRemunerationYen;
  const pensionRate = TAX_CONSTANTS.employeePensionRate;
  const annualPensionFromSalaryYen =
    employeeDeductionContext && age < 70
      ? calcSalaryInsurancePremiumForSimulationMonthsYen(
          employeeDeductionContext,
          pensionRate,
          'pension',
        )
      : (employeeDetail?.social.employeesPension ?? 0);
  const annualPensionFromBonusYen =
    employeeDeductionContext && !incomeSplit?.bonusTreatedAsRemuneration
      ? calcBonusInsurancePremiumYen(
          employeeDeductionContext.currentYearSplit,
          pensionRate,
          'pension',
          (calendarMonth) =>
            isEmployeesPensionLiableAtRemunerationMonth(
              employeeDeductionContext,
              calendarYear,
              calendarMonth,
            ),
          premiumMonthStart,
          premiumMonthEnd,
        )
      : 0;
  const healthMedicalSupportRate = FUKUOKA_HEALTH_INSURANCE_RATES_R8.medicalSupport;
  const healthChildcareRate = FUKUOKA_HEALTH_INSURANCE_RATES_R8.childcare;
  const healthNursingRate =
    age >= 40 && age < 65 ? FUKUOKA_HEALTH_INSURANCE_RATES_R8.nursingCare : 0;
  const standardHealthBonusYen = incomeSplit?.bonusTreatedAsRemuneration
    ? 0
    : (incomeSplit?.standardHealthBonusTotalYen ?? 0);
  const annualHealthMedicalSupportYen = calcHealthPremiumComponentYen(
    incomeSplit,
    grossIncomeYen,
    healthMedicalSupportRate,
    employeeDeductionContext,
  );
  const annualHealthChildcareYen = calcHealthPremiumComponentYen(
    incomeSplit,
    grossIncomeYen,
    healthChildcareRate,
    employeeDeductionContext,
  );
  const annualHealthNursingYen = calcHealthPremiumComponentYen(
    incomeSplit,
    grossIncomeYen,
    healthNursingRate,
    employeeDeductionContext,
  );
  const socialInsuranceDeduction = socialInsuranceDeductionFromEmployeeAmounts({
    employeesPensionYen: annualPensionFromSalaryYen + annualPensionFromBonusYen,
    annualHealthMedicalSupportYen,
    annualHealthChildcareYen,
    annualHealthNursingYen,
    employmentInsuranceYen: employmentAnnualPremiumYen,
  });
  const socialInsuranceTotalYen = Object.values(socialInsuranceDeduction).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    employeeCategory,
    incomeSplit,
    employeeDetail,
    standardMonthlyRemunerationYen,
    standardMonthlyRemunerationHealthYen,
    standardHealthBonusYen,
    annualPensionFromSalaryYen,
    annualPensionFromBonusYen,
    annualHealthMedicalSupportYen,
    annualHealthChildcareYen,
    annualHealthNursingYen,
    employmentAnnualIncomeYen,
    employmentAnnualPremiumYen,
    socialInsuranceDeduction,
    socialInsuranceTotalYen,
  };
}

interface EmployeesPensionPremiumContext {
  member: Pick<FamilyMember, 'id' | 'age' | 'birthMonth'>;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
}

function resolveMemberFullYearIncomeSplitYen(
  memberId: string,
  context: SocialInsuranceCalcContext,
  calendarYear: number,
): MemberSalaryBonusBreakdownYen | undefined {
  const member = context.familyMembers.find((m) => m.id === memberId);
  if (!member) return undefined;
  return calcMemberSalaryBonusBreakdownYen(
    member,
    context.incomeByMember[memberId] ?? [],
    context.referenceDate,
    calendarYear,
    1,
    12,
    selectiveDcSalaryOptions(
      member,
      context.referenceDate,
      calendarYear,
      context.savingsState,
    ),
  );
}

function buildEmployeeSocialInsuranceDeductionContext(
  member: Pick<FamilyMember, 'id' | 'age' | 'birthMonth'>,
  context: SocialInsuranceCalcContext,
  paycheckContext: EmployeesPensionPremiumContext,
  currentYearSplitOverride?: MemberSalaryBonusBreakdownYen,
): EmployeeSocialInsuranceDeductionContext | undefined {
  const currentYearSplit =
    currentYearSplitOverride ??
    resolveMemberFullYearIncomeSplitYen(
      member.id,
      context,
      paycheckContext.calendarYear,
    );
  if (!currentYearSplit) return undefined;

  const previousYearSplit =
    paycheckContext.monthStart <= 1
      ? resolveMemberFullYearIncomeSplitYen(
          member.id,
          context,
          paycheckContext.calendarYear - 1,
        )
      : undefined;

  return {
    member,
    referenceDate: paycheckContext.referenceDate,
    calendarYear: paycheckContext.calendarYear,
    monthStart: paycheckContext.monthStart,
    monthEnd: paycheckContext.monthEnd,
    currentYearSplit,
    previousYearSplit,
  };
}

function calcEmployeeSocialInsuranceDetailYen(
  profile: PersonTaxProfile,
  incomeSplit?: MemberSalaryBonusBreakdownYen,
  employeesPensionContext?: EmployeesPensionPremiumContext,
  socialInsuranceCalcContext?: SocialInsuranceCalcContext,
): { social: SocialInsuranceComponents; totalYen: number } {
  const age = profile.age ?? 0;
  const gross = profile.grossIncomeYen;
  const split =
    incomeSplit ??
    ({
      annualSalaryYen: gross,
      annualBonusYen: 0,
      standardMonthlyRemunerationYen:
        gross > 0 ? Math.round(gross / 12) : 0,
      standardMonthlyRemunerationHealthYen:
        gross > 0 ? Math.round(gross / 12) : 0,
      monthlyRemunerations: [],
      bonusPayments: [],
      standardHealthBonusTotalYen: 0,
      bonusPaymentCount: 0,
      bonusTreatedAsRemuneration: false,
      monthlyBonusShareYen: 0,
    } satisfies MemberSalaryBonusBreakdownYen);

  const deductionContext =
    employeesPensionContext && socialInsuranceCalcContext
      ? buildEmployeeSocialInsuranceDeductionContext(
          employeesPensionContext.member,
          socialInsuranceCalcContext,
          employeesPensionContext,
        )
      : undefined;

  const calcPremium = (rate: number, purpose: 'health' | 'pension' | 'employment') => {
    if (deductionContext) {
      return calcEmployeeInsurancePremiumFromSalaryAndBonusYen(
        deductionContext,
        rate,
        purpose,
      );
    }
    if (incomeSplit) {
      return calcInsurancePremiumFromSalaryAndBonusYen(split, rate, purpose);
    }
    return Math.floor(gross * rate);
  };

  const pensionRate = TAX_CONSTANTS.employeePensionRate;
  const employeesPension =
    (profile.age ?? 0) < 70 ? calcPremium(pensionRate, 'pension') : 0;

  const social: SocialInsuranceComponents = {
    healthInsurance: calcPremium(
      TAX_CONSTANTS.employeeHealthInsuranceRate,
      'health',
    ),
    employeesPension,
    longTermCare: 0,
    employmentInsurance: calcEmploymentInsuranceYen(
      split,
      gross,
      deductionContext,
    ),
  };

  if (age >= 40 && age < 65) {
    social.longTermCare = calcPremium(TAX_CONSTANTS.longTermCareRate, 'health');
  } else if (age >= 65) {
    social.longTermCare = TAX_CONSTANTS.longTermCareFirstClassAnnual;
  }

  return {
    social,
    totalYen: sumSocialInsuranceComponents(social),
  };
}

function buildHouseholdLateElderlyBreakdown(input: {
  lateElderlyEntries: MemberSocialInsuranceEntry[];
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  assessmentCalendarYear: number;
  levyProfilesByMemberId: Record<string, PersonTaxProfile>;
  assessmentProfilesByMemberId: Record<string, PersonTaxProfile>;
  levyResolutionsByMemberId: Record<string, PriorYearIncomeResolution>;
}): LateElderlyHealthHouseholdBreakdown | null {
  if (input.lateElderlyEntries.length === 0) return null;

  const levyIncomeCalendarYear = resolveLevyIncomeReferenceYear(
    input.assessmentCalendarYear,
  );

  const memberInputs = input.lateElderlyEntries
    .map((entry) => {
      const member = input.familyMembers.find((m) => m.id === entry.memberId);
      const assessmentProfile =
        input.assessmentProfilesByMemberId[entry.memberId] ?? entry.profile;
      const age = assessmentProfile.age ?? 0;
      if (age < 75) return null;

      const levyProfile =
        input.levyProfilesByMemberId[entry.memberId] ?? entry.profile;
      const resolution =
        input.levyResolutionsByMemberId[entry.memberId] ?? 'reference_year';
      const salaryCalendarYear =
        resolution === 'reference_year'
          ? levyIncomeCalendarYear
          : input.assessmentCalendarYear;

      if (!member) {
        const pensionRevenueYen = Math.round(
          levyProfile.annualPensionMan * MAN_TO_YEN,
        );
        const pensionIncomeYen = calcPensionIncomeForNhiYen(
          pensionRevenueYen,
          levyProfile.age ?? age,
          levyProfile.totalIncomeYen,
        );
        return {
          memberId: entry.memberId,
          age,
          grossSalaryRevenueYen: 0,
          salaryIncomeDeductionYen: 0,
          incomeAdjustmentDeductionYen: 0,
          salaryIncomeYen: 0,
          pensionRevenueYen,
          pensionIncomeYen,
          otherIncomeYen: levyProfile.totalIncomeYen,
          totalIncomeYen: levyProfile.totalIncomeYen + pensionIncomeYen,
          hasSalary: levyProfile.grossIncomeYen > 0,
          ...resolveNhiMemberAgeFlags(age),
        } satisfies NhiMemberInput;
      }

      return buildNhiMemberInput({
        member,
        assessmentProfile,
        levyProfile,
        incomeEntries: input.incomeByMember[member.id] ?? [],
        familyMembers: input.familyMembers,
        referenceDate: input.referenceDate,
        assessmentCalendarYear: input.assessmentCalendarYear,
        levyIncomeCalendarYear,
        salaryCalendarYear,
      });
    })
    .filter((memberInput): memberInput is NhiMemberInput => memberInput != null);

  if (memberInputs.length === 0) return null;

  return calcLateElderlyHealthHouseholdBreakdown(memberInputs);
}

function buildNhiMemberInput(input: {
  member: FamilyMember;
  assessmentProfile: PersonTaxProfile;
  levyProfile: PersonTaxProfile;
  incomeEntries: IncomeEntry[];
  familyMembers: FamilyMember[];
  referenceDate: Date;
  assessmentCalendarYear: number;
  levyIncomeCalendarYear: number;
  salaryCalendarYear: number;
}): NhiMemberInput {
  const age = input.assessmentProfile.age ?? 0;
  const salarySplit = calcMemberSalaryBonusBreakdownYen(
    input.member,
    input.incomeEntries,
    input.referenceDate,
    input.salaryCalendarYear,
  );
  const salaryFromSplitYen =
    salarySplit.annualSalaryYen + salarySplit.annualBonusYen;
  const grossSalaryRevenueYen =
    input.levyProfile.grossIncomeYen > 0
      ? input.levyProfile.grossIncomeYen
      : salaryFromSplitYen;
  const baseSalaryIncomeDeductionYen = calcSalaryIncomeDeductionYen(
    grossSalaryRevenueYen,
    input.salaryCalendarYear,
  );
  const { deductionYen: incomeAdjustmentDeductionYen } =
    resolveMemberIncomeAdjustmentDeductionYen({
      member: input.member,
      familyMembers: input.familyMembers,
      incomeEntries: input.incomeEntries,
      referenceDate: input.referenceDate,
      calendarYear: input.levyIncomeCalendarYear,
    });
  const salaryIncomeYen = Math.max(
    0,
    Math.max(
      0,
      grossSalaryRevenueYen - baseSalaryIncomeDeductionYen,
    ) - incomeAdjustmentDeductionYen,
  );
  const pensionRevenueYen = Math.round(
    input.levyProfile.annualPensionMan * MAN_TO_YEN,
  );
  const salaryIncomeFromSplitYen = Math.max(
    0,
    grossSalaryRevenueYen - baseSalaryIncomeDeductionYen,
  );
  const otherIncomeYen = Math.max(
    0,
    input.levyProfile.totalIncomeYen - salaryIncomeFromSplitYen,
  );
  const otherIncomeForPensionYen = salaryIncomeYen + otherIncomeYen;
  const pensionIncomeYen = calcPensionIncomeForNhiYen(
    pensionRevenueYen,
    input.levyProfile.age ?? age,
    otherIncomeForPensionYen,
  );
  const totalIncomeYen = salaryIncomeYen + pensionIncomeYen + otherIncomeYen;

  return {
    memberId: input.member.id,
    memberLabel: getMemberTabLabel(input.member),
    age,
    grossSalaryRevenueYen,
    salaryIncomeDeductionYen: baseSalaryIncomeDeductionYen,
    incomeAdjustmentDeductionYen,
    salaryIncomeYen,
    pensionRevenueYen,
    pensionIncomeYen,
    otherIncomeYen,
    totalIncomeYen,
    hasSalary: grossSalaryRevenueYen > 0,
    ...resolveNhiMemberAgeFlags(age),
  };
}

function buildHouseholdNhiBreakdown(input: {
  nhiEntries: MemberSocialInsuranceEntry[];
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  assessmentCalendarYear: number;
  levyProfilesByMemberId: Record<string, PersonTaxProfile>;
  assessmentProfilesByMemberId: Record<string, PersonTaxProfile>;
  levyResolutionsByMemberId: Record<string, PriorYearIncomeResolution>;
}): NhiHouseholdBreakdown | null {
  if (input.nhiEntries.length === 0) return null;

  const levyIncomeCalendarYear = resolveLevyIncomeReferenceYear(
    input.assessmentCalendarYear,
  );

  const memberInputs = input.nhiEntries.map((entry) => {
    const member = input.familyMembers.find((m) => m.id === entry.memberId);
    const assessmentProfile =
      input.assessmentProfilesByMemberId[entry.memberId] ?? entry.profile;
    const levyProfile =
      input.levyProfilesByMemberId[entry.memberId] ?? entry.profile;
    const resolution =
      input.levyResolutionsByMemberId[entry.memberId] ?? 'reference_year';
    const salaryCalendarYear =
      resolution === 'reference_year'
        ? levyIncomeCalendarYear
        : input.assessmentCalendarYear;

    if (!member) {
      const age = assessmentProfile.age ?? 0;
      const pensionRevenueYen = Math.round(
        levyProfile.annualPensionMan * MAN_TO_YEN,
      );
      const pensionIncomeYen = calcPensionIncomeForNhiYen(
        pensionRevenueYen,
        levyProfile.age ?? age,
        levyProfile.totalIncomeYen,
      );
      return {
        memberId: entry.memberId,
        age,
        grossSalaryRevenueYen: 0,
        salaryIncomeDeductionYen: 0,
        incomeAdjustmentDeductionYen: 0,
        salaryIncomeYen: 0,
        pensionRevenueYen,
        pensionIncomeYen,
        otherIncomeYen: levyProfile.totalIncomeYen,
        totalIncomeYen: levyProfile.totalIncomeYen + pensionIncomeYen,
        hasSalary: levyProfile.grossIncomeYen > 0,
        ...resolveNhiMemberAgeFlags(age),
      } satisfies NhiMemberInput;
    }

    return buildNhiMemberInput({
      member,
      assessmentProfile,
      levyProfile,
      incomeEntries: input.incomeByMember[member.id] ?? [],
      familyMembers: input.familyMembers,
      referenceDate: input.referenceDate,
      assessmentCalendarYear: input.assessmentCalendarYear,
      levyIncomeCalendarYear,
      salaryCalendarYear,
    });
  });

  return calcFukuokaHouseholdNhiBreakdown(memberInputs);
}

interface MemberSocialInsuranceEntry {
  memberId: string;
  profile: PersonTaxProfile;
}

interface SocialInsuranceCalcContext {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  simulationStartYear: number;
  levyProfilesByMemberId: Record<string, PersonTaxProfile>;
  assessmentProfilesByMemberId: Record<string, PersonTaxProfile>;
  levyResolutionsByMemberId: Record<string, PriorYearIncomeResolution>;
  /** 選択型DC加入者掛金を標準報酬から控除するために使用 */
  savingsState?: SavingsState;
}

function selectiveDcSalaryOptions(
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  savingsState: SavingsState | undefined,
): SalaryBonusBreakdownOptions | undefined {
  if (!savingsState) return undefined;
  return {
    selectiveDcManForMonth: (month) =>
      calcMemberSelectiveDcManForMonth(
        member,
        savingsState,
        referenceDate,
        calendarYear,
        month,
      ),
  };
}

/** 試算対象年の被用者保険料（標準報酬月額ベース）。CF・その他タブ・税控除で共有 */
function resolveAssessmentEmployeeInsuranceForMember(input: {
  member: FamilyMember;
  profile: PersonTaxProfile;
  context: SocialInsuranceCalcContext;
  incomeEntries?: IncomeEntry[];
  /** 初年度 CF 用: Q7 基礎は維持し保険料はシミュレーション月のみ */
  limitPremiumToSimulationMonths?: boolean;
}): ReturnType<typeof resolveEmployeeInsuranceBreakdownForMember> {
  const { member, profile, context } = input;
  const incomeEntries =
    input.incomeEntries ?? context.incomeByMember[member.id] ?? [];
  const useQ7AnnualPremiumBasis = usesAnnualIncomeTaxBasis(
    member,
    context.incomeByMember,
    context.monthStart,
    context.monthEnd,
    context.calendarYear,
    context.referenceDate,
    context.simulationStartYear,
  );
  const employmentAnnualIncomeYenOverride = useQ7AnnualPremiumBasis
    ? calcMemberSalaryBreakdownYenForTaxYear({
        member,
        entries: incomeEntries,
        referenceDate: context.referenceDate,
        calendarYear: context.calendarYear,
        annualize: true,
      }).grossSalaryRevenueYen
    : undefined;

  return resolveEmployeeInsuranceBreakdownForMember({
    member,
    profile,
    socialInsuranceCalcContext: context,
    calendarYear: context.calendarYear,
    monthStart: context.monthStart,
    monthEnd: context.monthEnd,
    incomeEntries,
    employmentAnnualIncomeYenOverride,
    useQ7AnnualPremiumBasis,
    limitPremiumToSimulationMonths: input.limitPremiumToSimulationMonths,
  });
}

function addEmployeeInsuranceComponentsToSocial(
  target: SocialInsuranceComponents,
  breakdown: ReturnType<typeof resolveEmployeeInsuranceBreakdownForMember>,
): void {
  target.employeesPension +=
    breakdown.annualPensionFromSalaryYen + breakdown.annualPensionFromBonusYen;
  target.healthInsurance +=
    breakdown.annualHealthMedicalSupportYen + breakdown.annualHealthChildcareYen;
  target.longTermCare += breakdown.annualHealthNursingYen;
  target.employmentInsurance += breakdown.employmentAnnualPremiumYen;
}

function resolveMemberIncomeSplitYen(
  memberId: string,
  context: SocialInsuranceCalcContext,
): MemberSalaryBonusBreakdownYen | undefined {
  const member = context.familyMembers.find((m) => m.id === memberId);
  if (!member) return undefined;
  return calcMemberSalaryBonusBreakdownYen(
    member,
    context.incomeByMember[memberId] ?? [],
    context.referenceDate,
    context.calendarYear,
    context.monthStart,
    context.monthEnd,
    selectiveDcSalaryOptions(
      member,
      context.referenceDate,
      context.calendarYear,
      context.savingsState,
    ),
  );
}

/**
 * 世帯の社会保険料（年額・円）。
 * 国保は福岡市ベースで世帯単位（2割・5割・7割軽減）で計算し、被保険者へ按分する。
 */
function calcHouseholdSocialInsuranceBreakdown(
  entries: MemberSocialInsuranceEntry[],
  context: SocialInsuranceCalcContext,
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
  const lateElderlyEntries: MemberSocialInsuranceEntry[] = [];

  for (const entry of entries) {
    const { memberId, profile } = entry;
    const category = classifySocialInsuranceCategory(profile);
    switch (category) {
      case 'employee': {
        const member = context.familyMembers.find((m) => m.id === memberId);
        if (!member) break;
        const breakdown = resolveAssessmentEmployeeInsuranceForMember({
          member,
          profile,
          context,
        });
        addEmployeeInsuranceComponentsToSocial(socialInsurance, breakdown);
        byMemberId[memberId] = breakdown.socialInsuranceTotalYen;
        total += breakdown.socialInsuranceTotalYen;
        break;
      }
      case 'late_elderly': {
        lateElderlyEntries.push(entry);
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

  if (lateElderlyEntries.length > 0) {
    const lateElderlyBreakdown = buildHouseholdLateElderlyBreakdown({
      lateElderlyEntries,
      familyMembers: context.familyMembers,
      incomeByMember: context.incomeByMember,
      priorYearIncomeByMember: context.priorYearIncomeByMember,
      referenceDate: context.referenceDate,
      assessmentCalendarYear: context.calendarYear,
      levyProfilesByMemberId: context.levyProfilesByMemberId,
      assessmentProfilesByMemberId: context.assessmentProfilesByMemberId,
      levyResolutionsByMemberId: context.levyResolutionsByMemberId,
    });

    for (const entry of lateElderlyEntries) {
      const age = entry.profile.age ?? 0;
      const memberBreakdown = lateElderlyBreakdown?.members.find(
        (member) => member.memberId === entry.memberId,
      );
      const healthPremiumYen = memberBreakdown?.premiumYen ?? 0;
      const ltcPremiumYen =
        age >= 75 ? TAX_CONSTANTS.longTermCareFirstClassAnnual : 0;
      publicInsurance.lateElderlyHealth += healthPremiumYen;
      publicInsurance.longTermCare += ltcPremiumYen;
      const memberTotalYen = healthPremiumYen + ltcPremiumYen;
      byMemberId[entry.memberId] = memberTotalYen;
      total += memberTotalYen;
    }
  }

  if (nhiEntries.length > 0) {
    const nhiBreakdown = buildHouseholdNhiBreakdown({
      nhiEntries,
      familyMembers: context.familyMembers,
      incomeByMember: context.incomeByMember,
      priorYearIncomeByMember: context.priorYearIncomeByMember,
      referenceDate: context.referenceDate,
      assessmentCalendarYear: context.calendarYear,
      levyProfilesByMemberId: context.levyProfilesByMemberId,
      assessmentProfilesByMemberId: context.assessmentProfilesByMemberId,
      levyResolutionsByMemberId: context.levyResolutionsByMemberId,
    });
    const premiumYen = nhiBreakdown?.premiumYen ?? 0;
    publicInsurance.nationalHealthInsurance += premiumYen;
    total += premiumYen;

    const shares = allocateNhiPremiumAmongMembers(
      premiumYen,
      nhiEntries.length,
    );
    nhiEntries.forEach((entry, index) => {
      const age = entry.profile.age ?? 0;
      const ltcPremiumYen =
        age >= 65 ? TAX_CONSTANTS.longTermCareFirstClassAnnual : 0;
      publicInsurance.longTermCare += ltcPremiumYen;
      byMemberId[entry.memberId] =
        (byMemberId[entry.memberId] ?? 0) + (shares[index] ?? 0);
      total += ltcPremiumYen;
    });
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
  const incomeLimitMan = getSpouseTotalIncomeLimitYen(calendarYear) / MAN_TO_YEN;
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

    // 年金所得を加算して合計所得を求め、上限超なら控除なし
    const pensionMan = annualPensionManByMember[member.id] ?? 0;
    const pensionIncomeYen = calcPensionMiscIncomeYen(
      Math.round(pensionMan * MAN_TO_YEN),
      age,
      Math.round(profile.taxableIncomeMan * MAN_TO_YEN),
    );
    const totalIncomeManWithPension =
      profile.totalIncomeMan + pensionIncomeYen / MAN_TO_YEN;

    if (totalIncomeManWithPension > incomeLimitMan) continue;

    const deduction = calcDependentDeductionForMember(member, age);
    incomeTaxYen += deduction.incomeTaxYen;
    residentTaxYen += deduction.residentTaxYen;
  }

  return { incomeTaxYen, residentTaxYen };
}

/** 世帯主の申告に適用する配偶者控除・配偶者特別控除 */
function calcTaxpayerTotalIncomeYenForSpouseDeduction(
  profile: PersonTaxProfile,
  incomeAdjustmentDeductionYen = 0,
): number {
  const pensionYen = Math.round(profile.annualPensionMan * MAN_TO_YEN);
  const age = profile.age ?? 65;
  const otherIncomeYen = calcOtherIncomeExcludingPensionYen(
    profile.taxableIncomeYen,
    incomeAdjustmentDeductionYen,
  );
  const pensionIncomeYen = calcPensionMiscIncomeYen(
    pensionYen,
    age,
    otherIncomeYen,
  );
  return Math.max(
    0,
    profile.taxableIncomeYen +
      pensionIncomeYen -
      incomeAdjustmentDeductionYen,
  );
}

function calcHeadSpouseDeductions(
  head: PersonTaxProfile,
  spouse: PersonTaxProfile | null,
  calendarYear: number,
  spouseAgeAtYearEnd: number | null,
  headTotalIncomeYen: number,
  spouseTotalIncomeYen: number,
): DependentDeductions {
  if (!spouse) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }
  if (!isTaxIndependent(head)) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }

  // 配偶者控除・配偶者特別控除は「扶養親族」ではなく「配偶者」の所得要件で判定する
  // （収入がある配偶者が Q7 で「独立」になっていても適用する）
  return calcSpouseDeductions({
    headTotalIncomeYen,
    spouseTotalIncomeYen,
    spouseAgeAtYearEnd,
    calendarYear,
  });
}

/**
 * 個人の所得税・住民税（年額・円）を計算する。
 *
 * 課税所得 = 給与/事業所得 ＋ 年金雑所得 − 社会保険料控除 − 基礎控除 − 各種控除
 *
 * 給与/事業所得  = grossIncomeYen − 給与所得控除（または青色申告特別控除）
 * 年金雑所得     = annualPensionMan × 10,000 − 公的年金等控除額
 */
function calcResidentTaxLevyAndPerCapitaYen(
  taxableResidentTaxBase: number,
  exemptionLevel: ResidentTaxExemptionLevel,
): { incomeLevyYen: number; perCapitaYen: number } {
  if (exemptionLevel === 'fully_exempt') {
    return { incomeLevyYen: 0, perCapitaYen: 0 };
  }

  const incomeLevyYen =
    exemptionLevel === 'income_levy_exempt'
      ? 0
      : Math.floor(taxableResidentTaxBase * TAX_CONSTANTS.residentTaxRate);
  const perCapitaYen = TAX_CONSTANTS.residentTaxPerCapita;

  return { incomeLevyYen, perCapitaYen };
}

function calcResidentTaxYen(
  taxableResidentTaxBase: number,
  exemptionLevel: ResidentTaxExemptionLevel,
  personalDeductionDiffYen = 0,
  totalIncomeYen = 0,
): number {
  const { incomeLevyYen, perCapitaYen } = calcResidentTaxLevyAndPerCapitaYen(
    taxableResidentTaxBase,
    exemptionLevel,
  );

  if (personalDeductionDiffYen <= 0 || totalIncomeYen <= 0) {
    return incomeLevyYen + perCapitaYen;
  }

  return calcResidentTaxWithAdjustmentYen({
    taxableIncomeYen: taxableResidentTaxBase,
    totalIncomeYen,
    personalDeductionDiffYen,
    incomeLevyYen,
    perCapitaYen,
  }).adjustedResidentTaxYen;
}

function resolveSalaryBreakdownYenForCalendarYear(input: {
  member: FamilyMember;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  fallbackGrossIncomeYen?: number;
}): { grossSalaryRevenueYen: number; salaryIncomeYen: number } {
  const split = calcMemberSalaryBonusBreakdownYen(
    input.member,
    input.incomeEntries,
    input.referenceDate,
    input.calendarYear,
    input.monthStart,
    input.monthEnd,
  );
  let grossSalaryRevenueYen = split.annualSalaryYen + split.annualBonusYen;
  if (grossSalaryRevenueYen <= 0 && (input.fallbackGrossIncomeYen ?? 0) > 0) {
    grossSalaryRevenueYen = input.fallbackGrossIncomeYen!;
  }
  const baseSalaryIncomeDeductionYen = calcSalaryIncomeDeductionYen(
    grossSalaryRevenueYen,
    input.calendarYear,
  );
  return {
    grossSalaryRevenueYen,
    salaryIncomeYen: Math.max(0, grossSalaryRevenueYen - baseSalaryIncomeDeductionYen),
  };
}

function resolveMemberIncomeAdjustmentDeductionYen(input: {
  member: FamilyMember;
  familyMembers: FamilyMember[];
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
  /** 前年度収入入力など、Q7期間から算出しない給与収入（円） */
  salaryRevenueYenOverride?: number;
}): { deductionYen: number; qualifies: boolean } {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const grossSalaryRevenueYen =
    input.salaryRevenueYenOverride ??
    resolveSalaryBreakdownYenForCalendarYear({
      member: input.member,
      incomeEntries: input.incomeEntries,
      referenceDate: input.referenceDate,
      calendarYear: input.calendarYear,
      monthStart,
      monthEnd,
    }).grossSalaryRevenueYen;
  const qualifies = qualifiesForIncomeAdjustmentDeduction({
    salaryRevenueYen: grossSalaryRevenueYen,
    taxpayer: input.member,
    familyMembers: input.familyMembers,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
  });

  return {
    qualifies,
    deductionYen: calcIncomeAdjustmentDeductionYen(
      grossSalaryRevenueYen,
      qualifies,
    ),
  };
}

function calcPersonTaxesYen(
  profile: PersonTaxProfile,
  extraIncomeTaxDeductionYen: number,
  extraResidentTaxDeductionYen: number,
  calendarYear: number,
  socialInsuranceYenOverride?: number,
  residentTaxExemptionLevel: ResidentTaxExemptionLevel = 'taxable',
  incomeAdjustmentDeductionYen = 0,
  residentTaxIncome?: {
    profile: PersonTaxProfile;
    calendarYear: number;
    incomeAdjustmentDeductionYen: number;
  },
  /** 住民税の社会保険料控除（円）。省略時は socialInsuranceYenOverride を流用 */
  residentTaxSocialInsuranceYen?: number,
  /** 保険収入などの一時所得の合計所得算入額（円・所得税） */
  additionalIncomeTaxIncomeYen?: number,
  /** 保険収入などの一時所得の合計所得算入額（円・住民税基準年） */
  additionalResidentTaxIncomeYen?: number,
): { incomeTaxYen: number; residentTaxYen: number } {
  if (!isTaxIndependent(profile)) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }

  const additionalIncomeTaxYen = additionalIncomeTaxIncomeYen ?? 0;
  const additionalResidentTaxYen = additionalResidentTaxIncomeYen ?? 0;

  const pensionYen = Math.round(profile.annualPensionMan * MAN_TO_YEN);
  const residentProfile = residentTaxIncome?.profile ?? profile;
  const residentPensionYen = Math.round(residentProfile.annualPensionMan * MAN_TO_YEN);

  const hasCurrentYearIncome =
    profile.taxableIncomeYen > 0 || pensionYen > 0 || additionalIncomeTaxYen > 0;
  const hasResidentTaxLevyIncome =
    residentProfile.taxableIncomeYen > 0 ||
    residentPensionYen > 0 ||
    additionalResidentTaxYen > 0;

  if (!hasCurrentYearIncome && !hasResidentTaxLevyIncome) {
    return {
      incomeTaxYen: 0,
      residentTaxYen: calcResidentTaxYen(0, residentTaxExemptionLevel),
    };
  }

  if (!hasCurrentYearIncome) {
    const residentAge = residentProfile.age ?? profile.age ?? 65;
    const residentIncomeAdjustmentYen =
      residentTaxIncome?.incomeAdjustmentDeductionYen ??
      incomeAdjustmentDeductionYen;
    const residentOtherIncomeYen = calcOtherIncomeExcludingPensionYen(
      residentProfile.taxableIncomeYen,
      residentIncomeAdjustmentYen,
    );
    const residentPensionIncomeYen = calcPensionMiscIncomeYen(
      residentPensionYen,
      residentAge,
      residentOtherIncomeYen,
    );
    const totalIncomeForResidentTax = Math.max(
      0,
      residentProfile.taxableIncomeYen +
        residentPensionIncomeYen +
        additionalResidentTaxYen -
        residentIncomeAdjustmentYen,
    );
    const basicDeductionResidentTaxYen = calcBasicDeductionResidentTaxYen(
      totalIncomeForResidentTax,
    );
    const socialInsuranceYen = socialInsuranceYenOverride ?? 0;
    const residentTaxSocialYen =
      residentTaxSocialInsuranceYen ?? socialInsuranceYen;
    const taxableResidentTaxBase = Math.max(
      0,
      totalIncomeForResidentTax -
        residentTaxSocialYen -
        basicDeductionResidentTaxYen -
        extraResidentTaxDeductionYen,
    );
    const personalDeductionDiffYen = calcPersonalDeductionDiffYen({
      basicDeductionIncomeTaxYen: calcBasicDeductionIncomeTaxYen(0, calendarYear),
      basicDeductionResidentTaxYen,
      spouseIncomeTaxYen: extraIncomeTaxDeductionYen,
      spouseResidentTaxYen: extraResidentTaxDeductionYen,
      dependentIncomeTaxYen: 0,
      dependentResidentTaxYen: 0,
      lifeInsuranceIncomeTaxYen: 0,
      lifeInsuranceResidentTaxYen: 0,
    });
    const residentTaxYen = calcResidentTaxYen(
      taxableResidentTaxBase,
      residentTaxExemptionLevel,
      personalDeductionDiffYen,
      totalIncomeForResidentTax,
    );
    return { incomeTaxYen: 0, residentTaxYen };
  }

  const age = profile.age ?? 65;
  const otherIncomeYen = calcOtherIncomeExcludingPensionYen(
    profile.taxableIncomeYen,
    incomeAdjustmentDeductionYen,
  );
  const pensionIncomeYen = calcPensionMiscIncomeYen(
    pensionYen,
    age,
    otherIncomeYen,
  );
  const socialInsuranceYen = socialInsuranceYenOverride ?? 0;
  const residentTaxSocialYen =
    residentTaxSocialInsuranceYen ?? socialInsuranceYen;

  const totalIncomeForIncomeTax = Math.max(
    0,
    profile.taxableIncomeYen +
      pensionIncomeYen +
      additionalIncomeTaxYen -
      incomeAdjustmentDeductionYen,
  );

  const residentAge = residentProfile.age ?? age;
  const residentOtherIncomeYen = calcOtherIncomeExcludingPensionYen(
    residentProfile.taxableIncomeYen,
    residentTaxIncome?.incomeAdjustmentDeductionYen ?? incomeAdjustmentDeductionYen,
  );
  const residentPensionIncomeYen = calcPensionMiscIncomeYen(
    residentPensionYen,
    residentAge,
    residentOtherIncomeYen,
  );
  const residentIncomeAdjustmentYen =
    residentTaxIncome?.incomeAdjustmentDeductionYen ?? incomeAdjustmentDeductionYen;
  const totalIncomeForResidentTax = Math.max(
    0,
    residentProfile.taxableIncomeYen +
      residentPensionIncomeYen +
      additionalResidentTaxYen -
      residentIncomeAdjustmentYen,
  );

  const basicDeductionIncomeTaxYen = calcBasicDeductionIncomeTaxYen(
    totalIncomeForIncomeTax,
    calendarYear,
  );
  const basicDeductionResidentTaxYen = calcBasicDeductionResidentTaxYen(
    totalIncomeForResidentTax,
  );

  const taxableIncomeTaxBase = Math.max(
    0,
    totalIncomeForIncomeTax -
      socialInsuranceYen -
      basicDeductionIncomeTaxYen -
      extraIncomeTaxDeductionYen,
  );
  const taxableResidentTaxBase = Math.max(
    0,
    totalIncomeForResidentTax -
      residentTaxSocialYen -
      basicDeductionResidentTaxYen -
      extraResidentTaxDeductionYen,
  );

  const incomeTaxYen = calcProgressiveIncomeTaxYen(taxableIncomeTaxBase);
  const personalDeductionDiffYen = calcPersonalDeductionDiffYen({
    basicDeductionIncomeTaxYen,
    basicDeductionResidentTaxYen,
    spouseIncomeTaxYen: extraIncomeTaxDeductionYen,
    spouseResidentTaxYen: extraResidentTaxDeductionYen,
    dependentIncomeTaxYen: 0,
    dependentResidentTaxYen: 0,
  });
  const residentTaxYen = calcResidentTaxYen(
    taxableResidentTaxBase,
    residentTaxExemptionLevel,
    personalDeductionDiffYen,
    totalIncomeForResidentTax,
  );

  return { incomeTaxYen, residentTaxYen };
}

function buildPersonProfileFromYearIncome(
  member: FamilyMember,
  yearProfile: MemberYearIncomeProfile,
  ageCalendarYear: number,
  referenceDate: Date,
  annualPensionMan = 0,
): PersonTaxProfile {
  return profileFromYearIncome(
    member,
    yearProfile,
    ageCalendarYear,
    referenceDate,
    annualPensionMan,
  );
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

  return profileFromYearIncome(
    member,
    yearProfile,
    calendarYear,
    referenceDate,
    annualPensionMan,
  );
}

function profileFromYearIncome(
  member: FamilyMember,
  yearProfile: ReturnType<typeof resolveMemberYearIncomeProfile>,
  calendarYear: number,
  referenceDate: Date,
  annualPensionMan: number,
): PersonTaxProfile {
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

/** Q7の12か月年収ベース。継続収入の所得税算定（税率・控除）に使用 */
function resolvePersonProfileFromAnnualIncomeBasis(
  member: FamilyMember,
  incomeByMember: IncomeByMember,
  referenceDate: Date,
  calendarYear: number,
  annualPensionMan = 0,
): PersonTaxProfile {
  const annualProfile = buildMemberIncomeProfileFromIncomeTaxAnnualBasis(
    member,
    incomeByMember[member.id] ?? [],
    calendarYear,
    referenceDate,
  );
  if (annualProfile?.hasActiveIncomeBlock) {
    return profileFromYearIncome(
      member,
      annualProfile,
      calendarYear,
      referenceDate,
      annualPensionMan,
    );
  }
  return resolvePersonProfile(
    member,
    incomeByMember,
    referenceDate,
    calendarYear,
    1,
    12,
    annualPensionMan,
  );
}

function resolveLevyAnnualPensionManByMember(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember?: PensionByMember;
  assessmentAnnualPensionManByMember: Record<string, number>;
  assessmentCalendarYear: number;
  simulationStartYear: number;
  referenceDate: Date;
  monthStart: number;
  monthEnd: number;
}): Record<string, number> {
  if (!input.pensionByMember) {
    return input.assessmentAnnualPensionManByMember;
  }

  const levyMonths = resolveResidentTaxLevyMonthRange({
    assessmentCalendarYear: input.assessmentCalendarYear,
    simulationStartYear: input.simulationStartYear,
    assessmentMonthStart: input.monthStart,
    assessmentMonthEnd: input.monthEnd,
  });

  return calcMemberAnnualPensionManByMember({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    pensionByMember: input.pensionByMember,
    referenceDate: input.referenceDate,
    calendarYear: resolveLevyIncomeReferenceYear(input.assessmentCalendarYear),
    monthStart: levyMonths.monthStart,
    monthEnd: levyMonths.monthEnd,
  });
}

function buildMemberLevyIncomeContext(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  assessmentCalendarYear: number;
  simulationStartYear: number;
  monthStart: number;
  monthEnd: number;
  levyAnnualPensionManByMember: Record<string, number>;
}): {
  levyIncomeCalendarYear: number;
  profilesByMemberId: Record<string, PersonTaxProfile>;
  resolutionsByMemberId: Record<string, PriorYearIncomeResolution>;
} {
  const levyIncomeCalendarYear = resolveLevyIncomeReferenceYear(
    input.assessmentCalendarYear,
  );
  const levyMonths = resolveResidentTaxLevyMonthRange({
    assessmentCalendarYear: input.assessmentCalendarYear,
    simulationStartYear: input.simulationStartYear,
    assessmentMonthStart: input.monthStart,
    assessmentMonthEnd: input.monthEnd,
  });
  const profilesByMemberId: Record<string, PersonTaxProfile> = {};
  const resolutionsByMemberId: Record<string, PriorYearIncomeResolution> = {};

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;

    const resolved = resolveMemberPriorYearIncome({
      member,
      incomeByMember: input.incomeByMember,
      priorYearIncomeByMember: input.priorYearIncomeByMember,
      referenceDate: input.referenceDate,
      incomeReferenceYear: levyIncomeCalendarYear,
      assessmentCalendarYear: input.assessmentCalendarYear,
      simulationStartYear: input.simulationStartYear,
      monthStart: levyMonths.monthStart,
      monthEnd: levyMonths.monthEnd,
    });
    const yearProfile = resolved?.profile ??
      resolveMemberPriorYearIncomeProfile({
        member,
        incomeByMember: input.incomeByMember,
        priorYearIncomeByMember: input.priorYearIncomeByMember,
        referenceDate: input.referenceDate,
        incomeReferenceYear: levyIncomeCalendarYear,
        assessmentCalendarYear: input.assessmentCalendarYear,
        simulationStartYear: input.simulationStartYear,
        monthStart: levyMonths.monthStart,
        monthEnd: levyMonths.monthEnd,
      });

    resolutionsByMemberId[member.id] = resolved?.resolution ?? 'unset';
    profilesByMemberId[member.id] = buildPersonProfileFromYearIncome(
      member,
      yearProfile,
      levyIncomeCalendarYear,
      input.referenceDate,
      input.levyAnnualPensionManByMember[member.id] ?? 0,
    );
  }

  return {
    levyIncomeCalendarYear,
    profilesByMemberId,
    resolutionsByMemberId,
  };
}

export function calcHouseholdTaxSocialMan(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
  /**
   * 試算初年度（部分年）の支払按分係数。
   * 継続収入の所得税は calcHouseholdTaxSocialMan 内で按分する。
   */
  levyPaymentFactor?: number;
  /** メンバー別の年間公的年金受給額（万円・試算対象年）。省略時は0として扱う。*/
  annualPensionManByMember?: Record<string, number>;
  pensionByMember?: PensionByMember;
  /** 試算開始年。省略時は referenceDate の暦年 */
  simulationStartYear?: number;
  /** 選択型DCの標準報酬控除に使用 */
  savingsState?: SavingsState;
}): TaxSocialBreakdown {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const levyPaymentFactor = input.levyPaymentFactor ?? 1;
  const annualPensionManByMember = input.annualPensionManByMember ?? {};
  const priorYearIncomeByMember = input.priorYearIncomeByMember ?? {};
  const simulationStartYear =
    input.simulationStartYear ?? input.referenceDate.getFullYear();
  const levyIncomeCalendarYear = resolveLevyIncomeReferenceYear(input.calendarYear);
  const levyMonths = resolveResidentTaxLevyMonthRange({
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    assessmentMonthStart: monthStart,
    assessmentMonthEnd: monthEnd,
  });
  const annualPensionManForLevy = resolveLevyAnnualPensionManByMember({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    pensionByMember: input.pensionByMember,
    assessmentAnnualPensionManByMember: annualPensionManByMember,
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    referenceDate: input.referenceDate,
    monthStart,
    monthEnd,
  });

  const levyContext = buildMemberLevyIncomeContext({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    monthStart,
    monthEnd,
    levyAnnualPensionManByMember: annualPensionManForLevy,
  });

  const headMember = input.familyMembers.find((m) => m.role === 'head');
  const spouseMember = input.familyMembers.find((m) => m.role === 'spouse');

  if (!headMember) {
    return {
      incomeTaxMan: 0,
      residentTaxMan: 0,
      giftTaxMan: 0,
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
      giftTaxMan: 0,
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
  const levyProfilesByMemberId = levyContext.profilesByMemberId;
  const levyMemberProfiles = insurableMembers.map((member) => ({
    memberId: member.id,
    profile: levyProfilesByMemberId[member.id] ?? profilesByMemberId[member.id],
  }));
  const residentTaxContext = buildHouseholdResidentTaxContext(
    input.familyMembers,
    levyProfilesByMemberId,
    input.calendarYear,
  );
  const residentTaxAssessment = assessHouseholdResidentTax(
    input.familyMembers,
    levyMemberProfiles,
    residentTaxContext,
  );
  const exemptionByMemberId = Object.fromEntries(
    residentTaxAssessment.assessments.map((assessment) => [
      assessment.memberId,
      assessment.exemptionLevel,
    ]),
  );

  const socialInsuranceCalcContext: SocialInsuranceCalcContext = {
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart,
    monthEnd,
    simulationStartYear,
    levyProfilesByMemberId,
    assessmentProfilesByMemberId: profilesByMemberId,
    levyResolutionsByMemberId: levyContext.resolutionsByMemberId,
    savingsState: input.savingsState,
  };

  const socialInsuranceBreakdown = calcHouseholdSocialInsuranceBreakdown(
    memberProfiles,
    socialInsuranceCalcContext,
  );

  const incomeTaxProfilesByMemberId = Object.fromEntries(
    insurableMembers.map((member) => [
      member.id,
      usesAnnualIncomeTaxBasis(
        member,
        input.incomeByMember,
        monthStart,
        monthEnd,
        input.calendarYear,
        input.referenceDate,
        simulationStartYear,
      )
        ? resolvePersonProfileFromAnnualIncomeBasis(
            member,
            input.incomeByMember,
            input.referenceDate,
            input.calendarYear,
            annualPensionManByMember[member.id] ?? 0,
          )
        : profilesByMemberId[member.id],
    ]),
  );

  const incomeTaxSocialByMemberId: Record<string, number> = {};
  for (const member of insurableMembers) {
    const assessmentProfile = profilesByMemberId[member.id];
    incomeTaxSocialByMemberId[member.id] =
      resolveAssessmentEmployeeInsuranceForMember({
        member,
        profile: assessmentProfile,
        context: socialInsuranceCalcContext,
      }).socialInsuranceTotalYen;
  }

  const levySocialInsuranceByMemberId: Record<string, number> = {};
  for (const member of insurableMembers) {
    const levyProfile = levyProfilesByMemberId[member.id];
    if (!levyProfile) continue;
    levySocialInsuranceByMemberId[member.id] = resolveResidentTaxSocialInsurance({
      member,
      levyProfile,
      incomeByMember: input.incomeByMember,
      levyIncomeCalendarYear,
      assessmentCalendarYear: input.calendarYear,
      simulationStartYear,
      socialInsuranceCalcContext,
      levyMonths,
    }).yen;
  }

  const incomeTaxHead =
    incomeTaxProfilesByMemberId[headMember.id] ?? head;
  const incomeTaxSpouse = spouseMember
    ? incomeTaxProfilesByMemberId[spouseMember.id] ?? spouse
    : null;

  const childDeductions = calcDependentMemberDeductions(
    input.familyMembers,
    input.incomeByMember,
    input.referenceDate,
    input.calendarYear,
    monthStart,
    monthEnd,
    annualPensionManByMember,
  );
  const childLevyDeductions = calcDependentMemberDeductions(
    input.familyMembers,
    input.incomeByMember,
    input.referenceDate,
    levyIncomeCalendarYear,
    levyMonths.monthStart,
    levyMonths.monthEnd,
    annualPensionManForLevy,
  );

  const headLevy = levyProfilesByMemberId[headMember.id] ?? head;
  const spouseLevy = spouseMember
    ? levyProfilesByMemberId[spouseMember.id] ?? spouse
    : null;

  const headUsesAnnualBasisForIncomeTax = usesAnnualIncomeTaxBasis(
    headMember,
    input.incomeByMember,
    monthStart,
    monthEnd,
    input.calendarYear,
    input.referenceDate,
    simulationStartYear,
  );
  const headIncomeAdjustment = resolveMemberIncomeAdjustmentDeductionYen({
    member: headMember,
    familyMembers: input.familyMembers,
    incomeEntries: input.incomeByMember[headMember.id] ?? [],
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart: headUsesAnnualBasisForIncomeTax ? 1 : monthStart,
    monthEnd: headUsesAnnualBasisForIncomeTax ? 12 : monthEnd,
  });
  const headLevyIncomeAdjustment = resolveMemberIncomeAdjustmentDeductionYen({
    member: headMember,
    familyMembers: input.familyMembers,
    incomeEntries: input.incomeByMember[headMember.id] ?? [],
    referenceDate: input.referenceDate,
    calendarYear: levyIncomeCalendarYear,
    salaryRevenueYenOverride:
      levyContext.resolutionsByMemberId[headMember.id] === 'prior_year_override'
        ? headLevy?.grossIncomeYen
        : undefined,
  });
  const spouseAgeAtYearEnd = spouseMember
    ? getMemberAgeAtYearEnd(
        spouseMember,
        input.referenceDate,
        input.calendarYear,
      )
    : null;
  const spouseLevyAgeAtYearEnd = spouseMember
    ? getMemberAgeAtYearEnd(
        spouseMember,
        input.referenceDate,
        levyIncomeCalendarYear,
      )
    : null;
  const headTotalIncomeForSpouseDeduction =
    calcTaxpayerTotalIncomeYenForSpouseDeduction(
      incomeTaxHead,
      headIncomeAdjustment.deductionYen,
    );
  const headLevyTotalIncomeForSpouseDeduction =
    calcTaxpayerTotalIncomeYenForSpouseDeduction(
      headLevy ?? head!,
      headLevyIncomeAdjustment.deductionYen,
    );
  const spouseTotalIncomeForSpouseDeduction = incomeTaxSpouse
    ? calcTaxpayerTotalIncomeYenForSpouseDeduction(incomeTaxSpouse)
    : 0;
  const spouseLevyTotalIncomeForSpouseDeduction = spouseLevy
    ? calcTaxpayerTotalIncomeYenForSpouseDeduction(spouseLevy)
    : 0;

  const spouseDeductions = calcHeadSpouseDeductions(
    incomeTaxHead,
    incomeTaxSpouse,
    input.calendarYear,
    spouseAgeAtYearEnd,
    headTotalIncomeForSpouseDeduction,
    spouseTotalIncomeForSpouseDeduction,
  );
  const spouseLevyDeductions = calcHeadSpouseDeductions(
    headLevy ?? head!,
    spouseLevy,
    levyIncomeCalendarYear,
    spouseLevyAgeAtYearEnd,
    headLevyTotalIncomeForSpouseDeduction,
    spouseLevyTotalIncomeForSpouseDeduction,
  );

  const headTaxes = calcPersonTaxesYen(
    incomeTaxHead,
    childDeductions.incomeTaxYen + spouseDeductions.incomeTaxYen,
    childLevyDeductions.residentTaxYen + spouseLevyDeductions.residentTaxYen,
    input.calendarYear,
    incomeTaxSocialByMemberId[headMember.id] ?? 0,
    exemptionByMemberId[headMember.id] ?? 'taxable',
    headIncomeAdjustment.deductionYen,
    {
      profile: headLevy,
      calendarYear: levyIncomeCalendarYear,
      incomeAdjustmentDeductionYen: headLevyIncomeAdjustment.deductionYen,
    },
    levySocialInsuranceByMemberId[headMember.id] ?? 0,
  );

  const spouseUsesAnnualBasisForIncomeTax =
    spouse && spouseMember
      ? usesAnnualIncomeTaxBasis(
          spouseMember,
          input.incomeByMember,
          monthStart,
          monthEnd,
          input.calendarYear,
          input.referenceDate,
          simulationStartYear,
        )
      : false;
  const spouseIncomeAdjustment =
    spouse && spouseMember
      ? resolveMemberIncomeAdjustmentDeductionYen({
          member: spouseMember,
          familyMembers: input.familyMembers,
          incomeEntries: input.incomeByMember[spouseMember.id] ?? [],
          referenceDate: input.referenceDate,
          calendarYear: input.calendarYear,
          monthStart: spouseUsesAnnualBasisForIncomeTax ? 1 : monthStart,
          monthEnd: spouseUsesAnnualBasisForIncomeTax ? 12 : monthEnd,
        })
      : { deductionYen: 0, qualifies: false };
  const spouseLevyIncomeAdjustment =
    spouse && spouseMember
      ? resolveMemberIncomeAdjustmentDeductionYen({
          member: spouseMember,
          familyMembers: input.familyMembers,
          incomeEntries: input.incomeByMember[spouseMember.id] ?? [],
          referenceDate: input.referenceDate,
          calendarYear: levyIncomeCalendarYear,
          salaryRevenueYenOverride:
            levyContext.resolutionsByMemberId[spouseMember.id] ===
            'prior_year_override'
              ? spouseLevy?.grossIncomeYen
              : undefined,
        })
      : { deductionYen: 0, qualifies: false };

  const spouseTaxes =
    incomeTaxSpouse &&
    spouse &&
    isTaxIndependent(incomeTaxSpouse) &&
    incomeTaxSpouse.grossIncomeYen > 0
      ? calcPersonTaxesYen(
          incomeTaxSpouse,
          0,
          0,
          input.calendarYear,
          spouseMember
            ? incomeTaxSocialByMemberId[spouseMember.id] ?? 0
            : 0,
          spouseMember ? exemptionByMemberId[spouseMember.id] ?? 'taxable' : 'taxable',
          spouseIncomeAdjustment.deductionYen,
          spouseLevy
            ? {
                profile: spouseLevy,
                calendarYear: levyIncomeCalendarYear,
                incomeAdjustmentDeductionYen: spouseLevyIncomeAdjustment.deductionYen,
              }
            : undefined,
          spouseMember
            ? levySocialInsuranceByMemberId[spouseMember.id] ?? 0
            : undefined,
        )
      : { incomeTaxYen: 0, residentTaxYen: 0 };

  const socialInsuranceYen = socialInsuranceBreakdown.totalYen;

  const prorateMemberIncomeTaxYen = (
    member: FamilyMember,
    taxYen: number,
  ): number => {
    if (levyPaymentFactor >= 1) return taxYen;
    if (
      !usesAnnualIncomeTaxBasis(
        member,
        input.incomeByMember,
        monthStart,
        monthEnd,
        input.calendarYear,
        input.referenceDate,
        simulationStartYear,
      )
    ) {
      return taxYen;
    }
    return Math.round(taxYen * levyPaymentFactor);
  };

  const incomeTaxYen =
    prorateMemberIncomeTaxYen(headMember, headTaxes.incomeTaxYen) +
    (spouseMember
      ? prorateMemberIncomeTaxYen(spouseMember, spouseTaxes.incomeTaxYen)
      : 0);
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
    longTermCare: yenToMan(socialInsuranceBreakdown.publicInsurance.longTermCare),
    lateElderlyHealth: yenToMan(
      socialInsuranceBreakdown.publicInsurance.lateElderlyHealth,
    ),
  };

  return {
    incomeTaxMan,
    residentTaxMan,
    giftTaxMan: 0,
    socialInsuranceMan,
    socialInsurance,
    publicInsurance,
    totalMan: Math.round((incomeTaxMan + residentTaxMan + socialInsuranceMan) * 10) / 10,
    isResidentTaxExemptHousehold: residentTaxAssessment.isExemptHousehold,
  };
}

/**
 * メンバー内訳（その他タブ）から世帯のキャッシュフロー表示値を組み立てる。
 * 税・被用者社保は memberBreakdown の cashFlowYen / employeeInsurance を唯一のソースとする。
 * 公的保険（国保・国民年金・公的介護・後期高齢）のみ初年度 levyPaymentFactor で按分する
 * （所得税・住民税は各 cashFlowYen 側で済、被用者社保は月次天引き合算済み）。
 */
export function buildHouseholdTaxSocialFromMemberBreakdowns(
  memberBreakdownByMemberId: Record<string, MemberTaxBreakdownData>,
  familyMembers: FamilyMember[],
  isResidentTaxExemptHousehold: boolean,
  levyPaymentFactor = 1,
): TaxSocialBreakdown {
  let incomeTaxCfYen = 0;
  let residentTaxCfYen = 0;
  let giftTaxCfYen = 0;
  let employeesPensionYen = 0;
  let healthMedicalYen = 0;
  let healthChildYen = 0;
  let ltcYen = 0;
  let employmentYen = 0;
  let nationalPensionYen = 0;
  let nhiYen = 0;
  let lateElderlyHealthYen = 0;
  let publicLongTermCareYen = 0;

  for (const member of familyMembers) {
    if (member.role === 'pet') continue;
    const bd = memberBreakdownByMemberId[member.id];
    if (!bd) continue;
    if (bd.isTaxIndependent) {
      incomeTaxCfYen += bd.incomeTax.incomeTaxCashFlowYen;
      residentTaxCfYen += bd.residentTax.residentTaxCashFlowYen;
    }
    giftTaxCfYen += bd.giftTax.giftTaxCashFlowYen;
    const ins = bd.employeeInsurance;
    if (ins.isEmployeeInsured) {
      employeesPensionYen +=
        ins.annualPensionFromSalaryYen + ins.annualPensionFromBonusYen;
      healthMedicalYen += ins.annualHealthMedicalSupportYen;
      healthChildYen += ins.annualHealthChildcareYen;
      ltcYen += ins.annualHealthNursingYen;
      employmentYen += ins.annualEmploymentYen;
    }
    if (bd.nhiInsurance.isNhiMember) {
      nationalPensionYen += bd.nhiInsurance.nationalPensionYen;
      nhiYen += bd.nhiInsurance.memberShareYen;
    }
    if (bd.lateElderlyHealth.isApplicable) {
      lateElderlyHealthYen += bd.lateElderlyHealth.memberPremiumYen;
    }
    if (
      bd.longTermCare.variant === 'first_class' ||
      bd.longTermCare.variant === 'late_elderly'
    ) {
      publicLongTermCareYen += bd.longTermCare.memberPremiumYen;
    }
  }

  if (levyPaymentFactor < 1) {
    nationalPensionYen = prorateAnnualLevyYen(
      nationalPensionYen,
      levyPaymentFactor,
    );
    nhiYen = prorateAnnualLevyYen(nhiYen, levyPaymentFactor);
    lateElderlyHealthYen = prorateAnnualLevyYen(
      lateElderlyHealthYen,
      levyPaymentFactor,
    );
    publicLongTermCareYen = prorateAnnualLevyYen(
      publicLongTermCareYen,
      levyPaymentFactor,
    );
  }

  const socialInsurance = {
    healthInsurance: yenToMan(healthMedicalYen + healthChildYen),
    employeesPension: yenToMan(employeesPensionYen),
    longTermCare: yenToMan(ltcYen),
    employmentInsurance: yenToMan(employmentYen),
  };
  const publicInsurance: PublicInsuranceComponents = {
    nationalPension: yenToMan(nationalPensionYen),
    nationalHealthInsurance: yenToMan(nhiYen),
    longTermCare: yenToMan(publicLongTermCareYen),
    lateElderlyHealth: yenToMan(lateElderlyHealthYen),
  };
  const incomeTaxMan = yenToMan(incomeTaxCfYen);
  const residentTaxMan = yenToMan(residentTaxCfYen);
  const giftTaxMan = yenToMan(giftTaxCfYen);
  const employeeSocialMan =
    socialInsurance.healthInsurance +
    socialInsurance.employeesPension +
    socialInsurance.longTermCare +
    socialInsurance.employmentInsurance;
  const publicInsuranceMan =
    publicInsurance.nationalPension +
    publicInsurance.nationalHealthInsurance +
    publicInsurance.longTermCare +
    publicInsurance.lateElderlyHealth;
  const socialInsuranceMan =
    Math.round((employeeSocialMan + publicInsuranceMan) * 10) / 10;

  return {
    incomeTaxMan,
    residentTaxMan,
    giftTaxMan,
    socialInsuranceMan,
    socialInsurance,
    publicInsurance,
    totalMan:
      Math.round(
        (incomeTaxMan + residentTaxMan + giftTaxMan + socialInsuranceMan) * 10,
      ) / 10,
    isResidentTaxExemptHousehold,
  };
}

/**
 * @deprecated 所得税・住民税・贈与税まで按分するため現行 CF では使わない。
 * 公的保険の初年度按分は buildHouseholdTaxSocialFromMemberBreakdowns の
 * levyPaymentFactor 引数で行う。
 */
export function applyPartialYearLevyPaymentFactor(
  breakdown: TaxSocialBreakdown,
  factor: number,
  options?: { prorateIncomeTax?: boolean },
): TaxSocialBreakdown {
  if (factor >= 1) return breakdown;

  const prorateMan = (value: number) => Math.round(value * factor * 10) / 10;
  const prorateIncomeTax = options?.prorateIncomeTax ?? true;

  const incomeTaxMan = prorateIncomeTax
    ? prorateMan(breakdown.incomeTaxMan)
    : breakdown.incomeTaxMan;
  const publicInsurance: PublicInsuranceComponents = {
    nationalPension: prorateMan(breakdown.publicInsurance.nationalPension),
    nationalHealthInsurance: prorateMan(
      breakdown.publicInsurance.nationalHealthInsurance,
    ),
    longTermCare: prorateMan(breakdown.publicInsurance.longTermCare),
    lateElderlyHealth: prorateMan(breakdown.publicInsurance.lateElderlyHealth),
  };
  const residentTaxMan = prorateMan(breakdown.residentTaxMan);
  const giftTaxMan = prorateMan(breakdown.giftTaxMan ?? 0);
  const employeeSocialMan =
    breakdown.socialInsurance.healthInsurance +
    breakdown.socialInsurance.employeesPension +
    breakdown.socialInsurance.longTermCare +
    breakdown.socialInsurance.employmentInsurance;
  const publicInsuranceMan =
    publicInsurance.nationalPension +
    publicInsurance.nationalHealthInsurance +
    publicInsurance.longTermCare +
    publicInsurance.lateElderlyHealth;
  const socialInsuranceMan =
    Math.round((employeeSocialMan + publicInsuranceMan) * 10) / 10;
  const totalMan =
    Math.round(
      (incomeTaxMan + residentTaxMan + giftTaxMan + socialInsuranceMan) * 10,
    ) / 10;

  return {
    ...breakdown,
    incomeTaxMan,
    residentTaxMan,
    giftTaxMan,
    publicInsurance,
    socialInsuranceMan,
    totalMan,
  };
}

export const TAX_RATE_CONSTANTS = TAX_CONSTANTS;

export { memberUsesAnnualBasisForIncomeTax } from './otherCashFlowLinkage';

export interface MemberTaxBreakdownReferenceContext {
  spouseIncomeTax: SpouseDeductionReferenceContext | null;
  spouseResidentTax: SpouseDeductionReferenceContext | null;
  lifeInsuranceIncomeTaxPremiumsYen: LifeInsurancePremiumByKindMan | null;
  lifeInsuranceResidentTaxPremiumsYen: LifeInsurancePremiumByKindMan | null;
  idecoIncomeTaxContributionYen: number;
  idecoResidentTaxContributionYen: number;
}

export interface MemberTaxBreakdownData {
  isTaxIndependent: boolean;
  memberAge: number | null;
  referenceContext: MemberTaxBreakdownReferenceContext;
  proration: OtherProrationContext;
  earnedIncomeFormula: 'salary' | 'business' | 'mixed';
  businessIncome: BusinessIncomeBreakdownYen | null;
  levyEarnedIncomeFormula: 'salary' | 'business' | 'mixed';
  levyBusinessIncome: BusinessIncomeBreakdownYen | null;
  incomeTax: {
    grossSalaryRevenueYen: number;
    baseSalaryIncomeDeductionYen: number;
    incomeAdjustmentDeductionYen: number;
    incomeAdjustmentQualifies: boolean;
    salaryIncomeDeductionYen: number;
    salaryIncomeYen: number;
    pensionRevenueYen: number;
    pensionDeductionYen: number;
    pensionIncomeYen: number;
    /** 公的年金等に係る雑所得以外の合計所得金額（円） */
    otherIncomeExcludingPensionYen: number;
    /** 合計所得金額（円）= 年金雑所得 ＋ 公的年金等以外の所得 */
    totalIncomeYen: number;
    basicDeductionYen: number;
    spouseDeductionYen: number;
    spouseDeductionKind: SpouseDeductionKind;
    dependentDeductionYen: number;
    singleParentDeductionYen: number;
    disabilityDeductionYen: number;
    workingStudentDeductionYen: number;
    lifeInsuranceDeductionYen: number;
    /** 小規模企業共済等掛金控除（iDeCo・選択型DC加入者・円・所得税年） */
    idecoContributionDeductionYen: number;
    /** 保険収入の一時所得（合計所得算入額・円） */
    insuranceTemporaryIncomeTaxableYen: number;
    insuranceMiscellaneousIncomeTaxableYen: number;
    otherIncomeDeductionYen: number;
    socialInsuranceDeduction: {
      employeesPension: number;
      healthInsurance: number;
      longTermCare: number;
      nationalPension: number;
      nationalHealthInsurance: number;
      employmentInsurance: number;
    };
    taxableIncomeYen: number;
    taxRate: number;
    taxRateDeductionYen: number;
    incomeTaxYen: number;
    /** キャッシュフロー表に計上する所得税（試算初年度は按分後） */
    incomeTaxCashFlowYen: number;
    /** 住宅ローン控除のうち所得税から控除した額（円） */
    housingLoanTaxCreditAppliedYen: number;
    /** 住宅ローン控除のうち住民税から控除した額（円） */
    housingLoanResidentTaxCreditAppliedYen: number;
    /** iDeCo 一時金の収入（円） */
    idecoLumpSumRevenueYen: number;
    /** iDeCo 一時金の加入年数 */
    idecoEnrollmentYears: number;
    /** 退職所得控除（円） */
    retirementIncomeDeductionYen: number;
    /** 退職所得（円） */
    retirementIncomeYen: number;
    /** 退職所得に対する所得税（円・分離） */
    retirementIncomeTaxYen: number;
    residentBasicDeductionYen: number;
    residentSpouseDeductionYen: number;
    residentDependentDeductionYen: number;
  };
  residentTax: {
    incomeReferenceYear: number;
    grossSalaryRevenueYen: number;
    baseSalaryIncomeDeductionYen: number;
    incomeAdjustmentDeductionYen: number;
    incomeAdjustmentQualifies: boolean;
    salaryIncomeYen: number;
    pensionIncomeYen: number;
    /** 公的年金等に係る雑所得以外の合計所得金額（円・住民税基準年） */
    otherIncomeExcludingPensionYen: number;
    /** 合計所得金額（円・住民税基準年） */
    totalIncomeYen: number;
    pensionRevenueYen: number;
    pensionDeductionYen: number;
    taxableIncomeYen: number;
    incomeLevyYen: number;
    perCapitaMunicipalYen: number;
    perCapitaPrefecturalYen: number;
    perCapitaTotalYen: number;
    adjustmentCreditYen: number;
    residentTaxYen: number;
    adjustedResidentTaxYen: number;
    /** キャッシュフロー表に計上する住民税（試算初年度は按分後・万円丸め） */
    residentTaxCashFlowYen: number;
    isExempt: boolean;
    resolution: PriorYearIncomeResolution;
    /** 住民税の前年所得算定フェーズ */
    levyPhase: ResidentTaxLevyPhase;
    /** Q7の12か月年収ベースで前年所得を評価している */
    incomeReferenceUsesAnnualBasis: boolean;
    /** iDeCo 一時金に対する住民税（円・受取年に加算） */
    retirementResidentTaxYen: number;
    /** 小規模企業共済等掛金控除（iDeCo・選択型DC加入者・円・levy 年） */
    idecoContributionDeductionYen: number;
    /** 住民税の社会保険料控除（円・前年／levy年） */
    socialInsuranceDeduction: {
      employeesPension: number;
      healthInsurance: number;
      longTermCare: number;
      nationalPension: number;
      nationalHealthInsurance: number;
      employmentInsurance: number;
    };
  };
  employeeInsurance: {
    grossIncomeYen: number;
    annualSalaryYen: number;
    annualBonusYen: number;
    standardMonthlyRemunerationYen: number;
    standardMonthlyRemunerationHealthYen: number;
    pensionRate: number;
    healthRate: number;
    longTermCareRate: number;
    healthMedicalSupportRate: number;
    healthChildcareRate: number;
    healthNursingRate: number;
    standardHealthBonusYen: number;
    annualHealthMedicalSupportYen: number;
    annualHealthChildcareYen: number;
    annualHealthNursingYen: number;
    employmentAnnualIncomeYen: number;
    employmentRate: number;
    monthlyPensionYen: number;
    monthlyHealthYen: number;
    monthlyLongTermCareYen: number;
    monthlyEmploymentYen: number;
    annualPensionFromSalaryYen: number;
    annualPensionFromBonusYen: number;
    annualPensionYen: number;
    annualHealthYen: number;
    annualLongTermCareYen: number;
    annualEmploymentYen: number;
    isEmployeeInsured: boolean;
    bonusPaymentCount: number;
    bonusTreatedAsRemuneration: boolean;
    monthlyBonusShareYen: number;
  };
  nhiInsurance: {
    isNhiMember: boolean;
    memberShareYen: number;
    nationalPensionYen: number;
    breakdown: NhiHouseholdBreakdown | null;
  };
  lateElderlyHealth: {
    isApplicable: boolean;
    memberPremiumYen: number;
    pensionRevenueYen: number;
    pensionIncomeYen: number;
    otherIncomeYen: number;
    salaryIncomeYen: number;
    incomeBaseYen: number;
    incomeLevyRate: number;
    incomeLevyYen: number;
    rawPerCapitaYen: number;
    fixedYen: number;
    householdIncomeYen: number;
    lateElderlyInsuredCount: number;
    reductionLabel: string;
    flatPayRate: number;
    breakdown: LateElderlyHealthHouseholdBreakdown | null;
  };
  longTermCare: {
    isApplicable: boolean;
    variant:
      | 'none'
      | 'employee_second_class'
      | 'employee_first_class'
      | 'nhi_segment'
      | 'late_elderly'
      | 'first_class';
    memberPremiumYen: number;
    rate: number | null;
    viaNhi: boolean;
    statusLabel: string;
    statusNote: string | null;
  };
  /** 保険収入に係る税（受取人ベース） */
  insuranceIncomeTax: InsuranceIncomeTaxDetail;
  giftTax: {
    giftTaxYen: number;
    giftTaxCashFlowYen: number;
  };
}

function buildLateElderlyHealthBreakdown(input: {
  profile: PersonTaxProfile;
  category: SocialInsuranceCategory;
  memberId: string;
  lateElderlyBreakdown: LateElderlyHealthHouseholdBreakdown | null;
}): MemberTaxBreakdownData['lateElderlyHealth'] {
  const age = input.profile.age ?? 0;
  const isApplicable = input.category === 'late_elderly' && age >= 75;
  const memberBreakdown = input.lateElderlyBreakdown?.members.find(
    (member) => member.memberId === input.memberId,
  );
  const household = input.lateElderlyBreakdown;

  return {
    isApplicable,
    memberPremiumYen: isApplicable ? (memberBreakdown?.premiumYen ?? 0) : 0,
    pensionRevenueYen: memberBreakdown?.pensionRevenueYen ?? 0,
    pensionIncomeYen: memberBreakdown?.pensionIncomeYen ?? 0,
    salaryIncomeYen: memberBreakdown?.salaryIncomeYen ?? 0,
    otherIncomeYen: memberBreakdown?.otherIncomeYen ?? 0,
    incomeBaseYen: memberBreakdown?.incomeBaseYen ?? 0,
    incomeLevyRate:
      household?.incomeLevyRate ?? TAX_CONSTANTS.lateElderlyHealthInsuranceRate,
    incomeLevyYen: isApplicable ? (memberBreakdown?.incomeLevyYen ?? 0) : 0,
    rawPerCapitaYen:
      household?.perCapitaUnitYen ?? TAX_CONSTANTS.lateElderlyHealthInsuranceFixed,
    fixedYen: isApplicable ? (memberBreakdown?.perCapitaYen ?? 0) : 0,
    householdIncomeYen: household?.householdIncomeYen ?? 0,
    lateElderlyInsuredCount: household?.insuredCount ?? 0,
    reductionLabel: household
      ? formatLateElderlyReductionLabel(household.reductionTier)
      : '軽減なし',
    flatPayRate: household?.flatPayRate ?? 1,
    breakdown: household,
  };
}

function formatLateElderlyReductionLabel(
  tier: LateElderlyHealthHouseholdBreakdown['reductionTier'],
): string {
  switch (tier) {
    case '70':
      return '7割軽減';
    case '50':
      return '5割軽減';
    case '20':
      return '2割軽減';
    default:
      return '軽減なし';
  }
}

function allocateNhiLtcShareYen(
  nhiBreakdown: NhiHouseholdBreakdown | null,
  memberId: string,
  memberName: string,
): number {
  if (!nhiBreakdown || nhiBreakdown.ltc.cappedTotalYen <= 0) {
    return 0;
  }

  const ltcMembers = nhiBreakdown.members.filter((entry) => entry.hasLtc);
  if (ltcMembers.length === 0) {
    return 0;
  }

  const memberEntry = ltcMembers.find(
    (entry) =>
      entry.memberId === memberId || entry.memberLabel === memberName,
  );
  if (!memberEntry?.hasLtc) {
    return 0;
  }

  return Math.round(nhiBreakdown.ltc.cappedTotalYen / ltcMembers.length);
}

function buildLongTermCareBreakdown(input: {
  profile: PersonTaxProfile;
  category: SocialInsuranceCategory;
  employeeDetail: ReturnType<typeof calcEmployeeSocialInsuranceDetailYen> | null;
  nhiBreakdown: NhiHouseholdBreakdown | null;
  memberId: string;
  memberName: string;
}): MemberTaxBreakdownData['longTermCare'] {
  const age = input.profile.age ?? 0;
  const { category, employeeDetail, nhiBreakdown } = input;

  if (category === 'late_elderly' && age >= 75) {
    return {
      isApplicable: true,
      variant: 'late_elderly',
      memberPremiumYen: TAX_CONSTANTS.longTermCareFirstClassAnnual,
      rate: null,
      viaNhi: false,
      statusLabel: '納付対象（第1号被保険者）',
      statusNote:
        '後期高齢者医療制度とあわせて試算しています。市町村から別途賦課されます。',
    };
  }

  if (category === 'employee' && age >= 65) {
    const premiumYen =
      employeeDetail?.social.longTermCare ??
      TAX_CONSTANTS.longTermCareFirstClassAnnual;
    return {
      isApplicable: true,
      variant: 'employee_first_class',
      memberPremiumYen: premiumYen,
      rate: null,
      viaNhi: false,
      statusLabel: '納付対象（第1号被保険者）',
      statusNote: '健康保険料とあわせて徴収される概算です。',
    };
  }

  if (category === 'employee' && age >= 40 && age < 65) {
    const premiumYen = employeeDetail?.social.longTermCare ?? 0;
    return {
      isApplicable: premiumYen > 0,
      variant: 'employee_second_class',
      memberPremiumYen: premiumYen,
      rate: TAX_CONSTANTS.longTermCareRate,
      viaNhi: false,
      statusLabel:
        premiumYen > 0 ? '納付対象（第2号被保険者）' : '対象外',
      statusNote:
        premiumYen > 0
          ? '給与から天引きされる第2号被保険者分です。'
          : '40歳未満、または給与収入がないため試算対象外です。',
    };
  }

  if (category === 'nhi' && age >= 65) {
    return {
      isApplicable: true,
      variant: 'first_class',
      memberPremiumYen: TAX_CONSTANTS.longTermCareFirstClassAnnual,
      rate: null,
      viaNhi: false,
      statusLabel: '納付対象（第1号被保険者）',
      statusNote:
        '国保から独立した第1号被保険者分の概算です。市町村から別途賦課されます。',
    };
  }

  if (category === 'nhi' && age >= 40 && age < 65) {
    const premiumYen = allocateNhiLtcShareYen(
      nhiBreakdown,
      input.memberId,
      input.memberName,
    );
    return {
      isApplicable: premiumYen > 0,
      variant: 'nhi_segment',
      memberPremiumYen: premiumYen,
      rate: null,
      viaNhi: true,
      statusLabel:
        premiumYen > 0
          ? '納付対象（第2号・国保介護分）'
          : '対象外',
      statusNote:
        premiumYen > 0
          ? '国民健康保険料の介護分（③）に含まれる第2号被保険者分です。'
          : '40～64歳の国保加入者で、介護分の算定対象となる場合に計上します。',
    };
  }

  if (age < 40) {
    return {
      isApplicable: false,
      variant: 'none',
      memberPremiumYen: 0,
      rate: null,
      viaNhi: false,
      statusLabel: '対象外',
      statusNote: '40歳未満は介護保険の被保険者ではありません。',
    };
  }

  return {
    isApplicable: false,
    variant: 'none',
    memberPremiumYen: 0,
    rate: null,
    viaNhi: false,
    statusLabel: '対象外',
    statusNote:
      '介護保険の加入・納付対象となる収入がない、または被扶養者のため試算対象外です。',
  };
}

function employeeSocialInsuranceDeductionFromProfile(
  profile: PersonTaxProfile,
): {
  yen: number;
  deduction: MemberTaxBreakdownData['incomeTax']['socialInsuranceDeduction'];
} {
  const detail = calcEmployeeSocialInsuranceDetailYen(profile);
  return {
    yen: detail.totalYen,
    deduction: mergeEmployeeHealthInsuranceDeduction({
      employeesPension: detail.social.employeesPension,
      healthInsurance: detail.social.healthInsurance,
      longTermCare: detail.social.longTermCare,
      nationalPension: 0,
      nationalHealthInsurance: 0,
      employmentInsurance: detail.social.employmentInsurance,
    }),
  };
}

/** 住民税の社保控除を所得（Q7年収ベース）と揃えるか */
function shouldUseAnnualBasisForResidentTaxLevySocialInsurance(input: {
  member: FamilyMember;
  incomeByMember: IncomeByMember;
  assessmentCalendarYear: number;
  simulationStartYear: number;
  referenceMonth?: number;
}): boolean {
  const phase = resolveResidentTaxLevyPhase(
    input.assessmentCalendarYear,
    input.simulationStartYear,
  );
  return residentTaxLevyUsesAnnualIncomeBasis(
    phase,
    memberHasNewIncomeFromStartById(
      input.member,
      input.incomeByMember,
      input.referenceMonth,
    ),
  );
}

function resolveResidentTaxSocialInsurance(input: {
  member: FamilyMember;
  levyProfile: PersonTaxProfile;
  incomeByMember: IncomeByMember;
  levyIncomeCalendarYear: number;
  assessmentCalendarYear: number;
  simulationStartYear: number;
  socialInsuranceCalcContext: SocialInsuranceCalcContext;
  levyMonths: { monthStart: number; monthEnd: number };
}): {
  yen: number;
  deduction: MemberTaxBreakdownData['incomeTax']['socialInsuranceDeduction'];
} {
  const useAnnualLevySocial = shouldUseAnnualBasisForResidentTaxLevySocialInsurance(
    {
      member: input.member,
      incomeByMember: input.incomeByMember,
      assessmentCalendarYear: input.assessmentCalendarYear,
      simulationStartYear: input.simulationStartYear,
      referenceMonth:
        input.socialInsuranceCalcContext.referenceDate.getMonth() + 1,
    },
  );
  const levyPhase = resolveResidentTaxLevyPhase(
    input.assessmentCalendarYear,
    input.simulationStartYear,
  );
  const incomeEntries = input.incomeByMember[input.member.id] ?? [];
  let levyProfile = input.levyProfile;
  let employmentAnnualIncomeYenOverride: number | undefined;
  const levyMonthStart = useAnnualLevySocial ? 1 : input.levyMonths.monthStart;
  const levyMonthEnd = useAnnualLevySocial ? 12 : input.levyMonths.monthEnd;

  if (useAnnualLevySocial) {
    const annualYear =
      levyPhase === 'simulation_start_next'
        ? input.levyIncomeCalendarYear
        : input.assessmentCalendarYear;
    const annualSalaryBreakdown = calcMemberSalaryBreakdownYenForTaxYear({
      member: input.member,
      entries: incomeEntries,
      referenceDate: input.socialInsuranceCalcContext.referenceDate,
      calendarYear: annualYear,
      annualize: true,
    });
    if (annualSalaryBreakdown.grossSalaryRevenueYen > 0) {
      employmentAnnualIncomeYenOverride =
        annualSalaryBreakdown.grossSalaryRevenueYen;
    }
    const annualMemberProfile = buildMemberIncomeProfileFromIncomeTaxAnnualBasis(
      input.member,
      incomeEntries,
      annualYear,
      input.socialInsuranceCalcContext.referenceDate,
    );
    if (annualMemberProfile?.hasActiveIncomeBlock) {
      levyProfile = buildPersonProfileFromYearIncome(
        input.member,
        annualMemberProfile,
        annualYear,
        input.socialInsuranceCalcContext.referenceDate,
      );
    }
  }

  if (classifySocialInsuranceCategory(levyProfile) === 'employee') {
    const breakdown = resolveEmployeeInsuranceBreakdownForMember({
      member: input.member,
      profile: levyProfile,
      socialInsuranceCalcContext: input.socialInsuranceCalcContext,
      calendarYear: input.levyIncomeCalendarYear,
      monthStart: levyMonthStart,
      monthEnd: levyMonthEnd,
      incomeEntries,
      employmentAnnualIncomeYenOverride,
      useQ7AnnualPremiumBasis: useAnnualLevySocial,
    });
    return {
      yen: breakdown.socialInsuranceTotalYen,
      deduction: breakdown.socialInsuranceDeduction,
    };
  }

  const levyContext: SocialInsuranceCalcContext = {
    ...input.socialInsuranceCalcContext,
    calendarYear: input.levyIncomeCalendarYear,
    monthStart: levyMonthStart,
    monthEnd: levyMonthEnd,
    assessmentProfilesByMemberId: { [input.member.id]: levyProfile },
  };
  const breakdown = calcHouseholdSocialInsuranceBreakdown(
    [{ memberId: input.member.id, profile: levyProfile }],
    levyContext,
  );
  const yen = breakdown.byMemberId[input.member.id] ?? 0;
  const deduction = resolveMemberSocialInsuranceDeductionYen(
    input.member.id,
    [{ memberId: input.member.id, profile: levyProfile }],
    breakdown,
    levyContext,
  );

  if (
    yen === 0 &&
    levyProfile.grossIncomeYen > 0 &&
    classifySocialInsuranceCategory(levyProfile) === 'employee'
  ) {
    return employeeSocialInsuranceDeductionFromProfile(levyProfile);
  }

  return { yen, deduction };
}

function resolveMemberSocialInsuranceDeductionYen(
  memberId: string,
  memberProfiles: { memberId: string; profile: PersonTaxProfile }[],
  socialBreakdown: ReturnType<typeof calcHouseholdSocialInsuranceBreakdown>,
  context: SocialInsuranceCalcContext,
): MemberTaxBreakdownData['incomeTax']['socialInsuranceDeduction'] {
  const profile = memberProfiles.find((entry) => entry.memberId === memberId)?.profile;
  if (!profile) {
    return {
      employeesPension: 0,
      healthInsurance: 0,
      longTermCare: 0,
      nationalPension: 0,
      nationalHealthInsurance: 0,
      employmentInsurance: 0,
    };
  }

  const category = classifySocialInsuranceCategory(profile);
  if (category === 'employee') {
    const member = context.familyMembers.find((m) => m.id === memberId);
    if (!member) {
      return {
        employeesPension: 0,
        healthInsurance: 0,
        longTermCare: 0,
        nationalPension: 0,
        nationalHealthInsurance: 0,
        employmentInsurance: 0,
      };
    }
    return resolveAssessmentEmployeeInsuranceForMember({
      member,
      profile,
      context,
    }).socialInsuranceDeduction;
  }

  if (category === 'nhi') {
    const pension =
      (profile.age ?? 0) < 60 ? TAX_CONSTANTS.nationalPensionAnnualYen : 0;
    const nhiShare =
      socialBreakdown.byMemberId[memberId] != null
        ? Math.max(0, socialBreakdown.byMemberId[memberId] - pension)
        : 0;
    return {
      employeesPension: 0,
      healthInsurance: 0,
      longTermCare: 0,
      nationalPension: pension,
      nationalHealthInsurance: nhiShare,
      employmentInsurance: 0,
    };
  }

  return {
    employeesPension: 0,
    healthInsurance: 0,
    longTermCare: 0,
    nationalPension: 0,
    nationalHealthInsurance: 0,
    employmentInsurance: 0,
  };
}

function resolveLevySalaryBreakdownYen(input: {
  member: FamilyMember;
  incomeByMember: IncomeByMember;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
  assessmentCalendarYear: number;
  simulationStartYear: number;
  levyProfile: PersonTaxProfile;
  resolution: PriorYearIncomeResolution;
  monthStart: number;
  monthEnd: number;
}): { grossSalaryRevenueYen: number; salaryIncomeYen: number } {
  const levyYear = resolveLevyIncomeReferenceYear(input.assessmentCalendarYear);
  const levyPhase = resolveResidentTaxLevyPhase(
    input.assessmentCalendarYear,
    input.simulationStartYear,
  );
  const hasNewIncomeFromStart = memberHasNewIncomeFromStartById(
    input.member,
    input.incomeByMember,
    input.referenceDate.getMonth() + 1,
  );

  if (input.resolution === 'prior_year_override') {
    const grossSalaryRevenueYen = input.levyProfile.grossIncomeYen;
    const baseSalaryIncomeDeductionYen = calcSalaryIncomeDeductionYen(
      grossSalaryRevenueYen,
      levyYear,
    );
    return {
      grossSalaryRevenueYen,
      salaryIncomeYen: Math.max(
        0,
        grossSalaryRevenueYen - baseSalaryIncomeDeductionYen,
      ),
    };
  }

  const salaryYear =
    usesPriorCalendarYearForResidentTaxLevy(
      input.assessmentCalendarYear,
      input.simulationStartYear,
    ) || input.resolution === 'reference_year'
      ? levyYear
      : input.assessmentCalendarYear;

  const levyMonths = resolveResidentTaxLevyMonthRange({
    assessmentCalendarYear: input.assessmentCalendarYear,
    simulationStartYear: input.simulationStartYear,
    assessmentMonthStart: input.monthStart,
    assessmentMonthEnd: input.monthEnd,
  });
  const salaryMonthStart =
    salaryYear === levyYear ? levyMonths.monthStart : input.monthStart;
  const salaryMonthEnd =
    salaryYear === levyYear ? levyMonths.monthEnd : input.monthEnd;

  if (
    levyPhase === 'simulation_start' &&
    usesAnnualIncomeTaxBasis(
      input.member,
      input.incomeByMember,
      input.monthStart,
      input.monthEnd,
      input.assessmentCalendarYear,
      input.referenceDate,
      input.simulationStartYear,
    )
  ) {
    return calcMemberSalaryBreakdownYenForTaxYear({
      member: input.member,
      entries: input.incomeEntries,
      referenceDate: input.referenceDate,
      calendarYear: input.assessmentCalendarYear,
      annualize: true,
    });
  }

  if (residentTaxLevyUsesAnnualIncomeBasis(levyPhase, hasNewIncomeFromStart)) {
    const annualYear =
      levyPhase === 'simulation_start_next'
        ? levyYear
        : input.assessmentCalendarYear;
    return calcMemberSalaryBreakdownYenForTaxYear({
      member: input.member,
      entries: input.incomeEntries,
      referenceDate: input.referenceDate,
      calendarYear: annualYear,
      annualize: true,
    });
  }

  return resolveSalaryBreakdownYenForCalendarYear({
    member: input.member,
    incomeEntries: input.incomeEntries,
    referenceDate: input.referenceDate,
    calendarYear: salaryYear,
    monthStart: salaryMonthStart,
    monthEnd: salaryMonthEnd,
  });
}

function resolveEarnedIncomeFormula(
  grossSalaryRevenueYen: number,
  businessBreakdown: BusinessIncomeBreakdownYen | null,
): 'salary' | 'business' | 'mixed' {
  const hasSalary = grossSalaryRevenueYen > 0;
  const hasBusiness =
    businessBreakdown != null && businessBreakdown.grossRevenueYen > 0;
  if (hasSalary && hasBusiness) return 'mixed';
  if (hasBusiness) return 'business';
  return 'salary';
}

function resolveLevyBusinessBreakdownYen(input: {
  member: FamilyMember;
  incomeByMember: IncomeByMember;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
  assessmentCalendarYear: number;
  simulationStartYear: number;
  levyProfile: PersonTaxProfile;
  resolution: PriorYearIncomeResolution;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  monthStart: number;
  monthEnd: number;
}): BusinessIncomeBreakdownYen | null {
  if (input.resolution === 'prior_year_override') {
    const override = input.priorYearIncomeByMember[input.member.id];
    if (
      override?.differsFromCurrentYear &&
      override.category === 'self_employed'
    ) {
      const grossRevenueYen = Math.round(
        override.monthlyAmountMan * 12 * MAN_TO_YEN,
      );
      const annualExpenseYen = 0;
      const filingDeductionYen = filingTypeDeductionYen('blue_65');
      const businessIncomeYen = Math.max(
        0,
        grossRevenueYen - annualExpenseYen - filingDeductionYen,
      );
      return {
        grossRevenueYen,
        annualExpenseYen,
        filingDeductionYen,
        businessIncomeYen,
      };
    }
    return null;
  }

  const businessYear =
    usesPriorCalendarYearForResidentTaxLevy(
      input.assessmentCalendarYear,
      input.simulationStartYear,
    ) || input.resolution === 'reference_year'
      ? resolveLevyIncomeReferenceYear(input.assessmentCalendarYear)
      : input.assessmentCalendarYear;

  if (
    !usesAnnualIncomeTaxBasis(
      input.member,
      input.incomeByMember,
      input.monthStart,
      input.monthEnd,
      input.assessmentCalendarYear,
      input.referenceDate,
      input.simulationStartYear,
    ) &&
    !input.levyProfile.hasActiveIncomeBlock
  ) {
    return null;
  }

  const useAnnualize = usesAnnualIncomeTaxBasis(
    input.member,
    input.incomeByMember,
    input.monthStart,
    input.monthEnd,
    input.assessmentCalendarYear,
    input.referenceDate,
    input.simulationStartYear,
  );

  return calcMemberBusinessIncomeBreakdownYenForTaxYear({
    member: input.member,
    entries: input.incomeEntries,
    referenceDate: input.referenceDate,
    calendarYear: useAnnualize
      ? input.assessmentCalendarYear
      : businessYear,
    annualize: useAnnualize,
  });
}

export function buildMemberTaxBreakdownData(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  referenceDate: Date;
  calendarYear: number;
  memberId: string;
  monthStart?: number;
  monthEnd?: number;
  levyPaymentFactor?: number;
  /** 按分表示用（試算初年度の対象月。算定は monthStart/monthEnd=1〜12） */
  simulationMonthStart?: number;
  simulationMonthEnd?: number;
  annualPensionManByMember?: Record<string, number>;
  pensionByMember?: PensionByMember;
  /** 試算開始年。省略時は referenceDate の暦年 */
  simulationStartYear?: number;
  /** 住宅ローン控除（税額控除・円）。所得税→住民税の順に充当 */
  housingLoanTaxCreditYen?: number;
  insuranceState?: InsuranceState;
  housingState?: HousingState;
  vehicleState?: VehicleState;
  /** 小規模企業共済等掛金控除（iDeCo + 選択型DC加入者掛金）に使用 */
  savingsState?: SavingsState;
  /**
   * iDeCo / 企業型DC / DB 年金受取（万円・住民税 levy 年）。
   * levy の公的年金再計算に加算する。
   */
  idecoAnnuityManByMemberForLevy?: Record<string, number>;
  /**
   * iDeCo / 企業型DC / DB 一時金（受取年）。分離課税の退職所得として加算。
   */
  idecoLumpSumByMember?: Record<
    string,
    {
      revenueMan: number;
      enrollmentYears: number;
      deductionYenOverride?: number;
      overlapYears?: number;
      kind?: 'company' | 'ideco' | 'dc' | 'db';
    }
  >;
}): MemberTaxBreakdownData | null {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const levyPaymentFactor = input.levyPaymentFactor ?? 1;
  const simulationMonthStart = input.simulationMonthStart ?? monthStart;
  const simulationMonthEnd = input.simulationMonthEnd ?? monthEnd;
  const annualPensionManByMember = input.annualPensionManByMember ?? {};
  const priorYearIncomeByMember = input.priorYearIncomeByMember ?? {};
  const simulationStartYear =
    input.simulationStartYear ?? input.referenceDate.getFullYear();
  const levyIncomeCalendarYear = resolveLevyIncomeReferenceYear(input.calendarYear);
  const levyMonths = resolveResidentTaxLevyMonthRange({
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    assessmentMonthStart: monthStart,
    assessmentMonthEnd: monthEnd,
  });
  const levyAnnualPensionManByMember = resolveLevyAnnualPensionManByMember({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    pensionByMember: input.pensionByMember,
    assessmentAnnualPensionManByMember: annualPensionManByMember,
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    referenceDate: input.referenceDate,
    monthStart,
    monthEnd,
  });

  const member = input.familyMembers.find((m) => m.id === input.memberId);
  if (!member || member.role === 'pet') return null;

  const headMember = input.familyMembers.find((m) => m.role === 'head');
  const spouseMember = input.familyMembers.find((m) => m.role === 'spouse');
  if (!headMember) return null;

  const insurableMembers = input.familyMembers.filter((m) => m.role !== 'pet');
  const memberProfiles = insurableMembers.map((m) => ({
    memberId: m.id,
    profile: resolvePersonProfile(
      m,
      input.incomeByMember,
      input.referenceDate,
      input.calendarYear,
      monthStart,
      monthEnd,
      annualPensionManByMember[m.id] ?? 0,
    ),
  }));

  const profile = memberProfiles.find((entry) => entry.memberId === member.id)?.profile;
  if (!profile) return null;

  const levyContext = buildMemberLevyIncomeContext({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    monthStart,
    monthEnd,
    levyAnnualPensionManByMember,
  });
  const levyProfilesByMemberId = levyContext.profilesByMemberId;
  const levyMemberProfiles = insurableMembers.map((m) => ({
    memberId: m.id,
    profile: levyProfilesByMemberId[m.id] ?? memberProfiles.find((e) => e.memberId === m.id)!.profile,
  }));
  const levyProfile = levyProfilesByMemberId[member.id] ?? profile;
  const levyResolution =
    levyContext.resolutionsByMemberId[member.id] ?? 'reference_year';

  const head = memberProfiles.find((entry) => entry.memberId === headMember.id)?.profile;
  const spouse = spouseMember
    ? memberProfiles.find((entry) => entry.memberId === spouseMember.id)?.profile ?? null
    : null;
  const headLevy = levyProfilesByMemberId[headMember.id] ?? head!;
  const spouseLevy = spouseMember
    ? levyProfilesByMemberId[spouseMember.id] ?? spouse
    : null;

  const residentTaxContext = buildHouseholdResidentTaxContext(
    input.familyMembers,
    levyProfilesByMemberId,
    levyIncomeCalendarYear,
  );
  const residentTaxAssessment = assessHouseholdResidentTax(
    input.familyMembers,
    levyMemberProfiles,
    residentTaxContext,
  );
  const exemptionByMemberId = Object.fromEntries(
    residentTaxAssessment.assessments.map((assessment) => [
      assessment.memberId,
      assessment.exemptionLevel,
    ]),
  );

  const profilesByMemberId = Object.fromEntries(
    memberProfiles.map((entry) => [entry.memberId, entry.profile]),
  );
  const incomeTaxProfilesByMemberId = Object.fromEntries(
    insurableMembers.map((m) => [
      m.id,
      usesAnnualIncomeTaxBasis(
        m,
        input.incomeByMember,
        monthStart,
        monthEnd,
        input.calendarYear,
        input.referenceDate,
        simulationStartYear,
      )
        ? resolvePersonProfileFromAnnualIncomeBasis(
            m,
            input.incomeByMember,
            input.referenceDate,
            input.calendarYear,
            annualPensionManByMember[m.id] ?? 0,
          )
        : profilesByMemberId[m.id],
    ]),
  );
  const incomeTaxHead =
    incomeTaxProfilesByMemberId[headMember.id] ?? head!;
  const incomeTaxSpouse = spouseMember
    ? incomeTaxProfilesByMemberId[spouseMember.id] ?? spouse
    : null;

  const socialInsuranceCalcContext: SocialInsuranceCalcContext = {
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart,
    monthEnd,
    simulationStartYear,
    levyProfilesByMemberId,
    assessmentProfilesByMemberId: profilesByMemberId,
    levyResolutionsByMemberId: levyContext.resolutionsByMemberId,
    savingsState: input.savingsState,
  };

  const socialInsuranceBreakdown = calcHouseholdSocialInsuranceBreakdown(
    memberProfiles,
    socialInsuranceCalcContext,
  );
  const residentTaxSocialInsurance = resolveResidentTaxSocialInsurance({
    member,
    levyProfile,
    incomeByMember: input.incomeByMember,
    levyIncomeCalendarYear,
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    socialInsuranceCalcContext,
    levyMonths,
  });
  const residentTaxSocialInsuranceYen = residentTaxSocialInsurance.yen;
  const residentTaxSocialInsuranceDeduction =
    residentTaxSocialInsurance.deduction;

  const childDeductions = calcDependentMemberDeductions(
    input.familyMembers,
    input.incomeByMember,
    input.referenceDate,
    input.calendarYear,
    monthStart,
    monthEnd,
    annualPensionManByMember,
  );
  const childLevyDeductions = calcDependentMemberDeductions(
    input.familyMembers,
    input.incomeByMember,
    input.referenceDate,
    levyIncomeCalendarYear,
    levyMonths.monthStart,
    levyMonths.monthEnd,
    levyAnnualPensionManByMember,
  );

  const headUsesAnnualBasisForSpouseDeduction =
    member.id === headMember.id &&
    usesAnnualIncomeTaxBasis(
      headMember,
      input.incomeByMember,
      monthStart,
      monthEnd,
      input.calendarYear,
      input.referenceDate,
      simulationStartYear,
    );
  const headIncomeAdjustmentForSpouseDeduction =
    member.id === headMember.id
      ? resolveMemberIncomeAdjustmentDeductionYen({
          member: headMember,
          familyMembers: input.familyMembers,
          incomeEntries: input.incomeByMember[headMember.id] ?? [],
          referenceDate: input.referenceDate,
          calendarYear: input.calendarYear,
          monthStart: headUsesAnnualBasisForSpouseDeduction ? 1 : monthStart,
          monthEnd: headUsesAnnualBasisForSpouseDeduction ? 12 : monthEnd,
        })
      : { deductionYen: 0 };
  const headLevyIncomeAdjustmentForSpouseDeduction =
    member.id === headMember.id
      ? resolveMemberIncomeAdjustmentDeductionYen({
          member: headMember,
          familyMembers: input.familyMembers,
          incomeEntries: input.incomeByMember[headMember.id] ?? [],
          referenceDate: input.referenceDate,
          calendarYear: levyIncomeCalendarYear,
          salaryRevenueYenOverride:
            levyResolution === 'prior_year_override'
              ? headLevy.grossIncomeYen
              : undefined,
        })
      : { deductionYen: 0 };
  const spouseAgeAtYearEnd = spouseMember
    ? getMemberAgeAtYearEnd(
        spouseMember,
        input.referenceDate,
        input.calendarYear,
      )
    : null;
  const spouseLevyAgeAtYearEnd = spouseMember
    ? getMemberAgeAtYearEnd(
        spouseMember,
        input.referenceDate,
        levyIncomeCalendarYear,
      )
    : null;

  const spouseDeductionInput =
    member.id === headMember.id && incomeTaxSpouse
      ? {
          headTotalIncomeYen: calcTaxpayerTotalIncomeYenForSpouseDeduction(
            incomeTaxHead,
            headIncomeAdjustmentForSpouseDeduction.deductionYen,
          ),
          spouseTotalIncomeYen: calcTaxpayerTotalIncomeYenForSpouseDeduction(
            incomeTaxSpouse,
          ),
          spouseAgeAtYearEnd,
          calendarYear: input.calendarYear,
        }
      : null;
  const spouseDeductions =
    member.id === headMember.id
      ? calcHeadSpouseDeductions(
          incomeTaxHead,
          incomeTaxSpouse,
          input.calendarYear,
          spouseAgeAtYearEnd,
          spouseDeductionInput?.headTotalIncomeYen ?? 0,
          spouseDeductionInput?.spouseTotalIncomeYen ?? 0,
        )
      : {
          incomeTaxYen: 0,
          residentTaxYen: 0,
        };
  const spouseDeductionKind: SpouseDeductionKind =
    spouseDeductionInput && spouseDeductions.incomeTaxYen > 0
      ? resolveSpouseDeductionKind(spouseDeductionInput)
      : 'none';
  const spouseLevyDeductionInput =
    member.id === headMember.id && spouseMember
      ? {
          headTotalIncomeYen: calcTaxpayerTotalIncomeYenForSpouseDeduction(
            headLevy,
            headLevyIncomeAdjustmentForSpouseDeduction.deductionYen,
          ),
          spouseTotalIncomeYen: spouseLevy
            ? calcTaxpayerTotalIncomeYenForSpouseDeduction(spouseLevy)
            : 0,
          spouseAgeAtYearEnd: spouseLevyAgeAtYearEnd,
          calendarYear: levyIncomeCalendarYear,
        }
      : null;
  const spouseLevyDeductions =
    member.id === headMember.id
      ? calcHeadSpouseDeductions(
          headLevy,
          spouseLevy,
          levyIncomeCalendarYear,
          spouseLevyAgeAtYearEnd,
          calcTaxpayerTotalIncomeYenForSpouseDeduction(
            headLevy,
            headLevyIncomeAdjustmentForSpouseDeduction.deductionYen,
          ),
          spouseLevy
            ? calcTaxpayerTotalIncomeYenForSpouseDeduction(spouseLevy)
            : 0,
        )
      : { incomeTaxYen: 0, residentTaxYen: 0 };
  const dependentDeductions =
    member.id === headMember.id
      ? childDeductions
      : { incomeTaxYen: 0, residentTaxYen: 0 };
  const dependentLevyDeductions =
    member.id === headMember.id
      ? childLevyDeductions
      : { incomeTaxYen: 0, residentTaxYen: 0 };

  const lifeInsuranceDeductions = input.insuranceState
    ? calcMemberLifeInsuranceDeductionYen({
        member,
        insuranceState: input.insuranceState,
        housingState: input.housingState ?? { byTarget: {} },
        vehicleState: input.vehicleState ?? { byMember: {} },
        referenceDate: input.referenceDate,
        calendarYear: input.calendarYear,
        monthStart,
        monthEnd,
        levyCalendarYear: levyIncomeCalendarYear,
        levyMonthStart: levyMonths.monthStart,
        levyMonthEnd: levyMonths.monthEnd,
      })
    : { incomeTaxYen: 0, residentTaxYen: 0 };
  const lifeInsuranceIncomeTaxPremiumsMan = input.insuranceState
    ? calcMemberAnnualLifeInsurancePremiumManByKind({
        member,
        entries: input.insuranceState.byMember[member.id] ?? [],
        housingState: input.housingState ?? { byTarget: {} },
        vehicleState: input.vehicleState ?? { byMember: {} },
        referenceDate: input.referenceDate,
        calendarYear: input.calendarYear,
        monthStart,
        monthEnd,
      })
    : null;
  const lifeInsuranceResidentTaxPremiumsMan = input.insuranceState
    ? calcMemberAnnualLifeInsurancePremiumManByKind({
        member,
        entries: input.insuranceState.byMember[member.id] ?? [],
        housingState: input.housingState ?? { byTarget: {} },
        vehicleState: input.vehicleState ?? { byMember: {} },
        referenceDate: input.referenceDate,
        calendarYear: levyIncomeCalendarYear,
        monthStart: levyMonths.monthStart,
        monthEnd: levyMonths.monthEnd,
      })
    : null;

  const idecoContributionDeductions = input.savingsState
    ? calcMemberIdecoContributionDeductionYen({
        member,
        savingsState: input.savingsState,
        referenceDate: input.referenceDate,
        calendarYear: input.calendarYear,
        monthStart,
        monthEnd,
        simulationStartYear,
      })
    : {
        incomeTaxYen: 0,
        residentTaxYen: 0,
        contributionMan: 0,
        levyContributionMan: 0,
      };

  const extraIncomeTaxDeductionYen =
    spouseDeductions.incomeTaxYen +
    dependentDeductions.incomeTaxYen +
    lifeInsuranceDeductions.incomeTaxYen +
    idecoContributionDeductions.incomeTaxYen;
  const extraResidentTaxDeductionYen =
    spouseLevyDeductions.residentTaxYen +
    dependentLevyDeductions.residentTaxYen +
    lifeInsuranceDeductions.residentTaxYen +
    idecoContributionDeductions.residentTaxYen;

  const incomeTaxProfile =
    incomeTaxProfilesByMemberId[member.id] ?? profile;
  const usesAnnualBasisForIncomeTax = usesAnnualIncomeTaxBasis(
    member,
    input.incomeByMember,
    monthStart,
    monthEnd,
    input.calendarYear,
    input.referenceDate,
    simulationStartYear,
  );
  const incomeEntries = input.incomeByMember[member.id] ?? [];
  const assessmentEmployeeInsurance = resolveAssessmentEmployeeInsuranceForMember({
    member,
    profile,
    context: socialInsuranceCalcContext,
    incomeEntries,
  });
  /** 初年度は CF・その他タブ表示をシミュレーション月の天引きに合わせる（税の社保控除は年額のまま） */
  const cashFlowEmployeeInsurance =
    levyPaymentFactor < 1 && usesAnnualBasisForIncomeTax
      ? resolveAssessmentEmployeeInsuranceForMember({
          member,
          profile,
          context: socialInsuranceCalcContext,
          incomeEntries,
          limitPremiumToSimulationMonths: true,
        })
      : assessmentEmployeeInsurance;
  const socialInsuranceDeduction =
    assessmentEmployeeInsurance.socialInsuranceDeduction;
  const incomeTaxSocialInsuranceYen =
    assessmentEmployeeInsurance.socialInsuranceTotalYen;
  const incomeTaxSalaryMonthStart = usesAnnualBasisForIncomeTax ? 1 : monthStart;
  const incomeTaxSalaryMonthEnd = usesAnnualBasisForIncomeTax ? 12 : monthEnd;

  const pensionYen = Math.round(incomeTaxProfile.annualPensionMan * MAN_TO_YEN);
  const age = incomeTaxProfile.age ?? profile.age ?? 65;

  const incomeTaxSalaryBreakdown = usesAnnualBasisForIncomeTax
    ? calcMemberSalaryBreakdownYenForTaxYear({
        member,
        entries: incomeEntries,
        referenceDate: input.referenceDate,
        calendarYear: input.calendarYear,
        annualize: true,
      })
    : resolveSalaryBreakdownYenForCalendarYear({
        member,
        incomeEntries,
        referenceDate: input.referenceDate,
        calendarYear: input.calendarYear,
        monthStart,
        monthEnd,
      });
  const hasSalaryIncomeForInsuranceTax =
    incomeTaxSalaryBreakdown.grossSalaryRevenueYen > 0;
  const insuranceIncomeTax = input.insuranceState
    ? calcRecipientInsuranceIncomeTaxDetail({
        recipientId: member.id,
        familyMembers: input.familyMembers,
        insuranceState: input.insuranceState,
        housingState: input.housingState ?? { byTarget: {} },
        vehicleState: input.vehicleState ?? { byMember: {} },
        referenceDate: input.referenceDate,
        calendarYear: input.calendarYear,
        monthStart,
        monthEnd,
        hasSalaryIncome: hasSalaryIncomeForInsuranceTax,
      })
    : createEmptyInsuranceIncomeTaxDetail();
  const incomeTaxBusinessBreakdown =
    usesAnnualBasisForIncomeTax || incomeTaxProfile.hasActiveIncomeBlock
      ? calcMemberBusinessIncomeBreakdownYenForTaxYear({
          member,
          entries: incomeEntries,
          referenceDate: input.referenceDate,
          calendarYear: input.calendarYear,
          annualize: usesAnnualBasisForIncomeTax,
        })
      : null;
  const earnedIncomeFormula = resolveEarnedIncomeFormula(
    incomeTaxSalaryBreakdown.grossSalaryRevenueYen,
    incomeTaxBusinessBreakdown,
  );
  const baseSalaryIncomeDeductionYen = calcSalaryIncomeDeductionYen(
    incomeTaxSalaryBreakdown.grossSalaryRevenueYen,
    input.calendarYear,
  );
  const { deductionYen: incomeAdjustmentDeductionYen, qualifies: incomeAdjustmentQualifies } =
    resolveMemberIncomeAdjustmentDeductionYen({
      member,
      familyMembers: input.familyMembers,
      incomeEntries,
      referenceDate: input.referenceDate,
      calendarYear: input.calendarYear,
      monthStart: incomeTaxSalaryMonthStart,
      monthEnd: incomeTaxSalaryMonthEnd,
    });
  const otherIncomeYen = calcOtherIncomeExcludingPensionYen(
    incomeTaxProfile.taxableIncomeYen,
    incomeAdjustmentDeductionYen,
  );
  const pensionIncomeYen = calcPensionMiscIncomeYen(
    pensionYen,
    age,
    otherIncomeYen,
  );
  const pensionDeductionYen = calcPublicPensionDeductionYen(
    pensionYen,
    age,
    otherIncomeYen,
  );
  const salaryIncomeDeductionYen =
    baseSalaryIncomeDeductionYen + incomeAdjustmentDeductionYen;

  const insuranceIncomeTaxableYen = sumInsuranceIncomeTaxableYen(insuranceIncomeTax);

  const totalIncomeForIncomeTax = Math.max(
    0,
    incomeTaxProfile.taxableIncomeYen +
      pensionIncomeYen +
      insuranceIncomeTaxableYen -
      incomeAdjustmentDeductionYen,
  );
  const basicDeductionIncomeTaxYen = calcBasicDeductionIncomeTaxYen(
    totalIncomeForIncomeTax,
    input.calendarYear,
  );

  const levySalaryBreakdown = resolveLevySalaryBreakdownYen({
    member,
    incomeByMember: input.incomeByMember,
    incomeEntries: input.incomeByMember[member.id] ?? [],
    referenceDate: input.referenceDate,
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    levyProfile,
    resolution: levyResolution,
    monthStart,
    monthEnd,
  });
  const levyInsuranceIncomeTax = input.insuranceState
    ? calcRecipientInsuranceIncomeTaxDetail({
        recipientId: member.id,
        familyMembers: input.familyMembers,
        insuranceState: input.insuranceState,
        housingState: input.housingState ?? { byTarget: {} },
        vehicleState: input.vehicleState ?? { byMember: {} },
        referenceDate: input.referenceDate,
        calendarYear: levyIncomeCalendarYear,
        monthStart: levyMonths.monthStart,
        monthEnd: levyMonths.monthEnd,
        hasSalaryIncome: levySalaryBreakdown.grossSalaryRevenueYen > 0,
      })
    : createEmptyInsuranceIncomeTaxDetail();
  const levyInsuranceIncomeTaxableYen =
    sumInsuranceIncomeTaxableYen(levyInsuranceIncomeTax);
  const levyBusinessBreakdown = resolveLevyBusinessBreakdownYen({
    member,
    incomeByMember: input.incomeByMember,
    incomeEntries: input.incomeByMember[member.id] ?? [],
    referenceDate: input.referenceDate,
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    levyProfile,
    resolution: levyResolution,
    priorYearIncomeByMember,
    monthStart,
    monthEnd,
  });
  const levyEarnedIncomeFormula = resolveEarnedIncomeFormula(
    levySalaryBreakdown.grossSalaryRevenueYen,
    levyBusinessBreakdown,
  );
  const levyBaseSalaryIncomeDeductionYen = calcSalaryIncomeDeductionYen(
    levySalaryBreakdown.grossSalaryRevenueYen,
    levyIncomeCalendarYear,
  );
  const {
    deductionYen: levyIncomeAdjustmentDeductionYen,
    qualifies: levyIncomeAdjustmentQualifies,
  } = resolveMemberIncomeAdjustmentDeductionYen({
    member,
    familyMembers: input.familyMembers,
    incomeEntries: input.incomeByMember[member.id] ?? [],
    referenceDate: input.referenceDate,
    calendarYear: levyIncomeCalendarYear,
    salaryRevenueYenOverride:
      levyResolution === 'prior_year_override'
        ? levyProfile.grossIncomeYen
        : undefined,
  });
  const levySalaryIncomeYen = Math.max(
    0,
    levySalaryBreakdown.salaryIncomeYen - levyIncomeAdjustmentDeductionYen,
  );
  const levyPensionYen = Math.round(
    ((levyAnnualPensionManByMember[member.id] ?? 0) +
      (input.idecoAnnuityManByMemberForLevy?.[member.id] ?? 0)) *
      MAN_TO_YEN,
  );
  const levyAge = levyProfile.age ?? age;
  const levyOtherIncomeYen = calcOtherIncomeExcludingPensionYen(
    levyProfile.taxableIncomeYen,
    levyIncomeAdjustmentDeductionYen,
  );
  const levyPensionIncomeYen = calcPensionMiscIncomeYen(
    levyPensionYen,
    levyAge,
    levyOtherIncomeYen,
  );
  const totalIncomeForResidentTax = Math.max(
    0,
    levyProfile.taxableIncomeYen +
      levyPensionIncomeYen +
      levyInsuranceIncomeTaxableYen -
      levyIncomeAdjustmentDeductionYen,
  );
  const basicDeductionResidentTaxYen =
    calcBasicDeductionResidentTaxYen(totalIncomeForResidentTax);

  const taxableIncomeTaxBase = Math.max(
    0,
    totalIncomeForIncomeTax -
      incomeTaxSocialInsuranceYen -
      basicDeductionIncomeTaxYen -
      extraIncomeTaxDeductionYen,
  );
  const taxableResidentTaxBase = Math.max(
    0,
    totalIncomeForResidentTax -
      residentTaxSocialInsuranceYen -
      basicDeductionResidentTaxYen -
      extraResidentTaxDeductionYen,
  );

  const taxBracket = getProgressiveIncomeTaxBracket(taxableIncomeTaxBase);
  const exemptionLevel = exemptionByMemberId[member.id] ?? 'taxable';

  const personalDeductionDiffYen = calcPersonalDeductionDiffYen({
    basicDeductionIncomeTaxYen,
    basicDeductionResidentTaxYen,
    spouseIncomeTaxYen: spouseDeductions.incomeTaxYen,
    spouseResidentTaxYen: spouseLevyDeductions.residentTaxYen,
    dependentIncomeTaxYen: dependentDeductions.incomeTaxYen,
    dependentResidentTaxYen: dependentLevyDeductions.residentTaxYen,
    singleParentIncomeTaxYen: 0,
    singleParentResidentTaxYen: 0,
    disabilityIncomeTaxYen: 0,
    disabilityResidentTaxYen: 0,
    workingStudentIncomeTaxYen: 0,
    workingStudentResidentTaxYen: 0,
    lifeInsuranceIncomeTaxYen: lifeInsuranceDeductions.incomeTaxYen,
    lifeInsuranceResidentTaxYen: lifeInsuranceDeductions.residentTaxYen,
  });

  const { incomeLevyYen } = calcResidentTaxLevyAndPerCapitaYen(
    taxableResidentTaxBase,
    exemptionLevel,
  );
  const perCapitaMunicipalYen =
    exemptionLevel === 'fully_exempt' ? 0 : 3_500;
  const perCapitaPrefecturalYen =
    exemptionLevel === 'fully_exempt' ? 0 : 1_500;

  const residentTaxAmounts = isTaxIndependent(profile)
    ? calcResidentTaxWithAdjustmentYen({
        taxableIncomeYen: taxableResidentTaxBase,
        totalIncomeYen: totalIncomeForResidentTax,
        personalDeductionDiffYen,
        incomeLevyYen,
        perCapitaYen: perCapitaMunicipalYen + perCapitaPrefecturalYen,
      })
    : {
        adjustmentCreditYen: 0,
        residentTaxYen: 0,
        adjustedResidentTaxYen: 0,
      };

  const authoritativeTaxes = isTaxIndependent(incomeTaxProfile)
    ? calcPersonTaxesYen(
        incomeTaxProfile,
        extraIncomeTaxDeductionYen,
        extraResidentTaxDeductionYen,
        input.calendarYear,
        incomeTaxSocialInsuranceYen,
        exemptionLevel,
        incomeAdjustmentDeductionYen,
        {
          profile: levyProfile,
          calendarYear: levyIncomeCalendarYear,
          incomeAdjustmentDeductionYen: levyIncomeAdjustmentDeductionYen,
        },
        residentTaxSocialInsuranceYen,
        insuranceIncomeTaxableYen,
        levyInsuranceIncomeTaxableYen,
      )
    : { incomeTaxYen: 0, residentTaxYen: 0 };
  const rawIncomeTaxYen = isTaxIndependent(incomeTaxProfile)
    ? authoritativeTaxes.incomeTaxYen
    : 0;
  const rawAdjustedResidentTaxYen = isTaxIndependent(incomeTaxProfile)
    ? authoritativeTaxes.residentTaxYen
    : 0;

  // 住宅ローン控除（税額控除）: 所得税 → 住民税の順に充当
  const housingLoanCredit = input.housingLoanTaxCreditYen ?? 0;
  const incomeTaxAfterHousingCredit = Math.max(0, rawIncomeTaxYen - housingLoanCredit);
  const housingCreditExcess = Math.max(0, housingLoanCredit - rawIncomeTaxYen);
  const residentTaxHousingCredit = Math.min(housingCreditExcess, 97_500);
  const housingLoanTaxCreditAppliedYen = housingLoanCredit - housingCreditExcess;
  const housingLoanResidentTaxCreditAppliedYen = residentTaxHousingCredit;

  // iDeCo / 企業型DC / DB 一時金（退職所得・分離課税）を受取年の税に加算
  const lumpInput = input.idecoLumpSumByMember?.[member.id];
  const retirementBreakdown =
    isTaxIndependent(incomeTaxProfile) && lumpInput && lumpInput.revenueMan > 0
      ? calcRetirementIncomeTaxBreakdown(
          lumpInput.revenueMan * MAN_TO_YEN,
          lumpInput.enrollmentYears,
          lumpInput.deductionYenOverride != null
            ? { deductionYenOverride: lumpInput.deductionYenOverride }
            : undefined,
        )
      : null;
  const retirementIncomeTaxYen = retirementBreakdown?.incomeTaxYen ?? 0;
  const retirementResidentTaxYen = retirementBreakdown?.residentTaxYen ?? 0;

  const incomeTaxYen =
    incomeTaxAfterHousingCredit + retirementIncomeTaxYen;
  const residentTaxYen = residentTaxAmounts.residentTaxYen;
  const adjustedResidentTaxYen =
    Math.max(0, rawAdjustedResidentTaxYen - residentTaxHousingCredit) +
    retirementResidentTaxYen;
  const adjustmentCreditYen = isTaxIndependent(incomeTaxProfile)
    ? residentTaxAmounts.adjustmentCreditYen
    : 0;
  const incomeTaxCashFlowYen =
    levyPaymentFactor < 1 && usesAnnualBasisForIncomeTax
      ? incomeTaxCashFlowYenFromAnnual(incomeTaxYen, levyPaymentFactor)
      : taxYenToCashFlowYen(incomeTaxYen);
  const residentTaxCashFlowYen = residentTaxCashFlowYenFromAnnual(
    adjustedResidentTaxYen,
    levyPaymentFactor,
  );

  const employeeCategory = cashFlowEmployeeInsurance.employeeCategory;
  const incomeSplit = cashFlowEmployeeInsurance.incomeSplit;
  const employeeDetail = cashFlowEmployeeInsurance.employeeDetail;
  const grossIncomeYen = profile.grossIncomeYen;
  const annualSalaryYen = incomeSplit?.annualSalaryYen ?? grossIncomeYen;
  const annualBonusYen = incomeSplit?.annualBonusYen ?? 0;
  const employmentAnnualIncomeYen =
    cashFlowEmployeeInsurance.employmentAnnualIncomeYen;
  const employmentAnnualPremiumYen =
    cashFlowEmployeeInsurance.employmentAnnualPremiumYen;
  const standardMonthlyRemunerationYen =
    cashFlowEmployeeInsurance.standardMonthlyRemunerationYen;
  const standardMonthlyRemunerationHealthYen =
    cashFlowEmployeeInsurance.standardMonthlyRemunerationHealthYen;
  const pensionRate = TAX_CONSTANTS.employeePensionRate;
  const annualPensionFromSalaryYen =
    cashFlowEmployeeInsurance.annualPensionFromSalaryYen;
  const annualPensionFromBonusYen =
    cashFlowEmployeeInsurance.annualPensionFromBonusYen;
  const healthMedicalSupportRate = FUKUOKA_HEALTH_INSURANCE_RATES_R8.medicalSupport;
  const healthChildcareRate = FUKUOKA_HEALTH_INSURANCE_RATES_R8.childcare;
  const healthNursingRate =
    age >= 40 && age < 65 ? FUKUOKA_HEALTH_INSURANCE_RATES_R8.nursingCare : 0;
  const standardHealthBonusYen = cashFlowEmployeeInsurance.standardHealthBonusYen;
  const annualHealthMedicalSupportYen =
    cashFlowEmployeeInsurance.annualHealthMedicalSupportYen;
  const annualHealthChildcareYen =
    cashFlowEmployeeInsurance.annualHealthChildcareYen;
  const annualHealthNursingYen =
    cashFlowEmployeeInsurance.annualHealthNursingYen;

  const nhiEntries = memberProfiles.filter(
    (entry) => classifySocialInsuranceCategory(entry.profile) === 'nhi',
  );
  const lateElderlyEntries = memberProfiles.filter(
    (entry) => classifySocialInsuranceCategory(entry.profile) === 'late_elderly',
  );
  const nhiBreakdown = buildHouseholdNhiBreakdown({
    nhiEntries,
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    assessmentCalendarYear: input.calendarYear,
    levyProfilesByMemberId,
    assessmentProfilesByMemberId: profilesByMemberId,
    levyResolutionsByMemberId: levyContext.resolutionsByMemberId,
  });
  const lateElderlyBreakdown = buildHouseholdLateElderlyBreakdown({
    lateElderlyEntries,
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    assessmentCalendarYear: input.calendarYear,
    levyProfilesByMemberId,
    assessmentProfilesByMemberId: profilesByMemberId,
    levyResolutionsByMemberId: levyContext.resolutionsByMemberId,
  });
  const isNhiMember = employeeCategory === 'nhi';
  const nationalPensionYen =
    isNhiMember && age < 60 ? TAX_CONSTANTS.nationalPensionAnnualYen : 0;
  const memberSocialTotalYen =
    socialInsuranceBreakdown.byMemberId[member.id] ?? 0;
  const memberShareYen = isNhiMember
    ? Math.max(0, memberSocialTotalYen - nationalPensionYen)
    : 0;

  const proration = buildOtherProrationContext({
    member,
    incomeEntries,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart: simulationMonthStart,
    monthEnd: simulationMonthEnd,
    levyPaymentFactor,
    residentTaxBasisGrossSalaryYen:
      levyEarnedIncomeFormula === 'business' && levyBusinessBreakdown
        ? levyBusinessBreakdown.grossRevenueYen
        : levySalaryBreakdown.grossSalaryRevenueYen,
  });

  const spouseIncomeTaxReference: SpouseDeductionReferenceContext | null =
    spouseDeductionInput && spouseDeductionKind !== 'none'
      ? { ...spouseDeductionInput, kind: spouseDeductionKind }
      : null;
  const spouseResidentTaxReference: SpouseDeductionReferenceContext | null =
    spouseLevyDeductionInput &&
    member.id === headMember.id &&
    spouseLevyDeductions.residentTaxYen > 0
      ? {
          ...spouseLevyDeductionInput,
          kind: resolveSpouseDeductionKind(spouseLevyDeductionInput),
        }
      : null;

  return {
    isTaxIndependent: isTaxIndependent(incomeTaxProfile),
    memberAge: age,
    referenceContext: {
      spouseIncomeTax: spouseIncomeTaxReference,
      spouseResidentTax: spouseResidentTaxReference,
      lifeInsuranceIncomeTaxPremiumsYen: lifeInsuranceIncomeTaxPremiumsMan
        ? premiumsManToYen(lifeInsuranceIncomeTaxPremiumsMan)
        : null,
      lifeInsuranceResidentTaxPremiumsYen: lifeInsuranceResidentTaxPremiumsMan
        ? premiumsManToYen(lifeInsuranceResidentTaxPremiumsMan)
        : null,
      idecoIncomeTaxContributionYen: idecoContributionDeductions.incomeTaxYen,
      idecoResidentTaxContributionYen:
        idecoContributionDeductions.residentTaxYen,
    },
    proration,
    earnedIncomeFormula,
    businessIncome:
      incomeTaxBusinessBreakdown != null &&
      incomeTaxBusinessBreakdown.grossRevenueYen > 0
        ? incomeTaxBusinessBreakdown
        : null,
    levyEarnedIncomeFormula,
    levyBusinessIncome:
      levyBusinessBreakdown != null && levyBusinessBreakdown.grossRevenueYen > 0
        ? levyBusinessBreakdown
        : null,
    incomeTax: {
      grossSalaryRevenueYen: incomeTaxSalaryBreakdown.grossSalaryRevenueYen,
      baseSalaryIncomeDeductionYen,
      incomeAdjustmentDeductionYen,
      incomeAdjustmentQualifies,
      salaryIncomeDeductionYen,
      salaryIncomeYen:
        Math.max(
          0,
          incomeTaxSalaryBreakdown.grossSalaryRevenueYen -
            baseSalaryIncomeDeductionYen,
        ) - incomeAdjustmentDeductionYen,
      pensionRevenueYen: pensionYen,
      pensionDeductionYen,
      pensionIncomeYen,
      otherIncomeExcludingPensionYen: otherIncomeYen,
      totalIncomeYen: totalIncomeForIncomeTax,
      basicDeductionYen: basicDeductionIncomeTaxYen,
      spouseDeductionYen: spouseDeductions.incomeTaxYen,
      spouseDeductionKind,
      dependentDeductionYen: dependentDeductions.incomeTaxYen,
      singleParentDeductionYen: 0,
      disabilityDeductionYen: 0,
      workingStudentDeductionYen: 0,
      lifeInsuranceDeductionYen: lifeInsuranceDeductions.incomeTaxYen,
      idecoContributionDeductionYen: idecoContributionDeductions.incomeTaxYen,
      insuranceTemporaryIncomeTaxableYen:
        insuranceIncomeTax.temporaryIncomeTaxableYen,
      insuranceMiscellaneousIncomeTaxableYen:
        insuranceIncomeTax.miscellaneousIncomeTaxableYen,
      otherIncomeDeductionYen: 0,
      socialInsuranceDeduction,
      taxableIncomeYen: taxableIncomeTaxBase,
      taxRate: taxBracket.rate,
      taxRateDeductionYen: taxBracket.deduction,
      incomeTaxYen,
      incomeTaxCashFlowYen,
      housingLoanTaxCreditAppliedYen,
      housingLoanResidentTaxCreditAppliedYen,
      idecoLumpSumRevenueYen: retirementBreakdown?.revenueYen ?? 0,
      idecoEnrollmentYears: retirementBreakdown?.enrollmentYears ?? 0,
      retirementIncomeDeductionYen: retirementBreakdown?.deductionYen ?? 0,
      retirementIncomeYen: retirementBreakdown?.retirementIncomeYen ?? 0,
      retirementIncomeTaxYen,
      residentBasicDeductionYen: basicDeductionResidentTaxYen,
      residentSpouseDeductionYen: spouseLevyDeductions.residentTaxYen,
      residentDependentDeductionYen: dependentLevyDeductions.residentTaxYen,
    },
    residentTax: {
      incomeReferenceYear: levyIncomeCalendarYear,
      grossSalaryRevenueYen: levySalaryBreakdown.grossSalaryRevenueYen,
      baseSalaryIncomeDeductionYen: levyBaseSalaryIncomeDeductionYen,
      incomeAdjustmentDeductionYen: levyIncomeAdjustmentDeductionYen,
      incomeAdjustmentQualifies: levyIncomeAdjustmentQualifies,
      salaryIncomeYen: levySalaryIncomeYen,
      pensionIncomeYen: levyPensionIncomeYen,
      otherIncomeExcludingPensionYen: levyOtherIncomeYen,
      totalIncomeYen: totalIncomeForResidentTax,
      pensionRevenueYen: levyPensionYen,
      pensionDeductionYen: calcPublicPensionDeductionYen(
        levyPensionYen,
        levyAge,
        levyOtherIncomeYen,
      ),
      taxableIncomeYen: taxableResidentTaxBase,
      incomeLevyYen,
      perCapitaMunicipalYen,
      perCapitaPrefecturalYen,
      perCapitaTotalYen: perCapitaMunicipalYen + perCapitaPrefecturalYen,
      adjustmentCreditYen,
      residentTaxYen,
      adjustedResidentTaxYen,
      residentTaxCashFlowYen,
      isExempt: exemptionLevel !== 'taxable',
      resolution: levyResolution,
      levyPhase: resolveResidentTaxLevyPhase(
        input.calendarYear,
        simulationStartYear,
      ),
      incomeReferenceUsesAnnualBasis: residentTaxLevyUsesAnnualIncomeBasis(
        resolveResidentTaxLevyPhase(input.calendarYear, simulationStartYear),
        memberHasNewIncomeFromStartById(
          member,
          input.incomeByMember,
          input.referenceDate.getMonth() + 1,
        ),
      ),
      retirementResidentTaxYen,
      idecoContributionDeductionYen: idecoContributionDeductions.residentTaxYen,
      socialInsuranceDeduction: residentTaxSocialInsuranceDeduction,
    },
    employeeInsurance: {
      grossIncomeYen,
      annualSalaryYen,
      annualBonusYen,
      standardMonthlyRemunerationYen,
      standardMonthlyRemunerationHealthYen,
      pensionRate,
      healthRate: TAX_CONSTANTS.employeeHealthInsuranceRate,
      longTermCareRate:
        age >= 40 && age < 65 ? TAX_CONSTANTS.longTermCareRate : 0,
      healthMedicalSupportRate,
      healthChildcareRate,
      healthNursingRate,
      standardHealthBonusYen,
      annualHealthMedicalSupportYen,
      annualHealthChildcareYen,
      annualHealthNursingYen,
      employmentAnnualIncomeYen,
      employmentRate: TAX_CONSTANTS.employeeEmploymentInsuranceRate,
      monthlyPensionYen: employeeDetail
        ? employeeDetail.social.employeesPension > 0
          ? Math.floor(standardMonthlyRemunerationYen * pensionRate)
          : 0
        : 0,
      monthlyHealthYen: employeeDetail
        ? Math.floor(employeeDetail.social.healthInsurance / 12)
        : 0,
      monthlyLongTermCareYen: employeeDetail
        ? Math.floor(employeeDetail.social.longTermCare / 12)
        : 0,
      monthlyEmploymentYen: employeeDetail
        ? Math.floor(employeeDetail.social.employmentInsurance / 12)
        : 0,
      annualPensionFromSalaryYen,
      annualPensionFromBonusYen,
      annualPensionYen:
        annualPensionFromSalaryYen + annualPensionFromBonusYen,
      annualHealthYen: employeeDetail?.social.healthInsurance ?? 0,
      annualLongTermCareYen: employeeDetail?.social.longTermCare ?? 0,
      annualEmploymentYen: employmentAnnualPremiumYen,
      isEmployeeInsured: employeeCategory === 'employee',
      bonusPaymentCount: incomeSplit?.bonusPaymentCount ?? 0,
      bonusTreatedAsRemuneration:
        incomeSplit?.bonusTreatedAsRemuneration ?? false,
      monthlyBonusShareYen: incomeSplit?.monthlyBonusShareYen ?? 0,
    },
    nhiInsurance: {
      isNhiMember,
      memberShareYen,
      nationalPensionYen,
      breakdown: nhiBreakdown,
    },
    lateElderlyHealth: buildLateElderlyHealthBreakdown({
      profile,
      category: employeeCategory,
      memberId: member.id,
      lateElderlyBreakdown,
    }),
    longTermCare: buildLongTermCareBreakdown({
      profile,
      category: employeeCategory,
      employeeDetail,
      nhiBreakdown,
      memberId: member.id,
      memberName: getMemberTabLabel(member),
    }),
    insuranceIncomeTax,
    giftTax: {
      giftTaxYen: insuranceIncomeTax.giftTaxYen,
      giftTaxCashFlowYen: taxYenToCashFlowYen(insuranceIncomeTax.giftTaxYen),
    },
  };
}
