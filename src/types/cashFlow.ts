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

  | 'childAllowance'

  | 'retirementAllowance'

  | 'businessCf'

  | 'realEstateCf'

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

  { key: 'childAllowance', label: '児童手当' },

  { key: 'retirementAllowance', label: '退職金' },

  { key: 'businessCf', label: '事業CF' },

  { key: 'realEstateCf', label: '不動産CF' },

  { key: 'transferCf', label: '譲渡CF ※ビジ' },

  { key: 'taxFreeIncome', label: '非課税収入' },

  { key: 'otherIncome', label: '収入(その他)' },

];



/** 保険収入の内訳（万円） */
export interface InsuranceIncomeBreakdown {
  education: number;
  personalPension: number;
  returnValue: number;
}

export const INSURANCE_INCOME_DETAIL_ROWS: {
  key: keyof InsuranceIncomeBreakdown;
  label: string;
}[] = [
  { key: 'education', label: '学資保険' },
  { key: 'personalPension', label: '個人年金保険' },
  { key: 'returnValue', label: '返戻金' },
];

export function createEmptyInsuranceIncomeBreakdown(): InsuranceIncomeBreakdown {
  return {
    education: 0,
    personalPension: 0,
    returnValue: 0,
  };
}

export function addInsuranceIncomeBreakdown(
  target: InsuranceIncomeBreakdown,
  source: InsuranceIncomeBreakdown,
): void {
  target.education += source.education;
  target.personalPension += source.personalPension;
  target.returnValue += source.returnValue;
}

export function sumInsuranceIncomeBreakdown(
  breakdown: InsuranceIncomeBreakdown,
): number {
  return breakdown.education + breakdown.personalPension + breakdown.returnValue;
}

export function roundInsuranceIncomeBreakdown(
  breakdown: InsuranceIncomeBreakdown,
  round: (value: number) => number,
): InsuranceIncomeBreakdown {
  return {
    education: round(breakdown.education),
    personalPension: round(breakdown.personalPension),
    returnValue: round(breakdown.returnValue),
  };
}

/** CF表「貯蓄額」の内訳（Q11 貯蓄カテゴリ） */
export interface SavingsBreakdown {
  deposit: number;
  timeDeposit: number;
  savingsOther: number;
}

export const SAVINGS_DETAIL_ROWS: {
  key: keyof SavingsBreakdown;
  label: string;
}[] = [
  { key: 'deposit', label: '普通預金' },
  { key: 'timeDeposit', label: '定期預金' },
  { key: 'savingsOther', label: 'その他貯蓄' },
];

export function createEmptySavingsBreakdown(): SavingsBreakdown {
  return {
    deposit: 0,
    timeDeposit: 0,
    savingsOther: 0,
  };
}

export function sumSavingsBreakdown(breakdown: SavingsBreakdown): number {
  return breakdown.deposit + breakdown.timeDeposit + breakdown.savingsOther;
}

export function roundSavingsBreakdown(
  breakdown: SavingsBreakdown,
  round: (value: number) => number,
): SavingsBreakdown {
  return {
    deposit: round(breakdown.deposit),
    timeDeposit: round(breakdown.timeDeposit),
    savingsOther: round(breakdown.savingsOther),
  };
}

/** CF表「運用」カテゴリ内訳（年末残高＋当年フロー） */
export interface InvestCategoryDetail {
  /** 年末評価額（万円） */
  balance: number;
  /** 当年積立（万円）。事業主掛金を含む口座増加額 */
  contribution: number;
  /**
   * 家計負担の当年積立（万円）。
   * 企業型DCの事業主掛金は含まない（加入者掛金のみ）。
   */
  personalContribution: number;
  /** 当年運用益（万円）。年初残高×利回り（複利） */
  annualReturn: number;
  /** 当年取崩し（売却額・万円）。特定口座など */
  withdrawal: number;
  /** 当年の売却益税（万円）。特定口座など */
  capitalGainsTax: number;
}

/** CF表「運用」の内訳（Q11 運用カテゴリ） */
export interface InvestBreakdown {
  nisaTsumitate: InvestCategoryDetail;
  nisaGrowth: InvestCategoryDetail;
  taxable: InvestCategoryDetail;
  ideco: InvestCategoryDetail;
  dc: InvestCategoryDetail;
  db: InvestCategoryDetail;
  investOther: InvestCategoryDetail;
}

export const INVEST_DETAIL_ROWS: {
  key: keyof InvestBreakdown;
  label: string;
}[] = [
  { key: 'nisaTsumitate', label: 'NISA（つみたて）' },
  { key: 'nisaGrowth', label: 'NISA（成長）' },
  { key: 'taxable', label: '特定口座' },
  { key: 'ideco', label: 'iDeCo' },
  { key: 'dc', label: '企業型DC' },
  { key: 'db', label: 'DB（確定給付）' },
  { key: 'investOther', label: 'その他運用' },
];

/** カテゴリ展開時に出す当年フロー行（親行は年末残高） */
export const INVEST_CATEGORY_PART_ROWS = [
  { key: 'contribution', label: '当年積立' },
  { key: 'annualReturn', label: '当年運用益' },
  { key: 'withdrawal', label: '当年取崩し' },
  { key: 'capitalGainsTax', label: '売却益税' },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<
    InvestCategoryDetail,
    'contribution' | 'annualReturn' | 'withdrawal' | 'capitalGainsTax'
  >;
  label: string;
}>;

export function createEmptyInvestCategoryDetail(): InvestCategoryDetail {
  return {
    balance: 0,
    contribution: 0,
    personalContribution: 0,
    annualReturn: 0,
    withdrawal: 0,
    capitalGainsTax: 0,
  };
}

export function createEmptyInvestBreakdown(): InvestBreakdown {
  return {
    nisaTsumitate: createEmptyInvestCategoryDetail(),
    nisaGrowth: createEmptyInvestCategoryDetail(),
    taxable: createEmptyInvestCategoryDetail(),
    ideco: createEmptyInvestCategoryDetail(),
    dc: createEmptyInvestCategoryDetail(),
    db: createEmptyInvestCategoryDetail(),
    investOther: createEmptyInvestCategoryDetail(),
  };
}

/** カテゴリ親行＝年末残高 */
export function sumInvestCategoryDetail(detail: InvestCategoryDetail): number {
  return detail.balance;
}

export function sumInvestBreakdown(breakdown: InvestBreakdown): number {
  return INVEST_DETAIL_ROWS.reduce(
    (sum, row) => sum + sumInvestCategoryDetail(breakdown[row.key]),
    0,
  );
}

/** 家計負担の運用積立合計（事業主掛金を含まない） */
export function sumInvestPersonalContribution(breakdown: InvestBreakdown): number {
  return INVEST_DETAIL_ROWS.reduce((sum, row) => {
    const detail = breakdown[row.key];
    if (typeof detail.personalContribution === 'number') {
      return sum + detail.personalContribution;
    }
    // 旧スナップショット: personalContribution 未設定時は DC 以外の当年積立を用いる
    if (row.key === 'dc') return sum;
    return sum + detail.contribution;
  }, 0);
}

export function roundInvestCategoryDetail(
  detail: InvestCategoryDetail,
  round: (value: number) => number,
): InvestCategoryDetail {
  return {
    balance: round(detail.balance),
    contribution: round(detail.contribution),
    personalContribution: round(detail.personalContribution ?? 0),
    annualReturn: round(detail.annualReturn),
    withdrawal: round(detail.withdrawal),
    capitalGainsTax: round(detail.capitalGainsTax),
  };
}

export function roundInvestBreakdown(
  breakdown: InvestBreakdown,
  round: (value: number) => number,
): InvestBreakdown {
  return {
    nisaTsumitate: roundInvestCategoryDetail(breakdown.nisaTsumitate, round),
    nisaGrowth: roundInvestCategoryDetail(breakdown.nisaGrowth, round),
    taxable: roundInvestCategoryDetail(breakdown.taxable, round),
    ideco: roundInvestCategoryDetail(breakdown.ideco, round),
    dc: roundInvestCategoryDetail(breakdown.dc, round),
    db: roundInvestCategoryDetail(breakdown.db, round),
    investOther: roundInvestCategoryDetail(breakdown.investOther, round),
  };
}

export interface IncomeBreakdown {

  salary: SalaryBonusDetail;

  bonus: BonusDetail;

  retirementAllowance: number;

  businessCf: number;

  realEstateCf: number;

  pension: PensionBreakdown;

  insurance: InsuranceIncomeBreakdown;

  childAllowance: number;

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
  medical: number;
  nursing: number;
  other: number;
}

export function createEmptyLifeEventExpenseDetail(): LifeEventExpenseDetail {
  return {
    travel: 0,
    appliance: 0,
    celebration: 0,
    medical: 0,
    nursing: 0,
    other: 0,
  };
}

export function sumLifeEventExpenseDetail(detail: LifeEventExpenseDetail): number {
  return (
    detail.travel +
    detail.appliance +
    detail.celebration +
    detail.medical +
    detail.nursing +
    detail.other
  );
}

export const LIFE_EVENT_DETAIL_ROWS = [
  { key: 'travel', label: '旅行・レジャー' },
  { key: 'appliance', label: '家電・家具' },
  { key: 'celebration', label: '子・孫の祝い金' },
  { key: 'medical', label: '医療費' },
  { key: 'nursing', label: '介護費' },
  { key: 'other', label: 'その他' },
] as const satisfies ReadonlyArray<{
  key: keyof LifeEventExpenseDetail;
  label: string;
}>;

/** 乗り物支出の内訳（万円） */
export interface VehicleExpenseDetail {
  purchase: number;
  maintenance: number;
  loanRepayment: number;
  insurance: number;
}

export function createEmptyVehicleExpenseDetail(): VehicleExpenseDetail {
  return {
    purchase: 0,
    maintenance: 0,
    loanRepayment: 0,
    insurance: 0,
  };
}

export function sumVehicleExpenseDetail(detail: VehicleExpenseDetail): number {
  return (
    detail.purchase +
    detail.maintenance +
    detail.loanRepayment +
    detail.insurance
  );
}

export function addVehicleExpenseDetail(
  target: VehicleExpenseDetail,
  source: VehicleExpenseDetail,
): void {
  target.purchase += source.purchase;
  target.maintenance += source.maintenance;
  target.loanRepayment += source.loanRepayment;
  target.insurance += source.insurance;
}

export const VEHICLE_DETAIL_ROWS = [
  { key: 'purchase', label: '購入費' },
  { key: 'maintenance', label: '保守費' },
  { key: 'loanRepayment', label: 'ローン返済' },
  { key: 'insurance', label: '保険料' },
] as const satisfies ReadonlyArray<{
  key: keyof VehicleExpenseDetail;
  label: string;
}>;

/** 住まい支出の税金内訳（万円） */
export interface HousingTaxDetail {
  realEstateAcquisition: number;
  fixedAsset: number;
  cityPlanning: number;
}

/** 住まい支出のローン返済内訳（万円） */
export interface HousingLoanRepaymentDetail {
  principal: number;
  interest: number;
  fees: number;
  /** 団信（ローン付帯のため返済フォルダに含める） */
  groupCreditLife: number;
}

/** 住まい支出の内訳（万円） */
export interface HousingExpenseDetail {
  purchaseInitial: number;
  rentalInitialCost: number;
  rentalMoveOutCost: number;
  monthlyCost: number;
  renewalCost: number;
  managementFee: number;
  repairReserve: number;
  selfRepairCost: number;
  improvementCost: number;
  taxDetail: HousingTaxDetail;
  loanRepaymentDetail: HousingLoanRepaymentDetail;
  rentalInsurancePremium: number;
  ownedInsurancePremium: number;
  /** 所有物件（居住中・簡単入力）の月々の住居費 */
  simpleMonthlyCost: number;
}

export function createEmptyHousingTaxDetail(): HousingTaxDetail {
  return {
    realEstateAcquisition: 0,
    fixedAsset: 0,
    cityPlanning: 0,
  };
}

export function createEmptyHousingLoanRepaymentDetail(): HousingLoanRepaymentDetail {
  return {
    principal: 0,
    interest: 0,
    fees: 0,
    groupCreditLife: 0,
  };
}

export function createEmptyHousingExpenseDetail(): HousingExpenseDetail {
  return {
    purchaseInitial: 0,
    rentalInitialCost: 0,
    rentalMoveOutCost: 0,
    monthlyCost: 0,
    renewalCost: 0,
    managementFee: 0,
    repairReserve: 0,
    selfRepairCost: 0,
    improvementCost: 0,
    taxDetail: createEmptyHousingTaxDetail(),
    loanRepaymentDetail: createEmptyHousingLoanRepaymentDetail(),
    rentalInsurancePremium: 0,
    ownedInsurancePremium: 0,
    simpleMonthlyCost: 0,
  };
}

export function sumHousingTaxDetail(detail: HousingTaxDetail): number {
  return (
    detail.realEstateAcquisition + detail.fixedAsset + detail.cityPlanning
  );
}

export function sumHousingLoanRepaymentDetail(
  detail: HousingLoanRepaymentDetail,
): number {
  return (
    detail.principal + detail.interest + detail.fees + detail.groupCreditLife
  );
}

export function sumHousingRentalExpenseDetail(
  detail: HousingExpenseDetail,
): number {
  return (
    detail.rentalInitialCost +
    detail.rentalMoveOutCost +
    detail.monthlyCost +
    detail.renewalCost +
    detail.rentalInsurancePremium
  );
}

export function sumHousingOwnedExpenseDetail(
  detail: HousingExpenseDetail,
): number {
  return (
    detail.purchaseInitial +
    detail.managementFee +
    detail.repairReserve +
    detail.selfRepairCost +
    detail.improvementCost +
    sumHousingTaxDetail(detail.taxDetail) +
    sumHousingLoanRepaymentDetail(detail.loanRepaymentDetail) +
    detail.ownedInsurancePremium +
    detail.simpleMonthlyCost
  );
}

export function sumHousingExpenseDetail(detail: HousingExpenseDetail): number {
  return (
    sumHousingRentalExpenseDetail(detail) + sumHousingOwnedExpenseDetail(detail)
  );
}

export const HOUSING_RENTAL_DETAIL_ROWS = [
  { key: 'rentalInitialCost', label: '初期費用(賃貸)' },
  { key: 'rentalMoveOutCost', label: '退去・引越' },
  { key: 'monthlyCost', label: '月額費用' },
  { key: 'renewalCost', label: '更新費・自' },
  { key: 'rentalInsurancePremium', label: '保険料' },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<
    HousingExpenseDetail,
    | 'rentalInitialCost'
    | 'rentalMoveOutCost'
    | 'monthlyCost'
    | 'renewalCost'
    | 'rentalInsurancePremium'
  >;
  label: string;
}>;

export const HOUSING_OWNED_DIRECT_DETAIL_ROWS = [
  { key: 'purchaseInitial', label: '購入費・初' },
  { key: 'managementFee', label: '管理費' },
  { key: 'repairReserve', label: '修繕積立金' },
  { key: 'selfRepairCost', label: '自主修繕費' },
  { key: 'improvementCost', label: '改良費' },
  { key: 'simpleMonthlyCost', label: '月々の住居費' },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<
    HousingExpenseDetail,
    | 'purchaseInitial'
    | 'managementFee'
    | 'repairReserve'
    | 'selfRepairCost'
    | 'improvementCost'
    | 'simpleMonthlyCost'
  >;
  label: string;
}>;

export const HOUSING_TAX_DETAIL_ROWS = [
  { key: 'realEstateAcquisition', label: '不動産取得税' },
  { key: 'fixedAsset', label: '固定資産税' },
  { key: 'cityPlanning', label: '都市計画税' },
] as const satisfies ReadonlyArray<{
  key: keyof HousingTaxDetail;
  label: string;
}>;

export const HOUSING_LOAN_REPAYMENT_DETAIL_ROWS = [
  { key: 'principal', label: '元金' },
  { key: 'interest', label: '利息' },
  { key: 'fees', label: '手数料' },
  { key: 'groupCreditLife', label: '団信' },
] as const satisfies ReadonlyArray<{
  key: keyof HousingLoanRepaymentDetail;
  label: string;
}>;

export const HOUSING_OWNED_TAIL_DETAIL_ROWS = [
  { key: 'ownedInsurancePremium', label: '保険料' },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<HousingExpenseDetail, 'ownedInsurancePremium'>;
  label: string;
}>;

/** 支出のローン（住まい/乗り物未リンク）内訳（万円） */
export interface OtherLoanRepaymentDetail {
  housing: number;
  vehicle: number;
  education: number;
  free: number;
}

export function createEmptyOtherLoanRepaymentDetail(): OtherLoanRepaymentDetail {
  return {
    housing: 0,
    vehicle: 0,
    education: 0,
    free: 0,
  };
}

export function sumOtherLoanRepaymentDetail(
  detail: OtherLoanRepaymentDetail,
): number {
  return detail.housing + detail.vehicle + detail.education + detail.free;
}

export function addOtherLoanRepaymentDetail(
  target: OtherLoanRepaymentDetail,
  source: OtherLoanRepaymentDetail,
): void {
  target.housing += source.housing;
  target.vehicle += source.vehicle;
  target.education += source.education;
  target.free += source.free;
}

/** ローンフォルダの常時表示行（教育・フリー） */
export const OTHER_LOAN_PRIMARY_DETAIL_ROWS = [
  { key: 'education', label: '教育ローン' },
  { key: 'free', label: 'フリーローン' },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<OtherLoanRepaymentDetail, 'education' | 'free'>;
  label: string;
}>;

/**
 * 物件/車両未リンクの仮置き行。
 * 紐づけ済みは家・乗り物側のみ計上し、ここには出さない。
 */
export const OTHER_LOAN_UNLINKED_DETAIL_ROWS = [
  { key: 'housing', label: '住宅ローン（未紐づけ）' },
  { key: 'vehicle', label: '自動車ローン（未紐づけ）' },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<OtherLoanRepaymentDetail, 'housing' | 'vehicle'>;
  label: string;
}>;

/** 支出の保険料（家・車以外）内訳（万円） */
export interface OtherInsurancePremiumDetail {
  nonlife_other: number;
  life: number;
  medical: number;
  cancer: number;
  education: number;
  personal_pension: number;
  life_other: number;
}

export function createEmptyOtherInsurancePremiumDetail(): OtherInsurancePremiumDetail {
  return {
    nonlife_other: 0,
    life: 0,
    medical: 0,
    cancer: 0,
    education: 0,
    personal_pension: 0,
    life_other: 0,
  };
}

export function sumOtherInsurancePremiumDetail(
  detail: OtherInsurancePremiumDetail,
): number {
  return (
    detail.nonlife_other +
    detail.life +
    detail.medical +
    detail.cancer +
    detail.education +
    detail.personal_pension +
    detail.life_other
  );
}

export function addOtherInsurancePremiumDetail(
  target: OtherInsurancePremiumDetail,
  source: OtherInsurancePremiumDetail,
): void {
  target.nonlife_other += source.nonlife_other;
  target.life += source.life;
  target.medical += source.medical;
  target.cancer += source.cancer;
  target.education += source.education;
  target.personal_pension += source.personal_pension;
  target.life_other += source.life_other;
}

export const OTHER_INSURANCE_PREMIUM_DETAIL_ROWS = [
  { key: 'life', label: '死亡保険' },
  { key: 'medical', label: '医療保険' },
  { key: 'cancer', label: 'がん保険' },
  { key: 'education', label: '学資保険' },
  { key: 'personal_pension', label: '個人年金保険' },
  { key: 'nonlife_other', label: 'その他損害保険' },
  { key: 'life_other', label: 'その他生命保険' },
] as const satisfies ReadonlyArray<{
  key: keyof OtherInsurancePremiumDetail;
  label: string;
}>;

/** 支出キャッシュフロー表のカテゴリ内訳（万円） */
export interface ExpenseBreakdown {
  living: number;
  livingByLabel: Record<string, number>;
  housing: number;
  housingDetail: HousingExpenseDetail;
  vehicle: number;
  vehicleDetail: VehicleExpenseDetail;
  lifeEvent: number;
  lifeEventDetail: LifeEventExpenseDetail;
  medicalCare: number;
  educationByMember: Record<string, number>;
  loanRepayment: number;
  loanRepaymentDetail: OtherLoanRepaymentDetail;
  insuranceOther: number;
  insuranceOtherDetail: OtherInsurancePremiumDetail;
}

export interface ExpenseEducationMemberRow {
  memberId: string;
  label: string;
}

export interface ExpenseLivingItemRow {
  key: string;
  label: string;
}

export function createEmptyExpenseBreakdown(
  memberIds: string[],
): ExpenseBreakdown {
  const educationByMember: Record<string, number> = {};
  for (const memberId of memberIds) {
    educationByMember[memberId] = 0;
  }
  return {
    living: 0,
    livingByLabel: {},
    housing: 0,
    housingDetail: createEmptyHousingExpenseDetail(),
    vehicle: 0,
    vehicleDetail: createEmptyVehicleExpenseDetail(),
    lifeEvent: 0,
    lifeEventDetail: createEmptyLifeEventExpenseDetail(),
    medicalCare: 0,
    educationByMember,
    loanRepayment: 0,
    loanRepaymentDetail: createEmptyOtherLoanRepaymentDetail(),
    insuranceOther: 0,
    insuranceOtherDetail: createEmptyOtherInsurancePremiumDetail(),
  };
}

export function sumEducationExpense(breakdown: ExpenseBreakdown): number {
  return Object.values(breakdown.educationByMember).reduce(
    (sum, value) => sum + value,
    0,
  );
}

export function sumLivingExpense(breakdown: ExpenseBreakdown): number {
  return Object.values(breakdown.livingByLabel).reduce(
    (sum, value) => sum + value,
    0,
  );
}

/** 社会保険料の内訳（万円）。介護（第2号）は健康保険に含む */
export interface SocialInsuranceDetail {
  healthInsurance: number;
  employeesPension: number;
  employmentInsurance: number;
}

/** 公的保険料の内訳（万円） */
export interface PublicInsuranceDetail {
  nationalPension: number;
  nationalHealthInsurance: number;
  /** 第1号被保険者（65歳以上・国保加入者・後期高齢者など） */
  longTermCare: number;
  lateElderlyHealth: number;
}

/** 税・社保キャッシュフロー表の内訳（万円） */
export interface TaxSocialBreakdown {
  incomeTax: number;
  residentTax: number;
  giftTax: number;
  socialInsuranceDetail: SocialInsuranceDetail;
  publicInsuranceDetail: PublicInsuranceDetail;
}

export const TAX_DETAIL_ROWS = [
  { key: 'incomeTax', label: '所得税' },
  { key: 'residentTax', label: '住民税' },
  { key: 'giftTax', label: '贈与税' },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<TaxSocialBreakdown, 'incomeTax' | 'residentTax' | 'giftTax'>;
  label: string;
}>;

export const SOCIAL_INSURANCE_DETAIL_ROWS = [
  { key: 'healthInsurance', label: '健康保険' },
  { key: 'employeesPension', label: '厚生年金' },
  { key: 'employmentInsurance', label: '雇用保険' },
] as const satisfies ReadonlyArray<{
  key: keyof SocialInsuranceDetail;
  label: string;
}>;

export const PUBLIC_INSURANCE_DETAIL_ROWS = [
  { key: 'nationalPension', label: '国民年金' },
  { key: 'nationalHealthInsurance', label: '国民健康保険' },
  { key: 'longTermCare', label: '介護保険' },
  { key: 'lateElderlyHealth', label: '後期高齢者医療' },
] as const satisfies ReadonlyArray<{
  key: keyof PublicInsuranceDetail;
  label: string;
}>;

export function sumTaxAmount(breakdown: TaxSocialBreakdown): number {
  return breakdown.incomeTax + breakdown.residentTax + breakdown.giftTax;
}

export function sumSocialInsuranceDetail(
  detail: SocialInsuranceDetail,
): number {
  return (
    detail.healthInsurance +
    detail.employeesPension +
    detail.employmentInsurance
  );
}

export function sumPublicInsuranceDetail(detail: PublicInsuranceDetail): number {
  return (
    detail.nationalPension +
    detail.nationalHealthInsurance +
    detail.longTermCare +
    detail.lateElderlyHealth
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
    sumEducationExpense(breakdown) +
    breakdown.loanRepayment +
    breakdown.insuranceOther
  );
}

import type { MemberTaxBreakdownData } from '../lib/taxCalculator';

export interface CashFlowYearRow {

  calendarYear: number;

  income: number;

  incomeBreakdown: IncomeBreakdown;

  taxSocial: number;

  taxSocialBreakdown: TaxSocialBreakdown;

  disposableIncome: number;

  /**
   * 支出合計（万円）。消費支出＋家計負担の運用積立。
   * expenseBreakdown の合計は消費のみで、運用積立は investContribution。
   */
  expenditure: number;

  expenseBreakdown: ExpenseBreakdown;

  /**
   * 年間収支（万円）＝可処分所得 − 支出（運用積立込み）。
   * 貯蓄投影の原資は「運用積立控除前」＝ annualBalance + investContribution。
   */
  annualBalance: number;

  savings: number;

  /** Q11 貯蓄カテゴリの内訳（普通・定期・その他）。未登録時は 0 */
  savingsBreakdown: SavingsBreakdown;

  /** Q11 運用口座の年末残高合計（万円）。未登録時は 0 */
  invest: number;

  /** Q11 運用カテゴリの内訳（年末残高＋当年積立／当年運用益）。未登録時は 0 */
  investBreakdown: InvestBreakdown;

  /**
   * 家計負担の運用積立合計（万円）。企業型DCの事業主掛金は含めない。
   * CF表・生涯収支グラフの「運用積立」に対応。未登録時は 0
   */
  investContribution: number;

  /** 金融資産合計（貯蓄額＋運用残高、万円） */
  financialAssets: number;

  /** 税・社保算定に使った試算対象月（その他タブと共有） */
  simulationMonthStart: number;

  simulationMonthEnd: number;

  levyPaymentFactor: number;

  /** キャッシュフロー表と同じ計算のメンバー別内訳 */
  memberTaxBreakdownByMemberId: Record<string, MemberTaxBreakdownData>;

  /** 世帯主・配偶者フォルダ用の個人別収入・税社保 */
  memberYearByMemberId: Record<string, MemberCashFlowYearSlice>;

}

/** キャッシュフロー表の個人フォルダ（世帯主・配偶者）1年分 */
export interface MemberCashFlowYearSlice {
  income: number;
  incomeBreakdown: IncomeBreakdown;
  taxSocial: number;
  taxSocialBreakdown: TaxSocialBreakdown;
}



export interface CashFlowTableData {

  startYear: number;

  endYear: number;

  /** 試算初年度の開始月（1–12）。収入期間の開始月を反映 */
  simulationMonthStart: number;

  memberAgeRows: MemberAgeRow[];

  expenseEducationMembers: ExpenseEducationMemberRow[];

  expenseLivingItems: ExpenseLivingItemRow[];

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

    insurance: createEmptyInsuranceIncomeBreakdown(),

    childAllowance: 0,

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



/** 老齢厚生年金（一般厚生＋公務員・私学共済）の月額合計（万円） */
export function sumOldAgeEmployeesPension(detail: OldAgePensionBreakdown): number {

  return (

    sumGeneralEmployeesDetail(detail.generalEmployees) +

    sumPublicServantDetail(detail.publicServant)

  );

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

    sumInsuranceIncomeBreakdown(breakdown.insurance) +

    (breakdown.childAllowance ?? 0) +

    breakdown.transferCf +

    breakdown.taxFreeIncome +

    breakdown.otherIncome

  );

}


