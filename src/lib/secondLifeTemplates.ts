import {
  applySecondLifeHousing,
  applySecondLifeLiving,
  applySecondLifeNursing,
  SECOND_LIFE_HOUSING_EVENT_LABEL,
} from './secondLifeApply';
import { calcBirthYear, calcYearAtAge } from './birthDate';
import { createDefaultSecondLifeState } from './secondLifeDefaults';
import {
  createOwnedImprovementEntry,
  createOwnedProperty,
  createRentalProperty,
  getHousingTargetData,
  migrateHousingState,
} from './housingDefaults';
import { estimateSecondLifeHousingTotalMan } from './secondLifeEstimates';
import {
  buildSecondLifeHousingFinancePlan,
  getSecondLifeHousingCashPaymentMan,
  SECOND_LIFE_MOVING_COST_MAN,
  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,
} from './secondLifeHousingFinance';
import { formatSecondLifeHousingApplyChangeLines } from './secondLifeHousingApplySummary';
import type { FamilyMember } from '../types/family';
import type {
  HousingState,
  OwnedProperty,
  RentalProperty,
} from '../types/housing';
import type { IncomeByMember } from '../types/income';
import type { LifeEventState } from '../types/lifeEvent';
import type { LivingExpenseState } from '../types/living';
import type { PensionByMember } from '../types/pension';
import type { SecondLifeState } from '../types/secondLife';
import type { SecondLifeHousingApplyChange } from '../types/secondLifeHousingApply';
import {
  getSecondLifeHousingTemplateKind,
  type SecondLifeHousingTemplateKind,
} from './secondLifeLabels';

export const SECOND_LIFE_RENTAL_NAME = 'セカンドライフ賃貸';
export const SECOND_LIFE_OWNED_NAME = 'セカンドライフ購入住宅';
export const SECOND_LIFE_HOMETOWN_HOME_NAME = 'セカンドライフ実家';
export const SECOND_LIFE_LIVING_LABEL = 'セカンドライフ生活費';

const SECOND_LIFE_IMPROVEMENT_ID = 'second-life-renovation';

const SECOND_LIFE_POST_PURCHASE_IMPROVEMENT_ID = 'second-life-post-purchase-renovation';

export type SecondLifeHousingApplyResult = {
  housingState: HousingState;
  lifeEventState: LifeEventState;
  kind: SecondLifeHousingTemplateKind;
  relocating: boolean;
  changes: SecondLifeHousingApplyChange[];
  /** Phase 2+ UI 用。`formatSecondLifeHousingApplyChangeLines(changes)` と同じ */
  changeLines: string[];
};

function monthBefore(age: number, month: number): { age: number; month: number } {
  if (month > 1) return { age, month: month - 1 };
  return { age: Math.max(0, age - 1), month: 12 };
}

function isSecondLifeHousingItem(name: string): boolean {
  return (
    name === SECOND_LIFE_RENTAL_NAME ||
    name === SECOND_LIFE_OWNED_NAME ||
    name === SECOND_LIFE_HOMETOWN_HOME_NAME
  );
}


function restoreSecondLifeManagedEnds<
  T extends {
    endMode: 'lifetime' | 'until';
    endAge: number;
    endMonth: number;
    secondLifeEndOverride?: {
      endMode: 'lifetime' | 'until';
      endAge: number;
      endMonth: number;
    };
  },
>(items: T[]): T[] {
  return items.map((item) => {
    const original = item.secondLifeEndOverride;
    if (!original) return item;
    return {
      ...item,
      endMode: original.endMode,
      endAge: original.endAge,
      endMonth: original.endMonth,
      secondLifeEndOverride: undefined,
    };
  });
}

function endExistingHousingBeforeStartAge<
  T extends {
    id: string;
    name: string;
    startAge: number;
    endMode: 'lifetime' | 'until';
    endAge: number;
    endMonth: number;
    secondLifeEndOverride?: {
      endMode: 'lifetime' | 'until';
      endAge: number;
      endMonth: number;
    };
  },
>(
  items: T[],
  startAge: number,
  propertyKind: 'rental' | 'owned',
): { items: T[]; ended: SecondLifeHousingApplyChange[] } {
  const end = monthBefore(startAge, 1);
  const ended: SecondLifeHousingApplyChange[] = [];
  const next = items.map((item) => {
    if (isSecondLifeHousingItem(item.name)) return item;
    if (item.startAge >= startAge) return item;
    if (item.endMode === 'until' && item.endAge < startAge) return item;
    ended.push({
      type: 'ended',
      propertyKind,
      id: item.id,
      name: item.name,
      endAge: end.age,
      endMonth: end.month,
    });
    return {
      ...item,
      secondLifeEndOverride: item.secondLifeEndOverride ?? {
        endMode: item.endMode,
        endAge: item.endAge,
        endMonth: item.endMonth,
      },
      endMode: 'until' as const,
      endAge: end.age,
      endMonth: end.month,
    };
  });
  return { items: next, ended };
}

function stripSecondLifeHousingItems(data: {
  rentals: RentalProperty[];
  owned: OwnedProperty[];
}): {
  rentals: RentalProperty[];
  owned: OwnedProperty[];
  cleared: SecondLifeHousingApplyChange[];
} {
  const cleared: SecondLifeHousingApplyChange[] = [];
  const rentals = data.rentals.filter((rental) => {
    if (!isSecondLifeHousingItem(rental.name)) return true;
    cleared.push({
      type: 'cleared',
      propertyKind: 'rental',
      id: rental.id,
      name: rental.name,
    });
    return false;
  });
  const owned = data.owned
    .filter((property) => {
      if (!isSecondLifeHousingItem(property.name)) return true;
      cleared.push({
        type: 'cleared',
        propertyKind: 'owned',
        id: property.id,
        name: property.name,
      });
      return false;
    })
    .map((property) => ({
      ...property,
      maintenance: {
        ...property.maintenance,
        improvements: property.maintenance.improvements.filter(
          (entry) =>
            entry.id !== SECOND_LIFE_IMPROVEMENT_ID &&
            entry.id !== SECOND_LIFE_POST_PURCHASE_IMPROVEMENT_ID,
        ),
      },
    }));
  return { rentals, owned, cleared };
}

type HousingApplyMutation = {
  housingState: HousingState;
  kind: SecondLifeHousingTemplateKind;
  relocating: boolean;
  renovationAppliedToHousing: boolean;
  changes: SecondLifeHousingApplyChange[];
};

/**
 * Q12 の住まい設計を Q5 住まい入力へ反映する（変更インベントリ付き）。
 */
export function applySecondLifeHousingToHousingStateWithChanges(input: {
  housingState: HousingState;
  secondLifeState: SecondLifeState;
  member: FamilyMember;
  referenceDate: Date;
  targetId?: string;
}): HousingApplyMutation {
  const targetId = input.targetId ?? input.member.id;
  const data = getHousingTargetData(input.housingState, targetId);
  const stripped = stripSecondLifeHousingItems(data);
  const startAge = input.secondLifeState.housingActionAge;
  const kind = getSecondLifeHousingTemplateKind(input.secondLifeState);
  const relocating =
    !input.secondLifeState.housingSkip &&
    (input.secondLifeState.housingScenario === 'hometown' ||
      input.secondLifeState.housingScenario === 'new_area');

  const changes: SecondLifeHousingApplyChange[] = [...stripped.cleared];

  // 前回の Q12 反映で終了時期を動かしていた場合は、まず元の条件へ戻す。
  // そのうえで今回の最新シナリオを適用することで、転居→住み続ける等の変更でも
  // Q5 に古い終了境界を残さない。
  let rentals = restoreSecondLifeManagedEnds(stripped.rentals);
  let owned = restoreSecondLifeManagedEnds(stripped.owned);

  if (relocating) {
    const endedRentals = endExistingHousingBeforeStartAge(
      rentals,
      startAge,
      'rental',
    );
    const endedOwned = endExistingHousingBeforeStartAge(
      owned,
      startAge,
      'owned',
    );
    rentals = endedRentals.items;
    owned = endedOwned.items;
    changes.push(...endedRentals.ended, ...endedOwned.ended);
  }

  if (kind === 'skip' || kind === 'stay') {
    return {
      housingState: migrateHousingState({
        ...input.housingState,
        byTarget: {
          ...input.housingState.byTarget,
          [targetId]: { ...data, rentals, owned },
        },
      }),
      kind,
      relocating,
      renovationAppliedToHousing: false,
      changes,
    };
  }

  const refMonth = input.referenceDate.getMonth() + 1;
  const refYear = input.referenceDate.getFullYear();

  if (kind === 'renovate') {
    const amountMan =
      getSecondLifeHousingCashPaymentMan(input.secondLifeState) +
      (input.secondLifeState.includeMovingCost
        ? SECOND_LIFE_MOVING_COST_MAN
        : 0);
    const birthYear = calcBirthYear(
      input.member.age,
      input.member.birthMonth,
      input.referenceDate,
    );
    const renovationYear = calcYearAtAge(
      birthYear,
      input.member.birthMonth ?? 1,
      startAge,
      1,
    );
    const improvement = () =>
      createOwnedImprovementEntry(renovationYear, 1, {
        id: SECOND_LIFE_IMPROVEMENT_ID,
        amountMan,
      });
    let renovationAppliedToHousing = false;

    if (
      input.secondLifeState.housingScenario === 'hometown' &&
      input.secondLifeState.hometownOption === 'renovate_parents'
    ) {
      let property = createOwnedProperty(
        'detached_house',
        input.member,
        refMonth,
        refYear,
        {
          usage: 'upcoming',
          name: SECOND_LIFE_HOMETOWN_HOME_NAME,
          startAge,
          startMonth: 1,
          buildingMan: 0,
          landMan: 0,
          paymentMethod: 'cash',
          currentExpenseMode: 'simple',
          simpleMonthlyExpenseMan: 0,
          secondLifeFinancePlan: buildSecondLifeHousingFinancePlan(
            input.secondLifeState,
            'renovation',
            startAge,
          ),
        },
        { rentals, owned },
      );
      property = {
        ...property,
        maintenance: {
          ...property.maintenance,
          improvements: [improvement()],
        },
      };
      owned = [...owned, property];
      renovationAppliedToHousing = true;
      changes.push(
        {
          type: 'added',
          propertyKind: 'owned',
          id: property.id,
          name: property.name,
          buildingMan: 0,
          landMan: 0,
        },
        {
          type: 'improvement',
          propertyId: property.id,
          propertyName: property.name,
          amountMan,
          year: renovationYear,
          month: 1,
        },
      );
    } else {
      const propertyIndex = owned.findIndex(
        (property) =>
          property.startAge <= startAge &&
          (property.endMode === 'lifetime' || property.endAge >= startAge),
      );
      if (propertyIndex >= 0) {
        const property = owned[propertyIndex];
        const updated = {
          ...property,
          secondLifeFinancePlan: buildSecondLifeHousingFinancePlan(
            input.secondLifeState,
            'renovation',
            startAge,
          ),
          maintenance: {
            ...property.maintenance,
            improvements: [
              ...property.maintenance.improvements,
              improvement(),
            ],
          },
        };
        owned = owned.map((item, index) =>
          index === propertyIndex ? updated : item,
        );
        renovationAppliedToHousing = true;
        changes.push({
          type: 'improvement',
          propertyId: updated.id,
          propertyName: updated.name,
          amountMan,
          year: renovationYear,
          month: 1,
        });
      }
    }

    return {
      housingState: migrateHousingState({
        ...input.housingState,
        byTarget: {
          ...input.housingState.byTarget,
          [targetId]: { ...data, rentals, owned },
        },
      }),
      kind,
      relocating,
      renovationAppliedToHousing,
      changes,
    };
  }
  const includeMoving = input.secondLifeState.includeMovingCost;

  if (kind === 'rent') {
    const monthlyRentMan = Math.max(0, input.secondLifeState.housingRentMonthlyMan);
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
        movingCostMan: includeMoving ? SECOND_LIFE_MOVING_COST_MAN : 0,
        securityDepositMan: monthlyRentMan,
        keyMoneyMan: monthlyRentMan,
        brokerageFeeMan: Math.round(monthlyRentMan * 0.5 * 10) / 10,
        securityDepositRefundMan: monthlyRentMan,
      },
      { rentals, owned },
    );
    rentals = [...rentals, rental];
    changes.push({
      type: 'added',
      propertyKind: 'rental',
      id: rental.id,
      name: rental.name,
      monthlyRentMan: rental.monthlyRentMan,
    });
  }

  if (kind === 'purchase') {
    let property = createOwnedProperty(
      'detached_house',
      input.member,
      refMonth,
      refYear,
      {
        usage: 'upcoming',
        name: SECOND_LIFE_OWNED_NAME,
        startAge,
        startMonth: 1,
        // Q12では土地・建物の内訳を仮定せず、住まい本体の目安額を建物側に集約する。
        buildingMan: Math.max(0, input.secondLifeState.housingBaseCostMan),
        landMan: 0,
        // 標準Q5ローンを自動作成せず、Q12専用の明示条件で計算する。
        paymentMethod: 'cash',
        brokerageFeeMan: 0,
        secondLifeFinancePlan: buildSecondLifeHousingFinancePlan(
          input.secondLifeState,
          'purchase',
          startAge,
        ),
        secondLifeInitialCashCostMan: includeMoving
          ? SECOND_LIFE_MOVING_COST_MAN
          : 0,
      },
      { rentals, owned },
    );
    if (input.secondLifeState.includePostPurchaseRenovation) {
      const birthYear = calcBirthYear(
        input.member.age,
        input.member.birthMonth,
        input.referenceDate,
      );
      const improvementYear = calcYearAtAge(
        birthYear,
        input.member.birthMonth ?? 1,
        startAge,
        1,
      );
      property = {
        ...property,
        maintenance: {
          ...property.maintenance,
          improvements: [
            ...property.maintenance.improvements,
            createOwnedImprovementEntry(improvementYear, 1, {
              id: SECOND_LIFE_POST_PURCHASE_IMPROVEMENT_ID,
              amountMan: SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,
            }),
          ],
        },
      };
    }
    owned = [...owned, property];
    changes.push({
      type: 'added',
      propertyKind: 'owned',
      id: property.id,
      name: property.name,
      buildingMan: property.buildingMan,
      landMan: property.landMan,
    });
  }

  return {
    housingState: migrateHousingState({
      ...input.housingState,
      byTarget: {
        ...input.housingState.byTarget,
        [targetId]: { ...data, rentals, owned },
      },
    }),
    kind,
    relocating,
    renovationAppliedToHousing: false,
    changes,
  };
}

/**
 * Q12 の住まい設計を Q5 住まい入力へ反映する。
 * - 賃貸: 月額家賃付きの入居予定賃貸を登録
 * - 購入: 所有物件（建物・土地の目安額）を登録
 * - リフォーム: 原則として Q5 の持ち家改良費へ反映
 * - 転居（地元・新土地）: 既存住まいを開始年齢の直前で終了
 */
export function applySecondLifeHousingToHousingState(input: {
  housingState: HousingState;
  secondLifeState: SecondLifeState;
  member: FamilyMember;
  referenceDate: Date;
  targetId?: string;
}): HousingState {
  return applySecondLifeHousingToHousingStateWithChanges(input).housingState;
}

/** 旧バージョンで作成された住まい連動ライフイベントを除去する互換処理 */
export function applySecondLifeHousingOneTimeToLifeEvent(input: {
  lifeEventState: LifeEventState;
  secondLifeState: SecondLifeState;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  renovationAppliedToHousing?: boolean;
}): LifeEventState {
  const head = input.familyMembers.find((member) => member.role === 'head');
  const kind = getSecondLifeHousingTemplateKind(input.secondLifeState);

  // 住まい側に反映できた内容は Q3 に複製しない。旧連動イベントがあれば削除する。
  if (
    kind === 'rent' ||
    kind === 'purchase' ||
    kind === 'skip' ||
    input.renovationAppliedToHousing
  ) {
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

function lifeEventChangesForHousingApply(input: {
  after: LifeEventState;
  secondLifeState: SecondLifeState;
  familyMembers: FamilyMember[];
}): SecondLifeHousingApplyChange[] {
  const kind = getSecondLifeHousingTemplateKind(input.secondLifeState);
  if (kind !== 'renovate') return [];

  const head = input.familyMembers.find((member) => member.role === 'head');
  if (!head) return [];

  const amountMan =
    estimateSecondLifeHousingTotalMan(input.secondLifeState) ?? 0;
  const afterEntries = input.after.byMember[head.id] ?? [];
  const hasEvent = afterEntries.some(
    (entry) => entry.label === SECOND_LIFE_HOUSING_EVENT_LABEL,
  );
  if (!hasEvent) return [];

  return [
    {
      type: 'life_event',
      action: 'upserted',
      label: SECOND_LIFE_HOUSING_EVENT_LABEL,
      amountMan,
      startAge: input.secondLifeState.startAge,
    },
  ];
}

/**
 * 住まい設計の一括反映。住まい費用の本体は Q5 / housingState のみ。
 * Phase 2 以降は `changeLines` / `changes` を UI に出す。
 */
export function applySecondLifeHousingDesign(input: {
  housingState: HousingState;
  lifeEventState: LifeEventState;
  secondLifeState: SecondLifeState;
  member: FamilyMember;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  targetId?: string;
}): SecondLifeHousingApplyResult {
  const housingMutation = applySecondLifeHousingToHousingStateWithChanges({
    housingState: input.housingState,
    secondLifeState: input.secondLifeState,
    member: input.member,
    referenceDate: input.referenceDate,
    targetId: input.targetId,
  });

  const nextLifeEvent = applySecondLifeHousingOneTimeToLifeEvent({
    lifeEventState: input.lifeEventState,
    secondLifeState: input.secondLifeState,
    familyMembers: input.familyMembers,
    referenceDate: input.referenceDate,
    renovationAppliedToHousing: housingMutation.renovationAppliedToHousing,
  });

  const changes: SecondLifeHousingApplyChange[] = [
    ...housingMutation.changes,
    ...lifeEventChangesForHousingApply({
      after: nextLifeEvent,
      secondLifeState: input.secondLifeState,
      familyMembers: input.familyMembers,
    }),
  ];

  return {
    housingState: housingMutation.housingState,
    lifeEventState: nextLifeEvent,
    kind: housingMutation.kind,
    relocating: housingMutation.relocating,
    changes,
    changeLines: formatSecondLifeHousingApplyChangeLines(changes),
  };
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
