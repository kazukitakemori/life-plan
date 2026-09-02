/**
 * Q10 保険収入 CF の簡易検証
 * npx tsx scripts/verify-insurance-income-cf.mjs
 */
import { calcBirthYear } from '../src/lib/birthDate.ts';
import {
  calcHouseholdMonthlyInsuranceIncomeDetailMan,
  createEmptyInsuranceIncomeDetail,
  addInsuranceIncomeDetail,
} from '../src/lib/insuranceCashFlow.ts';
import { createInsuranceEntry } from '../src/lib/insuranceDefaults.ts';
import { createFamilyMember } from '../src/lib/familyDefaults.ts';

const referenceDate = new Date(2026, 5, 1);
const head = createFamilyMember('head');
const child = createFamilyMember('child');
const members = [head, child];

function sumAnnualIncome(state, year) {
  const annual = createEmptyInsuranceIncomeDetail();
  for (let month = 1; month <= 12; month++) {
    addInsuranceIncomeDetail(
      annual,
      calcHouseholdMonthlyInsuranceIncomeDetailMan(
        members,
        state,
        referenceDate,
        year,
        month,
      ),
    );
  }
  return annual;
}

function yearWhenMemberReachesAge(member, targetAge) {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return birthYear + targetAge;
}

// 学資：一括 50万円（子ども18歳）
const educationLump = createInsuranceEntry('education', head, referenceDate, {
  benefitPayoutMode: 'lump_sum',
  benefitAmountMan: 50,
  benefitReceiveAge: 18,
  benefitReceiveMemberId: child.id,
  beneficiaryMemberId: child.id,
}, members);

const educationLumpYear = yearWhenMemberReachesAge(child, 18);
const educationLumpResult = sumAnnualIncome(
  { byMember: { [head.id]: [educationLump] } },
  educationLumpYear,
);
if (educationLumpResult.education !== 50) {
  console.error(
    `FAIL education lump: expected 50, got ${educationLumpResult.education}`,
  );
  process.exit(1);
}

// 学資：年金 10万円/年 × 4年
const educationAnnuity = createInsuranceEntry('education', head, referenceDate, {
  benefitPayoutMode: 'annuity',
  benefitAmountMan: 10,
  benefitReceiveAge: 18,
  educationAnnuityYears: 4,
  benefitReceiveMemberId: child.id,
  beneficiaryMemberId: child.id,
}, members);

let annuityTotal = 0;
for (let year = educationLumpYear; year < educationLumpYear + 4; year++) {
  annuityTotal += sumAnnualIncome(
    { byMember: { [head.id]: [educationAnnuity] } },
    year,
  ).education;
}
if (annuityTotal !== 40) {
  console.error(`FAIL education annuity: expected 40, got ${annuityTotal}`);
  process.exit(1);
}

// 個人年金：一括 200万円（世帯主65歳）
const pensionLump = createInsuranceEntry(
  'personal_pension',
  head,
  referenceDate,
  {
    benefitPayoutMode: 'lump_sum',
    benefitAmountMan: 200,
    benefitReceiveAge: 65,
    benefitReceiveMemberId: head.id,
    beneficiaryMemberId: head.id,
  },
  members,
);
const pensionYear = yearWhenMemberReachesAge(head, 65);
const pensionResult = sumAnnualIncome(
  { byMember: { [head.id]: [pensionLump] } },
  pensionYear,
);
if (pensionResult.personalPension !== 200) {
  console.error(
    `FAIL personal pension lump: expected 200, got ${pensionResult.personalPension}`,
  );
  process.exit(1);
}

// 返戻金：死亡保険 30万円（世帯主60歳）
const lifeReturn = createInsuranceEntry('life', head, referenceDate, {
  hasReturnValue: true,
  returnValueMan: 30,
  returnValueAge: 60,
});
const returnYear = yearWhenMemberReachesAge(head, 60);
const returnResult = sumAnnualIncome(
  { byMember: { [head.id]: [lifeReturn] } },
  returnYear,
);
if (returnResult.returnValue !== 30) {
  console.error(
    `FAIL return value: expected 30, got ${returnResult.returnValue}`,
  );
  process.exit(1);
}

console.log('OK insurance income CF', {
  educationLump: educationLumpResult.education,
  educationAnnuityTotal: annuityTotal,
  personalPension: pensionResult.personalPension,
  returnValue: returnResult.returnValue,
});
