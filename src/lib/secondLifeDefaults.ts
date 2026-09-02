import type {
  SecondLifeDesignSnapshot,
  SecondLifeNursingDesign,
  SecondLifeQ3ApplySnapshot,
  SecondLifeState,
} from '../types/secondLife';
import { captureSecondLifeQ3ApplySnapshot } from './secondLifeApplyStatus';



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

    annualCostMan: 50,

    ...overrides,

  };

}



export function createDefaultSecondLifeState(): SecondLifeState {

  return {

    priority: 'must',

    startAge: SECOND_LIFE_DEFAULT_START_AGE,

    housingSkip: false,

    housingScenario: 'stay',

    stayOption: 'renovate',

    hometownOption: 'renovate_parents',

    newAreaOption: 'rent',

    includeMovingCost: false,

    includePostPurchaseRenovation: false,

    livingSkip: false,

    livingLevel: 'seventy_percent',

    nursingByTarget: {

      head: createDefaultSecondLifeNursingDesign(),

      spouse: createDefaultSecondLifeNursingDesign(),

    },

  };

}



function migrateLegacyNursingFields(

  value: Partial<SecondLifeState>,

  defaults: SecondLifeState,

): SecondLifeState['nursingByTarget'] {

  const legacy = value as Partial<SecondLifeState> & {

    nursingSkip?: boolean;

    nursingScenario?: SecondLifeState['nursingByTarget']['head']['scenario'];

    nursingStartAge?: number;

    nursingAnnualCostMan?: number;

  };



  const head = createDefaultSecondLifeNursingDesign({

    skip:

      typeof legacy.nursingSkip === 'boolean'

        ? legacy.nursingSkip

        : defaults.nursingByTarget.head.skip,

    scenario: legacy.nursingScenario ?? defaults.nursingByTarget.head.scenario,

    startAge:

      typeof legacy.nursingStartAge === 'number' &&

      legacy.nursingStartAge >= 60

        ? legacy.nursingStartAge

        : defaults.nursingByTarget.head.startAge,

    annualCostMan:

      typeof legacy.nursingAnnualCostMan === 'number' &&

      legacy.nursingAnnualCostMan >= 0

        ? legacy.nursingAnnualCostMan

        : defaults.nursingByTarget.head.annualCostMan,

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



  return createDefaultSecondLifeNursingDesign({

    skip: typeof value.skip === 'boolean' ? value.skip : fallback.skip,

    scenario: value.scenario ?? fallback.scenario,

    startAge:

      typeof value.startAge === 'number' && value.startAge >= 60

        ? value.startAge

        : fallback.startAge,

    annualCostMan:

      typeof value.annualCostMan === 'number' && value.annualCostMan >= 0

        ? value.annualCostMan

        : fallback.annualCostMan,

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



  return {

    ...defaults,

    ...rest,

    startAge:

      typeof value.startAge === 'number' && value.startAge >= 60

        ? value.startAge

        : defaults.startAge,

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


