import type { EducationByMember } from './education';
import type { FamilyMember } from './family';
import type { HousingState } from './housing';
import type { IncomeByMember, PriorYearIncomeByMember } from './income';
import type { InsuranceState } from './insurance';
import type { LifeEventState } from './lifeEvent';
import type { LivingExpenseState } from './living';
import type { LoanState } from './loan';
import type { PensionByMember } from './pension';
import type { RequiredCoverageState } from './requiredCoverage';
import type { SecondLifeState } from './secondLife';
import type { SavingsState } from './savings';
import type { TaxSocialState } from './taxSocial';
import type { VehicleState } from './vehicle';

/** 保存フォーマットのバージョン。フィールド追加時に上げる */
export const PLAN_SCHEMA_VERSION = 7;

export type PlanPurpose =
  | 'life_plan'
  | 'education'
  | 'pension'
  | 'death_coverage'
  | 'medical_coverage';

export type PlanStatus = 'in_progress' | 'simulated';

export interface PlanStatusDefinition {
  id: PlanStatus;
  label: string;
  /** 業務上の意味 */
  description: string;
  /** 新規作成時の既定か */
  isDefaultForCreate: boolean;
  /** ライフプラン分析実行後に付与するか */
  setOnAnalyze: boolean;
}

export const PLAN_STATUS_DEFINITIONS: PlanStatusDefinition[] = [
  {
    id: 'in_progress',
    label: '入力中',
    description: '入力・編集中のプラン',
    isDefaultForCreate: true,
    setOnAnalyze: false,
  },
  {
    id: 'simulated',
    label: 'シミュレーション済み',
    description: 'ライフプラン分析を実行済みのプラン',
    isDefaultForCreate: false,
    setOnAnalyze: true,
  },
];

export const PLAN_STATUS_OPTIONS = PLAN_STATUS_DEFINITIONS.map((d) => ({
  id: d.id,
  label: d.label,
}));

export function getPlanStatusDefinition(
  status: PlanStatus,
): PlanStatusDefinition {
  return (
    PLAN_STATUS_DEFINITIONS.find((d) => d.id === status) ??
    PLAN_STATUS_DEFINITIONS[0]
  );
}

export function getPlanStatusLabel(status: PlanStatus): string {
  return getPlanStatusDefinition(status).label;
}

export function getDefaultCreateStatus(): PlanStatus {
  return (
    PLAN_STATUS_DEFINITIONS.find((d) => d.isDefaultForCreate)?.id ??
    'in_progress'
  );
}

/** 表示用に敬称「様」を付ける（半角スペース＋様。既にあれば正規化） */
export function formatCustomerNameWithHonorific(name: string): string {
  const trimmed = name.trim() || '名称未設定';
  const base = trimmed.replace(/(?:\s|　)*様\s*$/u, '').trim() || '名称未設定';
  return `${base} 様`;
}

/** エディションに応じたプラン名表示 */
export function formatPlanDisplayName(
  name: string,
  options: { honorific?: boolean } = {},
): string {
  const trimmed = name.trim() || '名称未設定';
  const base = trimmed.replace(/(?:\s|　)*様\s*$/u, '').trim() || '名称未設定';
  if (options.honorific) return `${base} 様`;
  return base;
}

/** IndexedDB / 将来クラウド共通の入力スナップショット（JSON 化可能な形） */
export interface PlanPayload {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  livingState: LivingExpenseState;
  housingState: HousingState;
  vehicleState: VehicleState;
  loanState: LoanState;
  insuranceState: InsuranceState;
  savingsState: SavingsState;
  educationByMember: EducationByMember;
  lifeEventState: LifeEventState;
  pensionByMember: PensionByMember;
  taxSocialState: TaxSocialState;
  /** 未設定の旧データは migrate で補完 */
  requiredCoverageState?: RequiredCoverageState;
  /** Q12 セカンドライフ設計。未設定の旧データは migrate で補完 */
  secondLifeState?: SecondLifeState;
  /** 試算基準日（ISO 日付文字列） */
  referenceDate: string;
}

export interface PlanRecord {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  note: string;
  /**
   * 試算目的（複数可。life_plan は単独）。
   * 旧データの単一 `purpose` は migrate でここへ寄せる。
   */
  purposes?: PlanPurpose[];
  /** @deprecated migrate で purposes へ移行 */
  purpose?: PlanPurpose;
  status: PlanStatus;
  schemaVersion: number;
  payload: PlanPayload;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSummary {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  note: string;
  purposes: PlanPurpose[];
  status: PlanStatus;
  updatedAt: string;
}

/** App の入力 state をまとめたランタイム形（Date あり） */
export interface PlanAppState {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  livingState: LivingExpenseState;
  housingState: HousingState;
  vehicleState: VehicleState;
  loanState: LoanState;
  insuranceState: InsuranceState;
  savingsState: SavingsState;
  educationByMember: EducationByMember;
  lifeEventState: LifeEventState;
  pensionByMember: PensionByMember;
  taxSocialState: TaxSocialState;
  requiredCoverageState: RequiredCoverageState;
  secondLifeState: SecondLifeState;
  referenceDate: Date;
}

export interface PlanMetaInput {
  customerName: string;
  phone: string;
  email: string;
  note: string;
  status: PlanStatus;
}

/** 編集時のメタ（目的変更可） */
export interface PlanEditInput extends PlanMetaInput {
  purposes: PlanPurpose[];
}

/** 新規作成時のメタ（目的は必須・1つ以上） */
export interface PlanCreateInput extends PlanMetaInput {
  purposes: PlanPurpose[];
}
