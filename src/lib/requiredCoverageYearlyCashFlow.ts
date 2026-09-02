import type { CashFlowInput } from './cashFlow';
import type { CashFlowYearRow } from '../types/cashFlow';
import { SAVINGS_CATEGORY_SECTOR } from './savingsLabels';
import { getAllSavingsEntries } from './savingsDefaults';
import { getSavingsOpeningBalanceMan } from './nisaQuota';

export type CoveragePreparedBalanceMode = 'deposit' | 'financialAssets';

export interface CoverageOpeningBalancesMan {
  /** 普通・定期・その他貯蓄の開始残高（万円） */
  deposit: number;
  /** 貯蓄＋運用（iDeCo・企業年金を含む）の開始残高（万円） */
  financialAssets: number;
}

function roundMan(value: number): number {
  return Math.round(value);
}

/** 1年分の収支入力（既存の費目別ロジックを年次集計したもの） */
export interface CoverageYearlyFlowInput {
  calendarYear: number;
  living: number;
  housing: number;
  /** その年始時点の住宅ローン残元金（ストック。年次収支の支出には含めない） */
  housingPrincipal: number;
  vehicle: number;
  education: number;
  lifeEvent: number;
  loan: number;
  insurance: number;
  /** 税・社会保険料 */
  taxSocial?: number;
  earned: number;
  survivorBasic: number;
  childAllowance: number;
  /** 額面収入合計 */
  income: number;
}

/** 万一後の年次キャッシュフロー（グラフ用） */
export interface RequiredCoverageYearlyCashFlow {
  calendarYear: number;
  living: number;
  housing: number;
  housingPrincipal: number;
  vehicle: number;
  education: number;
  lifeEvent: number;
  loan: number;
  insurance: number;
  taxSocial: number;
  /** 支出合計（年間のキャッシュアウト。住宅ローン残元金の一括は含まない。税・社保を含む） */
  expense: number;
  earned: number;
  survivorBasic: number;
  childAllowance: number;
  /** 額面収入合計 */
  income: number;
  /** 年間収支 ＝ 額面収入 − 支出（税・社保込み） */
  net: number;
  /** その年末の貯蓄残高 */
  savingsBalance: number;
}

export function calcCoverageOpeningBalancesMan(
  input: Pick<CashFlowInput, 'savingsState'>,
): CoverageOpeningBalancesMan {
  const entries = getAllSavingsEntries(input.savingsState ?? { byMember: {} });
  let deposit = 0;
  let financialAssets = 0;
  for (const entry of entries) {
    const opening = getSavingsOpeningBalanceMan(entry);
    financialAssets += opening;
    if (SAVINGS_CATEGORY_SECTOR[entry.category] === 'deposit') {
      deposit += opening;
    }
  }
  return {
    deposit: roundMan(deposit),
    financialAssets: roundMan(financialAssets),
  };
}

/** 試算開始時点の現預金。万一後の年次CFの初期残高に使う。 */
export function calcCoverageInitialSavingsMan(
  input: Pick<CashFlowInput, 'savingsState'>,
): number {
  return calcCoverageOpeningBalancesMan(input).deposit;
}

/**
 * 暦年 Y に万一が起きたときの年始残高。
 * キャッシュフロー表は年末残高なので、Y 年始＝Y−1 年末。初年は開始残高。
 */
export function resolveDeathTimeBalancesMan(
  calendarYear: number,
  years: Pick<CashFlowYearRow, 'calendarYear' | 'savings' | 'financialAssets'>[],
  opening: CoverageOpeningBalancesMan,
): CoverageOpeningBalancesMan {
  if (years.length === 0) return opening;
  const firstYear = years.reduce(
    (min, year) => Math.min(min, year.calendarYear),
    years[0].calendarYear,
  );
  if (calendarYear <= firstYear) return opening;

  let latestBefore: (typeof years)[number] | null = null;
  for (const year of years) {
    if (year.calendarYear >= calendarYear) continue;
    if (
      latestBefore == null ||
      year.calendarYear > latestBefore.calendarYear
    ) {
      latestBefore = year;
    }
  }
  if (latestBefore == null) return opening;
  return {
    deposit: roundMan(latestBefore.savings),
    financialAssets: roundMan(latestBefore.financialAssets),
  };
}

export function yearExpenseCashMan(flow: CoverageYearlyFlowInput): number {
  return (
    flow.living +
    flow.housing +
    flow.vehicle +
    flow.education +
    flow.lifeEvent +
    flow.loan +
    flow.insurance +
    (flow.taxSocial ?? 0)
  );
}

export function calcRequiredCoverageFromMinBalance(
  minSavingsBalance: number,
): number {
  if (!Number.isFinite(minSavingsBalance) || minSavingsBalance >= 0) return 0;
  return roundMan(Math.abs(minSavingsBalance));
}

/**
 * 現預金を初期値に、年次の収支で貯蓄残高を更新する。
 * 参考値：全期間の貯蓄残高の最小値（底）が負ならその絶対値。
 * 必要保障額グラフの不足額（支出累計 − 準備済）とは別の指標です。
 */
export function buildRequiredCoverageYearlyCashFlow(
  yearFlows: CoverageYearlyFlowInput[],
  initialSavings: number,
): {
  yearlyCashFlow: RequiredCoverageYearlyCashFlow[];
  minSavingsBalance: number;
  requiredAmount: number;
} {
  const yearlyCashFlow: RequiredCoverageYearlyCashFlow[] = [];
  let savingsBalance = roundMan(initialSavings);

  if (yearFlows.length === 0) {
    return {
      yearlyCashFlow,
      minSavingsBalance: savingsBalance,
      requiredAmount: calcRequiredCoverageFromMinBalance(savingsBalance),
    };
  }

  let minSavingsBalance = savingsBalance;

  for (let index = 0; index < yearFlows.length; index += 1) {
    const flow = yearFlows[index];
    const expense = roundMan(yearExpenseCashMan(flow));
    const income = roundMan(flow.income);
    const net = roundMan(income - expense);
    savingsBalance = roundMan(savingsBalance + net);
    if (savingsBalance < minSavingsBalance) {
      minSavingsBalance = savingsBalance;
    }
    yearlyCashFlow.push({
      calendarYear: flow.calendarYear,
      living: roundMan(flow.living),
      housing: roundMan(flow.housing),
      housingPrincipal: roundMan(index === 0 ? flow.housingPrincipal : 0),
      vehicle: roundMan(flow.vehicle),
      education: roundMan(flow.education),
      lifeEvent: roundMan(flow.lifeEvent),
      loan: roundMan(flow.loan),
      insurance: roundMan(flow.insurance),
      taxSocial: roundMan(flow.taxSocial ?? 0),
      expense,
      earned: roundMan(flow.earned),
      survivorBasic: roundMan(flow.survivorBasic),
      childAllowance: roundMan(flow.childAllowance),
      income,
      net,
      savingsBalance,
    });
  }

  return {
    yearlyCashFlow,
    minSavingsBalance,
    requiredAmount: calcRequiredCoverageFromMinBalance(minSavingsBalance),
  };
}
