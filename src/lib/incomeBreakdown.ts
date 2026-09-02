import type { BonusDetail, IncomeBreakdownKey, SalaryBonusStreamKey } from '../types/cashFlow';
import type { IncomeCategory, IncomeStreamType } from '../types/income';

export function getSalaryLikeCategories(): IncomeCategory[] {
  return ['employee', 'civil_servant', 'part_time'];
}

export function isSalaryLikeCategory(category: IncomeCategory): boolean {
  return getSalaryLikeCategories().includes(category);
}

export function isBusinessIncomeStream(streamType: IncomeStreamType): boolean {
  return streamType === 'business_national_insurance';
}

/** 経費入力欄を表示する収入形態か */
export function isExpenseInputStream(streamType: IncomeStreamType): boolean {
  return (
    streamType === 'business_national_insurance' ||
    streamType === 'miscellaneous_income' ||
    streamType === 'temporary_income'
  );
}

export function isSalaryIncomeStream(streamType: IncomeStreamType): boolean {
  return resolveSalaryStreamKey(streamType) !== null;
}

/** 給与所得として扱う期間か（会社員カテゴリ、または自営業内の給与収入） */
export function treatsPeriodAsSalaryIncome(
  category: IncomeCategory,
  streamType: IncomeStreamType,
): boolean {
  return isSalaryLikeCategory(category) || isSalaryIncomeStream(streamType);
}

/** 事業所得として扱う期間か */
export function treatsPeriodAsBusinessIncome(
  category: IncomeCategory,
  streamType: IncomeStreamType,
): boolean {
  return category === 'self_employed' && isBusinessIncomeStream(streamType);
}

/** Q7 の収入形態を給与内訳行へ割り当てる */
export function resolveSalaryStreamKey(
  streamType: IncomeStreamType,
): SalaryBonusStreamKey | null {
  switch (streamType) {
    case 'salary_social_insurance':
      return 'socialInsurance';
    case 'salary_civil_mutual':
      return 'civilMutual';
    case 'salary_national_insurance':
      return 'nationalInsurance';
    default:
      return null;
  }
}

/** Q7 の収入形態を賞与内訳行へ割り当てる（選択型DCは対象外） */
export function resolveBonusStreamKey(
  streamType: IncomeStreamType,
): keyof BonusDetail | null {
  switch (streamType) {
    case 'salary_social_insurance':
      return 'socialInsurance';
    case 'salary_civil_mutual':
      return 'civilMutual';
    case 'salary_national_insurance':
      return 'nationalInsurance';
    default:
      return null;
  }
}

/** 所得税・住民税の課税対象外の収入か */
export function isTaxFreeIncome(
  category: IncomeCategory,
  streamType: IncomeStreamType,
): boolean {
  return (
    category === 'benefit' ||
    streamType === 'benefit_tax_free' ||
    streamType === 'tax_free_income'
  );
}

export function resolveOtherIncomeKey(
  category: IncomeCategory,
  streamType: IncomeStreamType,
): IncomeBreakdownKey | null {
  switch (category) {
    case 'self_employed':
      return 'businessCf';
    case 'benefit':
      return 'taxFreeIncome';
    case 'other':
      if (streamType === 'temporary_income') {
        return 'transferCf';
      }
      if (streamType === 'tax_free_income') {
        return 'taxFreeIncome';
      }
      return 'otherIncome';
    default:
      return null;
  }
}

