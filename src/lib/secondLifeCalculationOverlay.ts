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
 * 毎回必ず元の入力から派生させるため、Q12 の「現在の入力内容から変更はしない」を
 * ON にすれば、復元処理なしで元データの計算へ戻る。
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

  const housingState = head
    ? applySecondLifeHousingToHousingStateWithChanges({
        housingState: input.housingState,
        secondLifeState: input.secondLifeState,
        member: head,
        referenceDate: input.referenceDate,
        targetId: head.id,
      }).housingState
    : input.housingState;

  const livingState = applySecondLifeLivingDesign({
    livingState: input.livingState,
    secondLifeState: input.secondLifeState,
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    pensionByMember: input.pensionByMember,
    referenceDate: input.referenceDate,
  });

  return { housingState, livingState };
}
