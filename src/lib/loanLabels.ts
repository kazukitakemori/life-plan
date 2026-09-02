import type {
  LoanCategory,
  LoanPaymentMode,
  LoanStructureType,
} from '../types/loan';
import type {
  HousingLoanPrepaymentType,
  HousingLoanRepaymentMethod,
  LoanInterestRateType,
} from '../types/housing';

export const LOAN_INTEREST_RATE_TYPE_LABELS: Record<LoanInterestRateType, string> = {
  fixed: '固定金利',
  variable: '変動金利',
};

export const HOUSING_LOAN_REPAYMENT_METHOD_LABELS: Record<
  HousingLoanRepaymentMethod,
  string
> = {
  equal_payment: '元利均等返済',
  equal_principal: '元金均等返済',
};

export const HOUSING_LOAN_PREPAYMENT_TYPE_LABELS: Record<
  HousingLoanPrepaymentType,
  string
> = {
  period_shortening: '期間短縮型',
  payment_reduction: '返済額軽減型',
};

export const LOAN_CATEGORY_LABELS: Record<LoanCategory, string> = {
  housing: '住宅ローン',
  vehicle: '自動車ローン',
  education: '教育ローン',
  free: 'フリーローン',
};

export const LOAN_CATEGORY_DEFAULT_NAMES: Record<LoanCategory, string> = {
  housing: '住宅ローン',
  vehicle: '自動車ローン',
  education: '教育ローン',
  free: 'フリーローン',
};

export const LOAN_CATEGORY_ICONS: Record<LoanCategory, string> = {
  housing: '🏠',
  vehicle: '🚗',
  education: '🎓',
  free: '📝',
};

export const LOAN_CATEGORY_DESCRIPTIONS: Record<LoanCategory, string> = {
  housing: 'マンション・一戸建てなどの住宅資金',
  vehicle: '自動車・バイクなどの購入資金',
  education: '学費・留学費用など',
  free: 'その他の借入（カードローン・自由ローンなど）',
};

export const LOAN_ADD_CATEGORIES: LoanCategory[] = [
  'housing',
  'vehicle',
  'education',
  'free',
];

export const LOAN_PAYMENT_MODE_LABELS: Record<LoanPaymentMode, string> = {
  loanSettings: 'ローン条件を入力',
  monthlyRepayment: '月々の返済額を入力',
};

export const LOAN_PAYMENT_MODE_OPTIONS: LoanPaymentMode[] = [
  'loanSettings',
  'monthlyRepayment',
];

/** Q5 所有物件名から住宅ローン表示名を生成 */
export function formatHousingLoanName(propertyName: string): string {
  const trimmed = propertyName.trim();
  return trimmed ? `${trimmed}用ローン` : '住宅ローン';
}

/** Q6 乗り物名から自動車ローン表示名を生成 */
export function formatVehicleLoanName(vehicleName: string): string {
  const trimmed = vehicleName.trim();
  return trimmed ? `${trimmed}用ローン` : LOAN_CATEGORY_DEFAULT_NAMES.vehicle;
}

export const LOAN_STRUCTURE_TYPE_LABELS: Record<LoanStructureType, string> = {
  sole: '単独ローン',
  pair: 'ペアローン',
  joint_debt: '連帯債務',
  income_combined: '収入合算',
};

export const LOAN_STRUCTURE_TYPE_DESCRIPTIONS: Record<LoanStructureType, string> = {
  sole: '1人で借りる',
  pair: '2人で別々に借りる',
  joint_debt: '2人の収入を合わせて1本で借りる',
  income_combined: '2人の収入を合わせて1本で借りる',
};

export const LOAN_STRUCTURE_TYPES: LoanStructureType[] = [
  'sole',
  'pair',
  'joint_debt',
  'income_combined',
];

/** ローン比較表（住宅ローン追加時） */
export const HOUSING_LOAN_STRUCTURE_COMPARISON = {
  columns: [
    { key: 'pair' as const, label: '① ペアローン' },
    { key: 'joint_debt' as const, label: '② 連帯債務' },
    { key: 'income_combined' as const, label: '③ 収入合算（連帯保証）' },
  ],
  rows: [
    {
      label: '契約の数',
      pair: '2本（夫と妻で別々）',
      joint_debt: '1本',
      income_combined: '1本',
    },
    {
      label: '住宅ローン控除',
      pair: '2人とも受けられる',
      joint_debt: '2人とも受けられる',
      income_combined: '1人だけ（主債務者のみ）',
    },
    {
      label: '団信（生命保険）',
      pair: '2人ともそれぞれ加入',
      joint_debt: '2人とも入れるプランあり',
      income_combined: '1人だけ（主債務者のみ）',
    },
    {
      label: '諸費用（手数料）',
      pair: '2契約分かかる（高い）',
      joint_debt: '1契約分で済む',
      income_combined: '1契約分で済む',
    },
    {
      label: 'メリット',
      pair: [
        '夫婦ともに控除をフル活用できる',
        'それぞれ100%カバーの団信に入れる',
        'お互いの借入額を自由に調整しやすい',
      ],
      joint_debt: [
        '契約が1つのため諸費用が安い',
        '諸費用を抑えつつ2人とも控除が使える',
        '2人で入れる団信（連生団信）も選択可',
      ],
      income_combined: [
        '契約が1つのため諸費用が安い',
        '配偶者がパートや育休予定でも収入を合算して借入額を増やせる',
      ],
    },
    {
      label: 'デメリット',
      pair: [
        '契約が2つのため諸費用が2倍かかる',
        '銀行の手続きや管理の手間が2倍になる',
      ],
      joint_debt: [
        '取扱っている民間銀行が非常に少ない',
        '連生団信を選ぶと金利が上乗せになる場合がある',
      ],
      income_combined: [
        '配偶者は住宅ローン控除を受けられない',
        '配偶者に万が一のことがあっても団信の保障がない',
      ],
    },
  ],
} as const;
