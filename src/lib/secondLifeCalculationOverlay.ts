import type { FamilyMember } from '../types/family';
import type { HousingState } from '../types/housing';
import type { IncomeByMember } from '../types/income';
import type { LivingExpenseState } from '../types/living';
import type { PensionByMember } from '../types/pension';
import type { SecondLifeState } from '../types/secondLife';
import {
  applySecondLifeHousingToHousingStateWithChanges,
  applySecondLifeLivingDesign,
} from './secondLifeTemplates';

export interface SecondLifeCalculationStates {
  housingState: HousingState;
  livingState: LivingExpenseState;
}

/**
 * Q4/Q5 の保存データを変更せず、キャッシュフロー計算にだけ Q12 の設計を重ねる。
 *
 * - housingSkip = true: Q5 の保存データをそのまま返す
 * - livingSkip = true: Q4 の保存データをそのまま返す
 * - skip = false: 元データから毎回、計算専用の派生状態を作る
 *
 * そのため Q12 を解除しても「復元処理」は不要で、元の入力へ即座に戻れる。
 */
export function buildSecondLifeCalculationStates(input: {
  housingState: HousingState;
  livingState: LivingExpenseState;
  secondLifeState: SecondLifeState;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
}): SecondLifeCalculationStates {
  const head = input.familyMembers.find((member) => member.role === 'head');

  const housingState =
    input.secondLifeState.housingSkip || !head
      ? input.housingState
      : applySecondLifeHousingToHousingStateWithChanges({
          housingState: input.housingState,
          secondLifeState: input.secondLifeState,
          member: head,
          referenceDate: input.referenceDate,
          targetId: head.id,
        }).housingState;

  const livingState = input.secondLifeState.livingSkip
    ? input.livingState
    : applySecondLifeLivingDesign({
        livingState: input.livingState,
        secondLifeState: input.secondLifeState,
        familyMembers: input.familyMembers,
        incomeByMember: input.incomeByMember,
        pensionByMember: input.pensionByMember,
        referenceDate: input.referenceDate,
      });

  return { housingState, livingState };
}
