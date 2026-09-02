import { applySecondLifeNursing } from './secondLifeApply';
import { createDefaultSecondLifeState } from './secondLifeDefaults';
import { getPreSecondLifeMonthlyLivingMan } from './secondLifeEstimates';
import {
  createLivingExpenseItem,
  createLivingExpenseSchedule,
} from './livingDefaults';
import {
  createRentalProperty,
  getHousingTargetData,
  migrateHousingState,
} from './housingDefaults';
import type { FamilyMember } from '../types/family';
import { HOUSEHOLD_HOUSING_KEY, type HousingState } from '../types/housing';
import type { IncomeByMember } from '../types/income';
import type { LifeEventState } from '../types/lifeEvent';
import {
  HOUSEHOLD_LIVING_KEY,
  type LivingExpenseState,
} from '../types/living';
import type { PensionByMember } from '../types/pension';

export const SECOND_LIFE_RENTAL_NAME = 'セカンドライフ賃貸';
export const SECOND_LIFE_LIVING_LABEL = 'セカンドライフ生活費';

const DEFAULT_SECOND_LIFE_RENT_MAN = 8;

export function addSecondLifeRentalToHousing(input: {
  housingState: HousingState;
  member: FamilyMember;
  referenceDate: Date;
  startAge: number;
  targetId?: string;
}): HousingState {
  const targetId = input.targetId ?? HOUSEHOLD_HOUSING_KEY;
  const data = getHousingTargetData(input.housingState, targetId);
  const refMonth = input.referenceDate.getMonth() + 1;
  const refYear = input.referenceDate.getFullYear();

  const rental = createRentalProperty(
    input.member,
    refMonth,
    refYear,
    {
      occupancy: 'upcoming',
      name: SECOND_LIFE_RENTAL_NAME,
      startAge: input.startAge,
      startMonth: 1,
      monthlyRentMan: DEFAULT_SECOND_LIFE_RENT_MAN,
      movingCostMan: 5,
      securityDepositMan: 8,
      keyMoneyMan: 8,
      brokerageFeeMan: 4,
    },
    { rentals: data.rentals, owned: data.owned },
  );

  return migrateHousingState({
    ...input.housingState,
    byTarget: {
      ...input.housingState.byTarget,
      [targetId]: {
        ...data,
        rentals: [...data.rentals, rental],
      },
    },
  });
}

export function estimateSecondLifeLivingTemplateMonthlyMan(input: {
  livingState: LivingExpenseState;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  startAge: number;
}): number {
  const current = getPreSecondLifeMonthlyLivingMan({
    livingState: input.livingState,
    familyMembers: input.familyMembers,
    referenceDate: input.referenceDate,
    startAge: input.startAge,
  });
  if (current <= 0) return 30;
  return Math.round(current * 0.7 * 10) / 10;
}

export function addSecondLifeLivingSchedule(input: {
  livingState: LivingExpenseState;
  member: FamilyMember;
  referenceDate: Date;
  startAge: number;
  monthlyMan: number;
  targetId?: string;
}): LivingExpenseState {
  const targetId = input.targetId ?? HOUSEHOLD_LIVING_KEY;
  const refMonth = input.referenceDate.getMonth() + 1;
  const existing = input.livingState.byTarget[targetId] ?? [];

  const schedule = createLivingExpenseSchedule(input.member.age, refMonth, {
    startAge: input.startAge,
    startMonth: 1,
    endMode: 'lifetime',
    endAge: input.member.expectedLifespan,
    endMonth: 12,
    inputMode: 'detail',
    items: [
      createLivingExpenseItem({
        label: SECOND_LIFE_LIVING_LABEL,
        amountMan: input.monthlyMan,
      }),
    ],
  });

  return {
    ...input.livingState,
    byTarget: {
      ...input.livingState.byTarget,
      [targetId]: [...existing, schedule],
    },
  };
}

export function addSecondLifeNursingTemplates(input: {
  lifeEventState: LifeEventState;
  familyMembers: FamilyMember[];
  referenceDate: Date;
}): LifeEventState {
  const secondLifeState = createDefaultSecondLifeState();
  return applySecondLifeNursing(
    input.lifeEventState,
    secondLifeState,
    input.familyMembers,
    input.referenceDate.getMonth() + 1,
  );
}
