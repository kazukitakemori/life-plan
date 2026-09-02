import {

  createLifeEventEntry,

  createLifeEventEntryFromPreset,

} from './lifeEventDefaults';

import {

  createLivingExpenseItem,

  createLivingExpenseSchedule,

  getLivingScheduleBillableItems,

  syncLivingDetailSummary,

} from './livingDefaults';

import {

  buildSecondLifeLivingOptions,

  estimateSecondLifeHousingTotalMan,

  getDefaultNursingAnnualCostMan,

  getMemberAgeWhenHeadReachesAge,

} from './secondLifeEstimates';

import {

  collectLivingTargetIds,

  resolveLivingTargetMember,

} from './secondLifeLivingTotal';

import type { FamilyMember } from '../types/family';

import type { IncomeByMember } from '../types/income';

import type { LifeEventState } from '../types/lifeEvent';

import {

  HOUSEHOLD_LIVING_KEY,

  type LivingExpenseSchedule,

  type LivingExpenseState,

} from '../types/living';

import type { PensionByMember } from '../types/pension';

import type {

  SecondLifeNursingDesign,

  SecondLifeNursingTarget,

  SecondLifeState,

} from '../types/secondLife';



const SECOND_LIFE_HOUSING_EVENT_LABEL = 'セカンドライフ住まい';

const SECOND_LIFE_NURSING_EVENT_LABEL = 'セカンドライフ介護';



const NURSING_TARGETS: {

  key: SecondLifeNursingTarget;

  role: FamilyMember['role'];

}[] = [

  { key: 'head', role: 'head' },

  { key: 'spouse', role: 'spouse' },

];



function createId(): string {

  return crypto.randomUUID();

}



function monthBefore(age: number, month: number): { age: number; month: number } {

  if (month > 1) {

    return { age, month: month - 1 };

  }

  return { age: Math.max(0, age - 1), month: 12 };

}



function splitSchedulesAtAge(

  schedules: LivingExpenseSchedule[],

  startAge: number,

): LivingExpenseSchedule[] {

  const result: LivingExpenseSchedule[] = [];



  for (const schedule of schedules) {

    const scheduleEndsBefore =

      schedule.endMode === 'until' && schedule.endAge < startAge;

    const scheduleStartsAfter = schedule.startAge > startAge;



    if (scheduleEndsBefore || scheduleStartsAfter) {

      result.push(schedule);

      continue;

    }



    if (schedule.startAge < startAge) {

      const end = monthBefore(startAge, 1);

      result.push({

        ...schedule,

        endMode: 'until',

        endAge: end.age,

        endMonth: end.month,

      });

    }



    if (schedule.endMode === 'until' && schedule.endAge >= startAge) {

      result.push({

        ...schedule,

        id: createId(),

        startAge,

        startMonth: 1,

      });

      continue;

    }



    if (schedule.startAge >= startAge) {

      result.push(schedule);

    }

  }



  return result;

}



function buildLivingItemsFromBreakdown(

  monthlyMan: number,

  breakdown: { label: string; amountMan: number }[],

): LivingExpenseSchedule['items'] {

  if (breakdown.length === 0) {

    return [createLivingExpenseItem({ label: '生活費', amountMan: monthlyMan })];

  }

  return syncLivingDetailSummary(

    createLivingExpenseSchedule(null, 1, {

      inputMode: 'detail',

      items: breakdown.map((item) =>

        createLivingExpenseItem({

          label: item.label,

          amountMan: item.amountMan,

        }),

      ),

    }),

  ).items;

}



function resolveLivingSplitAge(

  targetId: string,

  head: FamilyMember,

  member: FamilyMember,

  referenceDate: Date,

  secondLifeStartAge: number,

): number {

  if (targetId === HOUSEHOLD_LIVING_KEY) {

    return secondLifeStartAge;

  }

  return (

    getMemberAgeWhenHeadReachesAge(

      head,

      member,

      referenceDate,

      secondLifeStartAge,

      1,

    ) ?? secondLifeStartAge

  );

}



export function applySecondLifeLiving(

  livingState: LivingExpenseState,

  secondLifeState: SecondLifeState,

  input: {

    familyMembers: FamilyMember[];

    incomeByMember: IncomeByMember;

    pensionByMember: PensionByMember;

    referenceDate: Date;

  },

): LivingExpenseState {

  if (secondLifeState.livingSkip) {

    return livingState;

  }



  const head = input.familyMembers.find((m) => m.role === 'head');

  if (!head) return livingState;



  const options = buildSecondLifeLivingOptions({

    livingState,

    ...input,

    startAge: secondLifeState.startAge,

  });

  const selected = options.find((o) => o.level === secondLifeState.livingLevel);

  if (!selected) return livingState;



  const referenceMonth = input.referenceDate.getMonth() + 1;

  const startAge = secondLifeState.startAge;

  const byTarget: LivingExpenseState['byTarget'] = {

    ...livingState.byTarget,

  };



  for (const targetId of collectLivingTargetIds(

    input.familyMembers,

    livingState,

  )) {

    const member = resolveLivingTargetMember(targetId, input.familyMembers);

    if (!member) continue;



    const splitAge = resolveLivingSplitAge(

      targetId,

      head,

      member,

      input.referenceDate,

      startAge,

    );

    const existing = byTarget[targetId] ?? [];

    let schedules = splitSchedulesAtAge(existing, splitAge);



    if (targetId === HOUSEHOLD_LIVING_KEY) {

      schedules = schedules.filter(

        (schedule) =>

          !(

            schedule.startAge === startAge &&

            schedule.startMonth === 1 &&

            schedule.endMode === 'lifetime'

          ),

      );



      const billableTemplate = existing

        .flatMap((schedule) => getLivingScheduleBillableItems(schedule))

        .find((item) => item.increaseRate != null);



      const newSchedule = createLivingExpenseSchedule(head.age, referenceMonth, {

        startAge,

        startMonth: 1,

        endMode: 'lifetime',

        endAge: head.expectedLifespan,

        endMonth: 12,

        inputMode: 'detail',

        items: buildLivingItemsFromBreakdown(

          selected.monthlyMan,

          selected.breakdown,

        ).map((item, index) =>

          index === 0

            ? {

                ...item,

                increaseRate: billableTemplate?.increaseRate ?? null,

              }

            : item,

        ),

      });



      schedules = [...schedules, syncLivingDetailSummary(newSchedule)];

    }



    byTarget[targetId] = schedules;

  }



  return {

    ...livingState,

    byTarget,

  };

}



function upsertOneTimeLifeEvent(

  lifeEventState: LifeEventState,

  member: FamilyMember,

  referenceMonth: number,

  label: string,

  startAge: number,

  amountMan: number,

): LifeEventState {

  const entries = lifeEventState.byMember[member.id] ?? [];

  const without = entries.filter((entry) => entry.label !== label);

  if (amountMan <= 0) {

    return {

      ...lifeEventState,

      byMember: { ...lifeEventState.byMember, [member.id]: without },

    };

  }



  const entry = createLifeEventEntry(member, referenceMonth, {

    label,

    type: 'other',

    startAge,

    startMonth: 1,

    endMode: 'once',

    endAge: startAge,

    endMonth: 1,

    cycleInterval: 1,

    cycleUnit: 'year',

    amountMan,

    increaseRate: null,

  });



  return {

    ...lifeEventState,

    byMember: {

      ...lifeEventState.byMember,

      [member.id]: [...without, entry],

    },

  };

}



export function applySecondLifeHousing(

  lifeEventState: LifeEventState,

  secondLifeState: SecondLifeState,

  head: FamilyMember | undefined,

  referenceMonth: number,

): LifeEventState {

  if (!head || secondLifeState.housingSkip) {

    return lifeEventState;

  }



  const total = estimateSecondLifeHousingTotalMan(secondLifeState);

  return upsertOneTimeLifeEvent(

    lifeEventState,

    head,

    referenceMonth,

    SECOND_LIFE_HOUSING_EVENT_LABEL,

    secondLifeState.startAge,

    total ?? 0,

  );

}



function removeSecondLifeNursingEvent(

  lifeEventState: LifeEventState,

  member: FamilyMember,

): LifeEventState {

  const entries = lifeEventState.byMember[member.id] ?? [];

  const without = entries.filter(

    (entry) => entry.label !== SECOND_LIFE_NURSING_EVENT_LABEL,

  );



  return {

    ...lifeEventState,

    byMember: {

      ...lifeEventState.byMember,

      [member.id]: without,

    },

  };

}



function upsertSecondLifeNursingEvent(

  lifeEventState: LifeEventState,

  member: FamilyMember,

  referenceMonth: number,

  design: SecondLifeNursingDesign,

): LifeEventState {

  const without = removeSecondLifeNursingEvent(

    lifeEventState,

    member,

  ).byMember[member.id] ?? [];



  const annualCost =

    design.annualCostMan > 0

      ? design.annualCostMan

      : getDefaultNursingAnnualCostMan(design.scenario);



  if (annualCost <= 0) {

    return {

      ...lifeEventState,

      byMember: { ...lifeEventState.byMember, [member.id]: without },

    };

  }



  const entry = createLifeEventEntryFromPreset(

    'nursing',

    member,

    referenceMonth,

  );



  return {

    ...lifeEventState,

    byMember: {

      ...lifeEventState.byMember,

      [member.id]: [

        ...without,

        {

          ...entry,

          label: SECOND_LIFE_NURSING_EVENT_LABEL,

          type: 'nursing',

          startAge: design.startAge,

          startMonth: 1,

          endMode: 'lifetime',

          amountMan: annualCost,

        },

      ],

    },

  };

}



export function applySecondLifeNursing(

  lifeEventState: LifeEventState,

  secondLifeState: SecondLifeState,

  familyMembers: FamilyMember[],

  referenceMonth: number,

): LifeEventState {

  let result = lifeEventState;



  for (const { key, role } of NURSING_TARGETS) {

    const member = familyMembers.find((m) => m.role === role);

    if (!member) continue;



    const design = secondLifeState.nursingByTarget[key];

    if (design.skip) {

      result = removeSecondLifeNursingEvent(result, member);

      continue;

    }



    result = upsertSecondLifeNursingEvent(

      result,

      member,

      referenceMonth,

      design,

    );

  }



  return result;

}



export function applySecondLifeDesign(input: {

  lifeEventState: LifeEventState;

  secondLifeState: SecondLifeState;

  familyMembers: FamilyMember[];

  referenceDate: Date;

}): LifeEventState {

  const head = input.familyMembers.find((m) => m.role === 'head');

  const referenceMonth = input.referenceDate.getMonth() + 1;

  let { lifeEventState } = input;



  lifeEventState = applySecondLifeHousing(

    lifeEventState,

    input.secondLifeState,

    head,

    referenceMonth,

  );

  lifeEventState = applySecondLifeNursing(

    lifeEventState,

    input.secondLifeState,

    input.familyMembers,

    referenceMonth,

  );



  return lifeEventState;

}


