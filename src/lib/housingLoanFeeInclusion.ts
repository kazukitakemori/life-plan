import type { OwnedPropertyLoanSettings } from '../types/housing';

export type HousingLoanFeesInLoanMode = 'loan' | 'cash';

/** ペアローンで夫婦間連動するローン組み込み設定 */
export type PairLinkedFeeInclusionSettings = Pick<
  OwnedPropertyLoanSettings,
  | 'includeBrokerageFeeInLoan'
  | 'includeRegistrationFeeInLoan'
  | 'bankFeePaymentTiming'
>;

/** 諸費用のローン組み込みモードを解決（旧個別設定との互換） */
export function resolveHousingLoanFeesInLoanMode(
  settings: OwnedPropertyLoanSettings,
): HousingLoanFeesInLoanMode {
  // 仲介・登記・銀行手数料の3つが揃ってローン組込のときだけ「まとめてローン」
  // （仲介だけ true で銀行は initial、などの中間状態を loan と誤表示しない）
  if (
    settings.bankFeePaymentTiming === 'loan' &&
    settings.includeBrokerageFeeInLoan &&
    settings.includeRegistrationFeeInLoan
  ) {
    return 'loan';
  }
  return 'cash';
}

export function extractPairLinkedFeeInclusionSettings(
  settings: OwnedPropertyLoanSettings,
): PairLinkedFeeInclusionSettings {
  return {
    includeBrokerageFeeInLoan: settings.includeBrokerageFeeInLoan,
    includeRegistrationFeeInLoan: settings.includeRegistrationFeeInLoan,
    bankFeePaymentTiming: settings.bankFeePaymentTiming,
  };
}

export function applyPairLinkedFeeInclusionSettings(
  target: OwnedPropertyLoanSettings,
  source: OwnedPropertyLoanSettings,
): OwnedPropertyLoanSettings {
  const linked = extractPairLinkedFeeInclusionSettings(source);
  return { ...target, ...linked };
}

export function applyHousingLoanFeesInLoanMode(
  mode: HousingLoanFeesInLoanMode,
): PairLinkedFeeInclusionSettings {
  if (mode === 'loan') {
    return {
      includeBrokerageFeeInLoan: true,
      includeRegistrationFeeInLoan: true,
      bankFeePaymentTiming: 'loan',
    };
  }
  return {
    includeBrokerageFeeInLoan: false,
    includeRegistrationFeeInLoan: false,
    bankFeePaymentTiming: 'initial',
  };
}
