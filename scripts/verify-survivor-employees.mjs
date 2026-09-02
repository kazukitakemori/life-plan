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
  calcSurvivorEmployeesBaseYenPerYear,
  isSurvivingSpouseEligibleForEmployees,
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

assert.equal(CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE, 30);
console.log('verify-survivor-employees: all passed');
