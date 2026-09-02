import type { OwnedProperty, OwnedPropertyLoanSettings } from '../types/housing';
import type { LoanState } from '../types/loan';
import { calcHousingLoanTotalAmountMan } from './housingLoanAmount';
import {
  calcHousingPropertyBankFeesInitialMan,
  calcHousingPropertyTotalLoanAmountMan,
} from './loanResolution';

/** 取得価格（建物 + 土地 + 仲介手数料） */
export function calcOwnedAcquisitionTotalMan(property: OwnedProperty): number {
  return (
    property.buildingMan + property.landMan + property.brokerageFeeMan
  );
}

/** 現金一括時の購入費・初（取得価格 + 登記手数料） */
export function calcOwnedCashPurchaseInitialMan(property: OwnedProperty): number {
  return calcOwnedAcquisitionTotalMan(property) + property.registrationFeeMan;
}

/** ローン払い時の頭金・諸費用（取得費用合計 + 初回諸手数料 − 借入金額、0未満は0） */
export function calcOwnedLoanDownPaymentMan(
  property: OwnedProperty,
  loanSettings?: OwnedPropertyLoanSettings,
  loanState?: LoanState,
  targetId?: string,
): number {
  const loan = loanSettings ?? property.loan;
  const totalInitial =
    calcOwnedCashPurchaseInitialMan(property) +
    calcHousingPropertyBankFeesInitialMan(
      property,
      loanState,
      targetId,
      loan,
    );
  const loanAmount =
    loanState && targetId
      ? calcHousingPropertyTotalLoanAmountMan(property, loanState, targetId)
      : loan
        ? calcHousingLoanTotalAmountMan(property, loan)
        : property.loan?.amountMan ?? 0;
  return Math.max(0, totalInitial - loanAmount);
}

export function formatOwnedAcquisitionTotalMan(property: OwnedProperty): string {
  return `${calcOwnedAcquisitionTotalMan(property)}万円`;
}
