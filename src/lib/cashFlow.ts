import { resolveMemberBirthMonth } from './familyDefaults';
import {
  calcBirthYear,
  calcYearAtAge,
  getMemberAgeMonth,
  isAgeCalendarMonthInRange,
} from './birthDate';
import type { LivingExpenseItem } from '../types/living';
import { getMemberTabLabel } from './memberDisplay';
import {
  calcMonthlyIncomeBreakdown,
  type EarnedIncomeCalcInput,
  yearsElapsedSince,
} from './memberEarnedIncome';

export type { EarnedIncomeCalcInput };
import type {
  CashFlowTableData,
  CashFlowYearRow,
  ExpenseBreakdown,
  IncomeBreakdown,
} from '../types/cashFlow';
import {
  addOtherLoanRepaymentDetail,
  addPensionBreakdown,
  createEmptyExpenseBreakdown,
  createEmptyIncomeBreakdown,
  createEmptyLifeEventExpenseDetail,
  createEmptyHousingExpenseDetail,
  createEmptyOtherLoanRepaymentDetail,
  createEmptyVehicleExpenseDetail,
  createEmptyPensionBreakdown,
  createEmptySavingsBreakdown,
  createEmptyInvestBreakdown,
  roundPensionBreakdown,
  roundSavingsBreakdown,
  roundInvestBreakdown,
  sumInvestPersonalContribution,
  addInsuranceIncomeBreakdown,
  roundInsuranceIncomeBreakdown,
  addVehicleExpenseDetail,
  sumExpenseBreakdown,
  sumHousingExpenseDetail,
  sumIncomeBreakdown,
  sumLifeEventExpenseDetail,
  sumOtherInsurancePremiumDetail,
  sumOtherLoanRepaymentDetail,
  sumPensionBreakdown,
  sumVehicleExpenseDetail,
} from '../types/cashFlow';
import {
  calcMemberMonthlyPensionBreakdownMan,
  calcMonthlyPensionEntitlementBreakdownMan,
} from './pensionIncome';
import { createDefaultPensionMemberState } from './pensionDefaults';
import { calcPensionPaymentFromEntitlements } from './pensionPaymentSchedule';
import { calcMemberMonthlyEducationYen, yenToMan } from './educationCashFlow';
import type { FamilyMember } from '../types/family';
import type { EducationByMember } from '../types/education';
import type { LifeEventState } from '../types/lifeEvent';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { VehicleState } from '../types/vehicle';
import { calcHouseholdMonthlyLifeEventBreakdownMan } from './lifeEventCashFlow';
import { calcHouseholdMonthlyHousingDetailMan, addHousingExpenseDetail, calcHouseholdMonthlyRentalOtherIncomeMan } from './housingCashFlow';
import { calcHouseholdMonthlyVehicleDetailMan } from './vehicleCashFlow';
import { calcHouseholdMonthlyOtherLoanDetailMan } from './loanCashFlow';
import {
  addInsuranceCashFlowDetail,
  addInsuranceIncomeDetail,
  calcHouseholdMonthlyInsuranceDetailMan,
  calcHouseholdMonthlyInsuranceIncomeDetailMan,
  createEmptyInsuranceCashFlowDetail,
} from './insuranceCashFlow';
import type { PensionByMember } from '../types/pension';
import type { HousingState } from '../types/housing';
import type { InsuranceState } from '../types/insurance';
import type { LoanState } from '../types/loan';
import type { SavingsState } from '../types/savings';
import type { TaxSocialState } from '../types/taxSocial';
import { calcHouseholdTaxYearResult } from './householdTaxYear';
import {
  hasSavingsEntries,
  projectSavingsForYear,
} from './savingsCashFlow';
import {
  calcHouseholdSelectiveDcManForYear,
  reclassifySalaryForSelectiveDc,
} from './dcContribution';
import {
  calcChildAllowancePaymentFromEntitlements,
  calcHouseholdMonthlyChildAllowanceEntitlementMan,
} from './childAllowance';
import {
  resolveLevyPaymentFactorForYear,
  resolveSimulationMonthStart,
} from './simulationTiming';
import { buildMemberCashFlowYearSlices } from './memberCashFlowYear';
import {
  HOUSEHOLD_LIVING_KEY,
  type LivingExpenseSchedule,
  type LivingExpenseState,
} from '../types/living';

export interface CashFlowInput {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  livingState: LivingExpenseState;
  housingState: HousingState;
  vehicleState?: VehicleState;
  loanState?: LoanState;
  insuranceState?: InsuranceState;
  savingsState?: SavingsState;
  educationByMember: EducationByMember;
  lifeEventState: LifeEventState;
  pensionByMember: PensionByMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
}

function addBreakdown(
  target: IncomeBreakdown,
  source: IncomeBreakdown,
): void {
  target.salary.socialInsurance += source.salary.socialInsurance;
  target.salary.civilMutual += source.salary.civilMutual;
  target.salary.nationalInsurance += source.salary.nationalInsurance;
  target.salary.selectiveDc += source.salary.selectiveDc;
  target.bonus.socialInsurance += source.bonus.socialInsurance;
  target.bonus.civilMutual += source.bonus.civilMutual;
  target.bonus.nationalInsurance += source.bonus.nationalInsurance;
  target.retirementAllowance += source.retirementAllowance;
  target.businessCf += source.businessCf;
  target.realEstateCf += source.realEstateCf;
  addPensionBreakdown(target.pension, source.pension);
  addInsuranceIncomeBreakdown(target.insurance, source.insurance);
  target.childAllowance += source.childAllowance ?? 0;
  target.transferCf += source.transferCf;
  target.taxFreeIncome += source.taxFreeIncome;
  target.otherIncome += source.otherIncome;
}

function getScheduleEnd(
  schedule: LivingExpenseSchedule,
  member: FamilyMember,
): { endAge: number; endMonth: number } {
  if (schedule.endMode === 'lifetime') {
    return { endAge: member.expectedLifespan, endMonth: 12 };
  }
  return { endAge: schedule.endAge, endMonth: schedule.endMonth };
}

function resolveLivingItemLabel(item: LivingExpenseItem): string {
  const trimmed = item.label.trim();
  return trimmed || '（無題）';
}

function calcLivingItemMonthlyEquivalentMan(item: LivingExpenseItem): number {
  if (item.cycleInterval <= 0) return 0;
  const months =
    item.cycleUnit === 'year' ? item.cycleInterval * 12 : item.cycleInterval;
  if (months <= 0) return 0;
  return item.amountMan / months;
}

function addLivingByLabel(
  target: Record<string, number>,
  source: Record<string, number>,
): void {
  for (const [label, amount] of Object.entries(source)) {
    target[label] = (target[label] ?? 0) + amount;
  }
}

export interface LivingItemMonthlyAmount {
  id: string;
  targetId: string;
  label: string;
  amount: number;
}

function calcLivingItemsForMonth(
  schedule: LivingExpenseSchedule,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  targetId: string,
): LivingItemMonthlyAmount[] {
  const items: LivingItemMonthlyAmount[] = [];
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return items;

  const { endAge, endMonth } = getScheduleEnd(schedule, member);
  if (
    !isAgeCalendarMonthInRange(
      ageMonth.age,
      ageMonth.month,
      schedule.startAge,
      schedule.startMonth,
      endAge,
      endMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
  ) {
    return items;
  }

  const yearsElapsed = yearsElapsedSince(
    birthYear,
    member.birthMonth,
    schedule.startAge,
    schedule.startMonth,
    calendarYear,
    calendarMonth,
  );

  if (schedule.inputMode === 'simple') {
    let itemFactor = 1;
    if (schedule.simpleIncreaseRate != null) {
      itemFactor = Math.pow(
        1 + schedule.simpleIncreaseRate / 100,
        yearsElapsed,
      );
    }
    const monthly = schedule.simpleMonthlyExpenseMan * itemFactor;
    if (monthly !== 0) {
      items.push({
        id: schedule.items[0]?.id ?? schedule.id,
        targetId,
        label: '生活費',
        amount: monthly,
      });
    }
    return items;
  }

  let itemFactor = 1;
  const firstItem = schedule.items[0];
  if (firstItem?.increaseRate != null) {
    itemFactor = Math.pow(1 + firstItem.increaseRate / 100, yearsElapsed);
  }

  const billableItems =
    schedule.inputMode === 'detail' &&
    schedule.items.length > 1 &&
    schedule.items[0]?.label.trim() === '生活費'
      ? schedule.items.slice(1)
      : schedule.items;
  for (const item of billableItems) {
    const monthly = calcLivingItemMonthlyEquivalentMan(item) * itemFactor;
    if (monthly === 0) continue;
    items.push({
      id: item.id,
      targetId,
      label: resolveLivingItemLabel(item),
      amount: monthly,
    });
  }
  return items;
}

function calcLivingDetailForMonth(
  schedule: LivingExpenseSchedule,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): Record<string, number> {
  const detail: Record<string, number> = {};
  for (const item of calcLivingItemsForMonth(
    schedule,
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
    '',
  )) {
    detail[item.label] = (detail[item.label] ?? 0) + item.amount;
  }
  return detail;
}

function collectExpenseLivingItems(
  livingState: LivingExpenseState,
): { key: string; label: string }[] {
  const seen = new Set<string>();
  const items: { key: string; label: string }[] = [];
  for (const schedules of Object.values(livingState.byTarget)) {
    for (const schedule of schedules) {
      if (schedule.inputMode === 'simple') {
        if (!seen.has('生活費')) {
          seen.add('生活費');
          items.push({ key: '生活費', label: '生活費' });
        }
        continue;
      }
      const billableItems =
        schedule.items.length > 1 &&
        schedule.items[0]?.label.trim() === '生活費'
          ? schedule.items.slice(1)
          : schedule.items;
      for (const item of billableItems) {
        const label = resolveLivingItemLabel(item);
        if (seen.has(label)) continue;
        seen.add(label);
        items.push({ key: label, label });
      }
    }
  }
  return items;
}

export function calcMonthlyLivingItemsMan(
  input: CashFlowInput,
  calendarYear: number,
  calendarMonth: number,
): LivingItemMonthlyAmount[] {
  const items: LivingItemMonthlyAmount[] = [];

  for (const [targetId, schedules] of Object.entries(
    input.livingState.byTarget,
  )) {
    const member =
      targetId === HOUSEHOLD_LIVING_KEY
        ? input.familyMembers.find((m) => m.role === 'head')
        : input.familyMembers.find((m) => m.id === targetId);

    if (!member) continue;

    for (const schedule of schedules) {
      items.push(
        ...calcLivingItemsForMonth(
          schedule,
          member,
          input.referenceDate,
          calendarYear,
          calendarMonth,
          targetId,
        ),
      );
    }
  }

  return items;
}

export function calcMonthlyLivingDetailMan(
  input: CashFlowInput,
  calendarYear: number,
  calendarMonth: number,
): Record<string, number> {
  const detail: Record<string, number> = {};

  for (const [targetId, schedules] of Object.entries(
    input.livingState.byTarget,
  )) {
    const member =
      targetId === HOUSEHOLD_LIVING_KEY
        ? input.familyMembers.find((m) => m.role === 'head')
        : input.familyMembers.find((m) => m.id === targetId);

    if (!member) continue;

    for (const schedule of schedules) {
      addLivingByLabel(
        detail,
        calcLivingDetailForMonth(
          schedule,
          member,
          input.referenceDate,
          calendarYear,
          calendarMonth,
        ),
      );
    }
  }

  return detail;
}

/** Q7の就労・給付等（公的年金・保険の受取は含まない） */
export { calcMonthlyIncomeBreakdown as calcMonthlyEarnedIncomeBreakdown } from './memberEarnedIncome';

function calcMonthlyIncomeBreakdownWithPension(
  input: CashFlowInput,
  calendarYear: number,
  calendarMonth: number,
  pensionPayment: IncomeBreakdown['pension'],
): IncomeBreakdown {
  const total = calcMonthlyIncomeBreakdown(input, calendarYear, calendarMonth);
  addBreakdown(total, {
    ...createEmptyIncomeBreakdown(),
    pension: pensionPayment,
  });
  return total;
}

function roundMan(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildCashFlowTable(input: CashFlowInput): CashFlowTableData {
  const head = input.familyMembers.find((m) => m.role === 'head');
  if (!head) {
    return createEmptyCashFlowTableData();
  }

  const birthYear = calcBirthYear(head.age, head.birthMonth, input.referenceDate);
  const startYear = input.referenceDate.getFullYear();
  const simulationMonthStart = resolveSimulationMonthStart(
    head,
    input.incomeByMember,
    input.referenceDate,
  );
  const endYear = calcYearAtAge(
    birthYear,
    resolveMemberBirthMonth(head),
    head.expectedLifespan,
    12,
  );

  const displayMembers = input.familyMembers.filter((m) => m.role !== 'pet');
  const expenseEducationMembers = displayMembers.map((member) => ({
    memberId: member.id,
    label: getMemberTabLabel(member),
  }));
  const expenseMemberIds = expenseEducationMembers.map((row) => row.memberId);
  const expenseLivingItems = collectExpenseLivingItems(input.livingState);
  const memberAgeRows = displayMembers.map((member) => {
    const agesByYear: Record<number, number | null> = {};
    for (let year = startYear; year <= endYear; year++) {
      const ageMonth = getMemberAgeMonth(
        member,
        input.referenceDate,
        year,
        12,
      );
      agesByYear[year] = ageMonth?.age ?? null;
    }
    return {
      memberId: member.id,
      label: getMemberTabLabel(member),
      agesByYear,
    };
  });

  const years: CashFlowYearRow[] = [];
  let financialAssets = 0;
  let savingsAccountBalances: Record<string, number> = {};
  let savingsInvestPrincipals: Record<string, number> = {};
  let savingsResidualCash = 0;
  let savingsInitialized = false;
  const useSavingsProjection = hasSavingsEntries(input.savingsState);
  let entitlementPreviousYearDecember =
    createEmptyPensionBreakdown();

  for (let year = startYear; year <= endYear; year++) {
    const incomeBreakdown = createEmptyIncomeBreakdown();
    const expenseBreakdown: ExpenseBreakdown =
      createEmptyExpenseBreakdown(expenseMemberIds);
    let annualMedicalCare = 0;
    const annualLivingByLabel: Record<string, number> = {};
    const annualOtherLoanDetail = createEmptyOtherLoanRepaymentDetail();
    const annualLifeEventDetail = createEmptyLifeEventExpenseDetail();
    const annualHousingDetail = createEmptyHousingExpenseDetail();
    const annualVehicleDetail = createEmptyVehicleExpenseDetail();
    const annualInsuranceDetail = createEmptyInsuranceCashFlowDetail();

    const monthStart = year === startYear ? simulationMonthStart : 1;
    const monthEnd = 12;

    const entitlementsByMonth: IncomeBreakdown['pension'][] = [];
    entitlementsByMonth[0] = entitlementPreviousYearDecember;
    const childAllowanceEntitlementsByMonth: number[] = [];
    childAllowanceEntitlementsByMonth[0] =
      calcHouseholdMonthlyChildAllowanceEntitlementMan(
        input.familyMembers,
        input.referenceDate,
        year - 1,
        12,
      );

    for (let month = 1; month <= 12; month++) {
      entitlementsByMonth[month] = calcMonthlyPensionEntitlementBreakdownMan(
        input.familyMembers,
        input.pensionByMember,
        input.incomeByMember,
        input.referenceDate,
        year,
        month,
      );
      childAllowanceEntitlementsByMonth[month] =
        calcHouseholdMonthlyChildAllowanceEntitlementMan(
          input.familyMembers,
          input.referenceDate,
          year,
          month,
        );
    }

    // ── メンバー別年間年金受給額（税計算用）────────────────────────────────
    // 課税標準は支払ベースではなく受給権ベース（毎月の受給額合計）で近似する。
    // 加給年金・振替加算などの世帯加算分は世帯主に帰属させる。
    const memberAnnualPensionMan: Record<string, number> = {};
    for (const member of input.familyMembers) {
      if (member.role === 'pet') continue;
      const memberState =
        input.pensionByMember[member.id] ?? createDefaultPensionMemberState();
      const incomeEntries = input.incomeByMember[member.id] ?? [];
      let memberPension = 0;
      for (let month = monthStart; month <= monthEnd; month++) {
        memberPension += sumPensionBreakdown(
          calcMemberMonthlyPensionBreakdownMan(
            member,
            memberState,
            incomeEntries,
            input.referenceDate,
            year,
            month,
          ),
        );
      }
      memberAnnualPensionMan[member.id] = memberPension;
    }
    // 世帯合計（加給年金・振替加算を含む）と個人合計の差を世帯主に帰属
    const householdPensionTotal = Array.from(
      { length: monthEnd - monthStart + 1 },
      (_, i) => monthStart + i,
    ).reduce(
      (sum, m) =>
        sum + sumPensionBreakdown(entitlementsByMonth[m] ?? createEmptyPensionBreakdown()),
      0,
    );
    const memberPensionTotal = Object.values(memberAnnualPensionMan).reduce(
      (sum, v) => sum + v,
      0,
    );
    const pensionAdditions = Math.max(0, householdPensionTotal - memberPensionTotal);
    if (pensionAdditions > 0) {
      memberAnnualPensionMan[head.id] =
        (memberAnnualPensionMan[head.id] ?? 0) + pensionAdditions;
    }

    for (let month = monthStart; month <= monthEnd; month++) {
      const pensionPayment = calcPensionPaymentFromEntitlements(
        month,
        entitlementsByMonth[month - 1] ?? createEmptyPensionBreakdown(),
        entitlementsByMonth[month - 2] ?? createEmptyPensionBreakdown(),
      );

      addBreakdown(
        incomeBreakdown,
        calcMonthlyIncomeBreakdownWithPension(
          input,
          year,
          month,
          pensionPayment,
        ),
      );
      addLivingByLabel(
        annualLivingByLabel,
        calcMonthlyLivingDetailMan(input, year, month),
      );

      const lifeEventBreakdown = calcHouseholdMonthlyLifeEventBreakdownMan(
        input.familyMembers,
        input.lifeEventState,
        input.referenceDate,
        year,
        month,
      );
      annualLifeEventDetail.travel += lifeEventBreakdown.detail.travel;
      annualLifeEventDetail.appliance += lifeEventBreakdown.detail.appliance;
      annualLifeEventDetail.celebration += lifeEventBreakdown.detail.celebration;
      annualLifeEventDetail.medical += lifeEventBreakdown.detail.medical;
      annualLifeEventDetail.nursing += lifeEventBreakdown.detail.nursing;
      annualLifeEventDetail.other += lifeEventBreakdown.detail.other;
      annualMedicalCare += lifeEventBreakdown.medicalCare;

      if (input.vehicleState) {
        addVehicleExpenseDetail(
          annualVehicleDetail,
          calcHouseholdMonthlyVehicleDetailMan(
            input.familyMembers,
            input.vehicleState,
            input.referenceDate,
            year,
            month,
            input.loanState,
          ),
        );
      }

      const monthlyHousingDetail = calcHouseholdMonthlyHousingDetailMan(
        input.familyMembers,
        input.housingState,
        input.referenceDate,
        year,
        month,
        input.loanState,
      );
      addHousingExpenseDetail(annualHousingDetail, monthlyHousingDetail);

      addOtherLoanRepaymentDetail(
        annualOtherLoanDetail,
        calcHouseholdMonthlyOtherLoanDetailMan(
          input.loanState,
          input.referenceDate,
          year,
          month,
        ),
      );

      if (input.insuranceState) {
        addInsuranceCashFlowDetail(
          annualInsuranceDetail,
          calcHouseholdMonthlyInsuranceDetailMan(
            input.familyMembers,
            input.insuranceState,
            input.housingState,
            input.vehicleState ?? { byMember: {} },
            input.referenceDate,
            year,
            month,
          ),
        );
        const monthlyInsuranceIncome =
          calcHouseholdMonthlyInsuranceIncomeDetailMan(
            input.familyMembers,
            input.insuranceState,
            input.referenceDate,
            year,
            month,
          );
        addInsuranceIncomeDetail(
          incomeBreakdown.insurance,
          monthlyInsuranceIncome,
        );
      }

      incomeBreakdown.otherIncome += calcHouseholdMonthlyRentalOtherIncomeMan(
        input.familyMembers,
        input.housingState,
        input.referenceDate,
        year,
        month,
      );

      incomeBreakdown.childAllowance += calcChildAllowancePaymentFromEntitlements(
        month,
        childAllowanceEntitlementsByMonth[month - 1] ?? 0,
        childAllowanceEntitlementsByMonth[month - 2] ?? 0,
      );

      for (const member of displayMembers) {
        const entries = input.educationByMember[member.id] ?? [];
        const monthlyYen = calcMemberMonthlyEducationYen(
          member,
          entries,
          input.referenceDate,
          year,
          month,
        );
        expenseBreakdown.educationByMember[member.id] += yenToMan(monthlyYen);
      }
    }

    const roundedLivingByLabel: Record<string, number> = {};
    for (const item of expenseLivingItems) {
      roundedLivingByLabel[item.key] = roundMan(
        annualLivingByLabel[item.key] ?? 0,
      );
    }
    for (const [label, amount] of Object.entries(annualLivingByLabel)) {
      if (label in roundedLivingByLabel) continue;
      roundedLivingByLabel[label] = roundMan(amount);
    }
    expenseBreakdown.livingByLabel = roundedLivingByLabel;
    expenseBreakdown.living = roundMan(
      Object.values(roundedLivingByLabel).reduce((sum, value) => sum + value, 0),
    );
    expenseBreakdown.housingDetail = {
      purchaseInitial: roundMan(annualHousingDetail.purchaseInitial),
      rentalInitialCost: roundMan(annualHousingDetail.rentalInitialCost),
      rentalMoveOutCost: roundMan(annualHousingDetail.rentalMoveOutCost),
      monthlyCost: roundMan(annualHousingDetail.monthlyCost),
      renewalCost: roundMan(annualHousingDetail.renewalCost),
      managementFee: roundMan(annualHousingDetail.managementFee),
      repairReserve: roundMan(annualHousingDetail.repairReserve),
      selfRepairCost: roundMan(annualHousingDetail.selfRepairCost),
      improvementCost: roundMan(annualHousingDetail.improvementCost),
      taxDetail: {
        realEstateAcquisition: roundMan(
          annualHousingDetail.taxDetail.realEstateAcquisition,
        ),
        fixedAsset: roundMan(annualHousingDetail.taxDetail.fixedAsset),
        cityPlanning: roundMan(annualHousingDetail.taxDetail.cityPlanning),
      },
      loanRepaymentDetail: {
        principal: roundMan(annualHousingDetail.loanRepaymentDetail.principal),
        interest: roundMan(annualHousingDetail.loanRepaymentDetail.interest),
        fees: roundMan(annualHousingDetail.loanRepaymentDetail.fees),
        groupCreditLife: roundMan(
          annualHousingDetail.loanRepaymentDetail.groupCreditLife,
        ),
      },
      rentalInsurancePremium: roundMan(
        annualHousingDetail.rentalInsurancePremium +
          annualInsuranceDetail.rentalInsurancePremium,
      ),
      ownedInsurancePremium: roundMan(
        annualHousingDetail.ownedInsurancePremium +
          annualInsuranceDetail.ownedInsurancePremium,
      ),
      simpleMonthlyCost: roundMan(annualHousingDetail.simpleMonthlyCost),
    };
    expenseBreakdown.housing = roundMan(
      sumHousingExpenseDetail(expenseBreakdown.housingDetail),
    );
    expenseBreakdown.vehicleDetail = {
      purchase: roundMan(annualVehicleDetail.purchase),
      maintenance: roundMan(annualVehicleDetail.maintenance),
      loanRepayment: roundMan(annualVehicleDetail.loanRepayment),
      insurance: roundMan(
        annualVehicleDetail.insurance + annualInsuranceDetail.vehicleInsurance,
      ),
    };
    expenseBreakdown.vehicle = roundMan(
      sumVehicleExpenseDetail(expenseBreakdown.vehicleDetail),
    );
    expenseBreakdown.lifeEventDetail = {
      travel: roundMan(annualLifeEventDetail.travel),
      appliance: roundMan(annualLifeEventDetail.appliance),
      celebration: roundMan(annualLifeEventDetail.celebration),
      medical: roundMan(annualLifeEventDetail.medical),
      nursing: roundMan(annualLifeEventDetail.nursing),
      other: roundMan(annualLifeEventDetail.other),
    };
    expenseBreakdown.lifeEvent = roundMan(
      sumLifeEventExpenseDetail(expenseBreakdown.lifeEventDetail),
    );
    // タイムライン等の互換用（支出合計には含めない。ライフイベントに内包）
    expenseBreakdown.medicalCare = roundMan(annualMedicalCare);
    expenseBreakdown.loanRepaymentDetail = {
      housing: roundMan(annualOtherLoanDetail.housing),
      vehicle: roundMan(annualOtherLoanDetail.vehicle),
      education: roundMan(annualOtherLoanDetail.education),
      free: roundMan(annualOtherLoanDetail.free),
    };
    expenseBreakdown.loanRepayment = roundMan(
      sumOtherLoanRepaymentDetail(expenseBreakdown.loanRepaymentDetail),
    );
    expenseBreakdown.insuranceOtherDetail = {
      nonlife_other: roundMan(
        annualInsuranceDetail.insuranceOtherDetail.nonlife_other,
      ),
      life: roundMan(annualInsuranceDetail.insuranceOtherDetail.life),
      medical: roundMan(annualInsuranceDetail.insuranceOtherDetail.medical),
      cancer: roundMan(annualInsuranceDetail.insuranceOtherDetail.cancer),
      education: roundMan(
        annualInsuranceDetail.insuranceOtherDetail.education,
      ),
      personal_pension: roundMan(
        annualInsuranceDetail.insuranceOtherDetail.personal_pension,
      ),
      life_other: roundMan(
        annualInsuranceDetail.insuranceOtherDetail.life_other,
      ),
    };
    expenseBreakdown.insuranceOther = roundMan(
      sumOtherInsurancePremiumDetail(expenseBreakdown.insuranceOtherDetail),
    );
    for (const memberId of expenseMemberIds) {
      expenseBreakdown.educationByMember[memberId] = roundMan(
        expenseBreakdown.educationByMember[memberId],
      );
    }

    entitlementPreviousYearDecember =
      entitlementsByMonth[12] ?? createEmptyPensionBreakdown();

    if (input.savingsState) {
      const selectiveDcMan = calcHouseholdSelectiveDcManForYear({
        savingsState: input.savingsState,
        familyMembers: input.familyMembers,
        referenceDate: input.referenceDate,
        calendarYear: year,
        monthStart,
        monthEnd,
      });
      if (selectiveDcMan > 0) {
        incomeBreakdown.salary = reclassifySalaryForSelectiveDc(
          incomeBreakdown.salary,
          selectiveDcMan,
        );
      }
    }

    const roundedBreakdown: IncomeBreakdown = {
      salary: {
        socialInsurance: roundMan(incomeBreakdown.salary.socialInsurance),
        civilMutual: roundMan(incomeBreakdown.salary.civilMutual),
        nationalInsurance: roundMan(incomeBreakdown.salary.nationalInsurance),
        selectiveDc: roundMan(incomeBreakdown.salary.selectiveDc),
      },
      bonus: {
        socialInsurance: roundMan(incomeBreakdown.bonus.socialInsurance),
        civilMutual: roundMan(incomeBreakdown.bonus.civilMutual),
        nationalInsurance: roundMan(incomeBreakdown.bonus.nationalInsurance),
      },
      retirementAllowance: roundMan(incomeBreakdown.retirementAllowance),
      businessCf: roundMan(incomeBreakdown.businessCf),
      realEstateCf: roundMan(incomeBreakdown.realEstateCf),
      pension: roundPensionBreakdown(incomeBreakdown.pension, roundMan),
      insurance: roundInsuranceIncomeBreakdown(
        incomeBreakdown.insurance,
        roundMan,
      ),
      childAllowance: roundMan(incomeBreakdown.childAllowance),
      transferCf: roundMan(incomeBreakdown.transferCf),
      taxFreeIncome: roundMan(incomeBreakdown.taxFreeIncome),
      otherIncome: roundMan(incomeBreakdown.otherIncome),
    };

    const annualIncome = roundMan(sumIncomeBreakdown(roundedBreakdown));
    const levyPaymentFactor = resolveLevyPaymentFactorForYear({
      calendarYear: year,
      startYear,
      head,
      incomeByMember: input.incomeByMember,
      referenceDate: input.referenceDate,
    });
    const taxYear = calcHouseholdTaxYearResult({
      familyMembers: input.familyMembers,
      incomeByMember: input.incomeByMember,
      priorYearIncomeByMember: input.priorYearIncomeByMember,
      referenceDate: input.referenceDate,
      calendarYear: year,
      monthStart,
      monthEnd,
      levyPaymentFactor,
      annualPensionManByMember: memberAnnualPensionMan,
      pensionByMember: input.pensionByMember,
      simulationStartYear: startYear,
      housingState: input.housingState,
      loanState: input.loanState,
      insuranceState: input.insuranceState,
      vehicleState: input.vehicleState,
      savingsState: input.savingsState,
    });
    const taxBreakdown = taxYear.household;
    const taxSocial = taxBreakdown.totalMan;
    const disposableIncome = roundMan(annualIncome - taxSocial);
    /** 生活・住居など消費支出（運用積立を含まない） */
    const consumptionExpenditure = roundMan(sumExpenseBreakdown(expenseBreakdown));
    /** 貯蓄投影の原資。家計負担の運用積立は投影内で差し引く */
    const preInvestSurplus = roundMan(disposableIncome - consumptionExpenditure);
    let savings = preInvestSurplus;
    let savingsBreakdown = createEmptySavingsBreakdown();
    let invest = 0;
    let investBreakdown = createEmptyInvestBreakdown();
    let investContribution = 0;
    let annualBalance = preInvestSurplus;
    let expenditure = consumptionExpenditure;
    if (useSavingsProjection && input.savingsState) {
      const projected = projectSavingsForYear({
        savingsState: input.savingsState,
        familyMembers: input.familyMembers,
        referenceDate: input.referenceDate,
        calendarYear: year,
        monthStart,
        monthEnd,
        accountBalances: savingsAccountBalances,
        investPrincipalByEntry: savingsInvestPrincipals,
        residualCash: savingsResidualCash,
        annualBalance: preInvestSurplus,
        initialize: !savingsInitialized,
      });
      savingsInitialized = true;
      savingsAccountBalances = projected.accountBalances;
      savingsInvestPrincipals = projected.investPrincipalByEntry;
      savingsResidualCash = projected.residualCash;
      savings = roundMan(projected.savingsMan);
      savingsBreakdown = roundSavingsBreakdown(
        projected.savingsBreakdown,
        roundMan,
      );
      invest = roundMan(projected.investMan);
      investBreakdown = roundInvestBreakdown(
        projected.investBreakdown,
        roundMan,
      );
      investContribution = roundMan(
        sumInvestPersonalContribution(investBreakdown),
      );
      expenditure = roundMan(consumptionExpenditure + investContribution);
      annualBalance = roundMan(preInvestSurplus - investContribution);
      financialAssets = roundMan(projected.financialAssets);
    } else {
      // 口座未登録時は年間収支の累積を普通預金残高（ストック）として計上
      financialAssets += preInvestSurplus;
      savings = roundMan(financialAssets);
      savingsBreakdown = {
        deposit: savings,
        timeDeposit: 0,
        savingsOther: 0,
      };
    }

    const taxSocialBreakdown = {
      incomeTax: roundMan(taxBreakdown.incomeTaxMan),
      residentTax: roundMan(taxBreakdown.residentTaxMan),
      giftTax: roundMan(taxBreakdown.giftTaxMan ?? 0),
      socialInsuranceDetail: {
        healthInsurance: roundMan(
          taxBreakdown.socialInsurance.healthInsurance +
            taxBreakdown.socialInsurance.longTermCare,
        ),
        employeesPension: roundMan(taxBreakdown.socialInsurance.employeesPension),
        employmentInsurance: roundMan(
          taxBreakdown.socialInsurance.employmentInsurance,
        ),
      },
      publicInsuranceDetail: {
        nationalPension: roundMan(taxBreakdown.publicInsurance.nationalPension),
        nationalHealthInsurance: roundMan(
          taxBreakdown.publicInsurance.nationalHealthInsurance,
        ),
        longTermCare: roundMan(taxBreakdown.publicInsurance.longTermCare),
        lateElderlyHealth: roundMan(
          taxBreakdown.publicInsurance.lateElderlyHealth,
        ),
      },
    };

    years.push({
      calendarYear: year,
      income: annualIncome,
      incomeBreakdown: roundedBreakdown,
      taxSocial: roundMan(taxSocial),
      taxSocialBreakdown,
      disposableIncome,
      expenditure,
      expenseBreakdown,
      annualBalance,
      savings,
      savingsBreakdown,
      invest,
      investBreakdown,
      investContribution,
      financialAssets: roundMan(financialAssets),
      simulationMonthStart: monthStart,
      simulationMonthEnd: monthEnd,
      levyPaymentFactor,
      memberTaxBreakdownByMemberId: taxYear.memberBreakdownByMemberId,
      memberYearByMemberId: buildMemberCashFlowYearSlices({
        familyMembers: input.familyMembers,
        incomeByMember: input.incomeByMember,
        pensionByMember: input.pensionByMember,
        insuranceState: input.insuranceState,
        savingsState: input.savingsState,
        referenceDate: input.referenceDate,
        calendarYear: year,
        monthStart,
        monthEnd,
        levyPaymentFactor,
        householdEntitlementsByMonth: entitlementsByMonth,
        memberTaxBreakdownByMemberId: taxYear.memberBreakdownByMemberId,
      }),
    });
  }

  return {
    startYear,
    endYear,
    simulationMonthStart,
    memberAgeRows,
    expenseEducationMembers,
    expenseLivingItems,
    years,
  };
}

export function createEmptyCashFlowTableData(): CashFlowTableData {
  return {
    startYear: 0,
    endYear: 0,
    simulationMonthStart: 1,
    memberAgeRows: [],
    expenseEducationMembers: [],
    expenseLivingItems: [],
    years: [],
  };
}

export function formatCashFlowValue(
  value: number,
  options?: { emptyAsDash?: boolean },
): string {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (amount === 0 && options?.emptyAsDash) return '-';
  if (amount === 0) return '0';
  return amount.toFixed(1);
}
