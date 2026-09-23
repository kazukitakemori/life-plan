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
  calcCoverageSurvivorEmployeesDetail,
  calcDeceasedProportionalYenPerYearUntilDeath,
  calcEmployeesMonthsUntilDeath,
  calcMiddleAgedWidowAddYenPerYear,
  calcTransitionalWidowAddYenPerYear,
  calcSurvivorContinuationSuspensionYen,
  calcSurvivorEmployeesBaseYenPerYear,
  hasConfirmedLongTermSurvivorQualification,
  hasConfirmedNoUnpaidInRecentYear,
  hasConfirmedTwoThirdsPremiumRequirement,
  getTransitionalWidowAddYenPerYear,
  hasQualifyingSurvivorContinuationDisabilityPension,
  isSurvivingSpouseEligibleForEmployees,
  resolveSurvivorContinuationAnnualPensionYen,
  resolveSurvivorContinuationAssessmentTarget,
  resolveSurvivorContinuationIncomeBasis,
  resolveSurvivorContinuationIncomeReferenceYear,
  resolveSurvivorEmployeesDeathRequirement,
  resolveSurvivorPremiumRequirementAssessment,
  resolveSurvivorEmployeesRecipient,
} from '../src/lib/survivorEmployeesPension.ts';
import { toMonthlyMan } from '../src/lib/pensionOldAge.ts';
import {
  isEligibleSurvivorBasicChild,
  survivorBasicChildAddYenPerYear,
} from '../src/lib/survivorBasicPension.ts';

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
  // Q7で会社員と分かっても、過去の納付実績までは推測しない。
  const autoAssessment = resolveSurvivorPremiumRequirementAssessment(
    head,
    pension,
    referenceDate,
    death,
  );
  assert.equal(autoAssessment.status, 'unconfirmed');
  assert.equal(
    resolveSurvivorEmployeesDeathRequirement(
      head,
      [headIncome],
      pension,
      referenceDate,
      death,
    ),
    'none',
  );

  // ねんきんネット等で納付要件を確認できた場合は手動確定できる。
  const confirmedPension = createDefaultPensionMemberState();
  confirmedPension.benefitSettings.survivorPremiumRequirement = 'met';
  const requirement = resolveSurvivorEmployeesDeathRequirement(
    head,
    [headIncome],
    confirmedPension,
    referenceDate,
    death,
  );
  assert.equal(requirement, 'short_term');
  const months = calcEmployeesMonthsUntilDeath(
    head,
    [headIncome],
    confirmedPension,
    referenceDate,
    death,
  );
  assert.ok(months > 0);
  assert.ok(months < SURVIVOR_EMPLOYEES_DEEMED_MONTHS);
  const proportional = calcDeceasedProportionalYenPerYearUntilDeath(
    head,
    [headIncome],
    confirmedPension,
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

  confirmedPension.benefitSettings.survivorPremiumRequirement = 'not_met';
  assert.equal(
    resolveSurvivorEmployeesDeathRequirement(
      head,
      [headIncome],
      confirmedPension,
      referenceDate,
      death,
    ),
    'none',
  );
  console.log('OK premium requirement is not inferred from Q7; manual confirmation controls eligibility');
}

{
  // 直近1年特例: 死亡月の前々月まで12か月に未納がなければ自動確認。
  // 厚生年金加入月は国民年金欄が空でも納付済期間として扱える。
  const recent = createDefaultPensionMemberState();
  recent.pastEnrollment = 'nenkin-teikibin-over50';
  recent.teikibinOver50.recentMonthlyYear = 2026;
  recent.teikibinOver50.recentMonthlyMonth = 6;
  recent.teikibinOver50.monthlyRows = recent.teikibinOver50.monthlyRows.map(
    (row, index) => ({
      ...row,
      nationalPensionStatus: index === 2 ? 'student-special' : '',
      employeesPensionCategory: index === 2 ? '' : 'employees',
    }),
  );
  assert.equal(hasConfirmedNoUnpaidInRecentYear(recent, 2026, 7), true);
  assert.deepEqual(
    resolveSurvivorPremiumRequirementAssessment(
      head,
      recent,
      referenceDate,
      death,
    ),
    { status: 'met', basis: 'one_year_no_unpaid' },
  );

  recent.teikibinOver50.monthlyRows[5].nationalPensionStatus = 'unpaid';
  recent.teikibinOver50.monthlyRows[5].employeesPensionCategory = '';
  assert.equal(hasConfirmedNoUnpaidInRecentYear(recent, 2026, 7), false);
  console.log('OK one-year exception counts employees coverage and approved student special, but rejects unpaid months');
}

{
  // 定期便の累計加入期間だけでも、最大24か月の前納分を控除した下限で
  // 3分の2以上が明らかな場合は自動確認できる。
  const aggregate = createDefaultPensionMemberState();
  aggregate.pastEnrollment = 'nenkin-teikibin-over50';
  aggregate.teikibinOver50.employeesPensionGeneralMonths = 300;
  assert.equal(
    hasConfirmedTwoThirdsPremiumRequirement(
      head,
      aggregate,
      referenceDate,
      death,
    ),
    true,
  );

  // 老齢厚生年金の25年資格による長期要件も、Q7推計ではなく定期便の記録で確認する。
  const olderHead = member({
    ...head,
    id: 'older-head',
    age: 60,
  });
  const longTerm = createDefaultPensionMemberState();
  longTerm.pastEnrollment = 'nenkin-teikibin-over50';
  longTerm.teikibinOver50.employeesPensionGeneralMonths = 324;
  assert.equal(
    resolveSurvivorEmployeesDeathRequirement(
      olderHead,
      [],
      longTerm,
      referenceDate,
      death,
    ),
    'long_term',
  );
  console.log('OK recorded teikibin months support conservative 2/3 and 25-year checks');
}

{
  // 在職中の短期要件が確認できなくても、定期便で25年以上の長期要件を
  // 確認できる場合は長期要件へフォールバックする。
  const longTermWhileWorking = createDefaultPensionMemberState();
  longTermWhileWorking.pastEnrollment = 'nenkin-teikibin-over50';
  longTermWhileWorking.teikibinOver50.employeesPensionGeneralMonths = 324;
  longTermWhileWorking.benefitSettings.survivorPremiumRequirement = 'not_met';
  assert.equal(
    hasConfirmedLongTermSurvivorQualification(longTermWhileWorking),
    true,
  );
  assert.equal(
    resolveSurvivorEmployeesDeathRequirement(
      head,
      [headIncome],
      longTermWhileWorking,
      referenceDate,
      death,
    ),
    'long_term',
  );

  // 障害厚生年金1・2級の受給権者の死亡は短期要件として扱う。
  const disabledHead = member({
    ...head,
    id: 'disabled-head',
    disability: 'has',
    disabilityPension: 'employees_grade2',
  });
  assert.equal(
    resolveSurvivorEmployeesDeathRequirement(
      disabledHead,
      [],
      createDefaultPensionMemberState(),
      referenceDate,
      death,
    ),
    'short_term',
  );
  console.log('OK long-term fallback and disability employees death qualification');
}

{
  // 障害年金1・2級が明示された子は20歳未満まで対象。3級は延長しない。
  const child19 = member({
    id: 'child19',
    role: 'child',
    nickname: '19歳の子',
    age: 19,
    birthMonth: 4,
    gender: 'female',
    disability: 'has',
    disabilityGrade: 'grade2',
    disabilityPension: 'none',
  });
  assert.equal(
    isEligibleSurvivorBasicChild(child19, referenceDate, 2026, 7),
    true,
  );
  assert.equal(
    isEligibleSurvivorBasicChild(
      { ...child19, disabilityGrade: 'grade3' },
      referenceDate,
      2026,
      7,
    ),
    false,
  );
  assert.equal(
    isEligibleSurvivorBasicChild(child19, referenceDate, 2027, 7),
    false,
  );

  // 2028年4月からは第3子以降も含め、子の加算を同額にする。
  assert.equal(
    survivorBasicChildAddYenPerYear(3, 2027, 4),
    243_800 * 2 + 81_300,
  );
  assert.equal(
    survivorBasicChildAddYenPerYear(3, 2028, 4),
    292_500 * 3,
  );
  console.log('OK disabled-child extension and 2028 survivor child addition');
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
    false,
  );
  console.log('OK spouse duration: childless wife under 30 is 5 years; husband under 55 has no survivor-employees right even with child');
}

{
  const grandchild = member({
    id: 'grandchild',
    role: 'other',
    otherRelationship: 'grandchild',
    nickname: '孫',
    age: 10,
    birthMonth: 4,
  });
  const parent = member({
    id: 'parent',
    role: 'other',
    otherRelationship: 'parent',
    nickname: '親',
    age: 65,
    birthMonth: 4,
  });
  const grandparent = member({
    id: 'grandparent',
    role: 'other',
    otherRelationship: 'grandparent',
    nickname: '祖父母',
    age: 70,
    birthMonth: 4,
  });

  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [head, grandchild],
      'head',
      referenceDate,
      death,
      death,
    )?.kind,
    'grandchild',
  );
  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [head, parent, grandchild, grandparent],
      'head',
      referenceDate,
      death,
      death,
    )?.kind,
    'parent',
  );
  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [head, grandchild, grandparent],
      'head',
      referenceDate,
      death,
      death,
    )?.kind,
    'grandchild',
  );
  console.log('OK survivor employees priority includes grandchild between parent and grandparent');
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
  // 受給順位は死亡時に固定する。55〜59歳の夫は受給権を取得しても
  // 60歳まで支給停止となり、その間に父母へ順位を移さない。
  const husband58 = member({
    id: 'husband58',
    role: 'head',
    nickname: '夫',
    age: 58,
    birthMonth: 4,
    birthDay: 1,
    gender: 'male',
  });
  const deceasedWife = member({
    id: 'deceased-wife',
    role: 'spouse',
    nickname: '妻',
    age: 40,
    birthMonth: 4,
    gender: 'female',
  });
  const parent70 = member({
    id: 'parent70',
    role: 'other',
    otherRelationship: 'parent',
    nickname: '親',
    age: 70,
    birthMonth: 4,
  });

  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [husband58, deceasedWife, parent70],
      'spouse',
      referenceDate,
      death,
      { year: 2027, month: 7 },
    ),
    null,
  );
  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [husband58, deceasedWife, parent70],
      'spouse',
      referenceDate,
      death,
      { year: 2028, month: 4 },
    )?.member.id,
    husband58.id,
  );

  // 父母が死亡時55歳以上なら、60歳まで支給停止でも孫へ順位を移さない。
  const parent58 = member({
    id: 'parent58',
    role: 'other',
    otherRelationship: 'parent',
    nickname: '親',
    age: 58,
    birthMonth: 4,
    birthDay: 1,
  });
  const grandchild10 = member({
    id: 'grandchild10',
    role: 'other',
    otherRelationship: 'grandchild',
    nickname: '孫',
    age: 10,
    birthMonth: 4,
  });
  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [head, parent58, grandchild10],
      'head',
      referenceDate,
      death,
      { year: 2027, month: 7 },
    ),
    null,
  );
  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [head, parent58, grandchild10],
      'head',
      referenceDate,
      death,
      { year: 2028, month: 4 },
    )?.member.id,
    parent58.id,
  );

  // 孫が死亡時の上位順位を占めた場合、後に年齢要件を外れても祖父母へ移さない。
  const grandchild17 = member({
    id: 'grandchild17',
    role: 'other',
    otherRelationship: 'grandchild',
    nickname: '孫',
    age: 17,
    birthMonth: 4,
  });
  const grandparent70 = member({
    id: 'grandparent70',
    role: 'other',
    otherRelationship: 'grandparent',
    nickname: '祖父母',
    age: 70,
    birthMonth: 4,
  });
  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [head, grandchild17, grandparent70],
      'head',
      referenceDate,
      death,
      death,
    )?.member.id,
    grandchild17.id,
  );
  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [head, grandchild17, grandparent70],
      'head',
      referenceDate,
      death,
      { year: 2028, month: 4 },
    ),
    null,
  );

  // 配偶者の5年有期給付が終わっても、死亡時に下位だった父母へ承継しない。
  assert.equal(
    resolveSurvivorEmployeesRecipient(
      [head, wife28, parent70],
      'head',
      referenceDate,
      death,
      { year: 2031, month: 8 },
    ),
    null,
  );

  console.log('OK survivor employees keeps death-time priority during suspension and after expiry');
}

{
  // 65歳到達による中高齢寡婦加算→経過的寡婦加算の切替は翌月。
  // 4月2日生まれは4月に65歳到達するため、4月は中高齢、5月から経過的。
  const historicalReference = new Date(2020, 2, 1);
  const widowDay2 = member({
    id: 'widow-day2',
    role: 'spouse',
    nickname: '妻',
    age: 64,
    birthMonth: 4,
    birthDay: 2,
    gender: 'female',
  });
  const historicalDeath = { year: 2019, month: 7 };
  const aprilMiddle = calcMiddleAgedWidowAddYenPerYear({
    wife: widowDay2,
    remainingFamilyMembers: [widowDay2],
    referenceDate: historicalReference,
    death: historicalDeath,
    now: { year: 2020, month: 4 },
    hadEligibleChildrenAtDeath: false,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  const aprilTransitional = calcTransitionalWidowAddYenPerYear({
    wife: widowDay2,
    remainingFamilyMembers: [widowDay2],
    referenceDate: historicalReference,
    death: historicalDeath,
    now: { year: 2020, month: 4 },
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  const mayMiddle = calcMiddleAgedWidowAddYenPerYear({
    wife: widowDay2,
    remainingFamilyMembers: [widowDay2],
    referenceDate: historicalReference,
    death: historicalDeath,
    now: { year: 2020, month: 5 },
    hadEligibleChildrenAtDeath: false,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  const mayTransitional = calcTransitionalWidowAddYenPerYear({
    wife: widowDay2,
    remainingFamilyMembers: [widowDay2],
    referenceDate: historicalReference,
    death: historicalDeath,
    now: { year: 2020, month: 5 },
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  assert.ok(aprilMiddle > 0);
  assert.equal(aprilTransitional, 0);
  assert.equal(mayMiddle, 0);
  assert.ok(mayTransitional > 0);

  // 4月1日生まれは3月31日に65歳到達するため、4月から経過的へ切り替わる。
  const widowDay1 = { ...widowDay2, id: 'widow-day1', birthDay: 1 };
  assert.equal(
    calcMiddleAgedWidowAddYenPerYear({
      wife: widowDay1,
      remainingFamilyMembers: [widowDay1],
      referenceDate: historicalReference,
      death: historicalDeath,
      now: { year: 2020, month: 4 },
      hadEligibleChildrenAtDeath: false,
      hasEligibleChildrenNow: false,
      requirement: 'short_term',
      deceasedEmployeesMonths: 200,
    }),
    0,
  );
  assert.ok(
    calcTransitionalWidowAddYenPerYear({
      wife: widowDay1,
      remainingFamilyMembers: [widowDay1],
      referenceDate: historicalReference,
      death: historicalDeath,
      now: { year: 2020, month: 4 },
      requirement: 'short_term',
      deceasedEmployeesMonths: 200,
    }) > 0,
  );

  console.log('OK widow additions switch in the month after legal age-65 attainment');
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
  assert.equal(
    Math.round(afterChild),
    Math.round(MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR * 0.692),
  );
  console.log('OK middle-aged widow addition');
}

{
  // 経過的寡婦加算は昭和31年4月1日以前生まれまで。
  const born19550402 = member({
    id: 'wife-1955',
    role: 'spouse',
    nickname: '妻',
    age: 71,
    birthMonth: 4,
    birthDay: 2,
    gender: 'female',
  });
  const born19560401 = member({
    ...born19550402,
    id: 'wife-19560401',
    age: 70,
    birthMonth: 4,
    birthDay: 1,
  });
  const born19560402 = member({
    ...born19560401,
    id: 'wife-19560402',
    birthDay: 2,
  });
  assert.equal(
    getTransitionalWidowAddYenPerYear(born19550402, referenceDate),
    21_147,
  );
  assert.equal(
    getTransitionalWidowAddYenPerYear(born19560401, referenceDate),
    21_147,
  );
  assert.equal(
    getTransitionalWidowAddYenPerYear(born19560402, referenceDate),
    0,
  );

  const oldWifeDeath = { year: 2026, month: 7 };
  assert.equal(
    calcTransitionalWidowAddYenPerYear({
      wife: born19550402,
      remainingFamilyMembers: [born19550402],
      referenceDate,
      death: oldWifeDeath,
      now: oldWifeDeath,
      requirement: 'short_term',
      deceasedEmployeesMonths: 100,
    }),
    21_147,
  );
  assert.equal(
    calcTransitionalWidowAddYenPerYear({
      wife: {
        ...born19550402,
        disability: 'has',
        disabilityGrade: 'grade2',
        disabilityPension: 'basic_grade2',
      },
      remainingFamilyMembers: [born19550402],
      referenceDate,
      death: oldWifeDeath,
      now: oldWifeDeath,
      requirement: 'short_term',
      deceasedEmployeesMonths: 100,
    }),
    0,
  );
  console.log('OK transitional widow addition uses 2026 official birth-date table and disability-basic stop');
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
  assert.equal(
    Math.round(reformNoChild),
    Math.round(MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR * 0.962),
  );

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
  assert.equal(
    Math.round(reformAfterChild),
    Math.round(MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR * 0.692),
  );

  const phase2030 = calcMiddleAgedWidowAddYenPerYear({
    wife: wife45,
    remainingFamilyMembers: [wife45],
    referenceDate,
    death: { year: 2030, month: 4 },
    now: { year: 2030, month: 4 },
    hadEligibleChildrenAtDeath: false,
    hasEligibleChildrenNow: false,
    requirement: 'short_term',
    deceasedEmployeesMonths: 200,
  });
  assert.equal(
    Math.round(phase2030),
    Math.round(MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR * 0.885),
  );

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
    Math.round(MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR * 0.038),
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
  console.log('OK 2028 reform: statutory middle-aged widow phase-down rates through FY2052');
}

{
  // 2028年改正の5年有期給付後は、65歳まで継続給付の判定対象として追跡する。
  const reformDeath = { year: 2028, month: 4 };
  assert.equal(
    resolveSurvivorContinuationAssessmentTarget(
      [head, wife38],
      'head',
      referenceDate,
      reformDeath,
      { year: 2033, month: 4 },
    ),
    null,
  );
  const continuationTarget = resolveSurvivorContinuationAssessmentTarget(
    [head, wife38],
    'head',
    referenceDate,
    reformDeath,
    { year: 2033, month: 5 },
  );
  assert.equal(continuationTarget?.member.id, wife38.id);
  assert.deepEqual(continuationTarget?.finiteBenefitStart, reformDeath);
  assert.deepEqual(continuationTarget?.finiteBenefitEnd, {
    year: 2033,
    month: 4,
  });
  assert.equal(continuationTarget?.assessmentEndAge, 65);
  assert.equal(continuationTarget?.reason, 'income_or_disability');

  // 2028年度に40歳以上となる女性は段階移行の対象外なので、継続判定へ送らない。
  assert.equal(
    resolveSurvivorContinuationAssessmentTarget(
      [head, wife45],
      'head',
      referenceDate,
      reformDeath,
      { year: 2033, month: 4 },
    ),
    null,
  );

  // 男性も改正後は60歳未満で死別した場合に5年有期給付→継続判定の対象となる。
  const maleContinuationTarget = resolveSurvivorContinuationAssessmentTarget(
    [wife38, husband40],
    'spouse',
    referenceDate,
    reformDeath,
    { year: 2033, month: 5 },
  );
  assert.equal(maleContinuationTarget?.member.id, husband40.id);

  console.log('OK 2028 continuation: finite-benefit survivors remain assessment targets until 65');
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
  const reformDeath = { year: 2028, month: 4 };

  // 女性の段階移行は、子の遺族基礎年金を失う時点で判定する。
  // このケースは有期対象年齢を超えているため5年打切りにせず、従来型の期間を維持する。
  const transitionalChildLoss = { year: 2033, month: 4 };
  assert.equal(
    isSurvivingSpouseEligibleForEmployees(
      wife45,
      true,
      referenceDate,
      reformDeath,
      { year: 2039, month: 4 },
      false,
      transitionalChildLoss,
    ),
    true,
  );

  // 子の年金が60歳以後に失権する配偶者は、新たな5年有期へ切り替えない。
  const lossAfterSixty = { year: 2046, month: 7 };
  assert.equal(
    isSurvivingSpouseEligibleForEmployees(
      husband40,
      true,
      referenceDate,
      reformDeath,
      { year: 2052, month: 7 },
      false,
      lossAfterSixty,
    ),
    true,
  );

  // 実際の家族構成から判定する既存の継続給付ターゲットも、子の失権後の開始年齢を使う。
  const childContinuationTarget = resolveSurvivorContinuationAssessmentTarget(
    [head, wife28, child],
    'head',
    referenceDate,
    reformDeath,
    { year: 2042, month: 4 },
  );
  assert.equal(childContinuationTarget?.member.id, wife28.id);
  assert.ok(childContinuationTarget?.finiteBenefitStart.year > reformDeath.year);

  const childTransitionExcluded = resolveSurvivorContinuationAssessmentTarget(
    [head, wife45, child],
    'head',
    referenceDate,
    reformDeath,
    { year: 2042, month: 4 },
  );
  assert.equal(childTransitionExcluded, null);

  console.log('OK 2028 continuation: child-loss age and transition phase are respected');
}

{
  const qualifyingStatuses = [
    'basic_grade1',
    'basic_grade2',
    'employees_grade1',
    'employees_grade2',
    'employees_grade3',
  ];
  for (const disabilityPension of qualifyingStatuses) {
    assert.equal(
      hasQualifyingSurvivorContinuationDisabilityPension(
        member({
          ...wife38,
          disability: 'has',
          disabilityPension,
        }),
      ),
      true,
    );
  }
  assert.equal(
    hasQualifyingSurvivorContinuationDisabilityPension(
      member({
        ...wife38,
        disability: 'has',
        disabilityPension: 'none',
      }),
    ),
    false,
  );
  assert.equal(
    hasQualifyingSurvivorContinuationDisabilityPension(
      member({
        ...wife38,
        disability: 'none',
        disabilityPension: 'employees_grade3',
      }),
    ),
    false,
  );
  console.log('OK 2028 continuation: basic grades 1-2 and employees grades 1-3 qualify');
}

{
  const enhancedAnnualPensionYen = 1_200_000;

  // 障害による継続は、障害年金受給権等を別途確認できた場合だけ明示的に通す。
  const disabilityContinuation = resolveSurvivorContinuationAnnualPensionYen({
    recipient: wife38,
    incomeByMember: {},
    referenceDate,
    paymentYear: 2034,
    paymentMonth: 4,
    enhancedAnnualPensionYen,
    hasQualifyingDisabilityPensionEntitlement: true,
  });
  assert.equal(disabilityContinuation.resolution, 'qualifying_disability');
  assert.equal(disabilityContinuation.annualPensionYen, enhancedAnnualPensionYen);
  assert.equal(disabilityContinuation.suspensionYen, 0);

  // 政令の所得基準額が無い段階では、見込み値で受給額を作らない。
  const thresholdsUnavailable = resolveSurvivorContinuationAnnualPensionYen({
    recipient: head,
    incomeByMember: { [head.id]: [headIncome] },
    referenceDate,
    paymentYear: 2028,
    paymentMonth: 9,
    enhancedAnnualPensionYen,
    hasQualifyingDisabilityPensionEntitlement: false,
  });
  assert.equal(thresholdsUnavailable.resolution, 'thresholds_unavailable');
  assert.equal(thresholdsUnavailable.annualPensionYen, null);

  // 基準額が確定しても参照所得を作れない場合は0円所得とみなさない。
  const incomeUnavailable = resolveSurvivorContinuationAnnualPensionYen({
    recipient: wife38,
    incomeByMember: {},
    referenceDate,
    paymentYear: 2034,
    paymentMonth: 4,
    enhancedAnnualPensionYen,
    thresholds: { first: 900_000, second: 1_800_000 },
    hasQualifyingDisabilityPensionEntitlement: false,
  });
  assert.equal(incomeUnavailable.resolution, 'income_unavailable');
  assert.equal(incomeUnavailable.annualPensionYen, null);

  // 公式基準額を注入できる場合だけ、前年所得と法律の停止式から継続給付額を解決する。
  const thresholds = { first: 900_000, second: 1_800_000 };
  const adjusted = resolveSurvivorContinuationAnnualPensionYen({
    recipient: head,
    incomeByMember: { [head.id]: [headIncome] },
    referenceDate,
    paymentYear: 2028,
    paymentMonth: 9,
    enhancedAnnualPensionYen,
    thresholds,
    hasQualifyingDisabilityPensionEntitlement: false,
  });
  const basis = resolveSurvivorContinuationIncomeBasis({
    recipient: head,
    incomeByMember: { [head.id]: [headIncome] },
    referenceDate,
    paymentYear: 2028,
    paymentMonth: 9,
  });
  const expectedSuspension = calcSurvivorContinuationSuspensionYen({
    priorIncomeYen: basis.totalIncomeYen ?? 0,
    annualPensionYen: enhancedAnnualPensionYen,
    thresholds,
  });
  assert.equal(adjusted.resolution, 'income_adjusted');
  assert.equal(adjusted.suspensionYen, expectedSuspension);
  assert.equal(
    adjusted.annualPensionYen,
    Math.max(0, enhancedAnnualPensionYen - expectedSuspension),
  );

  console.log('OK 2028 continuation: amount resolver never guesses missing legal inputs');
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

{
  const reformDeath = { year: 2028, month: 4 };
  const domesticChild = member({
    ...child,
    pensionChildResidence: 'japan',
  });
  const unknownChild = member({
    ...child,
    id: 'unknown-child',
    pensionChildResidence: 'unknown',
  });

  const domesticState = createDefaultPensionMemberState();
  domesticState.benefitSettings.survivorPremiumRequirement = 'met';
  const deathMonth = calcCoverageSurvivorEmployeesDetail({
    familyMembers: [head, wife38, domesticChild],
    subject: 'head',
    pensionByMember: { [head.id]: domesticState },
    originalIncomeByMember: { [head.id]: [headIncome] },
    coverageIncomeByMember: {},
    referenceDate,
    death: reformDeath,
    year: 2028,
    month: 4,
  });
  assert.equal(deathMonth.detail.basic, 0);
  assert.equal(deathMonth.detail.children, 0);

  const domestic = calcCoverageSurvivorEmployeesDetail({
    familyMembers: [head, wife38, domesticChild],
    subject: 'head',
    pensionByMember: { [head.id]: domesticState },
    originalIncomeByMember: { [head.id]: [headIncome] },
    coverageIncomeByMember: {},
    referenceDate,
    death: reformDeath,
    year: 2028,
    month: 5,
  });
  assert.ok(domestic.detail.children > 0);

  const unknown = calcCoverageSurvivorEmployeesDetail({
    familyMembers: [head, wife38, unknownChild],
    subject: 'head',
    pensionByMember: { [head.id]: domesticState },
    originalIncomeByMember: { [head.id]: [headIncome] },
    coverageIncomeByMember: {},
    referenceDate,
    death: reformDeath,
    year: 2028,
    month: 5,
  });
  assert.equal(unknown.detail.children, 0);
  console.log('OK survivor employees starts after death month and child addition requires domestic/exception residence');
}

assert.equal(CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE, 30);
console.log('verify-survivor-employees: all passed');
