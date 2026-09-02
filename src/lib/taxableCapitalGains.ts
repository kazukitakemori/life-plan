/**
 * 特定口座の売却益課税・開始時評価（簡易）。
 * 配当・分配は対象外。平均取得単価方式で簿価を按分し、益に 20.315% を課す。
 */

import { ensureSavingsWithdrawalFields } from './savingsWithdrawalPeriod';
import type {
  NisaValuationMode,
  SavingsEntry,
  TaxableUtilization,
} from '../types/savings';

/** 所得税 15.315% + 住民税 5% */
export const TAXABLE_CAPITAL_GAINS_TAX_RATE = 0.20315;

export interface TaxableWithdrawalResult {
  /** 実際に売却した額（万円）。残高不足時はリクエストより小さい */
  withdrawnMan: number;
  /** 対応する取得原価（万円） */
  costBasisMan: number;
  /** 売却益（万円）。損失時は 0（税なし・損益通算なし） */
  gainMan: number;
  /** 売却益税（万円） */
  taxMan: number;
  nextBalanceMan: number;
  nextPrincipalMan: number;
}

/**
 * 特定口座から売却し、比例簿価で原価を減額、益に税率を適用する。
 * 損失時は税 0（還付・通算は行わない）。
 * NISA 取崩しでは taxRate=0 で呼び、簿価按分のみ行う。
 */
export function applyTaxableWithdrawal(
  balanceMan: number,
  principalMan: number,
  requestedMan: number,
  taxRate: number = TAXABLE_CAPITAL_GAINS_TAX_RATE,
): TaxableWithdrawalResult {
  const balance = Math.max(0, balanceMan);
  const principal = Math.max(0, principalMan);
  const requested = Math.max(0, requestedMan);
  const withdrawnMan = Math.min(requested, balance);

  if (withdrawnMan <= 0 || balance <= 0) {
    return {
      withdrawnMan: 0,
      costBasisMan: 0,
      gainMan: 0,
      taxMan: 0,
      nextBalanceMan: balance,
      nextPrincipalMan: principal,
    };
  }

  const costBasisMan = withdrawnMan * (principal / balance);
  const rawGain = withdrawnMan - costBasisMan;
  const gainMan = Math.max(0, rawGain);
  const taxMan = gainMan * taxRate;

  return {
    withdrawnMan,
    costBasisMan,
    gainMan,
    taxMan,
    nextBalanceMan: balance - withdrawnMan,
    nextPrincipalMan: Math.max(0, principal - costBasisMan),
  };
}

export function resolveTaxableUtilization(
  utilization: TaxableUtilization | undefined,
): TaxableUtilization {
  return utilization === 'active' ? 'active' : 'new';
}

function resolveTaxableValuationMode(
  mode: NisaValuationMode | undefined,
): NisaValuationMode {
  return mode === 'gains' ? 'gains' : 'rate';
}

export function resolveTaxablePrincipalMan(entry: SavingsEntry): number {
  if (resolveTaxableUtilization(entry.taxableUtilization) === 'new') return 0;
  return Math.max(0, Number(entry.principalMan) || 0);
}

export function resolveTaxableGainsMan(entry: SavingsEntry): number {
  if (resolveTaxableUtilization(entry.taxableUtilization) !== 'active') return 0;
  if (resolveTaxableValuationMode(entry.nisaValuationMode) === 'gains') {
    return Math.max(0, Number(entry.gainsMan) || 0);
  }
  const principal = resolveTaxablePrincipalMan(entry);
  const ratePct = Math.max(0, Number(entry.nisaCurrentReturnRatePct) || 0);
  return principal * (ratePct / 100);
}

/** 試算開始時点の特定口座評価額（万円） */
export function calcTaxableValuationMan(entry: SavingsEntry): number {
  return resolveTaxablePrincipalMan(entry) + resolveTaxableGainsMan(entry);
}

/**
 * 特定口座の元本・評価・取崩しフィールドを正規化。
 * 旧データ（残高のみ）は「活用中・元本＝残高・含み益なし」へ移行する。
 */
export function ensureTaxableFields(entry: SavingsEntry): SavingsEntry {
  let utilization = entry.taxableUtilization;
  let principalMan = entry.principalMan;
  let gainsMan = entry.gainsMan;
  let valuationMode = entry.nisaValuationMode;
  let currentReturnRatePct = entry.nisaCurrentReturnRatePct;
  const legacyBalance = Math.max(0, Number(entry.balanceMan) || 0);

  // 旧: 残高のみ → 含み益なしの活用中として移行
  if (
    utilization == null &&
    legacyBalance > 0 &&
    (principalMan == null || principalMan === 0)
  ) {
    utilization = 'active';
    principalMan = legacyBalance;
    gainsMan = 0;
    valuationMode = 'gains';
    currentReturnRatePct = 0;
  }

  const resolvedUtilization = resolveTaxableUtilization(utilization);
  const resolvedValuationMode = resolveTaxableValuationMode(valuationMode);

  const withValuation: SavingsEntry = {
    ...entry,
    taxableUtilization: resolvedUtilization,
    nisaValuationMode: resolvedValuationMode,
    principalMan:
      resolvedUtilization === 'active'
        ? Math.max(0, Number(principalMan) || 0)
        : 0,
    gainsMan:
      resolvedUtilization === 'active' && resolvedValuationMode === 'gains'
        ? Math.max(0, Number(gainsMan) || 0)
        : 0,
    nisaCurrentReturnRatePct:
      resolvedUtilization === 'active' && resolvedValuationMode === 'rate'
        ? Math.max(0, Number(currentReturnRatePct) || 0)
        : 0,
    balanceMan: 0,
  };

  return ensureSavingsWithdrawalFields(withValuation);
}

/** @deprecated ensureSavingsWithdrawalFields を使用 */
export function ensureTaxableWithdrawalFields(entry: SavingsEntry): SavingsEntry {
  return ensureSavingsWithdrawalFields(entry);
}
