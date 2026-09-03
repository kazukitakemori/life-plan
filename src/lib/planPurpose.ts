import type { PlanPurpose, PlanStatus } from '../types/plan';
import type { RequiredCoverageRiskKind } from '../types/requiredCoverage';
import type { StepId } from '../types/steps';

export interface PlanPurposeDefinition {
  id: PlanPurpose;
  label: string;
  /** 管理一覧などでの短縮表示 */
  shortLabel: string;
  description: string;
  /** 他目的と併用できない（単独選択） */
  exclusive: boolean;
}

export const PLAN_PURPOSE_DEFINITIONS: PlanPurposeDefinition[] = [
  {
    id: 'life_plan',
    label: 'ライフプランの作成',
    shortLabel: 'ライフプラン',
    description: '収支・資産・保障まで含む総合試算（他目的と併用不可）',
    exclusive: true,
  },
  {
    id: 'education',
    label: '教育費試算',
    shortLabel: '教育費',
    description: 'ご家族・教育費・（任意で）収入。認可保育料は所得階層で推計',
    exclusive: false,
  },
  {
    id: 'pension',
    label: '年金試算',
    shortLabel: '年金',
    description: 'ご家族・収入・年金の入力で老齢年金の見込みを表示',
    exclusive: false,
  },
  {
    id: 'death_coverage',
    label: '万が一時の必要保障額試算',
    shortLabel: '万が一保障',
    description:
      'ご家族・収入・生活費は必須。ライフイベント・乗り物・住まいは任意。必要保障額は簡易設計',
    exclusive: false,
  },
  {
    id: 'medical_coverage',
    label: '手術・入院の保障額試算',
    shortLabel: '手術・入院',
    description: 'ご家族の入力後、必要保障額（手術・入院）へ進んで試算',
    exclusive: false,
  },
];

export const PLAN_PURPOSE_OPTIONS = PLAN_PURPOSE_DEFINITIONS.map((d) => ({
  id: d.id,
  label: d.label,
}));

const ALL_STEPS: StepId[] = [
  'family',
  'education',
  'life-event',
  'living',
  'housing',
  'vehicle',
  'income',
  'pension',
  'loan',
  'insurance',
  'savings',
  'other',
];

const PURPOSE_ORDER = PLAN_PURPOSE_DEFINITIONS.map((d) => d.id);

function isPlanPurpose(value: unknown): value is PlanPurpose {
  return (
    value === 'life_plan' ||
    value === 'education' ||
    value === 'pension' ||
    value === 'death_coverage' ||
    value === 'medical_coverage'
  );
}

function sortPurposes(purposes: PlanPurpose[]): PlanPurpose[] {
  return [...purposes].sort(
    (a, b) => PURPOSE_ORDER.indexOf(a) - PURPOSE_ORDER.indexOf(b),
  );
}

export function getDefaultPlanPurposes(): PlanPurpose[] {
  return ['life_plan'];
}

/** ライフプラン作成かつシミュレーション済みのときは目的を変更できない */
export function isPlanPurposeLocked(
  status: PlanStatus,
  purposes: PlanPurpose[],
): boolean {
  return status === 'simulated' && purposes.includes('life_plan');
}

/** @deprecated use getDefaultPlanPurposes */
export function getDefaultPlanPurpose(): PlanPurpose {
  return 'life_plan';
}

/**
 * 保存値・旧単一 purpose を現行の配列へ正規化する。
 * life_plan が含まれる場合は単独にする。
 */
export function normalizePlanPurposes(
  value: unknown,
  legacyPurpose?: unknown,
): PlanPurpose[] {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : isPlanPurpose(value)
      ? [value]
      : isPlanPurpose(legacyPurpose)
        ? [legacyPurpose]
        : [];

  const unique = [...new Set(raw.filter(isPlanPurpose))];
  if (unique.length === 0) return getDefaultPlanPurposes();
  if (unique.includes('life_plan')) return ['life_plan'];
  return sortPurposes(unique);
}

/** @deprecated use normalizePlanPurposes */
export function normalizePlanPurpose(value: unknown): PlanPurpose {
  return normalizePlanPurposes(value)[0] ?? getDefaultPlanPurpose();
}

export function getPlanPurposeDefinition(
  purpose: PlanPurpose,
): PlanPurposeDefinition {
  return (
    PLAN_PURPOSE_DEFINITIONS.find((d) => d.id === purpose) ??
    PLAN_PURPOSE_DEFINITIONS[0]
  );
}

export function getPlanPurposeLabel(purpose: PlanPurpose): string {
  return getPlanPurposeDefinition(purpose).label;
}

export function getPlanPurposeShortLabel(purpose: PlanPurpose): string {
  return getPlanPurposeDefinition(purpose).shortLabel;
}

export function getPlanPurposesLabel(purposes: PlanPurpose[]): string {
  const normalized = normalizePlanPurposes(purposes);
  return normalized.map(getPlanPurposeLabel).join('・');
}

export function getPlanPurposesShortLabel(purposes: PlanPurpose[]): string {
  const normalized = normalizePlanPurposes(purposes);
  return normalized.map(getPlanPurposeShortLabel).join('・');
}

export function hasPlanPurpose(
  purposes: PlanPurpose[],
  purpose: PlanPurpose,
): boolean {
  return normalizePlanPurposes(purposes).includes(purpose);
}

/**
 * チェックボックス切替。
 * life_plan を選ぶと他は外れ、部分目的を選ぶと life_plan は外れる。
 */
export function togglePlanPurpose(
  current: PlanPurpose[],
  toggled: PlanPurpose,
): PlanPurpose[] {
  const normalized = normalizePlanPurposes(current);
  const def = getPlanPurposeDefinition(toggled);

  if (def.exclusive) {
    return normalized.includes(toggled) && normalized.length === 1
      ? normalized
      : [toggled];
  }

  const withoutExclusive = normalized.filter(
    (id) => !getPlanPurposeDefinition(id).exclusive,
  );
  if (withoutExclusive.includes(toggled)) {
    const next = withoutExclusive.filter((id) => id !== toggled);
    return next.length > 0 ? sortPurposes(next) : getDefaultPlanPurposes();
  }
  return sortPurposes([...withoutExclusive, toggled]);
}

export function getInputStepsForPurpose(purpose: PlanPurpose): StepId[] {
  switch (purpose) {
    case 'education':
      return ['family', 'education', 'income'];
    case 'pension':
      return ['family', 'income', 'pension'];
    case 'death_coverage':
      // 必須: family / income / living。任意: life-event / vehicle / housing
      return [
        'family',
        'life-event',
        'living',
        'housing',
        'vehicle',
        'income',
      ];
    case 'medical_coverage':
      return ['family'];
    case 'life_plan':
    default:
      return ALL_STEPS;
  }
}

/** 目的ごとの必須入力ステップ（有効な項目のうち＊を付ける対象） */
export function getRequiredStepsForPurpose(purpose: PlanPurpose): StepId[] {
  switch (purpose) {
    case 'education':
      return ['family', 'education'];
    case 'pension':
      return ['family', 'income', 'pension'];
    case 'death_coverage':
      return ['family', 'income', 'living'];
    case 'medical_coverage':
      return ['family'];
    case 'life_plan':
    default:
      return ALL_STEPS;
  }
}

export function getRequiredStepsForPurposes(purposes: PlanPurpose[]): StepId[] {
  const normalized = normalizePlanPurposes(purposes);
  if (normalized.includes('life_plan')) return [];

  const set = new Set<StepId>();
  for (const purpose of normalized) {
    for (const step of getRequiredStepsForPurpose(purpose)) {
      set.add(step);
    }
  }
  return ALL_STEPS.filter((step) => set.has(step));
}

/** ライフプラン以外の部分目的では、サイドバーに必須＊を表示する */
export function showsRequiredStepMarkers(purposes: PlanPurpose[]): boolean {
  return !hasPlanPurpose(purposes, 'life_plan');
}

export function isStepInputRequired(
  step: StepId,
  purposes: PlanPurpose[],
): boolean {
  return getRequiredStepsForPurposes(purposes).includes(step);
}

export function getInputStepsForPurposes(purposes: PlanPurpose[]): StepId[] {
  const normalized = normalizePlanPurposes(purposes);
  if (normalized.includes('life_plan')) return ALL_STEPS;

  const set = new Set<StepId>();
  for (const purpose of normalized) {
    for (const step of getInputStepsForPurpose(purpose)) {
      set.add(step);
    }
  }
  return ALL_STEPS.filter((step) => set.has(step));
}

/** @deprecated use getInputStepsForPurposes */
export function getEnabledStepsForPurpose(purpose: PlanPurpose): StepId[] {
  return getInputStepsForPurpose(purpose);
}

export function isStepInputEnabled(
  step: StepId,
  purposes: PlanPurpose[],
): boolean {
  return getInputStepsForPurposes(purposes).includes(step);
}

export function getInitialStepForPurposes(_purposes: PlanPurpose[]): StepId {
  return 'family';
}

/** @deprecated use getInitialStepForPurposes */
export function getInitialStepForPurpose(_purpose: PlanPurpose): StepId {
  return 'family';
}

export function shouldShowAnalyzeButton(purposes: PlanPurpose[]): boolean {
  return hasPlanPurpose(purposes, 'life_plan');
}

export function tracksAnalysisStale(purposes: PlanPurpose[]): boolean {
  return shouldShowAnalyzeButton(purposes);
}

/** 分析なしで必要保障額（手術・入院）タブを開けるか */
export function unlocksMedicalCoverageWithoutAnalysis(
  purposes: PlanPurpose[],
): boolean {
  return hasPlanPurpose(purposes, 'medical_coverage');
}

/** 分析なしで必要保障額（万一）タブを開けるか */
export function unlocksDeathCoverageWithoutAnalysis(
  purposes: PlanPurpose[],
): boolean {
  return hasPlanPurpose(purposes, 'death_coverage');
}

/** 分析なしで必要保障額タブを開けるか */
export function unlocksRequiredCoverageWithoutAnalysis(
  purposes: PlanPurpose[],
): boolean {
  return (
    unlocksMedicalCoverageWithoutAnalysis(purposes) ||
    unlocksDeathCoverageWithoutAnalysis(purposes)
  );
}

/**
 * ライフプラン以外の部分目的だけで開くときのリスク種別。
 * life_plan がある場合は両方。
 */
export function getRequiredCoverageRiskKindsForPurposes(
  purposes: PlanPurpose[],
): RequiredCoverageRiskKind[] {
  const normalized = normalizePlanPurposes(purposes);
  if (normalized.includes('life_plan')) {
    return ['death', 'medical'];
  }
  const kinds: RequiredCoverageRiskKind[] = [];
  if (normalized.includes('death_coverage')) kinds.push('death');
  if (normalized.includes('medical_coverage')) kinds.push('medical');
  return kinds.length > 0 ? kinds : ['death', 'medical'];
}

/** 万が一保障のみの部分目的で、簡易設計に固定するか */
export function limitsRequiredCoverageToSimpleDesign(
  purposes: PlanPurpose[],
): boolean {
  const normalized = normalizePlanPurposes(purposes);
  return (
    normalized.includes('death_coverage') &&
    !normalized.includes('life_plan')
  );
}
