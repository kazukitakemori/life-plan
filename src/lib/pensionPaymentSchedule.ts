import {
  addPensionBreakdown,
  createEmptyPensionBreakdown,
  sumOldAgePension,
  type PensionBreakdown,
} from '../types/cashFlow';

/**
 * 公的年金の支給スケジュール（簡易モデル）。
 *
 * - 支給は偶数月（2・4・6・8・10・12月）のみ
 * - 各回は原則2か月分（支給月の2か月前・1か月前に資格があった分）
 * - 受給開始直後や年度をまたぐ場合は満年額にならない
 *
 * entitlement* は各暦月の「受給資格に基づく1か月分」の内訳（万円）。
 */
export function calcPensionPaymentFromEntitlements(
  paymentCalendarMonth: number,
  entitlementOneMonthAgo: PensionBreakdown,
  entitlementTwoMonthsAgo: PensionBreakdown,
): PensionBreakdown {
  const result = createEmptyPensionBreakdown();

  if (paymentCalendarMonth % 2 !== 0) {
    return result;
  }

  addPensionBreakdown(result, entitlementOneMonthAgo);
  addPensionBreakdown(result, entitlementTwoMonthsAgo);

  return result;
}


/**
 * 税計算へ渡す老齢年金の実支払額（月額・万円）。
 *
 * 老齢年金だけを対象にし、非課税の遺族年金・障害年金は含めない。
 * 支払時期は calcPensionPaymentFromEntitlements と同じ偶数月・前2か月分。
 */
export function calcTaxableOldAgePensionPaymentMan(
  paymentCalendarMonth: number,
  entitlementOneMonthAgo: PensionBreakdown,
  entitlementTwoMonthsAgo: PensionBreakdown,
): number {
  const payment = calcPensionPaymentFromEntitlements(
    paymentCalendarMonth,
    entitlementOneMonthAgo,
    entitlementTwoMonthsAgo,
  );
  return sumOldAgePension(payment.oldAge);
}
