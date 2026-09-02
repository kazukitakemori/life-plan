import type {

  NisaUtilization,

  NisaValuationMode,

  SavingsCategory,

  SavingsContributionMode,

  SavingsSector,

  SavingsWithdrawalMode,

} from '../types/savings';



export const SAVINGS_SECTOR_LABELS: Record<SavingsSector, string> = {

  deposit: '貯蓄',

  invest: '運用',

};



export const SAVINGS_SECTOR_DESCRIPTIONS: Record<SavingsSector, string> = {

  deposit: '普通預金・定期預金など、元本重視の口座',

  invest: 'NISA・iDeCo・課税口座など、運用を想定する口座',

};



export const SAVINGS_CATEGORY_SECTOR: Record<SavingsCategory, SavingsSector> = {

  deposit: 'deposit',

  time_deposit: 'deposit',

  savings_other: 'deposit',

  nisa_tsumitate: 'invest',

  nisa_growth: 'invest',

  taxable: 'invest',

  ideco: 'invest',

  dc: 'invest',

  db: 'invest',

  invest_other: 'invest',

};



export const SAVINGS_CATEGORY_LABELS: Record<SavingsCategory, string> = {

  deposit: '普通預金',

  time_deposit: '定期預金',

  savings_other: 'その他貯蓄',

  nisa_tsumitate: 'NISA（つみたて）',

  nisa_growth: 'NISA（成長）',

  taxable: '特定口座',

  ideco: 'iDeCo',

  dc: '企業型DC',

  db: 'DB（確定給付）',

  invest_other: 'その他運用',

};



export const SAVINGS_CATEGORY_DEFAULT_NAMES: Record<SavingsCategory, string> = {

  deposit: '普通預金',

  time_deposit: '定期預金',

  savings_other: '貯蓄',

  nisa_tsumitate: 'NISA（つみたて）',

  nisa_growth: 'NISA（成長）',

  taxable: '特定口座',

  ideco: 'iDeCo',

  dc: '企業型DC',

  db: 'DB（確定給付）',

  invest_other: '運用口座',

};



export const SAVINGS_CATEGORY_ICONS: Record<SavingsCategory, string> = {

  deposit: '🏦',

  time_deposit: '📅',

  savings_other: '💰',

  nisa_tsumitate: '📈',

  nisa_growth: '📊',

  taxable: '📊',

  ideco: '🧓',

  dc: '🏢',

  db: '🏛️',

  invest_other: '💹',

};



export const SAVINGS_CATEGORY_DESCRIPTIONS: Record<SavingsCategory, string> = {

  deposit: '日常の預貯金',

  time_deposit: '満期まで据え置く預金。満期利息に約20%課税',

  savings_other: '財形・その他の貯蓄',

  nisa_tsumitate: '年間120万円までのつみたて投資枠',

  nisa_growth: '年間240万円までの成長投資枠',

  taxable: '課税口座の投資信託など',

  ideco: '個人型確定拠出年金',

  dc: '企業型確定拠出年金',

  db: '確定給付企業年金などの見込み給付',

  invest_other: '株式・債券など',

};



/** 追加カード：貯蓄グループ */

export const SAVINGS_DEPOSIT_ADD_CATEGORIES: SavingsCategory[] = [

  'deposit',

  'time_deposit',

  'savings_other',

];



/** 追加カード：運用グループ */

export const SAVINGS_INVEST_ADD_CATEGORIES: SavingsCategory[] = [

  'nisa_tsumitate',

  'nisa_growth',

  'taxable',

  'ideco',

  'dc',

  'db',

  'invest_other',

];



export const SAVINGS_CONTRIBUTION_MODE_LABELS: Record<

  SavingsContributionMode,

  string

> = {

  monthly: '月額',

  annual: '年額',

  none: '積立なし',

};



export const SAVINGS_CONTRIBUTION_MODE_UNITS: Record<

  Exclude<SavingsContributionMode, 'none'>,

  string

> = {

  monthly: '万円/月',

  annual: '万円/年',

};



export const SAVINGS_CONTRIBUTION_MODES: SavingsContributionMode[] = [

  'monthly',

  'annual',

  'none',

];



export const SAVINGS_WITHDRAWAL_MODE_LABELS: Record<
  'none' | 'once' | 'drawdown',
  string
> = {
  none: '取崩しなし',
  once: '一括',
  drawdown: '分割（期間指定）',
};

/** UI で選べる取崩し方法（legacy monthly/annual は出さない） */
export const SAVINGS_WITHDRAWAL_MODES: Array<
  'none' | 'once' | 'drawdown'
> = ['none', 'once', 'drawdown'];

/** 分割取崩しの既定年数 */
export const SAVINGS_DEFAULT_WITHDRAWAL_YEARS = 20;



export const NISA_UTILIZATION_LABELS: Record<NisaUtilization, string> = {

  active: '既に活用している',

  new: 'これから始める',

};



export const NISA_VALUATION_MODE_LABELS: Record<NisaValuationMode, string> = {

  gains: '運用益を入力',

  rate: '現在の利回りを入力',

};



/** カテゴリ別の既定利回り（年率 %） */

export const SAVINGS_CATEGORY_DEFAULT_RETURN_PCT: Record<

  SavingsCategory,

  number

> = {

  deposit: 0,

  time_deposit: 0.2,

  savings_other: 0,

  nisa_tsumitate: 4,

  nisa_growth: 4,

  taxable: 3,

  ideco: 3,

  dc: 3,

  db: 0,

  invest_other: 3,

};



/** 積立終了の基準年齢（歳未満ならこの年齢まで） */
export const SAVINGS_DEFAULT_CONTRIBUTION_END_AGE = 65;

/**
 * 積立期間の既定終了年齢。
 * 65歳未満 → 65歳、65歳以上 → 現在年齢+10年（余命で上限）。
 */
export function resolveDefaultSavingsContributionEndAge(member: {
  age: number;
  expectedLifespan: number;
}): number {
  const raw =
    member.age >= SAVINGS_DEFAULT_CONTRIBUTION_END_AGE
      ? member.age + 10
      : SAVINGS_DEFAULT_CONTRIBUTION_END_AGE;
  return Math.min(Math.max(raw, member.age), member.expectedLifespan);
}



export function isInvestSavingsCategory(category: SavingsCategory): boolean {

  return SAVINGS_CATEGORY_SECTOR[category] === 'invest';

}



/** 預金は「利息」、運用は「想定利回り」 */

export function getSavingsRateFieldLabel(category: SavingsCategory): string {

  return isInvestSavingsCategory(category) ? '想定利回り' : '利息';

}



export function resolveSavingsContributionMode(

  mode: SavingsContributionMode | undefined,

): SavingsContributionMode {

  if (mode === 'monthly' || mode === 'annual' || mode === 'none') {

    return mode;

  }

  return 'none';

}



export function resolveSavingsWithdrawalMode(
  mode: SavingsWithdrawalMode | undefined,
): 'none' | 'once' | 'drawdown' {
  if (mode === 'once' || mode === 'none' || mode === 'drawdown') {
    return mode;
  }
  // legacy
  if (mode === 'monthly' || mode === 'annual') {
    return 'drawdown';
  }
  return 'none';
}



export function isTaxableSavingsCategory(category: SavingsCategory): boolean {

  return category === 'taxable';

}



/** NISA・特定口座・iDeCo・企業型DC・DB は取崩し／受取スケジュールを持てる */
export function supportsSavingsWithdrawal(category: SavingsCategory): boolean {
  return (
    category === 'taxable' ||
    category === 'nisa_tsumitate' ||
    category === 'nisa_growth' ||
    category === 'ideco' ||
    category === 'dc' ||
    category === 'db'
  );
}

/** iDeCo / 企業型DC / DB の年金・一括受取 UI */
export function isPensionStylePayoutCategory(
  category: SavingsCategory,
): boolean {
  return category === 'ideco' || category === 'dc' || category === 'db';
}

/**
 * 事業主掛金など、世帯の残現金を減らさない積立カテゴリの既定判定。
 * 企業型DCは事業主／加入者を分けて扱うため、積立ループではカテゴリ全体では使わない。
 */
export function isEmployerFundedSavingsContribution(
  category: SavingsCategory,
): boolean {
  return category === 'dc';
}


export function formatReturnRateLabel(ratePct: number): string {

  const rounded = Math.round(ratePct * 1000) / 1000;

  if (Number.isInteger(rounded)) {

    return `${rounded}%`;

  }

  return `${rounded}%`;

}


