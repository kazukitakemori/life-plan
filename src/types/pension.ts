export type PastEnrollmentMode =
  | 'none'
  | 'nenkin-teikibin-under50'
  | 'nenkin-teikibin-over50';

export interface NenkinTeikibinMonthlyRow {
  nationalPensionStatus: string;
  employeesPensionCategory: string;
  standardRemuneration: string;
  standardBonus: string;
  premiumPayment: string;
}

export interface NenkinTeikibinParticipationFields {
  nationalPensionType1Months: number | null;
  nationalPensionType3Months: number | null;
  additionalPremiumMonths: number | null;
  seamenInsuranceMonths: number | null;
  employeesPensionGeneralMonths: number | null;
  employeesPensionPublicServantMonths: number | null;
  employeesPensionPrivateSchoolMonths: number | null;
  consolidationPeriodMonths: number | null;
}

export interface NenkinTeikibinMonthlyFields {
  recentMonthlyYear: number;
  recentMonthlyMonth: number;
  monthlyRows: NenkinTeikibinMonthlyRow[];
}

export interface TeikibinRecentMonthlyInputRow {
  nationalPensionStatus: string;
  employeesPensionCategory: string;
  standardRemuneration: string;
  standardBonus: string;
}

export interface NenkinTeikibinUnder50AmountFields {
  oldAgeBasicPensionYen: number | null;
  oldAgeEmployeesGeneralYen: number | null;
  oldAgeEmployeesPublicServantYen: number | null;
  oldAgeEmployeesPrivateSchoolYen: number | null;
}

export interface TeikibinOver50AmountPair {
  proportional: number | null;
  fixed: number | null;
}

export interface TeikibinOver50AmountTriple {
  proportional: number | null;
  fixed: number | null;
  transitionalOccupational: number | null;
}

export interface TeikibinOver50OldAgePair {
  proportional: number | null;
  transitionalAddition: number | null;
}

export interface TeikibinOver50OldAgeTriple {
  proportional: number | null;
  transitionalAddition: number | null;
  transitionalOccupational: number | null;
}

export interface NenkinTeikibinOver50AmountFields {
  basicPension65: number | null;
  general: {
    specialCol3: TeikibinOver50AmountPair;
    specialCol4: TeikibinOver50AmountPair;
    oldAge65: TeikibinOver50OldAgePair;
  };
  publicServant: {
    specialCol2: TeikibinOver50AmountTriple;
    specialCol3: TeikibinOver50AmountTriple;
    specialCol4: TeikibinOver50AmountTriple;
    oldAge65: TeikibinOver50OldAgeTriple;
  };
  privateSchool: {
    specialCol2: TeikibinOver50AmountTriple;
    specialCol3: TeikibinOver50AmountTriple;
    specialCol4: TeikibinOver50AmountTriple;
    oldAge65: TeikibinOver50OldAgeTriple;
  };
}

export type NenkinTeikibinUnder50Form = NenkinTeikibinParticipationFields &
  NenkinTeikibinUnder50AmountFields &
  NenkinTeikibinMonthlyFields;

export type NenkinTeikibinOver50Form = NenkinTeikibinParticipationFields &
  NenkinTeikibinOver50AmountFields &
  NenkinTeikibinMonthlyFields & {
    recentMonthlyInputRow: TeikibinRecentMonthlyInputRow;
  };

export type BenefitAmountMode = 'auto' | 'manual';

export interface OldAgeBenefitRowSettings {
  startAge: number;
  /** 受給開始年齢の月オフセット（0〜11）。0 = startAge の誕生月と同月。 */
  startMonth: number;
  amountMode: BenefitAmountMode;
  manualAmountPerYear: number | null;
}

/**
 * 加給年金（配偶者分）の受給設定。
 * auto: 厚生年金加入月数≥240か月かつ配偶者が65歳未満の間を自動判定。
 * manual: ユーザーが手入力した年額を使用（autoが不正確な場合に上書き）。
 */
export interface DependentSpousePensionSettings {
  amountMode: BenefitAmountMode;
  manualAmountPerYear: number | null;
}

export interface BenefitSettings {
  oldAgeBasic: OldAgeBenefitRowSettings;
  oldAgeGeneralEmployees: OldAgeBenefitRowSettings;
  oldAgePublicPrivate: OldAgeBenefitRowSettings;
  survivorDeathYear: number;
  survivorDeathMonth: number;
  survivorBasicPerYear: number | null;
  survivorEmployeesMutualPerYear: number | null;
  dependentSpousePension: DependentSpousePensionSettings;
}

export interface PensionMemberState {
  pastEnrollment: PastEnrollmentMode;
  teikibinUnder50: NenkinTeikibinUnder50Form;
  teikibinOver50: NenkinTeikibinOver50Form;
  benefitSettings: BenefitSettings;
}

export const PENSION_START_AGE_OPTIONS = Array.from(
  { length: 16 },
  (_, i) => 60 + i,
);

/** 受給開始の月オフセット選択肢（0〜11ヶ月）*/
export const PENSION_START_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i);

export type PensionByMember = Record<string, PensionMemberState>;

export const PAST_ENROLLMENT_OPTIONS: {
  value: PastEnrollmentMode;
  label: string;
}[] = [
  { value: 'none', label: '入力しない' },
  {
    value: 'nenkin-teikibin-under50',
    label: 'ねんきん定期便（50歳未満の方タイプ）',
  },
  {
    value: 'nenkin-teikibin-over50',
    label: 'ねんきん定期便（50歳以上の方タイプ）',
  },
];

export const TEIKIBIN_UNDER50_MONTHLY_ROW_COUNT = 12;
