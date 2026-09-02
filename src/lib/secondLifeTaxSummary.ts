import { calcMemberAnnualPensionManByMember } from './calculationBreakdown';
import { getMemberAgeAtYearEnd } from './memberYearIncome';
import {
  buildMemberTaxBreakdownData,
  calcPublicPensionDeductionYen,
  describePublicPensionDeductionFormula,
  type MemberTaxBreakdownData,
} from './taxCalculator';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { PensionByMember } from '../types/pension';
import type {
  SecondLifeTaxSummaryConfig,
  SecondLifeTaxSummaryRow,
  SecondLifeTaxSummarySection,
} from '../types/secondLifeTaxSummary';

function formatYen(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`;
}

function sumSocialInsuranceDeductionYen(
  deduction: NonNullable<
    ReturnType<typeof buildMemberTaxBreakdownData>
  >['incomeTax']['socialInsuranceDeduction'],
): number {
  return (
    deduction.employeesPension +
    deduction.healthInsurance +
    deduction.longTermCare +
    deduction.nationalPension +
    deduction.nationalHealthInsurance +
    deduction.employmentInsurance
  );
}

function describeSocialInsuranceDeductionLabel(
  deduction: NonNullable<
    ReturnType<typeof buildMemberTaxBreakdownData>
  >['incomeTax']['socialInsuranceDeduction'],
): string {
  const parts: string[] = [];
  if (deduction.nationalHealthInsurance > 0) {
    parts.push('国保');
  }
  if (deduction.healthInsurance > 0) {
    parts.push('健康保険');
  }
  if (deduction.employeesPension > 0) {
    parts.push('厚生年金');
  }
  if (deduction.nationalPension > 0) {
    parts.push('国民年金');
  }
  if (deduction.employmentInsurance > 0) {
    parts.push('雇用保険');
  }

  if (parts.length === 0) {
    return '社会保険料控除';
  }
  if (parts.length === 1) {
    return `社会保険料控除（${parts[0]}）`;
  }
  return `社会保険料控除（${parts.join('・')}）`;
}

function buildPensionSection(input: {
  pensionRevenueYen: number;
  deductionYen: number;
  pensionIncomeYen: number;
  deductionFormula: string;
}): SecondLifeTaxSummarySection {
  const rows: SecondLifeTaxSummaryRow[] = [
    {
      label: '公的年金の受給額',
      value: formatYen(input.pensionRevenueYen),
    },
    {
      label: '公的年金等控除',
      value: formatYen(input.deductionYen),
      note: input.pensionRevenueYen > 0 ? input.deductionFormula : undefined,
    },
    {
      label: '公的年金等の雑所得',
      value: formatYen(input.pensionIncomeYen),
      variant: 'subtotal',
    },
  ];

  return {
    title: '年金から雑所得へ',
    rows,
  };
}

function buildIncomeTaxSection(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): SecondLifeTaxSummarySection {
  const { incomeTax: tax } = data;
  const socialDeductionYen = sumSocialInsuranceDeductionYen(
    tax.socialInsuranceDeduction,
  );
  const personalDeductionYen =
    tax.spouseDeductionYen +
    tax.dependentDeductionYen +
    tax.singleParentDeductionYen +
    tax.disabilityDeductionYen +
    tax.workingStudentDeductionYen;

  const totalIncomeYen = tax.totalIncomeYen;
  const businessIncomeYen = data.businessIncome?.businessIncomeYen ?? 0;
  const otherNonSalaryIncomeYen = Math.max(
    0,
    tax.otherIncomeExcludingPensionYen -
      tax.salaryIncomeYen -
      businessIncomeYen,
  );

  const rows: SecondLifeTaxSummaryRow[] = [];

  if (tax.salaryIncomeYen > 0) {
    rows.push({
      label: '給与所得',
      value: formatYen(tax.salaryIncomeYen),
    });
  }
  if (businessIncomeYen > 0) {
    rows.push({
      label: '事業所得',
      value: formatYen(businessIncomeYen),
    });
  }
  if (otherNonSalaryIncomeYen > 0) {
    rows.push({
      label: 'その他の所得',
      value: formatYen(otherNonSalaryIncomeYen),
    });
  }
  if (tax.pensionIncomeYen > 0) {
    rows.push({
      label: '公的年金等の雑所得',
      value: formatYen(tax.pensionIncomeYen),
    });
  }
  rows.push({
    label: '合計所得',
    value: formatYen(totalIncomeYen),
    variant: 'subtotal',
  });

  if (socialDeductionYen > 0) {
    rows.push({
      label: describeSocialInsuranceDeductionLabel(tax.socialInsuranceDeduction),
      value: formatYen(socialDeductionYen),
    });
  }

  if (tax.basicDeductionYen > 0) {
    rows.push({
      label: '基礎控除',
      value: formatYen(tax.basicDeductionYen),
    });
  }

  if (personalDeductionYen > 0) {
    rows.push({
      label: '配偶者・扶養控除など',
      value: formatYen(personalDeductionYen),
    });
  }

  rows.push(
    {
      label: '課税所得',
      value: formatYen(tax.taxableIncomeYen),
      variant: 'subtotal',
    },
    {
      label: '所得税',
      value: formatYen(tax.incomeTaxYen),
      variant: 'result',
    },
  );

  return {
    title: '所得税',
    rows,
  };
}

function buildResidentTaxSection(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): SecondLifeTaxSummarySection {
  const { residentTax: tax } = data;
  const socialDeductionYen = sumSocialInsuranceDeductionYen(
    tax.socialInsuranceDeduction,
  );
  const personalDeductionYen =
    data.incomeTax.residentSpouseDeductionYen +
    data.incomeTax.residentDependentDeductionYen;

  const totalIncomeYen = tax.totalIncomeYen;
  const levyBusinessIncomeYen = data.levyBusinessIncome?.businessIncomeYen ?? 0;
  const otherNonSalaryIncomeYen = Math.max(
    0,
    tax.otherIncomeExcludingPensionYen -
      tax.salaryIncomeYen -
      levyBusinessIncomeYen,
  );
  const residentBasicDeductionYen = data.incomeTax.residentBasicDeductionYen;

  const rows: SecondLifeTaxSummaryRow[] = [];

  if (tax.salaryIncomeYen > 0) {
    rows.push({
      label: '給与所得',
      value: formatYen(tax.salaryIncomeYen),
      note: `${tax.incomeReferenceYear}年の所得を基準`,
    });
  }
  if (levyBusinessIncomeYen > 0) {
    rows.push({
      label: '事業所得',
      value: formatYen(levyBusinessIncomeYen),
      note: `${tax.incomeReferenceYear}年の所得を基準`,
    });
  }
  if (otherNonSalaryIncomeYen > 0) {
    rows.push({
      label: 'その他の所得',
      value: formatYen(otherNonSalaryIncomeYen),
      note: `${tax.incomeReferenceYear}年の所得を基準`,
    });
  }
  if (tax.pensionRevenueYen > 0) {
    rows.push({
      label: '公的年金の受給額',
      value: formatYen(tax.pensionRevenueYen),
      note: `${tax.incomeReferenceYear}年の所得を基準`,
    });
    rows.push({
      label: '公的年金等控除',
      value: formatYen(tax.pensionDeductionYen),
    });
  }
  if (tax.pensionIncomeYen > 0) {
    rows.push({
      label: '公的年金等の雑所得',
      value: formatYen(tax.pensionIncomeYen),
      note: `${tax.incomeReferenceYear}年の所得を基準`,
    });
  }
  rows.push({
    label: '合計所得',
    value: formatYen(totalIncomeYen),
    variant: 'subtotal',
  });

  if (socialDeductionYen > 0) {
    rows.push({
      label: describeSocialInsuranceDeductionLabel(
        tax.socialInsuranceDeduction,
      ),
      value: formatYen(socialDeductionYen),
      note: `${tax.incomeReferenceYear}年分の社会保険料控除`,
    });
  }

  if (residentBasicDeductionYen > 0) {
    rows.push({
      label: '基礎控除（住民税）',
      value: formatYen(residentBasicDeductionYen),
    });
  }

  if (personalDeductionYen > 0) {
    rows.push({
      label: '配偶者・扶養控除など（住民税）',
      value: formatYen(personalDeductionYen),
    });
  }

  rows.push(
    {
      label: '課税所得',
      value: formatYen(tax.taxableIncomeYen),
      variant: 'subtotal',
    },
    {
      label: '住民税',
      value: formatYen(tax.adjustedResidentTaxYen),
      variant: 'result',
      note:
        tax.adjustmentCreditYen > 0
          ? `調整控除 ${formatYen(tax.adjustmentCreditYen)} を反映`
          : undefined,
    },
  );

  return {
    title: '住民税',
    rows,
  };
}

export function buildSecondLifeTaxSummaryConfig(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear: number;
  memberId: string;
  simulationStartYear?: number;
  memberTaxBreakdownData?: MemberTaxBreakdownData | null;
}): SecondLifeTaxSummaryConfig | null {
  const member = input.familyMembers.find((m) => m.id === input.memberId);
  if (!member || member.role === 'pet') {
    return null;
  }

  const annualPensionManByMember = calcMemberAnnualPensionManByMember({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    pensionByMember: input.pensionByMember,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
  });
  const pensionRevenueYen = Math.round(
    (annualPensionManByMember[input.memberId] ?? 0) * 10_000,
  );

  const breakdownData =
    input.memberTaxBreakdownData ??
    buildMemberTaxBreakdownData({
      familyMembers: input.familyMembers,
      incomeByMember: input.incomeByMember,
      priorYearIncomeByMember: input.priorYearIncomeByMember,
      referenceDate: input.referenceDate,
      calendarYear: input.calendarYear,
      memberId: input.memberId,
      annualPensionManByMember,
      pensionByMember: input.pensionByMember,
      simulationStartYear: input.simulationStartYear,
    });
  if (!breakdownData) {
    return null;
  }

  const memberAge =
    getMemberAgeAtYearEnd(member, input.referenceDate, input.calendarYear) ??
    65;
  const otherIncomeYen = breakdownData.incomeTax.otherIncomeExcludingPensionYen;
  const deductionYen = calcPublicPensionDeductionYen(
    pensionRevenueYen,
    memberAge,
    otherIncomeYen,
  );
  const deductionFormula = describePublicPensionDeductionFormula(
    pensionRevenueYen,
    memberAge,
    otherIncomeYen,
  );

  const notes = [
    `試算対象年は${input.calendarYear}年です（公的年金を12か月分受給する年）。`,
    '各タブの詳細計算と同じ数値を、流れが追いやすいよう要約しています。',
    '公的年金等控除は国税庁タックスアンサー No.1600（令和2年以降）に基づく概算です。',
  ];

  if (pensionRevenueYen <= 0) {
    notes.unshift(
      `${input.calendarYear}年時点では公的年金の受給がありません。`,
    );
  }

  if (
    breakdownData.incomeTax.taxableIncomeYen <= 0 &&
    breakdownData.incomeTax.pensionIncomeYen > 0 &&
    breakdownData.isTaxIndependent
  ) {
    notes.push(
      '課税所得が0円のため所得税はかかりません。公的年金等控除・社会保険料控除・基礎控除の合計が、年金雑所得を上回っている場合に起こります。',
    );
  }

  if (!breakdownData.isTaxIndependent) {
    notes.unshift(
      'このメンバーは世帯主の扶養に入っているため、所得税は世帯主の申告で計算されます。',
    );
  }

  if (breakdownData.residentTax.isExempt) {
    notes.push('住民税は非課税区分に該当するため、試算上の住民税は0円です。');
  }

  return {
    fiscalYearLabel: `${input.calendarYear}年`,
    memberAge,
    sections: [
      buildPensionSection({
        pensionRevenueYen,
        deductionYen,
        pensionIncomeYen: breakdownData.incomeTax.pensionIncomeYen,
        deductionFormula,
      }),
      buildIncomeTaxSection(breakdownData),
      buildResidentTaxSection(breakdownData),
    ],
    notes,
    isTaxIndependent: breakdownData.isTaxIndependent,
  };
}
