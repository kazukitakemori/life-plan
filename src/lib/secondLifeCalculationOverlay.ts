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

  // skip は「何も反映しない」を厳密に保証する。
  // 派生処理すら通さず、Q5 の保存データをそのまま計算へ渡す。
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

  // 生活費も同様に、skip 中は Q4 の保存データを一切加工しない。
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
