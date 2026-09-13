import type { FamilyMember } from '../types/family';
import type { HousingState } from '../types/housing';
import type { IncomeByMember } from '../types/income';
import type { LivingExpenseState } from '../types/living';
import type { PensionByMember } from '../types/pension';
import type { SecondLifeState } from '../types/secondLife';
import { getPreSecondLifeMonthlyLivingMan } from './secondLifeEstimates';
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
 * Q4/Q5 は常にユーザー入力の原本として保存する。
 * Q12 で「見直す」を選んだ項目だけ、原本から計算専用の派生状態を毎回作る。
 * 「現在の計画をそのまま使う」を選んだ項目は、原本をそのまま返す。
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
    input.secondLifeState.housingConfigured === false ||
    input.secondLifeState.housingSkip ||
    !head
      ? input.housingState
      : applySecondLifeHousingToHousingStateWithChanges({
          housingState: input.housingState,
          secondLifeState: input.secondLifeState,
          member: head,
          referenceDate: input.referenceDate,
          targetId: head.id,
        }).housingState;

  const livingBaseMonthly = getPreSecondLifeMonthlyLivingMan({
    livingState: input.livingState,
    familyMembers: input.familyMembers,
    referenceDate: input.referenceDate,
    startAge: input.secondLifeState.startAge,
  });

  const livingState =
    input.secondLifeState.livingConfigured === false ||
    input.secondLifeState.livingSkip ||
    livingBaseMonthly <= 0
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
