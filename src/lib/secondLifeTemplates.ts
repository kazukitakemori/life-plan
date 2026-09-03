import {
  applySecondLifeHousing,
  applySecondLifeLiving,
  applySecondLifeNursing,
} from './secondLifeApply';
import { createDefaultSecondLifeState } from './secondLifeDefaults';
import {
  createOwnedProperty,
  createRentalProperty,
  getHousingTargetData,
  migrateHousingState,
} from './housingDefaults';
import type { FamilyMember } from '../types/family';
import {
  HOUSEHOLD_HOUSING_KEY,
  type HousingState,
  type OwnedProperty,
  type RentalProperty,
} from '../types/housing';
import type { IncomeByMember } from '../types/income';
import type { LifeEventState } from '../types/lifeEvent';
import type { LivingExpenseState } from '../types/living';
import type { PensionByMember } from '../types/pension';
import type { SecondLifeState } from '../types/secondLife';
import { getSecondLifeHousingTemplateKind } from './secondLifeLabels';

export const SECOND_LIFE_RENTAL_NAME = 'セカンドライフ賃貸';
export const SECOND_LIFE_OWNED_NAME = 'セカンドライフ購入住宅';
export const SECOND_LIFE_LIVING_LABEL = 'セカンドライフ生活費';

const DEFAULT_SECOND_LIFE_RENT_MAN = 8;
const PURCHASE_BUILDING_MAN = 2_000;
const PURCHASE_LAND_MAN = 500;

function monthBefore(age: number, month: number): { age: number; month: number } {
  if (month > 1) return { age, month: month - 1 };
  return { age: Math.max(0, age - 1), month: 12 };
}

function isSecondLifeHousingItem(name: string): boolean {
  return name === SECOND_LIFE_RENTAL_NAME || name === SECOND_LIFE_OWNED_NAME;
}

function endExistingHousingBeforeStartAge<
  T extends {
    name: string;
    startAge: number;
    endMode: 'lifetime' | 'until';
    endAge: number;
    endMonth: number;
  },
>(items: T[], startAge: number): T[] {
  const end = monthBefore(startAge, 1);
  return items.map((item) => {
    if (isSecondLifeHousingItem(item.name)) return item;
    if (item.startAge >= startAge) return item;
    if (item.endMode === 'until' && item.endAge < startAge) return item;
    return {
      ...item,
      endMode: 'until' as const,
      endAge: end.age,
      endMonth: end.month,
    };
  });
}

function resolveMonthlyRentMan(
  rentals: RentalProperty[],
  startAge: number,
): number {
  const prior = rentals.find(
    (rental) =>
      !isSecondLifeHousingItem(rental.name) &&
      rental.monthlyRentMan > 0 &&
      rental.startAge < startAge,
  );
  return prior?.monthlyRentMan || DEFAULT_SECOND_LIFE_RENT_MAN;
}

function stripSecondLifeHousingItems(data: {
  rentals: RentalProperty[];
  owned: OwnedProperty[];
}): { rentals: RentalProperty[]; owned: OwnedProperty[] } {
  return {
    rentals: data.rentals.filter(
      (rental) => !isSecondLifeHousingItem(rental.name),
    ),
    owned: data.owned.filter((property) => !isSecondLifeHousingItem(property.name)),
  };
}

/**
 * Q12/Q5 の住まい設計を Q5 住まい入力へ反映する。
 * - 賃貸: 月額家賃付きの入居予定賃貸を登録
 * - 購入: 所有物件（建物・土地の目安額）を登録
 * - リフォームのみ: Q5物件は追加せず、一時金は Q3 側で扱う
 * - 転居（地元・新土地）: 既存住まいを開始年齢の直前で終了
 */
export function applySecondLifeHousingToHousingState(input: {
  housingState: HousingState;
  secondLifeState: SecondLifeState;
  member: FamilyMember;
  referenceDate: Date;
  targetId?: string;
}): HousingState {
  const targetId = input.targetId ?? HOUSEHOLD_HOUSING_KEY;
  const data = getHousingTargetData(input.housingState, targetId);
  const stripped = stripSecondLifeHousingItems(data);
  const startAge = input.secondLifeState.startAge;
  const kind = getSecondLifeHousingTemplateKind(input.secondLifeState);
  const relocating =
    !input.secondLifeState.housingSkip &&
    (input.secondLifeState.housingScenario === 'hometown' ||
      input.secondLifeState.housingScenario === 'new_area');

  let rentals = relocating
    ? endExistingHousingBeforeStartAge(stripped.rentals, startAge)
    : stripped.rentals;
  let owned = relocating
    ? endExistingHousingBeforeStartAge(stripped.owned, startAge)
    : stripped.owned;

  if (kind === 'skip' || kind === 'renovate') {
    return migrateHousingState({
      ...input.housingState,
      byTarget: {
        ...input.housingState.byTarget,
        [targetId]: { ...data, rentals, owned },
      },
    });
  }

  const refMonth = input.referenceDate.getMonth() + 1;
  const refYear = input.referenceDate.getFullYear();
  const includeMoving =
    input.secondLifeState.includeMovingCost ||
    input.secondLifeState.housingScenario === 'hometown' ||
    input.secondLifeState.housingScenario === 'new_area';

  if (kind === 'rent') {
    const monthlyRentMan = resolveMonthlyRentMan(stripped.rentals, startAge);
    const rental = createRentalProperty(
      input.member,
      refMonth,
      refYear,
      {
        occupancy: 'upcoming',
        name: SECOND_LIFE_RENTAL_NAME,
        startAge,
        startMonth: 1,
        monthlyRentMan,
        movingCostMan: includeMoving ? 50 : 0,
        securityDepositMan: monthlyRentMan,
        keyMoneyMan: monthlyRentMan,
        brokerageFeeMan: Math.round(monthlyRentMan * 0.5 * 10) / 10,
        securityDepositRefundMan: monthlyRentMan,
      },
      { rentals, owned },
    );
    rentals = [...rentals, rental];
  }

  if (kind === 'purchase') {
    const property = createOwnedProperty(
      'detached_house',
      input.member,
      refMonth,
      refYear,
      {
        usage: 'upcoming',
        name: SECOND_LIFE_OWNED_NAME,
        startAge,
        startMonth: 1,
        buildingMan: PURCHASE_BUILDING_MAN,
        landMan: PURCHASE_LAND_MAN,
        paymentMethod: 'loan',
        brokerageFeeMan: includeMoving ? 50 : 0,
      },
      { rentals, owned },
    );
    owned = [...owned, property];
  }

  return migrateHousingState({
    ...input.housingState,
    byTarget: {
      ...input.housingState.byTarget,
      [targetId]: { ...data, rentals, owned },
    },
  });
}

/** リフォーム等、Q5に載らない一時金だけを Q3 へ反映 */
export function applySecondLifeHousingOneTimeToLifeEvent(input: {
  lifeEventState: LifeEventState;
  secondLifeState: SecondLifeState;
  familyMembers: FamilyMember[];
  referenceDate: Date;
}): LifeEventState {
  const head = input.familyMembers.find((member) => member.role === 'head');
  const kind = getSecondLifeHousingTemplateKind(input.secondLifeState);

  // 賃貸・購入は Q5 で本体を持つので、一時金イベントはリフォーム系のみ
  if (kind === 'rent' || kind === 'purchase' || kind === 'skip') {
    return applySecondLifeHousing(
      input.lifeEventState,
      { ...input.secondLifeState, housingSkip: true },
      head,
      input.referenceDate.getMonth() + 1,
    );
  }

  return applySecondLifeHousing(
    input.lifeEventState,
    input.secondLifeState,
    head,
    input.referenceDate.getMonth() + 1,
  );
}

export function applySecondLifeLivingDesign(input: {
  livingState: LivingExpenseState;
  secondLifeState: SecondLifeState;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
}): LivingExpenseState {
  return applySecondLifeLiving(input.livingState, input.secondLifeState, {
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    pensionByMember: input.pensionByMember,
    referenceDate: input.referenceDate,
  });
}

export function addSecondLifeNursingTemplates(input: {
  lifeEventState: LifeEventState;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  secondLifeState?: SecondLifeState;
}): LifeEventState {
  const secondLifeState =
    input.secondLifeState ?? createDefaultSecondLifeState();
  return applySecondLifeNursing(
    input.lifeEventState,
    secondLifeState,
    input.familyMembers,
    input.referenceDate.getMonth() + 1,
  );
}
