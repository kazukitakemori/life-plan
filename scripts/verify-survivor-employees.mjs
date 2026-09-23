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
  hasConfirmedNoUnpaidInRecentYear,
  hasConfirmedTwoThirdsPremiumRequirement,
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
  // 2028年改正の5年有期給付後は、65歳まで継続給付の判定対象として追跡する。
  const reformDeath = { year: 2028, month: 4 };
  assert.equal(
    resolveSurvivorContinuationAssessmentTarget(
      [head, wife38],
      'head',
      referenceDate,
      reformDeath,
      { year: 2033, month: 3 },
    ),
    null,
  );
  const continuationTarget = resolveSurvivorContinuationAssessmentTarget(
    [head, wife38],
    'head',
    referenceDate,
    reformDeath,
    { year: 2033, month: 4 },
  );
  assert.equal(continuationTarget?.member.id, wife38.id);
  assert.deepEqual(continuationTarget?.finiteBenefitStart, reformDeath);
  assert.deepEqual(continuationTarget?.finiteBenefitEnd, {
    year: 2033,
    month: 3,
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
    { year: 2033, month: 4 },
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

assert.equal(CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE, 30);
console.log('verify-survivor-employees: all passed');
