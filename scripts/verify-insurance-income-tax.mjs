/**
 * 保険収入の税区分（一時所得・雑所得・贈与税）の検証
 * npx tsx scripts/verify-insurance-income-tax.mjs
 */
import { calcBirthYear } from '../src/lib/birthDate.ts';
import {
  classifyInsuranceBenefitIncomeKind,
  calcAnnuityExpenseRatio,
  calcAnnuityNecessaryExpenseYen,
  calcInsuranceEntryIncomeTaxPreview,
  calcRecipientInsuranceIncomeTaxDetail,
  formatInsuranceEntryIncomeTaxPreview,
  resolveAnnuityPayoutEstimateYears,
} from '../src/lib/insuranceIncomeTax.ts';
import { getAnnuityRemainingLifeYears } from '../src/lib/annuityRemainingLife.ts';
import {
  calcMiscellaneousIncomeYen,
  calcTemporaryIncomeYen,
} from '../src/lib/incomeTaxDeductions.ts';
import { createInsuranceEntry } from '../src/lib/insuranceDefaults.ts';
import { createFamilyMember } from '../src/lib/familyDefaults.ts';
import { buildMemberTaxBreakdownData } from '../src/lib/taxCalculator.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

const referenceDate = new Date(2026, 5, 1);
const head = createFamilyMember('head');
const child = createFamilyMember('child');
const members = [head, child];
const emptyHousing = { byTarget: {} };
const emptyVehicle = { inflationRate: 0, byMember: {} };

function yearWhenMemberReachesAge(member, targetAge) {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return birthYear + targetAge;
}

const lumpPension = createInsuranceEntry('personal_pension', head, referenceDate, {
  benefitPayoutMode: 'lump_sum',
});
assertEq(
  classifyInsuranceBenefitIncomeKind(lumpPension, head.id, head.id),
  'temporary_income',
  'self lump pension',
);
const annuityPension = createInsuranceEntry('personal_pension', head, referenceDate, {
  benefitPayoutMode: 'annuity',
});
assertEq(
  classifyInsuranceBenefitIncomeKind(annuityPension, head.id, head.id),
  'miscellaneous_income',
  'self annuity pension',
);
const educationGift = createInsuranceEntry('education', head, referenceDate, {
  benefitPayoutMode: 'lump_sum',
  beneficiaryMemberId: child.id,
}, members);
assertEq(
  classifyInsuranceBenefitIncomeKind(educationGift, head.id, child.id),
  'gift_tax',
  'education to child',
);

// 余命年数（所得税法施行令別表）
assertEq(getAnnuityRemainingLifeYears(55, 'female'), 27, 'life 55F');
assertEq(getAnnuityRemainingLifeYears(65, 'male'), 15, 'life 65M');

// JILI事例相当: 総収入45万・払込950万・55歳女性・終身 → 余命27年
// 総支給見込 = 45万×27、必要経費割合 = ceil(950/1215, 2桁)=0.79
// 必要経費 = floor(45万×0.79)=355,500、雑所得=94,500
{
  const revenueYen = 450_000;
  const premiumYen = 9_500_000;
  const years = resolveAnnuityPayoutEstimateYears(
    { category: 'personal_pension', personalPensionAnnuityKind: 'lifetime' },
    27,
  );
  assertEq(years, 27, 'jili estimate years');
  const totalEstimateYen = revenueYen * years;
  assertEq(calcAnnuityExpenseRatio(premiumYen, totalEstimateYen), 0.79, 'jili ratio');
  const expenseYen = calcAnnuityNecessaryExpenseYen(
    revenueYen,
    premiumYen,
    totalEstimateYen,
  );
  assertEq(expenseYen, 355_500, 'jili expense');
  assertEq(
    calcMiscellaneousIncomeYen(revenueYen, expenseYen),
    94_500,
    'jili misc income',
  );
}

// 返戻金（契約者受取）→ 一時所得
const lifeReturn = createInsuranceEntry('life', head, referenceDate, {
  hasReturnValue: true,
  returnValueMan: 100,
  returnValueAge: 60,
  startAge: head.age,
  startMonth: 1,
  premiumMan: 0,
  premiumPaymentMode: 'annual',
});
const returnYear = yearWhenMemberReachesAge(head, 60);
const returnTax = calcRecipientInsuranceIncomeTaxDetail({
  recipientId: head.id,
  familyMembers: members,
  insuranceState: { byMember: { [head.id]: [lifeReturn] } },
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: returnYear,
  monthStart: 1,
  monthEnd: 12,
});
const expectedReturnRevenueYen = 1_000_000;
const expectedReturnTaxable = calcTemporaryIncomeYen(expectedReturnRevenueYen, 0);
assertEq(returnTax.temporaryIncomeRevenueYen, expectedReturnRevenueYen, 'return revenue');
assertEq(returnTax.temporaryIncomeTaxableYen, expectedReturnTaxable, 'return temporary');
assertEq(returnTax.miscellaneousIncomeTaxableYen, 0, 'return misc');

// 学資一括（子ども受取）→ 贈与税
const education = createInsuranceEntry('education', head, referenceDate, {
  benefitPayoutMode: 'lump_sum',
  benefitAmountMan: 50,
  benefitReceiveAge: 18,
  benefitReceiveMemberId: child.id,
  beneficiaryMemberId: child.id,
}, members);
const educationYear = yearWhenMemberReachesAge(child, 18);
const educationTax = calcRecipientInsuranceIncomeTaxDetail({
  recipientId: child.id,
  familyMembers: members,
  insuranceState: { byMember: { [head.id]: [education] } },
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: educationYear,
  monthStart: 1,
  monthEnd: 12,
});
assertEq(educationTax.giftAmountYen, 500_000, 'education gift amount');

// 個人年金・年金形式（契約者受取）→ 雑所得
// 収入10万円/年・払込累計25万円・確定10年
// 総支給見込=100万円、割合=0.25、必要経費=25,000、雑所得=75,000
const personalPensionAnnuity = createInsuranceEntry(
  'personal_pension',
  head,
  referenceDate,
  {
    benefitPayoutMode: 'annuity',
    personalPensionAnnuityKind: 'certain',
    benefitAmountMan: 10,
    benefitReceiveAge: 65,
    benefitReceiveMemberId: head.id,
    beneficiaryMemberId: head.id,
    personalPensionAnnuityYears: 10,
    startAge: head.age - 5,
    startMonth: 1,
    endMode: 'until',
    endAge: head.age - 1,
    endMonth: 12,
    premiumMan: 5,
    premiumPaymentMode: 'annual',
  },
  members,
);
const pensionYear = yearWhenMemberReachesAge(head, 65);
const pensionTax = calcRecipientInsuranceIncomeTaxDetail({
  recipientId: head.id,
  familyMembers: members,
  insuranceState: { byMember: { [head.id]: [personalPensionAnnuity] } },
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: pensionYear,
  monthStart: 1,
  monthEnd: 12,
});
const pensionRevenueYen = 100_000;
const pensionExpenseYen = calcAnnuityNecessaryExpenseYen(
  pensionRevenueYen,
  250_000,
  pensionRevenueYen * 10,
);
const expectedMiscTaxable = calcMiscellaneousIncomeYen(
  pensionRevenueYen,
  pensionExpenseYen,
);
assertEq(pensionTax.miscellaneousIncomeRevenueYen, pensionRevenueYen, 'pension revenue');
assertEq(
  pensionTax.miscellaneousIncomeTaxableYen,
  expectedMiscTaxable,
  'pension misc taxable',
);
assertEq(expectedMiscTaxable, 75_000, 'pension misc expected');
assertEq(pensionTax.temporaryIncomeTaxableYen, 0, 'pension temporary');

const pensionByMember = createDefaultPensionByMember(members);
const breakdown = buildMemberTaxBreakdownData({
  familyMembers: members,
  incomeByMember: {},
  referenceDate,
  calendarYear: pensionYear,
  memberId: head.id,
  monthStart: 1,
  monthEnd: 12,
  annualPensionManByMember: {},
  pensionByMember,
  simulationStartYear: 2026,
  insuranceState: { byMember: { [head.id]: [personalPensionAnnuity] } },
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
});
if (!breakdown) throw new Error('no breakdown');
assertEq(
  breakdown.incomeTax.insuranceMiscellaneousIncomeTaxableYen,
  expectedMiscTaxable,
  'breakdown misc income',
);

const preview = calcInsuranceEntryIncomeTaxPreview({
  entry: personalPensionAnnuity,
  contractor: head,
  familyMembers: members,
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
});
assertEq(preview.kind, 'miscellaneous_income', 'preview kind');
assertEq(preview.incomeYen, expectedMiscTaxable, 'preview income');
assertEq(preview.expenseYen, pensionExpenseYen, 'preview expense');
assertEq(
  formatInsuranceEntryIncomeTaxPreview(preview),
  `雑所得：${expectedMiscTaxable.toLocaleString('ja-JP')}円 （収入${pensionRevenueYen.toLocaleString('ja-JP')}円 − 必要経費${pensionExpenseYen.toLocaleString('ja-JP')}円）`,
  'preview label',
);

// 学資（子ども受取）贈与でも累計払込保険料を表示する
const educationPremium = createInsuranceEntry(
  'education',
  head,
  referenceDate,
  {
    benefitPayoutMode: 'lump_sum',
    benefitAmountMan: 200,
    benefitReceiveAge: 18,
    benefitReceiveMemberId: child.id,
    beneficiaryMemberId: child.id,
    premiumMan: 10,
    premiumPaymentMode: 'annual',
  },
  members,
);
const educationPreview = calcInsuranceEntryIncomeTaxPreview({
  entry: educationPremium,
  contractor: head,
  familyMembers: members,
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
});
assertEq(educationPreview.kind, 'gift_tax', 'education gift kind');
if (educationPreview.expenseYen <= 0) {
  console.error(
    `FAIL education gift premium: expected cumulative > 0, got ${educationPreview.expenseYen}`,
  );
  process.exit(1);
}
const educationParts = formatInsuranceEntryIncomeTaxPreview(educationPreview);
if (!educationParts || !educationParts.includes('累計払込保険料')) {
  console.error(`FAIL education gift label missing premium: ${educationParts}`);
  process.exit(1);
}

console.log('OK insurance income tax', {
  returnTax,
  educationTax,
  pensionTax,
  expectedMiscTaxable,
  previewLabel: formatInsuranceEntryIncomeTaxPreview(preview),
});
