import { writeFileSync } from 'node:fs';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { calcHouseholdTaxYearResult } from '../src/lib/householdTaxYear.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';

const referenceDate = new Date(2026, 7, 1);
const head = {
  id: 'head',
  role: 'head',
  age: 40,
  birthMonth: 3,
  birthDay: 15,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};
const spouse = {
  id: 'spouse',
  role: 'spouse',
  age: 38,
  birthMonth: 5,
  birthDay: 10,
  expectedLifespan: 90,
  nickname: '',
  gender: 'female',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};
const emp = (id, age, man) => ({
  id: `${id}-e`,
  memberId: id,
  category: 'employee',
  spouseContingencyOnly: false,
  periods: [
    {
      id: `${id}-p`,
      startAge: age,
      startMonth: 1,
      endAge: 60,
      endMonth: 12,
      streamType: 'salary_social_insurance',
      monthlyAmountMan: man,
      bonuses: [],
      annualAmountMan: man * 12,
      spouseContingencyRate: null,
      annualIncreaseRate: null,
    },
  ],
  expenseManPerMonth: null,
  filingType: null,
});
const members = [head, spouse];
const incomeByMember = {
  head: [emp('head', 40, 30)],
  spouse: [emp('spouse', 38, 50)],
};
const pensionByMember = createDefaultPensionByMember(members);
const cf = buildCashFlowTable({
  familyMembers: members,
  incomeByMember,
  livingState: createDefaultLivingState(head, 9),
  housingState: createDefaultHousingState(head, 9),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember,
  taxSocialState: createDefaultTaxSocialState(40, 9),
  referenceDate,
});
const start = cf.years[0].calendarYear;
const out = [];
for (const year of [start + 1, start + 2]) {
  const y = cf.years.find((r) => r.calendarYear === year);
  const r = calcHouseholdTaxYearResult({
    familyMembers: members,
    incomeByMember,
    pensionByMember,
    referenceDate,
    calendarYear: year,
    monthStart: y.simulationMonthStart,
    monthEnd: y.simulationMonthEnd,
    levyPaymentFactor: y.levyPaymentFactor,
    simulationStartYear: start,
    annualPensionManByMember: {},
  });
  for (const [id, bd] of Object.entries(r.memberBreakdownByMemberId)) {
    const ins = bd.employeeInsurance;
    out.push({
      year,
      id,
      nursingYen: ins.annualHealthNursingYen,
      medicalYen: ins.annualHealthMedicalSupportYen,
      childYen: ins.annualHealthChildcareYen,
      healthTotalYen:
        ins.annualHealthMedicalSupportYen +
        ins.annualHealthChildcareYen +
        ins.annualHealthNursingYen,
    });
  }
}
writeFileSync('tmp-nursing.json', JSON.stringify(out, null, 2));
console.log('ok');
