import type {
  SecondLifeDesignSnapshot,
  SecondLifeNursingDesign,
  SecondLifeQ3ApplySnapshot,
  SecondLifeState,
} from '../types/secondLife';
import { captureSecondLifeQ3ApplySnapshot } from './secondLifeApplyStatus';
import {
  getDefaultSecondLifeHousingBaseCostMan,
  SECOND_LIFE_DEFAULT_RENT_MAN,
  SECOND_LIFE_MOVING_COST_MAN,
  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,
  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN,
} from './secondLifeHousingFinance';

export const SECOND_LIFE_DEFAULT_START_AGE = 70;
export const SECOND_LIFE_DEFAULT_NURSING_START_AGE = 80;

export const SECOND_LIFE_PRIORITY_OPTIONS: {
  id: SecondLifeState['priority'];
  label: string;
}[] = [
  { id: 'must', label: 'Must' },
  { id: 'want', label: 'Want' },
  { id: 'nice', label: 'Nice' },
];

export function createDefaultSecondLifeNursingDesign(
  overrides: Partial<SecondLifeNursingDesign> = {},
): SecondLifeNursingDesign {
  return {
    skip: false,
    scenario: 'home',
    startAge: SECOND_LIFE_DEFAULT_NURSING_START_AGE,
    initialCostMan: 0,
    monthlyCostMan: 0,
    durationMode: 'lifetime',
    durationYears: null,
    ...overrides,
  };
}

export function createDefaultSecondLifeState(): SecondLifeState {
  return {
    priority: 'must',
    startAge: SECOND_LIFE_DEFAULT_START_AGE,
    housingActionAge: SECOND_LIFE_DEFAULT_START_AGE,
    // 新規プランでは Q5 の原本を優先。ユーザーが「見直す」を選んだ時だけ Q12 を重ねる。
    housingSkip: true,
    housingScenario: 'stay',
    stayOption: 'renovate',
    hometownOption: 'renovate_parents',
    newAreaOption: 'rent',
    includeMovingCost: false,
    movingCostMan: SECOND_LIFE_MOVING_COST_MAN,
    includePostPurchaseRenovation: false,
    postPurchaseRenovationCostMan: SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,
    renovationScope: 'repair_equipment',
    housingBaseCostMan: SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN,
    housingRentMonthlyMan: SECOND_LIFE_DEFAULT_RENT_MAN,
    // 支払い方法は未定を初期値にし、勝手にローンを作らない。
    housingPaymentMethod: 'undecided',
    housingLoanDownPaymentMan: 0,
    housingLoanInterestRatePct: null,
    housingLoanYears: null,
    // 生活費も同様に、明示的に見直すまでは Q4 の原本を使う。
    livingSkip: true,
    livingLevel: 'same',
    nursingByTarget: {
      head: createDefaultSecondLifeNursingDesign(),
      spouse: createDefaultSecondLifeNursingDesign(),
    },
  };
}

function normalizeNursingScenario(value: unknown): SecondLifeNursingDesign['scenario'] {
  if (
    value === 'home' ||
    value === 'day_service' ||
    value === 'special_nursing_home' ||
    value === 'paid_care' ||
    value === 'paid_residential' ||
    value === 'serviced_elderly' ||
    value === 'group_home' ||
    value === 'other'
  ) {
    return value;
  }
  // 旧「施設介護」は施設種別を特定できないため「その他」へ移行する。
  if (value === 'facility') return 'other';
  return 'home';
}

function migrateLegacyNursingFields(
  value: Partial<SecondLifeState>,
  defaults: SecondLifeState,
): SecondLifeState['nursingByTarget'] {
  const legacy = value as Partial<SecondLifeState> & {
    nursingSkip?: boolean;
    nursingScenario?: unknown;
    nursingStartAge?: number;
    nursingAnnualCostMan?: number;
  };

  const annual =
    typeof legacy.nursingAnnualCostMan === 'number' && legacy.nursingAnnualCostMan >= 0
      ? legacy.nursingAnnualCostMan
      : 0;

  const head = createDefaultSecondLifeNursingDesign({
    skip:
      typeof legacy.nursingSkip === 'boolean'
        ? legacy.nursingSkip
        : defaults.nursingByTarget.head.skip,
    scenario: normalizeNursingScenario(legacy.nursingScenario),
    startAge:
      typeof legacy.nursingStartAge === 'number' && legacy.nursingStartAge >= 60
        ? legacy.nursingStartAge
        : defaults.nursingByTarget.head.startAge,
    monthlyCostMan: Math.round((annual / 12) * 100) / 100,
  });

  return {
    head,
    spouse: defaults.nursingByTarget.spouse,
  };
}

function migrateNursingDesign(
  value: Partial<SecondLifeNursingDesign> | undefined,
  fallback: SecondLifeNursingDesign,
): SecondLifeNursingDesign {
  if (!value) return fallback;

  const legacy = value as Partial<SecondLifeNursingDesign> & {
    annualCostMan?: number;
    scenario?: unknown;
  };
  const legacyAnnual =
    typeof legacy.annualCostMan === 'number' && legacy.annualCostMan >= 0
      ? legacy.annualCostMan
      : null;
  const monthlyCostMan =
    typeof value.monthlyCostMan === 'number' && value.monthlyCostMan >= 0
      ? value.monthlyCostMan
      : legacyAnnual != null
        ? Math.round((legacyAnnual / 12) * 100) / 100
        : fallback.monthlyCostMan;

  return createDefaultSecondLifeNursingDesign({
    skip: typeof value.skip === 'boolean' ? value.skip : fallback.skip,
    scenario: normalizeNursingScenario(legacy.scenario),
    startAge:
      typeof value.startAge === 'number' && value.startAge >= 60
        ? value.startAge
        : fallback.startAge,
    initialCostMan:
      typeof value.initialCostMan === 'number' && value.initialCostMan >= 0
        ? value.initialCostMan
        : fallback.initialCostMan,
    monthlyCostMan,
    durationMode: value.durationMode === 'years' ? 'years' : 'lifetime',
    durationYears:
      value.durationMode === 'years' &&
      typeof value.durationYears === 'number' &&
      value.durationYears > 0
        ? Math.min(50, Math.max(1, Math.round(value.durationYears)))
        : null,
  });
}

export function migrateSecondLifeState(
  value: Partial<SecondLifeState> | undefined,
): SecondLifeState {
  const defaults = createDefaultSecondLifeState();
  if (!value) return defaults;

  const nursingByTarget = value.nursingByTarget
    ? {
        head: migrateNursingDesign(
          value.nursingByTarget.head,
          defaults.nursingByTarget.head,
        ),
        spouse: migrateNursingDesign(
          value.nursingByTarget.spouse,
          defaults.nursingByTarget.spouse,
        ),
      }
    : migrateLegacyNursingFields(value, defaults);

  const legacyValue = value as Partial<SecondLifeState> & {
    lastAppliedSnapshot?: Partial<SecondLifeDesignSnapshot> | null;
  };

  const {
    lastAppliedSnapshot: _legacySnapshot,
    lastAppliedQ3Snapshot: _ignoredQ3Snapshot,
    ...rest
  } = legacyValue;

  const startAge =
    typeof value.startAge === 'number' && value.startAge >= 60
      ? value.startAge
      : defaults.startAge;

  const housingActionAge =
    typeof value.housingActionAge === 'number' && value.housingActionAge >= startAge
      ? value.housingActionAge
      : startAge;

  const housingSkip =
    typeof value.housingSkip === 'boolean'
      ? value.housingSkip
      : defaults.housingSkip;
  const livingSkip =
    typeof value.livingSkip === 'boolean'
      ? value.livingSkip
      : defaults.livingSkip;

  const housingScenario = value.housingScenario ?? defaults.housingScenario;
  const hometownOption = value.hometownOption ?? defaults.hometownOption;
  const newAreaOption = value.newAreaOption ?? defaults.newAreaOption;

  const storedStayOption = value.stayOption ?? defaults.stayOption;
  const stayOption =
    !housingSkip && storedStayOption === 'continue'
      ? 'renovate'
      : storedStayOption;

  const renovationScope =
    value.renovationScope === 'repair_equipment' ||
    value.renovationScope === 'partial_room' ||
    value.renovationScope === 'performance' ||
    value.renovationScope === 'full'
      ? value.renovationScope
      : defaults.renovationScope;

  const movingCostMan =
    typeof value.movingCostMan === 'number' && value.movingCostMan >= 0
      ? value.movingCostMan
      : defaults.movingCostMan;
  const postPurchaseRenovationCostMan =
    typeof value.postPurchaseRenovationCostMan === 'number' &&
    value.postPurchaseRenovationCostMan >= 0
      ? value.postPurchaseRenovationCostMan
      : defaults.postPurchaseRenovationCostMan;

  const housingBaseCostMan =
    typeof value.housingBaseCostMan === 'number' && value.housingBaseCostMan >= 0
      ? value.housingBaseCostMan
      : getDefaultSecondLifeHousingBaseCostMan({
          housingScenario,
          stayOption,
          hometownOption,
          newAreaOption,
          renovationScope,
        });
  const housingRentMonthlyMan =
    typeof value.housingRentMonthlyMan === 'number' && value.housingRentMonthlyMan >= 0
      ? value.housingRentMonthlyMan
      : defaults.housingRentMonthlyMan;
  const housingPaymentMethod =
    value.housingPaymentMethod === 'cash' ||
    value.housingPaymentMethod === 'loan' ||
    value.housingPaymentMethod === 'undecided'
      ? value.housingPaymentMethod
      : defaults.housingPaymentMethod;
  const housingLoanDownPaymentMan = Math.min(
    housingBaseCostMan,
    typeof value.housingLoanDownPaymentMan === 'number' &&
      value.housingLoanDownPaymentMan >= 0
      ? value.housingLoanDownPaymentMan
      : defaults.housingLoanDownPaymentMan,
  );
  const housingLoanInterestRatePct =
    typeof value.housingLoanInterestRatePct === 'number' &&
    value.housingLoanInterestRatePct >= 0
      ? value.housingLoanInterestRatePct
      : null;
  const housingLoanYears =
    typeof value.housingLoanYears === 'number' && value.housingLoanYears > 0
      ? Math.min(50, Math.max(1, Math.round(value.housingLoanYears)))
      : null;

  return {
    ...defaults,
    ...rest,
    startAge,
    housingActionAge,
    housingSkip,
    housingScenario,
    hometownOption,
    newAreaOption,
    livingSkip,
    stayOption,
    renovationScope,
    movingCostMan,
    postPurchaseRenovationCostMan,
    housingBaseCostMan,
    housingRentMonthlyMan,
    housingPaymentMethod,
    housingLoanDownPaymentMan,
    housingLoanInterestRatePct,
    housingLoanYears,
    nursingByTarget,
    lastAppliedQ3Snapshot: migrateLastAppliedQ3Snapshot(
      _ignoredQ3Snapshot,
      legacyValue,
      defaults,
    ),
  };
}

function migrateLastAppliedQ3Snapshot(
  snapshot: Partial<SecondLifeQ3ApplySnapshot> | null | undefined,
  value: Partial<SecondLifeState> & {
    lastAppliedSnapshot?: Partial<SecondLifeDesignSnapshot> | null;
  },
  defaults: SecondLifeState,
): SecondLifeQ3ApplySnapshot | null {
  if (snapshot) {
    return captureSecondLifeQ3ApplySnapshot(
      migrateSecondLifeState({
        ...defaults,
        ...snapshot,
        lastAppliedQ3Snapshot: null,
      }),
    );
  }

  const legacy = value.lastAppliedSnapshot;
  if (!legacy) return null;

  return captureSecondLifeQ3ApplySnapshot(
    migrateSecondLifeState({
      ...defaults,
      ...legacy,
      lastAppliedQ3Snapshot: null,
    }),
  );
}
