/** 給与・賞与の社会保険区分内訳 */

export type SalaryBonusStreamKey =

  | 'socialInsurance'

  | 'civilMutual'

  | 'nationalInsurance'

  | 'selectiveDc';



export interface SalaryBonusDetail {

  socialInsurance: number;

  civilMutual: number;

  nationalInsurance: number;

  selectiveDc: number;

}



export type BonusDetail = Pick<

  SalaryBonusDetail,

  'socialInsurance' | 'civilMutual' | 'nationalInsurance'

>;



/** キャッシュフロー表の収入内訳（給与・賞与・年金以外はフラット） */

export type IncomeBreakdownKey =

  | 'retirementAllowance'

  | 'businessCf'

  | 'realEstateCf'

  | 'insurancePayout'

  | 'transferCf'

  | 'taxFreeIncome'

  | 'otherIncome';



export interface OldAgeBasicDetail {

  basic: number;

  additional: number;

  transfer: number;

  earlyPayment: number;

  fund: number;

}



export interface GeneralEmployeesDetail {

  basic: number;

  transitional: number;

  dependent: number;

  payment: number;

  earlyPayment: number;

}



export interface PublicServantDetail {

  basic: number;

  transitional: number;

  dependent: number;

  occupational: number;

  payment: number;

  earlyPayment: number;

}



export interface OldAgePensionBreakdown {

  basic: OldAgeBasicDetail;

  generalEmployees: GeneralEmployeesDetail;

  publicServant: PublicServantDetail;

}



export interface DisabilityBasicDetail {

  basic: number;

  children: number;

}



export interface DisabilityEmployeesDetail {

  basic: number;

  dependent: number;

  occupational: number;

}



export interface DisabilityPensionBreakdown {

  basic: DisabilityBasicDetail;

  employees: DisabilityEmployeesDetail;

}



export interface SurvivorBasicDetail {

  basic: number;

  children: number;

  widow: number;

}



export interface SurvivorEmployeesDetail {

  basic: number;

  occupational: number;

  middleAged: number;

  transitional: number;

  payment: number;

}



export interface SurvivorPensionBreakdown {

  basic: SurvivorBasicDetail;

  employees: SurvivorEmployeesDetail;

}



export interface PensionBreakdown {

  oldAge: OldAgePensionBreakdown;

  disability: DisabilityPensionBreakdown;

  survivor: SurvivorPensionBreakdown;

}



export const SALARY_DETAIL_ROWS: {

  key: SalaryBonusStreamKey;

  label: string;

}[] = [

  { key: 'socialInsurance', label: '厚生年金' },

  { key: 'civilMutual', label: '公務員厚' },

  { key: 'nationalInsurance', label: '国民年金' },

  { key: 'selectiveDc', label: '選択型DC拠' },

];



export const BONUS_DETAIL_ROWS: {

  key: keyof BonusDetail;

  label: string;

}[] = [

  { key: 'socialInsurance', label: '厚生年金' },

  { key: 'civilMutual', label: '公務員厚' },

  { key: 'nationalInsurance', label: '国民年金' },

];



export const OLD_AGE_BASIC_DETAIL_ROWS: {

  key: keyof OldAgeBasicDetail;

  label: string;

}[] = [

  { key: 'basic', label: '基本' },

  { key: 'additional', label: '付加' },

  { key: 'transfer', label: '振替' },

  { key: 'earlyPayment', label: '繰上' },

  { key: 'fund', label: '基金' },

];



export const GENERAL_EMPLOYEES_DETAIL_ROWS: {

  key: keyof GeneralEmployeesDetail;

  label: string;

}[] = [

  { key: 'basic', label: '基本' },

  { key: 'transitional', label: '経過' },

  { key: 'dependent', label: '加給' },

  { key: 'payment', label: '特支' },

  { key: 'earlyPayment', label: '繰上' },

];



export const PUBLIC_SERVANT_DETAIL_ROWS: {

  key: keyof PublicServantDetail;

  label: string;

}[] = [

  { key: 'basic', label: '基本' },

  { key: 'transitional', label: '経過' },

  { key: 'dependent', label: '加給' },

  { key: 'occupational', label: '職域' },

  { key: 'payment', label: '特支' },

  { key: 'earlyPayment', label: '繰上' },

];



export const OLD_AGE_PENSION_CATEGORY_ROWS: {

  key: keyof OldAgePensionBreakdown;

  label: string;

}[] = [

  { key: 'basic', label: '老齢基礎' },

  { key: 'generalEmployees', label: '一般厚生' },

  { key: 'publicServant', label: '公務員厚' },

];



export const DISABILITY_BASIC_DETAIL_ROWS: {

  key: keyof DisabilityBasicDetail;

  label: string;

}[] = [

  { key: 'basic', label: '基本' },

  { key: 'children', label: '子の' },

];



export const DISABILITY_EMPLOYEES_DETAIL_ROWS: {

  key: keyof DisabilityEmployeesDetail;

  label: string;

}[] = [

  { key: 'basic', label: '基本' },

  { key: 'dependent', label: '加給' },

  { key: 'occupational', label: '職域' },

];



export const DISABILITY_PENSION_CATEGORY_ROWS: {

  key: keyof DisabilityPensionBreakdown;

  label: string;

}[] = [

  { key: 'basic', label: '障害基礎' },

  { key: 'employees', label: '障害厚' },

];



export const SURVIVOR_BASIC_DETAIL_ROWS: {

  key: keyof SurvivorBasicDetail;

  label: string;

}[] = [

  { key: 'basic', label: '基本' },

  { key: 'children', label: '子の' },

  { key: 'widow', label: '寡婦' },

];



export const SURVIVOR_EMPLOYEES_DETAIL_ROWS: {

  key: keyof SurvivorEmployeesDetail;

  label: string;

}[] = [

  { key: 'basic', label: '基本' },

  { key: 'occupational', label: '職域' },

  { key: 'middleAged', label: '中高' },

  { key: 'transitional', label: '経過' },

  { key: 'payment', label: '特支' },

];



export const SURVIVOR_PENSION_CATEGORY_ROWS: {

  key: keyof SurvivorPensionBreakdown;

  label: string;

}[] = [

  { key: 'basic', label: '遺族基礎' },

  { key: 'employees', label: '遺族厚' },

];



export const INCOME_BREAKDOWN_ROWS: {

  key: IncomeBreakdownKey;

  label: string;

}[] = [

  { key: 'retirementAllowance', label: '退職金' },

  { key: 'businessCf', label: '事業CF' },

  { key: 'realEstateCf', label: '不動産CF' },

  { key: 'insurancePayout', label: '保険金' },

  { key: 'transferCf', label: '譲渡CF ※ビジ' },

  { key: 'taxFreeIncome', label: '非課税収入' },

  { key: 'otherIncome', label: '収入(その他)' },

];



export interface IncomeBreakdown {

  salary: SalaryBonusDetail;

  bonus: BonusDetail;

  retirementAllowance: number;

  businessCf: number;

  realEstateCf: number;

  pension: PensionBreakdown;

  insurancePayout: number;

  transferCf: number;

  taxFreeIncome: number;

  otherIncome: number;

}



export interface MemberAgeRow {

  memberId: string;

  label: string;

  agesByYear: Record<number, number | null>;

}

/** ライフイベント支出の内訳（万円） */
export interface LifeEventExpenseDetail {
  travel: number;
  appliance: number;
  celebration: number;
  other: number;
}

export function createEmptyLifeEventExpenseDetail(): LifeEventExpenseDetail {
  return {
    travel: 0,
    appliance: 0,
    celebration: 0,
    other: 0,
  };
}

export function sumLifeEventExpenseDetail(detail: LifeEventExpenseDetail): number {
  return detail.travel + detail.appliance + detail.celebration + detail.other;
}

/** 支出キャッシュフロー表のカテゴリ内訳（万円） */
export interface ExpenseBreakdown {
  living: number;
  housing: number;
  vehicle: number;
  lifeEvent: number;
  lifeEventDetail: LifeEventExpenseDetail;
  medicalCare: number;
  educationByMember: Record<string, number>;
  loanRepayment: number;
  insuranceOther: number;
  other: number;
}

export interface ExpenseEducationMemberRow {
  memberId: string;
  label: string;
}

export const EXPENSE_CATEGORY_ROWS = [
  { key: 'living', label: '生活費' },
  { key: 'housing', label: '家' },
  { key: 'vehicle', label: '乗り物' },
  { key: 'lifeEvent', label: 'ライフイベント' },
  { key: 'medicalCare', label: '医療・介護費' },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<ExpenseBreakdown, 'educationByMember'>;
  label: string;
}>;

export const EXPENSE_CATEGORY_ROWS_AFTER_EDUCATION = [
  { key: 'loanRepayment', label: 'ローン返済(その他)' },
  { key: 'insuranceOther', label: '保険料(その他)' },
  { key: 'other', label: '支出(その他)' },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<ExpenseBreakdown, 'educationByMember'>;
  label: string;
}>;

export function createEmptyExpenseBreakdown(
  memberIds: string[],
): ExpenseBreakdown {
  const educationByMember: Record<string, number> = {};
  for (const memberId of memberIds) {
    educationByMember[memberId] = 0;
  }
  return {
    living: 0,
    housing: 0,
    vehicle: 0,
    lifeEvent: 0,
    lifeEventDetail: createEmptyLifeEventExpenseDetail(),
    medicalCare: 0,
    educationByMember,
    loanRepayment: 0,
    insuranceOther: 0,
    other: 0,
  };
}

export function sumEducationExpense(breakdown: ExpenseBreakdown): number {
  return Object.values(breakdown.educationByMember).reduce(
    (sum, value) => sum + value,
    0,
  );
}

/** 社会保険料の内訳（万円） */
export interface SocialInsuranceDetail {
  healthInsurance: number;
  employeesPension: number;
  longTermCare: number;
  employmentInsurance: number;
}

/** 公的保険料の内訳（万円） */
export interface PublicInsuranceDetail {
  nationalPension: number;
  nationalHealthInsurance: number;
  lateElderlyHealth: number;
  lateElderlyLongTermCare: number;
}

/** 税・社保キャッシュフロー表の内訳（万円） */
export interface TaxSocialBreakdown {
  incomeTax: number;
  residentTax: number;
  socialInsuranceDetail: SocialInsuranceDetail;
  publicInsuranceDetail: PublicInsuranceDetail;
}

export const TAX_DETAIL_ROWS = [
  { key: 'incomeTax', label: '所得税' },
  { key: 'residentTax', label: '住民税' },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<TaxSocialBreakdown, 'incomeTax' | 'residentTax'>;
  label: string;
}>;

export const SOCIAL_INSURANCE_DETAIL_ROWS = [
  { key: 'healthInsurance', label: '健康保険' },
  { key: 'employeesPension', label: '厚生年金' },
  { key: 'longTermCare', label: '介護保険' },
  { key: 'employmentInsurance', label: '雇用保険' },
] as const satisfies ReadonlyArray<{
  key: keyof SocialInsuranceDetail;
  label: string;
}>;

export const PUBLIC_INSURANCE_DETAIL_ROWS = [
  { key: 'nationalPension', label: '国民年金' },
  { key: 'nationalHealthInsurance', label: '国民健康保険' },
  { key: 'lateElderlyHealth', label: '後期高齢者医療' },
  { key: 'lateElderlyLongTermCare', label: '後期高齢者介護' },
] as const satisfies ReadonlyArray<{
  key: keyof PublicInsuranceDetail;
  label: string;
}>;

export function sumTaxAmount(breakdown: TaxSocialBreakdown): number {
  return breakdown.incomeTax + breakdown.residentTax;
}

export function sumSocialInsuranceDetail(
  detail: SocialInsuranceDetail,
): number {
  return (
    detail.healthInsurance +
    detail.employeesPension +
    detail.longTermCare +
    detail.employmentInsurance
  );
}

export function sumPublicInsuranceDetail(detail: PublicInsuranceDetail): number {
  return (
    detail.nationalPension +
    detail.nationalHealthInsurance +
    detail.lateElderlyHealth +
    detail.lateElderlyLongTermCare
  );
}

export function sumTaxSocialBreakdown(breakdown: TaxSocialBreakdown): number {
  return (
    sumTaxAmount(breakdown) +
    sumSocialInsuranceDetail(breakdown.socialInsuranceDetail) +
    sumPublicInsuranceDetail(breakdown.publicInsuranceDetail)
  );
}

export function sumExpenseBreakdown(breakdown: ExpenseBreakdown): number {
  return (
    breakdown.living +
    breakdown.housing +
    breakdown.vehicle +
    breakdown.lifeEvent +
    breakdown.medicalCare +
    sumEducationExpense(breakdown) +
    breakdown.loanRepayment +
    breakdown.insuranceOther +
    breakdown.other
  );
}

export interface CashFlowYearRow {

  calendarYear: number;

  income: number;

  incomeBreakdown: IncomeBreakdown;

  taxSocial: number;

  taxSocialBreakdown: TaxSocialBreakdown;

  disposableIncome: number;

  expenditure: number;

  expenseBreakdown: ExpenseBreakdown;

  annualBalance: number;

  savings: number;

  financialAssets: number;

}



export interface CashFlowTableData {

  startYear: number;

  endYear: number;

  memberAgeRows: MemberAgeRow[];

  expenseEducationMembers: ExpenseEducationMemberRow[];

  years: CashFlowYearRow[];

}



function sumNumericRecord(detail: object): number {
  return (Object.values(detail) as number[]).reduce((sum, value) => sum + value, 0);
}

function addNumericRecord<T extends object>(target: T, source: T): void {
  for (const key of Object.keys(target) as (keyof T)[]) {
    (target as Record<keyof T, number>)[key] +=
      (source as Record<keyof T, number>)[key];
  }
}

function roundNumericRecord<T extends object>(
  detail: T,
  round: (value: number) => number,
): T {
  const result = { ...detail } as T;
  for (const key of Object.keys(result) as (keyof T)[]) {
    (result as Record<keyof T, number>)[key] = round(
      (detail as Record<keyof T, number>)[key],
    );
  }
  return result;
}



export function createEmptyOldAgeBasicDetail(): OldAgeBasicDetail {

  return { basic: 0, additional: 0, transfer: 0, earlyPayment: 0, fund: 0 };

}



export function createEmptyGeneralEmployeesDetail(): GeneralEmployeesDetail {

  return {

    basic: 0,

    transitional: 0,

    dependent: 0,

    payment: 0,

    earlyPayment: 0,

  };

}



export function createEmptyPublicServantDetail(): PublicServantDetail {

  return {

    basic: 0,

    transitional: 0,

    dependent: 0,

    occupational: 0,

    payment: 0,

    earlyPayment: 0,

  };

}



export function createEmptyOldAgePensionBreakdown(): OldAgePensionBreakdown {

  return {

    basic: createEmptyOldAgeBasicDetail(),

    generalEmployees: createEmptyGeneralEmployeesDetail(),

    publicServant: createEmptyPublicServantDetail(),

  };

}



export function createEmptyDisabilityBasicDetail(): DisabilityBasicDetail {

  return { basic: 0, children: 0 };

}



export function createEmptyDisabilityEmployeesDetail(): DisabilityEmployeesDetail {

  return { basic: 0, dependent: 0, occupational: 0 };

}



export function createEmptyDisabilityPensionBreakdown(): DisabilityPensionBreakdown {

  return {

    basic: createEmptyDisabilityBasicDetail(),

    employees: createEmptyDisabilityEmployeesDetail(),

  };

}



export function createEmptySurvivorBasicDetail(): SurvivorBasicDetail {

  return { basic: 0, children: 0, widow: 0 };

}



export function createEmptySurvivorEmployeesDetail(): SurvivorEmployeesDetail {

  return {

    basic: 0,

    occupational: 0,

    middleAged: 0,

    transitional: 0,

    payment: 0,

  };

}



export function createEmptySurvivorPensionBreakdown(): SurvivorPensionBreakdown {

  return {

    basic: createEmptySurvivorBasicDetail(),

    employees: createEmptySurvivorEmployeesDetail(),

  };

}



export function createEmptyPensionBreakdown(): PensionBreakdown {

  return {

    oldAge: createEmptyOldAgePensionBreakdown(),

    disability: createEmptyDisabilityPensionBreakdown(),

    survivor: createEmptySurvivorPensionBreakdown(),

  };

}



export function createEmptySalaryBonusDetail(): SalaryBonusDetail {

  return {

    socialInsurance: 0,

    civilMutual: 0,

    nationalInsurance: 0,

    selectiveDc: 0,

  };

}



export function createEmptyBonusDetail(): BonusDetail {

  return {

    socialInsurance: 0,

    civilMutual: 0,

    nationalInsurance: 0,

  };

}



export function createEmptyIncomeBreakdown(): IncomeBreakdown {

  return {

    salary: createEmptySalaryBonusDetail(),

    bonus: createEmptyBonusDetail(),

    retirementAllowance: 0,

    businessCf: 0,

    realEstateCf: 0,

    pension: createEmptyPensionBreakdown(),

    insurancePayout: 0,

    transferCf: 0,

    taxFreeIncome: 0,

    otherIncome: 0,

  };

}



export function addOldAgePensionBreakdown(

  target: OldAgePensionBreakdown,

  source: OldAgePensionBreakdown,

): void {

  addNumericRecord(target.basic, source.basic);

  addNumericRecord(target.generalEmployees, source.generalEmployees);

  addNumericRecord(target.publicServant, source.publicServant);

}



export function addDisabilityPensionBreakdown(

  target: DisabilityPensionBreakdown,

  source: DisabilityPensionBreakdown,

): void {

  addNumericRecord(target.basic, source.basic);

  addNumericRecord(target.employees, source.employees);

}



export function addSurvivorPensionBreakdown(

  target: SurvivorPensionBreakdown,

  source: SurvivorPensionBreakdown,

): void {

  addNumericRecord(target.basic, source.basic);

  addNumericRecord(target.employees, source.employees);

}



export function addPensionBreakdown(

  target: PensionBreakdown,

  source: PensionBreakdown,

): void {

  addOldAgePensionBreakdown(target.oldAge, source.oldAge);

  addDisabilityPensionBreakdown(target.disability, source.disability);

  addSurvivorPensionBreakdown(target.survivor, source.survivor);

}



export function sumOldAgeBasicDetail(detail: OldAgeBasicDetail): number {

  return sumNumericRecord(detail);

}



export function sumGeneralEmployeesDetail(detail: GeneralEmployeesDetail): number {

  return sumNumericRecord(detail);

}



export function sumPublicServantDetail(detail: PublicServantDetail): number {

  return sumNumericRecord(detail);

}



export function sumOldAgePension(detail: OldAgePensionBreakdown): number {

  return (

    sumOldAgeBasicDetail(detail.basic) +

    sumGeneralEmployeesDetail(detail.generalEmployees) +

    sumPublicServantDetail(detail.publicServant)

  );

}



export function sumDisabilityBasicDetail(detail: DisabilityBasicDetail): number {

  return sumNumericRecord(detail);

}



export function sumDisabilityEmployeesDetail(

  detail: DisabilityEmployeesDetail,

): number {

  return sumNumericRecord(detail);

}



export function sumDisabilityPension(detail: DisabilityPensionBreakdown): number {

  return (

    sumDisabilityBasicDetail(detail.basic) +

    sumDisabilityEmployeesDetail(detail.employees)

  );

}



export function sumSurvivorBasicDetail(detail: SurvivorBasicDetail): number {

  return sumNumericRecord(detail);

}



export function sumSurvivorEmployeesDetail(

  detail: SurvivorEmployeesDetail,

): number {

  return sumNumericRecord(detail);

}



export function sumSurvivorPension(detail: SurvivorPensionBreakdown): number {

  return (

    sumSurvivorBasicDetail(detail.basic) +

    sumSurvivorEmployeesDetail(detail.employees)

  );

}



export function sumPensionBreakdown(breakdown: PensionBreakdown): number {

  return (

    sumOldAgePension(breakdown.oldAge) +

    sumDisabilityPension(breakdown.disability) +

    sumSurvivorPension(breakdown.survivor)

  );

}



export function roundPensionBreakdown(

  breakdown: PensionBreakdown,

  round: (value: number) => number,

): PensionBreakdown {

  return {

    oldAge: {

      basic: roundNumericRecord(breakdown.oldAge.basic, round),

      generalEmployees: roundNumericRecord(

        breakdown.oldAge.generalEmployees,

        round,

      ),

      publicServant: roundNumericRecord(breakdown.oldAge.publicServant, round),

    },

    disability: {

      basic: roundNumericRecord(breakdown.disability.basic, round),

      employees: roundNumericRecord(breakdown.disability.employees, round),

    },

    survivor: {

      basic: roundNumericRecord(breakdown.survivor.basic, round),

      employees: roundNumericRecord(breakdown.survivor.employees, round),

    },

  };

}



export function sumSalaryDetail(detail: SalaryBonusDetail): number {

  return (

    detail.socialInsurance +

    detail.civilMutual +

    detail.nationalInsurance +

    detail.selectiveDc

  );

}



export function sumBonusDetail(detail: BonusDetail): number {

  return (

    detail.socialInsurance + detail.civilMutual + detail.nationalInsurance

  );

}



export function sumIncomeBreakdown(breakdown: IncomeBreakdown): number {

  return (

    sumSalaryDetail(breakdown.salary) +

    sumBonusDetail(breakdown.bonus) +

    breakdown.retirementAllowance +

    breakdown.businessCf +

    breakdown.realEstateCf +

    sumPensionBreakdown(breakdown.pension) +

    breakdown.insurancePayout +

    breakdown.transferCf +

    breakdown.taxFreeIncome +

    breakdown.otherIncome

  );

}


