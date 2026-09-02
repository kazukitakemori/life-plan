/** 住宅ローン諸手数料の目安額（参考ボタン用） */

export interface HousingLoanBankFeeReference {
  financingFeeMan: number;
  guaranteeFeeMan: number;
  administrativeFeeMan: number;
  loanAmountMan: number;
  loanYears: number;
}

/** 融資手数料の目安（借入額の2.2%・税込） */
export function calcFinancingFeeReferenceMan(loanAmountMan: number): number {
  if (loanAmountMan <= 0) return 0;
  return Math.ceil(loanAmountMan * 0.022);
}

/**
 * 保証料の目安（機構保証等の概算）
 * 借入額 × 1.5% ×（返済年数 / 35年）を目安とする
 */
export function calcGuaranteeFeeReferenceMan(
  loanAmountMan: number,
  loanYears: number,
): number {
  if (loanAmountMan <= 0 || loanYears <= 0) return 0;
  return Math.ceil(loanAmountMan * 0.015 * (loanYears / 35));
}

/** 事務手数料の目安（税込・固定） */
export function calcAdministrativeFeeReferenceMan(): number {
  return 3.3;
}

/**
 * ペアローン1契約分の銀行諸手数料目安。
 * 融資・保証は契約の借入額（分担後）で算出し、事務手数料は契約ごとに定額。
 */
export function calcHousingLoanBankFeeReferenceForPairContract(
  householdBaseLoanMan: number,
  contractSharePct: number,
  loanYears: number,
): HousingLoanBankFeeReference {
  const contractLoanMan = Math.max(
    0,
    Math.round((householdBaseLoanMan * contractSharePct) / 100),
  );
  const variableFees = calcHousingLoanBankFeeReference(
    contractLoanMan,
    loanYears,
  );
  return {
    loanAmountMan: contractLoanMan,
    loanYears,
    financingFeeMan: variableFees.financingFeeMan,
    guaranteeFeeMan: variableFees.guaranteeFeeMan,
    administrativeFeeMan: calcAdministrativeFeeReferenceMan(),
  };
}

export function calcHousingLoanBankFeeReference(
  loanAmountMan: number,
  loanYears: number,
): HousingLoanBankFeeReference {
  return {
    loanAmountMan,
    loanYears,
    financingFeeMan: calcFinancingFeeReferenceMan(loanAmountMan),
    guaranteeFeeMan: calcGuaranteeFeeReferenceMan(loanAmountMan, loanYears),
    administrativeFeeMan: calcAdministrativeFeeReferenceMan(),
  };
}
