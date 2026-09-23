/**
 * 遺族厚生年金の自動計算
 * npx tsx scripts/verify-survivor-employees.mjs
 */
import assert from 'node:assert/strict';
import { createIncomeEntry } from '../src/lib/incomeDefaults.ts';
import { createDefaultPensionMemberState } from '../src/lib/pensionDefaults.ts';
import {
  CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE,
  MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR,
  SURVIVOR_EMPLOYEES_DEEMED_MONTHS,
  SURVIVOR_EMPLOYEES_PROPORTIONAL_RATE,
} from '../src/lib/pensionConstants.ts';
import {
  applySurvivorEmployeesOwnOldAgeOffsetMan,
  calcDeceasedProportionalYenPerYearUntilDeath,
  calcEmployeesMonthsUntilDeath,
  calcMiddleAgedWidowAddYenPerYear,
  calcSurvivorContinuationSuspensionYen,
  calcSurvivorEmployeesBaseYenPerYear,
  isSurvivingSpouseEligibleForEmployees,
  resolveSurvivorContinuationIncomeBasis,
  resolveSurvivorContinuationIncomeReferenceYear,
  resolveSurvivorEmployeesDeathRequirement,
  resolveSurvivorEmployeesRecipient,
} from '../src/lib/survivorEmployeesPension.ts';
import { toMonthlyMan } from '../src/lib/pensionOldAge.ts';

const referenceDate = new Date(2026, 5, 1);
const death = { year: 2026, month: 7 };

function member(partial) {
  return {
    nickname: '',
    gender: 'male',
    expectedLifespan: 90,
    disability: 'none',
    hobbies: [],
    householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
    birthDay: 1,
    ...partial,
  };
}

const head = member({
  id: 'head',
  role: 'head',
  nickname: '世帯主',
  age: 40,
  birthMonth: 4,
  gender: 'male',
});
const wife38 = member({
  id: 'spouse',
  role: 'spouse',
  nickname: '配偶者',
  age: 38,
  birthMonth: 6,
  gender: 'female',
});
const wife28 = member({
  ...wife38,
  id: 'spouse28',
  age: 28,
});
const wife45 = member({
  ...wife38,
  id: 'spouse45',
  age: 45,
});
const husband40 = member({
  id: 'head40',
  role: 'head',
  nickname: '夫',
  age: 40,
  birthMonth: 4,
  gender: 'male',
});
const child = member({
  id: 'child',
  role: 'child',
  nickname: '子',
  age: 10,
  birthMonth: 4,
});

const headIncome = createIncomeEntry(head.id, 'employee', 40, 6, head);
headIncome.periods[0].monthlyAmountMan = 50;
const pension = createDefaultPensionMemberState();

{
  const requirement = resolveSurvivorEmployeesDeathRequirement(
    head,
    [headIncome],
    pension,
    referenceDate,
    death,
  );
  assert.equal(requirement, 'short_term');
  const months = calcEmployeesMonthsUntilDeath(
    head,
    [headIncome],
    pension,
    referenceDate,
    death,
  );
  assert.ok(months > 0);
  assert.ok(months < SURVIVOR_EMPLOYEES_DEEMED_MONTHS);
  const proportional = calcDeceasedProportionalYenPerYearUntilDeath(
    head,
    [headIncome],
    pension,
    referenceDate,
    death,
  );
  assert.ok(proportional > 0);
  const base = calcSurvivorEmployeesBaseYenPerYear({
    proportionalYenPerYear: proportional,
    employeesMonthsUntilDeath: months,
    requirement,
  });
  const expected =
    proportional *
    (SURVIVOR_EMPLOYEES_DEEMED_MONTHS / months) *
    SURVIVOR_EMPLOYEES_PROPORTIONAL_RATE;
  assert.equal(Math.round(base), Math.round(expected));
  console.log('OK 3/4 with 300-month deeming while insured');
}

{
  const noneReq = resolveSurvivorEmployeesDeathRequirement(
    head,
    [],
    pension,
    referenceDate,
    death,
  );
  assert.equal(noneReq, 'none');
  console.log('OK no employees history is not eligible');
}

{
  const baseMan = 10;
  const ownMan = 8;
  const offset = applySurvivorEmployeesOwnOldAgeOffsetMan(baseMan, ownMan, 65);
  const deceasedProp = baseMan / SURVIVOR_EMPLOYEES_PROPORTIONAL_RATE;
  const optionB = deceasedProp * 0.5 + ownMan * 0.5;
  const amount = Math.max(baseMan, optionB);
  assert.equal(offset, Math.max(0, amount - ownMan));
  assert.equal(applySurvivorEmployeesOwnOldAgeOffsetMan(baseMan, ownMan, 64), baseMan);
  assert.equal(applySurvivorEmployeesOwnOldAgeOffsetMan(baseMan, 20, 65), 0);
  console.log('OK 65+ own old-age employees offset');
}

{
  assert.equal(
    isSurvivingSpouseEligibleForEmployees(wife38, false, referenceDate, death, death, false),
    true,
  );
  assert.equal(
    isSurvivingSpouseEligibleForEmployees(wife28, false, referenceDate, death, death, false),
    true,
  );
  assert.equal(
    isSurvivingSpouseEligibleForEmployees(
      wife28,
      false,
      referenceDate,
      death,
      { year: 2032, month: 7 },
      false,
    ),
    false,
  );
  assert.equal(
    isSurvivingSpouseEligibleForEmployees(
      husband40,
      false,
      referenceDate,
      death,
      death,
      false,
    ),
    false,
  );
  assert.equal(
    isSurvivingSpouseEligibleForEmployees(
      husband40,
      true,
      referenceDate,
      death,
      death,
      true,
    ),
    true,
  );
  console.log('OK spouse duration: childless wife under 30 is 5 years; childless husband under 55 is out');
}

{
  const recipient = resolveSurvivorEmployeesRecipient(
    [head, wife38, child],
    'head',
    referenceDate,
    death,
    death,
  );
  assert.equal(recipient?.kind, 'spouse');
  assert.equal(recipient?.member.id, wife38.id);
  const childOnly = resolveSurvivorEmployeesRecipient(
    [head, child],
    'head',
    referenceDate,
    death,
    death,
  );
  assert.equal(childOnly?.kind, 'child');
  console.log('OK recipient priority: spouse with child, then child');
}

{
  const none = calcMiddleAgedWidowAddYenPerYear({
    wife: wife38,
    remainingFamilyMembers: [wife38],
    referenceDate,
    death,
    now: { year: 2030, month: 7 },
    hadEligibleChildrenAtDeath: false,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  assert.equal(none, 0);

  const add = calcMiddleAgedWidowAddYenPerYear({
    wife: wife45,
    remainingFamilyMembers: [wife45],
    referenceDate,
    death,
    now: death,
    hadEligibleChildrenAtDeath: false,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  assert.equal(add, MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR);
  assert.ok(toMonthlyMan(add) > 0);

  const afterChild = calcMiddleAgedWidowAddYenPerYear({
    wife: wife38,
    remainingFamilyMembers: [wife38, child],
    referenceDate,
    death,
    now: { year: 2036, month: 4 },
    hadEligibleChildrenAtDeath: true,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  assert.equal(afterChild, MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR);
  console.log('OK middle-aged widow addition');
}

{
  const reformDeath = { year: 2028, month: 4 };
  const reformNoChild = calcMiddleAgedWidowAddYenPerYear({
    wife: wife45,
    remainingFamilyMembers: [wife45],
    referenceDate,
    death: reformDeath,
    now: reformDeath,
    hadEligibleChildrenAtDeath: false,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  assert.ok(reformNoChild > 0);
  assert.ok(reformNoChild < MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR);

  const reformAfterChild = calcMiddleAgedWidowAddYenPerYear({
    wife: wife38,
    remainingFamilyMembers: [wife38, child],
    referenceDate,
    death: reformDeath,
    now: { year: 2036, month: 4 },
    hadEligibleChildrenAtDeath: true,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  assert.ok(reformAfterChild > 0);
  assert.ok(reformAfterChild < MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR);
  const finalPhaseDeath = { year: 2052, month: 4 };
  const finalPhase = calcMiddleAgedWidowAddYenPerYear({
    wife: wife45,
    remainingFamilyMembers: [wife45],
    referenceDate,
    death: finalPhaseDeath,
    now: finalPhaseDeath,
    hadEligibleChildrenAtDeath: false,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  assert.equal(
    Math.round(finalPhase),
    Math.round(MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR / 25),
  );

  const abolishedDeath = { year: 2053, month: 4 };
  const abolished = calcMiddleAgedWidowAddYenPerYear({
    wife: wife45,
    remainingFamilyMembers: [wife45],
    referenceDate,
    death: abolishedDeath,
    now: abolishedDeath,
    hadEligibleChildrenAtDeath: false,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  assert.equal(abolished, 0);
  console.log('OK 2028 reform: middle-aged widow addition phases down through FY2052');
}

{
  // 継続給付の所得参照年は、1〜9月が前々年、10〜12月が前年。
  assert.equal(resolveSurvivorContinuationIncomeReferenceYear(2034, 1), 2032);
  assert.equal(resolveSurvivorContinuationIncomeReferenceYear(2034, 9), 2032);
  assert.equal(resolveSurvivorContinuationIncomeReferenceYear(2034, 10), 2033);
  assert.equal(resolveSurvivorContinuationIncomeReferenceYear(2034, 12), 2033);

  // Q7の当該暦年所得は「概算」として利用できる。
  const q7Basis = resolveSurvivorContinuationIncomeBasis({
    recipient: head,
    incomeByMember: { [head.id]: [headIncome] },
    referenceDate,
    paymentYear: 2028,
    paymentMonth: 9,
  });
  assert.equal(q7Basis.incomeReferenceYear, 2026);
  assert.equal(q7Basis.resolution, 'q7_reference_year');
  assert.equal(q7Basis.isEstimate, true);
  assert.ok((q7Basis.totalIncomeYen ?? 0) > 0);

  // 「前年度の収入」上書きは、試算開始年の前年を参照する場合だけ概算元に使う。
  const overrideBasis = resolveSurvivorContinuationIncomeBasis({
    recipient: head,
    incomeByMember: {},
    priorYearIncomeByMember: {
      [head.id]: {
        differsFromCurrentYear: true,
        category: 'employee',
        monthlyAmountMan: 30,
      },
    },
    referenceDate,
    paymentYear: 2026,
    paymentMonth: 10,
  });
  assert.equal(overrideBasis.incomeReferenceYear, 2025);
  assert.equal(overrideBasis.resolution, 'prior_year_override');
  assert.equal(overrideBasis.isEstimate, true);
  assert.ok((overrideBasis.totalIncomeYen ?? 0) > 0);

  // 元データが無い場合は0円と決めつけず、判定不能にする。
  const unavailableBasis = resolveSurvivorContinuationIncomeBasis({
    recipient: wife38,
    incomeByMember: {},
    referenceDate,
    paymentYear: 2028,
    paymentMonth: 9,
  });
  assert.equal(unavailableBasis.resolution, 'unavailable');
  assert.equal(unavailableBasis.totalIncomeYen, null);

  console.log('OK 2028 continuation: prior-income reference is separated from resident-tax proxy');
}

{
  // 所得基準額は政令値を外から渡す。ここでは法律の停止式だけを仮の基準額で検証する。
  const thresholds = { first: 900_000, second: 1_800_000 };
  assert.equal(
    calcSurvivorContinuationSuspensionYen({
      priorIncomeYen: 800_000,
      annualPensionYen: 3_000_000,
      thresholds,
    }),
    0,
  );
  assert.equal(
    calcSurvivorContinuationSuspensionYen({
      priorIncomeYen: 1_500_000,
      annualPensionYen: 3_000_000,
      thresholds,
    }),
    200_000,
  );
  assert.equal(
    calcSurvivorContinuationSuspensionYen({
      priorIncomeYen: 2_400_000,
      annualPensionYen: 3_000_000,
      thresholds,
    }),
    600_000,
  );
  assert.equal(
    calcSurvivorContinuationSuspensionYen({
      priorIncomeYen: 2_400_000,
      annualPensionYen: 100_000,
      thresholds,
    }),
    100_000,
  );
  console.log('OK 2028 continuation: statutory 1/3 and 1/2 suspension formula');
}

assert.equal(CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE, 30);
console.log('verify-survivor-employees: all passed');
