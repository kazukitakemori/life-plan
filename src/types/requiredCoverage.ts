import type { IncomeEntry } from './income';

/** 保障が必要な期間の条件 */
export type RequiredCoverageHorizonKind =
  | 'survivor_expected_lifespan'
  | 'youngest_child_education'
  | 'spouse_old_age_pension'
  | 'housing_loan_payoff'
  | 'custom';

/** 万一の対象。head = 世帯主が亡くなった場合 / spouse = 配偶者が亡くなった場合 */
export type RequiredCoverageSubject = 'head' | 'spouse';

/** 必要保障額のリスク種別。death = 万一 / medical = 手術・入院 */
export type RequiredCoverageRiskKind = 'death' | 'medical';

export const REQUIRED_COVERAGE_RISK_KINDS: {
  id: RequiredCoverageRiskKind;
  label: string;
}[] = [
  { id: 'death', label: '万一のリスク' },
  { id: 'medical', label: '手術・入院のリスク' },
];

/** 高額療養費の所得区分（70歳未満・ア〜オ）。試算の既定値用 */
export type RequiredCoverageMedicalIncomeBracket =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E';

/** 就業形態（傷病手当金の有無に影響） */
export type MedicalEmploymentType = 'employee' | 'selfEmployed' | 'other';

/**
 * 療養中に止められる支出の内訳（円/治療月）。
 * 収入の目減りから差し引き、純不足だけを必要保障に載せる。
 */
export type MedicalStoppableExpenseKind =
  | 'pocketMoney'
  | 'savingsContribution'
  | 'eatingOut'
  | 'hobby'
  | 'entertainment'
  | 'clothing'
  | 'socializing'
  | 'other';

export type MedicalStoppableExpenses = Record<
  MedicalStoppableExpenseKind,
  number
>;

export const MEDICAL_STOPPABLE_EXPENSE_ORDER: MedicalStoppableExpenseKind[] = [
  'pocketMoney',
  'savingsContribution',
  'eatingOut',
  'hobby',
  'entertainment',
  'clothing',
  'socializing',
  'other',
];

export const MEDICAL_STOPPABLE_EXPENSE_LABELS: Record<
  MedicalStoppableExpenseKind,
  string
> = {
  pocketMoney: 'お小遣い',
  savingsContribution: '任意の積立・貯蓄・運用',
  eatingOut: '外食・食事代',
  hobby: '趣味・習い事',
  entertainment: '娯楽・レジャー',
  clothing: '衣服・ファッション',
  socializing: '交際費・付き合い',
  other: 'その他',
};

export const MEDICAL_STOPPABLE_EXPENSE_NOTES: Partial<
  Record<MedicalStoppableExpenseKind, string>
> = {
  eatingOut: '入院中の病院食とは別。普段の外食分を止められる額',
  entertainment: '映画・旅行・スポーツ観戦など',
};

/** 手術・入院シナリオの設計 */
export interface RequiredCoverageMedicalDesign {
  /**
   * 対象者の月収（万円）。
   * 0 は未入力。ライフプランに収入があれば引用し、なければ手入力する
   * （ライフプラン未実施でもこの画面だけで算定できる）。
   */
  monthlyIncomeMan: number;
  /** 住民税非課税など、区分オ（低所得者）として扱う */
  isLowIncome: boolean;
  /**
   * 就業形態。employee = 会社員・公務員（傷病手当金あり）/
   * selfEmployed = 個人事業主 / other = その他
   */
  employmentType: MedicalEmploymentType;
  /**
   * 高額療養費の自己負担が発生する月数（治療月数）。既定6。
   * 手術・通院・入院を含む、限度額到達を見込む期間。
   */
  hospitalMonthsPerYear: number;
  /**
   * 実際の入院日数。
   * 差額ベッド代・食事代など入院に直結するコストの計算に使う（30日＝1か月相当）。
   */
  inpatientDays: number;
  /** 疾患プリセットのキー。null はカスタム入力 */
  diseasePreset: string | null;
  /** 差額ベッド代（円/日）— 高額療養費の対象外・全額自己負担 */
  extraBedCostYenPerDay: number;
  /** 食事代（円/日）— 入院時食事療養費（1食460円×3食＝1,380円） */
  mealCostYenPerDay: number;
  /** 着替え・サニタリーグッズ代（円/日） */
  clothingCostYenPerDay: number;
  /** 交通費（円/日） */
  transportCostYenPerDay: number;
  /** 消耗品代（円/日） */
  consumablesCostYenPerDay: number;
  /**
   * 収入の目減り（万円/治療月）。
   * 傷病手当金を差し引いたあとの額を入れる想定。
   */
  incomeLossManPerMonth: number;
  /**
   * true のとき、収入の目減りは手入力優先。
   * false（既定）かつ会社員のとき、月収−傷病手当から自動セットする。
   */
  incomeLossManual: boolean;
  /**
   * 療養中に止められる支出の内訳（円/治療月）。
   * 合計を収入の目減りから差し引き、純不足だけを必要保障に載せる。
   */
  stoppableExpensesYen: MedicalStoppableExpenses;
  /** 既加入の想定給付（万円） */
  existingBenefitMan: number;
}

export type RequiredCoverageMedicalDesigns = Record<
  RequiredCoverageSubject,
  RequiredCoverageMedicalDesign
>;

/** 必要保障額タブ内の設計段階（本体のモード切替） */
export type RequiredCoveragePageView = 'simple' | 'detail';

/** 簡易設計 / 詳細設計の支出設計（別データ） */
export type RequiredCoverageDesignStage = RequiredCoveragePageView;

export const REQUIRED_COVERAGE_PAGE_VIEWS: {
  id: RequiredCoveragePageView;
  label: string;
}[] = [
  { id: 'simple', label: '簡易設計' },
  { id: 'detail', label: '詳細設計' },
];

/** 本体に出す結果グラフ */
export type RequiredCoverageChartView = 'sweep' | 'line' | 'yearNet';

/** 詳細設計の入力画面 */
export type RequiredCoverageDetailSection = 'expense' | 'income';

/** 詳細設計の本体。入力とグラフは同時に出さない */
export type RequiredCoverageDetailPane =
  | RequiredCoverageDetailSection
  | RequiredCoverageChartView;

export const REQUIRED_COVERAGE_CHART_VIEWS: {
  id: RequiredCoverageChartView;
  label: string;
}[] = [
  { id: 'sweep', label: '推移' },
  { id: 'line', label: '不足額' },
  { id: 'yearNet', label: '年間収支' },
];

export const REQUIRED_COVERAGE_DETAIL_SECTIONS: {
  id: RequiredCoverageDetailSection;
  label: string;
}[] = [
  { id: 'expense', label: '支出' },
  { id: 'income', label: '収入' },
];

export function isRequiredCoverageChartView(
  view: RequiredCoverageDetailPane,
): view is RequiredCoverageChartView {
  return view === 'sweep' || view === 'line' || view === 'yearNet';
}

/** 必要保障額の支出カテゴリ（CF の支出累計と同じ区分） */
export type RequiredCoverageExpenseKind =
  | 'living'
  | 'education'
  | 'housing'
  | 'lifeEvent'
  | 'vehicle'
  | 'loanRepayment'
  | 'insuranceOther';

/** 万一後の1項目。未設定はカテゴリの残す割合を使う */
export interface RequiredCoverageLineOverride {
  included?: boolean;
  /** この項目だけ残す割合（%）。未設定ならカテゴリの残す割合 */
  ratePct?: number | null;
}

/** カテゴリ単位の万一後設計 */
export interface RequiredCoverageCategoryDesign {
  included: boolean;
  /** 残す割合（%）。100 = そのまま */
  ratePct: number;
  items: Record<string, RequiredCoverageLineOverride>;
}

export type RequiredCoverageExpenseDesigns = Record<
  RequiredCoverageExpenseKind,
  RequiredCoverageCategoryDesign
>;

/** 残る人の万一後の働き方 */
export type RequiredCoverageWorkMode = 'keep' | 'stop' | 'redesign';

/** 残る世帯主・配偶者1人の万一後の収入設計 */
export interface RequiredCoverageMemberWorkDesign {
  mode: RequiredCoverageWorkMode;
  /** mode === 'redesign' のとき使う収入カード（Q7とは独立） */
  entries: IncomeEntry[];
}

export type RequiredCoverageWorkDesigns = Record<
  RequiredCoverageSubject,
  Record<string, RequiredCoverageMemberWorkDesign>
>;

/** 必要保障額タブの入力（将来、死亡時点や既存保障などもここに足す） */
export interface RequiredCoverageState {
  /** 試算するリスク種別。未設定時は万一（death） */
  riskKind: RequiredCoverageRiskKind;
  subject: RequiredCoverageSubject;
  kind: RequiredCoverageHorizonKind;
  /** kind === 'custom' の終了年。0 は未入力 */
  customEndYear: number;
  /** kind === 'custom' の終了月。0 は未入力 */
  customEndMonth: number;
  /** 簡易設計の支出（生活費の残す割合のみ。他カテゴリは100%） */
  simpleDesigns: Record<RequiredCoverageSubject, RequiredCoverageExpenseDesigns>;
  /** 詳細設計の支出 */
  detailDesigns: Record<RequiredCoverageSubject, RequiredCoverageExpenseDesigns>;
  /** 万一対象ごとの、残る人の働き方 */
  workDesigns: RequiredCoverageWorkDesigns;
  /** 手術・入院シナリオ（対象ごと） */
  medicalDesigns: RequiredCoverageMedicalDesigns;
}
