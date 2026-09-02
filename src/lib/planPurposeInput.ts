import { isMemberBirthComplete } from './familyDefaults';
import { getIncomeEligibleMembers } from './memberDisplay';
import { calcMonthlyEquivalentMan } from './livingAmount';
import {
  getLivingScheduleBillableItems,
} from './livingDefaults';
import {
  getRequiredStepsForPurposes,
  hasPlanPurpose,
  normalizePlanPurposes,
  unlocksRequiredCoverageWithoutAnalysis,
} from './planPurpose';
import type { EducationByMember } from '../types/education';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember } from '../types/income';
import { HOUSEHOLD_LIVING_KEY, type LivingExpenseState } from '../types/living';
import type { PlanPurpose } from '../types/plan';
import { STEPS, type StepId } from '../types/steps';

export interface PlanPurposeInputSnapshot {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  livingState: LivingExpenseState;
  educationByMember: EducationByMember;
}

export function isFamilyStepComplete(members: FamilyMember[]): boolean {
  const head = members.find((member) => member.role === 'head');
  return head != null && isMemberBirthComplete(head);
}

export function isIncomeStepComplete(
  members: FamilyMember[],
  incomeByMember: IncomeByMember,
): boolean {
  return getIncomeEligibleMembers(members).some(
    (member) => (incomeByMember[member.id]?.length ?? 0) > 0,
  );
}

export function isLivingStepComplete(livingState: LivingExpenseState): boolean {
  const schedules = livingState.byTarget[HOUSEHOLD_LIVING_KEY] ?? [];
  return schedules.some((schedule) => {
    if (schedule.inputMode === 'simple') {
      return schedule.simpleMonthlyExpenseMan > 0;
    }
    const items = getLivingScheduleBillableItems(schedule);
    return calcMonthlyEquivalentMan(items) > 0;
  });
}

export function isEducationStepComplete(
  members: FamilyMember[],
  educationByMember: EducationByMember,
): boolean {
  const children = members.filter((member) => member.role === 'child');
  if (children.length === 0) return true;
  return children.every(
    (child) => (educationByMember[child.id]?.length ?? 0) > 0,
  );
}

export function isStepInputComplete(
  step: StepId,
  input: PlanPurposeInputSnapshot,
): boolean {
  switch (step) {
    case 'family':
      return isFamilyStepComplete(input.familyMembers);
    case 'income':
      return isIncomeStepComplete(
        input.familyMembers,
        input.incomeByMember,
      );
    case 'living':
      return isLivingStepComplete(input.livingState);
    case 'education':
      return isEducationStepComplete(
        input.familyMembers,
        input.educationByMember,
      );
    case 'pension':
      return isIncomeStepComplete(
        input.familyMembers,
        input.incomeByMember,
      );
    default:
      return true;
  }
}

export function getIncompleteRequiredSteps(
  purposes: PlanPurpose[],
  input: PlanPurposeInputSnapshot,
): StepId[] {
  const normalized = normalizePlanPurposes(purposes);
  if (normalized.includes('life_plan')) return [];

  return getRequiredStepsForPurposes(purposes).filter(
    (step) => !isStepInputComplete(step, input),
  );
}

export function areRequiredInputsComplete(
  purposes: PlanPurpose[],
  input: PlanPurposeInputSnapshot,
): boolean {
  return getIncompleteRequiredSteps(purposes, input).length === 0;
}

export function canOpenRequiredCoverageWithoutAnalysis(
  purposes: PlanPurpose[],
  input: PlanPurposeInputSnapshot,
): boolean {
  return (
    unlocksRequiredCoverageWithoutAnalysis(purposes) &&
    areRequiredInputsComplete(purposes, input)
  );
}

export function getRequiredCoverageBlockedDescription(
  purposes: PlanPurpose[],
  input: PlanPurposeInputSnapshot,
): string {
  if (hasPlanPurpose(purposes, 'life_plan')) {
    return '入力タブで内容を入力し、サイドバーの「ライフプラン分析」を実行すると、保障期間と支出累計を試算できます。';
  }

  if (!unlocksRequiredCoverageWithoutAnalysis(purposes)) {
    return '入力タブで内容を入力し、サイドバーの「ライフプラン分析」を実行すると、保障期間と支出累計を試算できます。';
  }

  const incomplete = getIncompleteRequiredSteps(purposes, input);
  if (incomplete.length === 0) {
    return '必要保障額の試算画面を表示します。';
  }

  const labels = incomplete.map(
    (stepId) => STEPS.find((step) => step.id === stepId)?.label ?? stepId,
  );
  return `必要保障額の試算には、次の必須入力（${labels.join('・')}）を完了してください。左の入力メニューで＊の付いた項目を入力してください。`;
}
