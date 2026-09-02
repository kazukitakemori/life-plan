import { calcMemberAnnualPensionManByMember } from './pensionIncome';
import { FUKUOKA_PENSION_INSURANCE_RATE } from '../data/fukuokaStandardRemunerationR8';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { PensionByMember } from '../types/pension';
import {
  buildMemberTaxBreakdownData,
  describePublicPensionDeductionFormula,
  TAX_RATE_CONSTANTS,
  type MemberTaxBreakdownData,
} from './taxCalculator';
import { formatSpouseDeductionLabel } from './spouseDeduction';
import type { OtherProrationContext } from './otherCashFlowLinkage';
import {
  formatLevyProrationLabel,
  formatManFromYen,
  prorateAnnualLevyYen,
} from './otherCashFlowLinkage';
import type {
  BreakdownFormulaRow,
  BreakdownProrationCallout,
  CalculationBreakdownConfig,
} from '../types/calculationBreakdown';
import type { TaxBreakdownReferenceDetail } from '../types/taxBreakdownReference';
import {
  buildBasicDeductionReferenceDetail,
  buildDependentDeductionReferenceDetail,
  buildLifeInsuranceDeductionReferenceDetail,
  buildPublicPensionDeductionReferenceDetail,
  buildSalaryIncomeDeductionReferenceDetail,
  buildSmallScaleMutualAidReferenceDetail,
  buildSpouseDeductionReferenceDetail,
} from './taxBreakdownReferenceDetail';
import {
  breakdownItemLabeledRef,
  breakdownLabeledRef,
} from './breakdownRefFormat';

export { calcMemberAnnualPensionManByMember } from './pensionIncome';

function formatYen(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`;
}

function formatPercent(rate: number): string {
  if (rate <= 0) return '0%';
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function formatBreakdownFiscalYearLabel(calendarYear: number): string {
  return `${calendarYear}年`;
}

function attachFiscalYearLabel(
  config: CalculationBreakdownConfig,
  calendarYear: number,
): CalculationBreakdownConfig {
  return {
    ...config,
    fiscalYearLabel: formatBreakdownFiscalYearLabel(calendarYear),
  };
}

function buildProrationCallout(
  proration: OtherProrationContext,
  annualAmountYen: number,
  annualAmountLabel: string,
  proratedAmountLabel: string,
  basisDescription: string,
  proratedAmountYenOverride?: number,
): BreakdownProrationCallout | undefined {
  if (!proration.isPartialFirstYear || annualAmountYen <= 0) {
    return undefined;
  }

  const proratedAmountYen =
    proratedAmountYenOverride ??
    prorateAnnualLevyYen(annualAmountYen, proration.levyPaymentFactor);
  const prorationLabel = formatLevyProrationLabel(
    proration.simulationMonthCount,
  );

  return {
    annualAmountYen,
    annualAmountLabel,
    proratedAmountYen,
    proratedAmountLabel,
    prorationLabel,
    explanation: `算定基礎は${basisDescription}です。キャッシュフロー表には年間算定額 ${formatYen(annualAmountYen)} に ${prorationLabel} を乗じた ${formatYen(proratedAmountYen)} を計上しています（${proration.periodLabel}分）。`,
  };
}

function formatIncomeTaxBasisDescription(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): string {
  if (isPensionPrimaryIncomeTax(data)) {
    return `公的年金の受給額（年間${formatManFromYen(data.incomeTax.pensionRevenueYen)}万円・12か月分）`;
  }
  if (data.earnedIncomeFormula === 'mixed' && data.businessIncome) {
    return `Q7の12か月年収（${formatManFromYen(data.proration.annualGrossSalaryYen)}万円）および総収入金額（年間の売上）（${formatManFromYen(data.businessIncome.grossRevenueYen)}万円）`;
  }
  if (data.earnedIncomeFormula === 'business' && data.businessIncome) {
    return `Q7の総収入金額（年間の売上）（${formatManFromYen(data.businessIncome.grossRevenueYen)}万円）`;
  }
  return `Q7の12か月年収（${formatManFromYen(data.proration.annualGrossSalaryYen)}万円）`;
}

function formatResidentTaxPriorYearIncomeLabel(
  resTax: NonNullable<
    ReturnType<typeof buildMemberTaxBreakdownData>
  >['residentTax'],
  amountYen: number,
): string {
  if (resTax.incomeReferenceUsesAnnualBasis) {
    if (resTax.levyPhase === 'simulation_start_next') {
      return `${resTax.incomeReferenceYear}年（前年・試算開始年）のQ7の12か月年収（${formatManFromYen(amountYen)}万円）`;
    }
    return `${resTax.incomeReferenceYear}年（前年）のQ7の12か月年収（${formatManFromYen(amountYen)}万円）`;
  }
  return `${resTax.incomeReferenceYear}年（前年）のQ7期間の暦年所得（${formatManFromYen(amountYen)}万円）`;
}

function describeResidentTaxLevyPhaseNote(
  resTax: NonNullable<
    ReturnType<typeof buildMemberTaxBreakdownData>
  >['residentTax'],
): string {
  if (resTax.resolution === 'prior_year_override') {
    return '前年度の収入はQ7の前年度入力を使用しています。';
  }
  if (resTax.resolution === 'current_year_proxy') {
    return `${resTax.incomeReferenceYear + 1}年の収入（所得税の収入と同じ基準）を前年度として読み替えています。`;
  }
  switch (resTax.levyPhase) {
    case 'simulation_start':
      return resTax.incomeReferenceUsesAnnualBasis
        ? '試算開始年に支払う住民税は、継続収入の場合Q7の12か月年収を前年所得の代用として使用しています（初年度の所得税と同じ基準）。'
        : '試算開始年に支払う住民税は、就職・開業（「新しい収入」ON）の暦年実績を前年所得として使用しています。';
    case 'simulation_start_next':
      return resTax.incomeReferenceUsesAnnualBasis
        ? '試算開始翌年の住民税は、前年（試算開始年）をQ7の12か月年収で評価しています。社会保険料控除も同じ基準です。'
        : '試算開始翌年の住民税は、前年（試算開始年）の暦年実績を使用しています（「新しい収入」ON）。';
    case 'subsequent':
      return '3年目以降は前年（1月〜12月）の暦年所得を基準に計算しています（退職後も前年の所得・社保控除を反映）。';
  }
}

function formatResidentTaxBasisDescription(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): string {
  const { residentTax: resTax, proration } = data;
  if (isPensionPrimaryLevy(data)) {
    return `${resTax.incomeReferenceYear}年（前年）の公的年金の受給額（年間${formatManFromYen(resTax.pensionRevenueYen)}万円）`;
  }
  if (data.levyEarnedIncomeFormula === 'mixed' && data.levyBusinessIncome) {
    const salaryBasis =
      resTax.resolution === 'prior_year_override'
        ? `Q7の前年度収入入力（月額×12＝${formatManFromYen(resTax.grossSalaryRevenueYen)}万円）`
        : resTax.resolution === 'current_year_proxy'
          ? `${resTax.incomeReferenceYear}年（前年）のQ7の12か月年収（${formatManFromYen(proration.annualGrossSalaryYen)}万円）`
          : formatResidentTaxPriorYearIncomeLabel(
              resTax,
              proration.annualGrossSalaryYen,
            );
    const businessBasis =
      resTax.resolution === 'prior_year_override'
        ? `Q7の前年度収入入力（月額×12＝${formatManFromYen(data.levyBusinessIncome.grossRevenueYen)}万円）`
        : `${resTax.incomeReferenceYear}年（前年）のQ7の総収入金額（年間の売上）（${formatManFromYen(data.levyBusinessIncome.grossRevenueYen)}万円）`;
    return `${salaryBasis}および${businessBasis}`;
  }
  if (data.levyEarnedIncomeFormula === 'business' && data.levyBusinessIncome) {
    if (resTax.resolution === 'prior_year_override') {
      return `Q7の前年度収入入力（月額×12＝${formatManFromYen(data.levyBusinessIncome.grossRevenueYen)}万円）`;
    }
    return `${resTax.incomeReferenceYear}年（前年）のQ7の総収入金額（年間の売上）（${formatManFromYen(data.levyBusinessIncome.grossRevenueYen)}万円）`;
  }
  if (resTax.resolution === 'prior_year_override') {
    return `Q7の前年度収入入力（月額×12＝${formatManFromYen(resTax.grossSalaryRevenueYen)}万円）`;
  }
  if (resTax.resolution === 'current_year_proxy') {
    return `${resTax.incomeReferenceYear}年（前年）のQ7の12か月年収（${formatManFromYen(proration.annualGrossSalaryYen)}万円）`;
  }
  return formatResidentTaxPriorYearIncomeLabel(
    resTax,
    proration.annualGrossSalaryYen,
  );
}

type AddBreakdownItem = (
  label: string,
  yen: number,
  refId?: string,
  referenceDetail?: TaxBreakdownReferenceDetail,
) => number;

function appendSalaryEarnedIncomeBlock(input: {
  addItem: AddBreakdownItem;
  rows: BreakdownFormulaRow[];
  calendarYear: number;
  grossSalaryRevenueYen: number;
  baseSalaryIncomeDeductionYen: number;
  incomeAdjustmentDeductionYen: number;
  salaryIncomeYen: number;
  useStandardRefs: boolean;
}): string {
  const idGross = input.addItem(
    '年収（給与収入）',
    input.grossSalaryRevenueYen,
    input.useStandardRefs ? '1' : undefined,
  );
  const idDeduction = input.addItem(
    '給与所得控除',
    input.baseSalaryIncomeDeductionYen,
    input.useStandardRefs ? '2' : undefined,
    buildSalaryIncomeDeductionReferenceDetail({
      calendarYear: input.calendarYear,
      revenueYen: input.grossSalaryRevenueYen,
      deductionYen: input.baseSalaryIncomeDeductionYen,
    }),
  );
  const idAdjustment = input.addItem(
    '所得調整控除',
    input.incomeAdjustmentDeductionYen,
    input.useStandardRefs ? "2'" : undefined,
  );
  const idSalaryIncome = input.addItem(
    '給与所得',
    input.salaryIncomeYen,
    input.useStandardRefs ? '3' : undefined,
  );
  const refLabel = input.useStandardRefs
    ? breakdownLabeledRef('3', '給与所得')
    : breakdownItemLabeledRef(idSalaryIncome, '給与所得');
  input.rows.push({
    segments: input.useStandardRefs
      ? [
          { type: 'text', text: breakdownLabeledRef('1', '年収（給与収入）') },
          { type: 'text', text: breakdownLabeledRef('2', '給与所得控除') },
          { type: 'text', text: breakdownLabeledRef("2'", '所得調整控除') },
        ]
      : [
          { type: 'text', text: breakdownItemLabeledRef(idGross, '年収（給与収入）') },
          { type: 'text', text: breakdownItemLabeledRef(idDeduction, '給与所得控除') },
          { type: 'text', text: breakdownItemLabeledRef(idAdjustment, '所得調整控除') },
        ],
    operators: ['−', '−', '='],
    resultId: idSalaryIncome,
    resultLabel: refLabel,
  });
  return refLabel;
}

function appendBusinessEarnedIncomeBlock(input: {
  addItem: AddBreakdownItem;
  rows: BreakdownFormulaRow[];
  business: NonNullable<
    NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>['businessIncome']
  >;
  useStandardRefs: boolean;
}): string {
  const idGross = input.addItem(
    '総収入金額（年間の売上）',
    input.business.grossRevenueYen,
    input.useStandardRefs ? '1' : undefined,
  );
  const idExpense = input.addItem(
    '経費',
    input.business.annualExpenseYen,
    input.useStandardRefs ? '2' : undefined,
  );
  const idFilingDeduction = input.addItem(
    '申告特別控除',
    input.business.filingDeductionYen,
    input.useStandardRefs ? "2'" : undefined,
  );
  const idBusinessIncome = input.addItem(
    '事業所得',
    input.business.businessIncomeYen,
    input.useStandardRefs ? '3' : undefined,
  );
  const refLabel = input.useStandardRefs
    ? breakdownLabeledRef('3', '事業所得')
    : breakdownItemLabeledRef(idBusinessIncome, '事業所得');
  input.rows.push({
    segments: input.useStandardRefs
      ? [
          { type: 'text', text: breakdownLabeledRef('1', '総収入金額（年間の売上）') },
          { type: 'text', text: breakdownLabeledRef('2', '経費') },
          { type: 'text', text: breakdownLabeledRef("2'", '申告特別控除') },
        ]
      : [
          { type: 'text', text: breakdownItemLabeledRef(idGross, '総収入金額（年間の売上）') },
          { type: 'text', text: breakdownItemLabeledRef(idExpense, '経費') },
          { type: 'text', text: breakdownItemLabeledRef(idFilingDeduction, '申告特別控除') },
        ],
    operators: ['−', '−', '='],
    resultId: idBusinessIncome,
    resultLabel: refLabel,
  });
  return refLabel;
}

function hasSalaryEarnedIncome(input: {
  grossSalaryRevenueYen: number;
  salaryIncomeYen: number;
}): boolean {
  return input.grossSalaryRevenueYen > 0 || input.salaryIncomeYen > 0;
}

function hasBusinessEarnedIncome(
  business: NonNullable<
    ReturnType<typeof buildMemberTaxBreakdownData>
  >['businessIncome'],
): boolean {
  return business != null && business.grossRevenueYen > 0;
}

function calcOtherEarnedIncomeYen(
  otherIncomeExcludingPensionYen: number,
  salaryIncomeYen: number,
  businessIncomeYen: number,
): number {
  return Math.max(
    0,
    otherIncomeExcludingPensionYen - salaryIncomeYen - businessIncomeYen,
  );
}

function hasEarnedIncomeForIncomeTax(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): boolean {
  const tax = data.incomeTax;
  if (hasSalaryEarnedIncome(tax)) return true;
  if (hasBusinessEarnedIncome(data.businessIncome)) return true;
  return (
    calcOtherEarnedIncomeYen(
      tax.otherIncomeExcludingPensionYen,
      tax.salaryIncomeYen,
      data.businessIncome?.businessIncomeYen ?? 0,
    ) > 0
  );
}

function isPensionPrimaryIncomeTax(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): boolean {
  return data.incomeTax.pensionRevenueYen > 0 && !hasEarnedIncomeForIncomeTax(data);
}

function hasEarnedIncomeForLevy(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): boolean {
  const tax = data.residentTax;
  if (hasSalaryEarnedIncome(tax)) return true;
  if (hasBusinessEarnedIncome(data.levyBusinessIncome)) return true;
  return (
    calcOtherEarnedIncomeYen(
      tax.otherIncomeExcludingPensionYen,
      tax.salaryIncomeYen,
      data.levyBusinessIncome?.businessIncomeYen ?? 0,
    ) > 0
  );
}

function isPensionPrimaryLevy(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): boolean {
  return data.residentTax.pensionRevenueYen > 0 && !hasEarnedIncomeForLevy(data);
}

function appendPensionMiscIncomeBlock(input: {
  addItem: AddBreakdownItem;
  rows: BreakdownFormulaRow[];
  memberAge: number;
  otherIncomeExcludingPensionYen: number;
  pensionRevenueYen: number;
  pensionDeductionYen: number;
  pensionIncomeYen: number;
  useStandardRefs: boolean;
}): string | null {
  if (input.pensionRevenueYen <= 0 && input.pensionIncomeYen <= 0) {
    return null;
  }

  const idRevenue = input.addItem(
    '公的年金の受給額',
    input.pensionRevenueYen,
    input.useStandardRefs ? '1' : undefined,
  );
  const idDeduction = input.addItem(
    '公的年金等控除',
    input.pensionDeductionYen,
    input.useStandardRefs ? '2' : undefined,
    buildPublicPensionDeductionReferenceDetail({
      age: input.memberAge,
      pensionYen: input.pensionRevenueYen,
      otherIncomeYen: input.otherIncomeExcludingPensionYen,
      deductionYen: input.pensionDeductionYen,
    }),
  );
  const idIncome = input.addItem(
    '公的年金等の雑所得',
    input.pensionIncomeYen,
    input.useStandardRefs ? '3' : undefined,
  );
  const refLabel = input.useStandardRefs
    ? breakdownLabeledRef('3', '公的年金等の雑所得')
    : breakdownItemLabeledRef(idIncome, '公的年金等の雑所得');
  input.rows.push({
    segments: input.useStandardRefs
      ? [
          { type: 'text', text: breakdownLabeledRef('1', '公的年金の受給額') },
          { type: 'text', text: breakdownLabeledRef('2', '公的年金等控除') },
        ]
      : [
          { type: 'text', text: breakdownItemLabeledRef(idRevenue, '公的年金の受給額') },
          { type: 'text', text: breakdownItemLabeledRef(idDeduction, '公的年金等控除') },
        ],
    operators: ['−', '='],
    resultId: idIncome,
    resultLabel: refLabel,
  });
  return refLabel;
}

function appendTotalIncomeRow(input: {
  addItem: AddBreakdownItem;
  rows: BreakdownFormulaRow[];
  incomeComponentRefLabels: string[];
  totalIncomeYen: number;
}): number {
  const idTotalIncome = input.addItem('合計所得', input.totalIncomeYen);
  if (input.incomeComponentRefLabels.length === 0) {
    return idTotalIncome;
  }

  const segments: BreakdownFormulaRow['segments'] =
    input.incomeComponentRefLabels.map((refLabel) => ({
      type: 'text' as const,
      text: refLabel,
    }));
  const operators: BreakdownFormulaRow['operators'] = [];
  for (let index = 1; index < input.incomeComponentRefLabels.length; index++) {
    operators.push('+');
  }
  operators.push('=');

  input.rows.push({
    segments,
    operators,
    resultId: idTotalIncome,
    resultLabel: breakdownItemLabeledRef(idTotalIncome, '合計所得'),
  });
  return idTotalIncome;
}

function appendEarnedIncomeNotes(
  notes: string[],
  formula: 'salary' | 'business' | 'mixed',
  incomeAdjustmentQualifies: boolean,
): void {
  if (formula === 'salary' || formula === 'mixed') {
    notes.push(
      incomeAdjustmentQualifies
        ? '所得金額調整控除は、給与収入が850万円を超え、かつ一定の要件（23歳未満の扶養親族・障害者等）を満たす場合に適用されます。給与収入の上限1,000万円までを対象に算出しています。'
        : '所得金額調整控除は、給与収入が850万円を超え、かつ一定の要件（23歳未満の扶養親族・障害者等）を満たす場合に適用されます。',
    );
    if (formula === 'salary') {
      notes.push(
        '給与所得660万円未満の場合は、給与所得の計算方法が異なる場合があります。',
      );
    }
  }
  if (formula === 'business' || formula === 'mixed') {
    notes.push(
      '申告特別控除は、青色申告（65万円・55万円・10万円）または白色申告（0円）の区分に応じて算出しています。',
    );
  }
}

function buildIncomeTaxBreakdown(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
  calendarYear: number,
): CalculationBreakdownConfig {
  const { incomeTax: tax, proration } = data;
  const items: CalculationBreakdownConfig['items'] = [];
  const rows: BreakdownFormulaRow[] = [];
  let nextId = 1;

  const addItem = (
    label: string,
    yen: number,
    refId?: string,
    referenceDetail?: TaxBreakdownReferenceDetail,
  ) => {
    const id = nextId++;
    items.push({
      id,
      refId,
      label,
      value: formatYen(yen),
      referenceDetail,
    });
    return id;
  };

  const addDeductionItemIfPositive = (label: string, yen: number) =>
    yen > 0 ? addItem(label, yen) : null;

  const incomeComponentRefLabels: string[] = [];
  const pensionPrimary = isPensionPrimaryIncomeTax(data);

  const pensionRef = appendPensionMiscIncomeBlock({
    addItem,
    rows,
    memberAge: data.memberAge ?? 65,
    otherIncomeExcludingPensionYen: tax.otherIncomeExcludingPensionYen,
    pensionRevenueYen: tax.pensionRevenueYen,
    pensionDeductionYen: tax.pensionDeductionYen,
    pensionIncomeYen: tax.pensionIncomeYen,
    useStandardRefs: pensionPrimary,
  });
  if (pensionRef) {
    incomeComponentRefLabels.push(pensionRef);
  }

  if (
    (data.earnedIncomeFormula === 'salary' ||
      data.earnedIncomeFormula === 'mixed') &&
    hasSalaryEarnedIncome(tax)
  ) {
    incomeComponentRefLabels.push(
      appendSalaryEarnedIncomeBlock({
        addItem,
        rows,
        calendarYear,
        grossSalaryRevenueYen: tax.grossSalaryRevenueYen,
        baseSalaryIncomeDeductionYen: tax.baseSalaryIncomeDeductionYen,
        incomeAdjustmentDeductionYen: tax.incomeAdjustmentDeductionYen,
        salaryIncomeYen: tax.salaryIncomeYen,
        useStandardRefs:
          data.earnedIncomeFormula === 'salary' && !pensionPrimary,
      }),
    );
  }

  if (
    (data.earnedIncomeFormula === 'business' ||
      data.earnedIncomeFormula === 'mixed') &&
    hasBusinessEarnedIncome(data.businessIncome) &&
    data.businessIncome
  ) {
    incomeComponentRefLabels.push(
      appendBusinessEarnedIncomeBlock({
        addItem,
        rows,
        business: data.businessIncome,
        useStandardRefs:
          data.earnedIncomeFormula === 'business' && !pensionPrimary,
      }),
    );
  }

  const businessIncomeYen = data.businessIncome?.businessIncomeYen ?? 0;
  const otherEarnedIncomeYen = calcOtherEarnedIncomeYen(
    tax.otherIncomeExcludingPensionYen,
    hasSalaryEarnedIncome(tax) ? tax.salaryIncomeYen : 0,
    hasBusinessEarnedIncome(data.businessIncome) ? businessIncomeYen : 0,
  );
  if (otherEarnedIncomeYen > 0) {
    const idOtherIncome = addItem('その他の所得', otherEarnedIncomeYen);
    incomeComponentRefLabels.push(
      breakdownItemLabeledRef(idOtherIncome, 'その他の所得'),
    );
  }

  if (tax.insuranceTemporaryIncomeTaxableYen > 0) {
    const idInsuranceIncome = addItem(
      '保険収入（一時所得）',
      tax.insuranceTemporaryIncomeTaxableYen,
    );
    incomeComponentRefLabels.push(
      breakdownItemLabeledRef(idInsuranceIncome, '保険収入（一時所得）'),
    );
  }

  if (tax.insuranceMiscellaneousIncomeTaxableYen > 0) {
    const idInsuranceMiscIncome = addItem(
      '保険収入（雑所得）',
      tax.insuranceMiscellaneousIncomeTaxableYen,
    );
    incomeComponentRefLabels.push(
      breakdownItemLabeledRef(idInsuranceMiscIncome, '保険収入（雑所得）'),
    );
  }

  const refCtx = data.referenceContext;
  const deductionIds = [
    addItem(
      '基礎控除',
      tax.basicDeductionYen,
      undefined,
      buildBasicDeductionReferenceDetail({
        calendarYear,
        totalIncomeYen: tax.totalIncomeYen,
        deductionYen: tax.basicDeductionYen,
        taxKind: 'income',
      }),
    ),
    addItem(
      formatSpouseDeductionLabel(tax.spouseDeductionKind),
      tax.spouseDeductionYen,
      undefined,
      refCtx.spouseIncomeTax
        ? buildSpouseDeductionReferenceDetail({
            calendarYear,
            headTotalIncomeYen: refCtx.spouseIncomeTax.headTotalIncomeYen,
            spouseTotalIncomeYen: refCtx.spouseIncomeTax.spouseTotalIncomeYen,
            spouseAgeAtYearEnd: refCtx.spouseIncomeTax.spouseAgeAtYearEnd,
            kind: refCtx.spouseIncomeTax.kind,
            deductionYen: tax.spouseDeductionYen,
            taxKind: 'income',
          })
        : undefined,
    ),
    addItem(
      '扶養控除',
      tax.dependentDeductionYen,
      undefined,
      tax.dependentDeductionYen > 0
        ? buildDependentDeductionReferenceDetail({
            deductionYen: tax.dependentDeductionYen,
            taxKind: 'income',
          })
        : undefined,
    ),
    addItem('ひとり親控除', tax.singleParentDeductionYen),
    addItem('障害者控除', tax.disabilityDeductionYen),
    addItem('勤労学生控除', tax.workingStudentDeductionYen),
    addItem(
      '生命保険料控除',
      tax.lifeInsuranceDeductionYen,
      undefined,
      refCtx.lifeInsuranceIncomeTaxPremiumsYen &&
      tax.lifeInsuranceDeductionYen > 0
        ? buildLifeInsuranceDeductionReferenceDetail({
            premiumsByKindYen: refCtx.lifeInsuranceIncomeTaxPremiumsYen,
            deductionYen: tax.lifeInsuranceDeductionYen,
            taxKind: 'income',
          })
        : undefined,
    ),
    addItem(
      '小規模企業共済等掛金控除',
      tax.idecoContributionDeductionYen,
      undefined,
      tax.idecoContributionDeductionYen > 0
        ? buildSmallScaleMutualAidReferenceDetail({
            contributionYen: refCtx.idecoIncomeTaxContributionYen,
            deductionYen: tax.idecoContributionDeductionYen,
            taxKind: 'income',
          })
        : undefined,
    ),
    addItem('そのほか所得控除', tax.otherIncomeDeductionYen),
    addDeductionItemIfPositive('厚生年金', tax.socialInsuranceDeduction.employeesPension),
    addDeductionItemIfPositive('健康保険', tax.socialInsuranceDeduction.healthInsurance),
    addDeductionItemIfPositive('国民年金', tax.socialInsuranceDeduction.nationalPension),
    addDeductionItemIfPositive(
      '国民健康保険',
      tax.socialInsuranceDeduction.nationalHealthInsurance,
    ),
    addDeductionItemIfPositive('雇用保険', tax.socialInsuranceDeduction.employmentInsurance),
  ].filter((id): id is number => id != null);

  const idTotalIncome = appendTotalIncomeRow({
    addItem,
    rows,
    incomeComponentRefLabels,
    totalIncomeYen: tax.totalIncomeYen,
  });

  const idTaxable = addItem('課税所得', tax.taxableIncomeYen);
  rows.push({
    segments: [
      { type: 'text', text: breakdownItemLabeledRef(idTotalIncome, '合計所得') },
      {
        type: 'group',
        groupTitle: '各種控除',
        groupItemIds: deductionIds,
      },
    ],
    operators: ['−', '='],
    resultId: idTaxable,
    resultLabel: breakdownItemLabeledRef(idTaxable, '課税所得'),
  });

  const idRate = addItem('税率', 0);
  items[items.length - 1].value = formatPercent(tax.taxRate);
  const idRateDeduction = addItem('税率に応じた控除額', tax.taxRateDeductionYen);
  const housingIncomeCredit = tax.housingLoanTaxCreditAppliedYen ?? 0;
  const preCreditIncomeTaxYen = tax.incomeTaxYen + housingIncomeCredit;
  const idIncomeTaxAnnual = addItem('所得税（年間算定額）', preCreditIncomeTaxYen);
  const incomeTaxCashFlowYen = tax.incomeTaxCashFlowYen ?? tax.incomeTaxYen;
  const showCfIncomeTaxRow = incomeTaxCashFlowYen !== tax.incomeTaxYen;
  const idIncomeTaxCf = addItem(
    '所得税（キャッシュフロー反映額）',
    incomeTaxCashFlowYen,
  );

  rows.push({
    segments: [
      {
        type: 'text',
        text: `${breakdownItemLabeledRef(idTaxable, '課税所得')} × ${breakdownItemLabeledRef(idRate, '税率')} − ${breakdownItemLabeledRef(idRateDeduction, '税率に応じた控除額')}`,
      },
    ],
    operators: ['='],
    resultId: idIncomeTaxAnnual,
    resultLabel: breakdownItemLabeledRef(idIncomeTaxAnnual, '所得税（年間算定額）'),
    highlight: housingIncomeCredit === 0 && !showCfIncomeTaxRow,
  });

  if (housingIncomeCredit > 0) {
    const idHousingLoan = addItem(
      '住宅借入金等特別控除',
      housingIncomeCredit,
    );
    const idIncomeTaxFinal = addItem('所得税', tax.incomeTaxYen);
    rows.push({
      segments: [
        { type: 'text', text: breakdownItemLabeledRef(idIncomeTaxAnnual, '所得税（年間算定額）') },
        {
          type: 'group',
          groupTitle: '税額控除',
          groupItemIds: [idHousingLoan],
        },
      ],
      operators: ['−', '='],
      resultId: idIncomeTaxFinal,
      resultLabel: breakdownItemLabeledRef(idIncomeTaxFinal, '所得税'),
      highlight: !showCfIncomeTaxRow,
      compoundNote:
        '税額控除のため課税所得には含めません。算出した所得税から直接控除します。',
    });
  }

  if (showCfIncomeTaxRow) {
    rows.push({
      segments: [],
      operators: [],
      resultId: idIncomeTaxCf,
      resultLabel: breakdownItemLabeledRef(
        idIncomeTaxCf,
        '所得税（キャッシュフロー反映額）',
      ),
      highlight: true,
      compoundNote:
        'キャッシュフロー表の「税金」欄には、この金額が計上されます。',
    });
  }

  if (data.giftTax.giftTaxYen > 0) {
    const idGiftTax = addItem('贈与税（保険収入）', data.giftTax.giftTaxYen);
    rows.push({
      segments: [{ type: 'text', text: breakdownItemLabeledRef(idGiftTax, '贈与税（保険収入）') }],
      operators: [],
      resultId: idGiftTax,
      resultLabel: breakdownItemLabeledRef(idGiftTax, '贈与税（保険収入）'),
      compoundNote:
        '学資保険など、契約者と受取人が異なる場合の保険金は贈与として課税されます。贈与税は所得税とは別にキャッシュフローへ反映されます。',
    });
  }

  const notes = [
    `算定基礎は${formatIncomeTaxBasisDescription(data)}です。`,
    '社会保険料控除は、同じ年の「厚生年金」「健康保険（合計）」「雇用保険」タブと同じ標準報酬月額ベースです。健康保険タブの⑥～⑧の合計が税の「健康保険」控除に対応します。',
    '計算結果はあくまで概算です。実際の税額は確定申告・年末調整等で異なる場合があります。',
  ];

  if (pensionPrimary) {
    notes.push(
      '公的年金等控除は国税庁タックスアンサー No.1600（令和2年以降）に基づく概算です。',
      `控除額の算式: ${describePublicPensionDeductionFormula(
        tax.pensionRevenueYen,
        data.memberAge ?? 65,
        tax.otherIncomeExcludingPensionYen,
      )}`,
    );
  } else if (hasEarnedIncomeForIncomeTax(data)) {
    appendEarnedIncomeNotes(
      notes,
      data.earnedIncomeFormula,
      tax.incomeAdjustmentQualifies,
    );
  }

  if (tax.pensionRevenueYen > 0 && hasEarnedIncomeForIncomeTax(data)) {
    notes.push(
      '公的年金等控除は国税庁タックスアンサー No.1600（令和2年以降）に基づく概算です。',
    );
  }

  if (
    housingIncomeCredit > 0 ||
    (tax.housingLoanResidentTaxCreditAppliedYen ?? 0) > 0
  ) {
    notes.push(
      '住宅借入金等特別控除はQ5の所有物件（ローン払い）の設定に基づき、年末ローン残高 × 0.7%で算出しています。税額控除のため課税所得の計算には含めず、算出した所得税から控除します。控除しきれない分は住民税から控除します（住民税分の上限は97,500円）。',
    );
  }

  notes.push(
    '基礎控除は、納税者本人の合計所得金額に応じて決まります（国税庁タックスアンサーNo.1199・令和7年分以降）。',
    '配偶者控除・配偶者特別控除は、納税者本人と配偶者の合計所得金額・配偶者の年齢（70歳以上は老人控除対象配偶者）に応じて算出しています（No.1191・No.1195・令和7年分以降）。',
  );

  if (!data.isTaxIndependent) {
    notes.unshift(
      'このメンバーは世帯主の扶養に入っているため、所得税は世帯主の申告で計算されます。',
    );
  }

  return {
    id: 'income-tax',
    title: '所得税',
    prorationCallout: buildProrationCallout(
      proration,
      tax.incomeTaxYen,
      '年間所得税（算定額）',
      'キャッシュフロー表への反映額',
      formatIncomeTaxBasisDescription(data),
      tax.incomeTaxCashFlowYen,
    ),
    items,
    rows,
    notes,
  };
}

function buildResidentTaxBreakdown(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
  calendarYear: number,
): CalculationBreakdownConfig {
  const { incomeTax: tax, residentTax: resTax, proration } = data;
  const social = resTax.socialInsuranceDeduction;
  const items: CalculationBreakdownConfig['items'] = [];
  const rows: BreakdownFormulaRow[] = [];
  let nextId = 1;

  const addItem = (
    label: string,
    yen: number,
    refId?: string,
    referenceDetail?: TaxBreakdownReferenceDetail,
  ) => {
    const id = nextId++;
    items.push({
      id,
      refId,
      label,
      value: formatYen(yen),
      referenceDetail,
    });
    return id;
  };

  const addDeductionItemIfPositive = (label: string, yen: number) =>
    yen > 0 ? addItem(label, yen) : null;

  const incomeComponentRefLabels: string[] = [];
  const pensionPrimaryLevy = isPensionPrimaryLevy(data);

  const pensionRef = appendPensionMiscIncomeBlock({
    addItem,
    rows,
    memberAge: data.memberAge ?? 65,
    otherIncomeExcludingPensionYen: resTax.otherIncomeExcludingPensionYen,
    pensionRevenueYen: resTax.pensionRevenueYen,
    pensionDeductionYen: resTax.pensionDeductionYen,
    pensionIncomeYen: resTax.pensionIncomeYen,
    useStandardRefs: pensionPrimaryLevy,
  });
  if (pensionRef) {
    incomeComponentRefLabels.push(pensionRef);
  }

  if (
    (data.levyEarnedIncomeFormula === 'salary' ||
      data.levyEarnedIncomeFormula === 'mixed') &&
    hasSalaryEarnedIncome(resTax)
  ) {
    incomeComponentRefLabels.push(
      appendSalaryEarnedIncomeBlock({
        addItem,
        rows,
        calendarYear,
        grossSalaryRevenueYen: resTax.grossSalaryRevenueYen,
        baseSalaryIncomeDeductionYen: resTax.baseSalaryIncomeDeductionYen,
        incomeAdjustmentDeductionYen: resTax.incomeAdjustmentDeductionYen,
        salaryIncomeYen: resTax.salaryIncomeYen,
        useStandardRefs:
          data.levyEarnedIncomeFormula === 'salary' && !pensionPrimaryLevy,
      }),
    );
  }

  if (
    (data.levyEarnedIncomeFormula === 'business' ||
      data.levyEarnedIncomeFormula === 'mixed') &&
    hasBusinessEarnedIncome(data.levyBusinessIncome) &&
    data.levyBusinessIncome
  ) {
    incomeComponentRefLabels.push(
      appendBusinessEarnedIncomeBlock({
        addItem,
        rows,
        business: data.levyBusinessIncome,
        useStandardRefs:
          data.levyEarnedIncomeFormula === 'business' && !pensionPrimaryLevy,
      }),
    );
  }

  const levyBusinessIncomeYen = data.levyBusinessIncome?.businessIncomeYen ?? 0;
  const otherEarnedIncomeYen = calcOtherEarnedIncomeYen(
    resTax.otherIncomeExcludingPensionYen,
    hasSalaryEarnedIncome(resTax) ? resTax.salaryIncomeYen : 0,
    hasBusinessEarnedIncome(data.levyBusinessIncome)
      ? levyBusinessIncomeYen
      : 0,
  );
  if (otherEarnedIncomeYen > 0) {
    const idOtherIncome = addItem('その他の所得', otherEarnedIncomeYen);
    incomeComponentRefLabels.push(
      breakdownItemLabeledRef(idOtherIncome, 'その他の所得'),
    );
  }

  const levyRefCtx = data.referenceContext;
  const deductionIds = [
    addItem(
      '基礎控除',
      tax.residentBasicDeductionYen,
      undefined,
      buildBasicDeductionReferenceDetail({
        calendarYear,
        totalIncomeYen: resTax.totalIncomeYen,
        deductionYen: tax.residentBasicDeductionYen,
        taxKind: 'resident',
      }),
    ),
    addItem(
      formatSpouseDeductionLabel(tax.spouseDeductionKind),
      tax.residentSpouseDeductionYen,
      undefined,
      levyRefCtx.spouseResidentTax
        ? buildSpouseDeductionReferenceDetail({
            calendarYear: levyRefCtx.spouseResidentTax.calendarYear,
            headTotalIncomeYen: levyRefCtx.spouseResidentTax.headTotalIncomeYen,
            spouseTotalIncomeYen:
              levyRefCtx.spouseResidentTax.spouseTotalIncomeYen,
            spouseAgeAtYearEnd: levyRefCtx.spouseResidentTax.spouseAgeAtYearEnd,
            kind: levyRefCtx.spouseResidentTax.kind,
            deductionYen: tax.residentSpouseDeductionYen,
            taxKind: 'resident',
          })
        : undefined,
    ),
    addItem(
      '扶養控除（特定親族特別控除）',
      tax.residentDependentDeductionYen,
      undefined,
      tax.residentDependentDeductionYen > 0
        ? buildDependentDeductionReferenceDetail({
            deductionYen: tax.residentDependentDeductionYen,
            taxKind: 'resident',
          })
        : undefined,
    ),
    addItem('ひとり親控除（寡婦控除）', tax.singleParentDeductionYen),
    addItem('障害者控除', tax.disabilityDeductionYen),
    addItem(
      '生命保険料控除',
      tax.lifeInsuranceDeductionYen,
      undefined,
      levyRefCtx.lifeInsuranceResidentTaxPremiumsYen &&
      tax.lifeInsuranceDeductionYen > 0
        ? buildLifeInsuranceDeductionReferenceDetail({
            premiumsByKindYen: levyRefCtx.lifeInsuranceResidentTaxPremiumsYen,
            deductionYen: tax.lifeInsuranceDeductionYen,
            taxKind: 'resident',
          })
        : undefined,
    ),
    addItem(
      '小規模企業共済等掛金控除',
      resTax.idecoContributionDeductionYen,
      undefined,
      resTax.idecoContributionDeductionYen > 0
        ? buildSmallScaleMutualAidReferenceDetail({
            contributionYen: levyRefCtx.idecoResidentTaxContributionYen,
            deductionYen: resTax.idecoContributionDeductionYen,
            taxKind: 'resident',
          })
        : undefined,
    ),
    addItem('そのほか所得控除', tax.otherIncomeDeductionYen),
    addDeductionItemIfPositive('厚生年金', social.employeesPension),
    addDeductionItemIfPositive('健康保険', social.healthInsurance),
    addDeductionItemIfPositive('国民年金', social.nationalPension),
    addDeductionItemIfPositive('国民健康保険', social.nationalHealthInsurance),
    addDeductionItemIfPositive('雇用保険', social.employmentInsurance),
  ].filter((id): id is number => id != null);

  const idTotalIncome = appendTotalIncomeRow({
    addItem,
    rows,
    incomeComponentRefLabels,
    totalIncomeYen: resTax.totalIncomeYen,
  });

  const idTaxable = addItem('課税所得', resTax.taxableIncomeYen);
  rows.push({
    segments: [
      { type: 'text', text: breakdownItemLabeledRef(idTotalIncome, '合計所得') },
      {
        type: 'group',
        groupTitle: '各種控除',
        groupItemIds: deductionIds,
      },
    ],
    operators: ['−', '='],
    resultId: idTaxable,
    resultLabel: breakdownItemLabeledRef(idTaxable, '課税所得'),
  });

  const idRate = addItem('税率', 0);
  items[items.length - 1].value = formatPercent(TAX_RATE_CONSTANTS.residentTaxRate);
  const idPerCapita = addItem('均等割額', resTax.perCapitaTotalYen);
  const idResidentTax = addItem('住民税（調整控除前）', resTax.residentTaxYen);
  rows.push({
    segments: [
      {
        type: 'text',
        text: `${breakdownItemLabeledRef(idTaxable, '課税所得')} × ${breakdownItemLabeledRef(idRate, '税率')} ＋ ${breakdownItemLabeledRef(idPerCapita, '均等割額')}`,
      },
    ],
    operators: ['='],
    resultId: idResidentTax,
    resultLabel: breakdownItemLabeledRef(idResidentTax, '住民税（調整控除前）'),
  });

  const housingResidentCredit = tax.housingLoanResidentTaxCreditAppliedYen ?? 0;
  const idAdjustedResidentTax = addItem(
    '住民税',
    resTax.adjustedResidentTaxYen,
  );

  if (housingResidentCredit > 0) {
    const idPreHousingResidentTax = addItem(
      '住民税（税額控除適用前）',
      resTax.adjustedResidentTaxYen + housingResidentCredit,
    );
    const idHousingLoanResident = addItem(
      '住宅借入金等特別控除（住民税）',
      housingResidentCredit,
    );
    rows.push({
      segments: [
        {
          type: 'text',
          text: breakdownItemLabeledRef(
            idPreHousingResidentTax,
            '住民税（税額控除適用前）',
          ),
        },
        {
          type: 'group',
          groupTitle: '税額控除',
          groupItemIds: [idHousingLoanResident],
        },
      ],
      operators: ['−', '='],
      resultId: idAdjustedResidentTax,
      resultLabel: breakdownItemLabeledRef(idAdjustedResidentTax, '住民税'),
      highlight: true,
      compoundNote:
        resTax.adjustmentCreditYen > 0
          ? `調整控除 ${formatYen(resTax.adjustmentCreditYen)} を反映したうえで、所得税から控除しきれなかった住宅借入金等特別控除を住民税から控除しています（上限97,500円）。`
          : '所得税から控除しきれなかった住宅借入金等特別控除を住民税から控除しています（上限97,500円）。',
    });
  } else {
    rows.push({
      segments: [],
      operators: [],
      resultId: idAdjustedResidentTax,
      resultLabel: breakdownItemLabeledRef(idAdjustedResidentTax, '住民税'),
      highlight: true,
      compoundNote:
        resTax.adjustmentCreditYen > 0
          ? `調整控除 ${formatYen(resTax.adjustmentCreditYen)} を反映した金額です。キャッシュフロー表にもこの金額が計上されます。`
          : 'キャッシュフロー表にもこの金額が計上されます。',
    });
  }

  if (resTax.adjustmentCreditYen > 0) {
    rows.push({
      layout: 'supplemental',
      segments: [],
      operators: [],
      resultId: idResidentTax,
      resultLabel: breakdownItemLabeledRef(idResidentTax, '調整控除前の住民税'),
      compoundNote:
        '※合計所得2,500万円超えの場合は調整控除が適用外となります。',
    });
  } else {
    rows.push({
      layout: 'supplemental',
      segments: [],
      operators: [],
      resultId: idAdjustedResidentTax,
      resultLabel: breakdownItemLabeledRef(idAdjustedResidentTax, '調整控除後の住民税'),
      compoundNote:
        '※合計所得2,500万円超えの場合は調整控除が適用外となります。',
    });
  }

  const notes = [
    `算定基礎は${formatResidentTaxBasisDescription(data)}です。`,
    `算定基礎となる所得は${resTax.incomeReferenceYear}年（前年）分です。`,
    '社会保険料控除は前年（上記の所得基準年）分の被用者保険料で、所得税と同様に標準報酬月額ベース（Q7の12か月年収）で算出しています。当該年の社会保険タブとは対象年が異なるため、金額が一致しない場合があります。',
    resTax.resolution === 'prior_year_override'
      ? '前年度の収入はQ7の前年度入力を使用しています。'
      : resTax.resolution === 'current_year_proxy'
        ? `${resTax.incomeReferenceYear + 1}年の収入（所得税の収入と同じ基準）を前年度として読み替えています。`
        : describeResidentTaxLevyPhaseNote(resTax),
    '計算結果はあくまで概算です。実際の税額は自治体の条例・減免措置により異なる場合があります。',
  ];

  if (hasEarnedIncomeForLevy(data)) {
    appendEarnedIncomeNotes(
      notes,
      data.levyEarnedIncomeFormula,
      resTax.incomeAdjustmentQualifies,
    );
  }

  if (pensionPrimaryLevy || resTax.pensionRevenueYen > 0) {
    notes.push(
      '公的年金等控除は国税庁タックスアンサー No.1600（令和2年以降）に基づく概算です。',
    );
    if (pensionPrimaryLevy) {
      notes.push(
        `控除額の算式: ${describePublicPensionDeductionFormula(
          resTax.pensionRevenueYen,
          data.memberAge ?? 65,
          resTax.otherIncomeExcludingPensionYen,
        )}`,
      );
    }
  }

  notes.push(
    '所得税の基礎控除は合計所得に応じて変動しますが、住民税の基礎控除は最高43万円のままです（令和7年度税制改正）。',
    `住民税の調整控除は、所得税と住民税の人的控除の差額に基づき所得割から控除します（合計課税所得200万円超の場合は最低2,500円）。今回の調整控除額は${formatYen(resTax.adjustmentCreditYen)}です。`,
    '住民税の所得割は、道府県民税（4%）と市町村民税（6%）に分かれ、それぞれ100円未満切り捨てとなるため、上記の合計額と100円程度の差が生じる場合があります。',
  );

  if (resTax.isExempt) {
    notes.unshift('この年は住民税非課税（または所得割非課税）の対象となる見込みです。');
  }

  if (!data.isTaxIndependent) {
    notes.unshift(
      'このメンバーは世帯主の扶養に入っているため、住民税は世帯主の申告で計算されます。',
    );
  }

  return {
    id: 'resident-tax',
    title: '住民税',
    headerVariant: 'resident',
    prorationCallout: buildProrationCallout(
      proration,
      resTax.adjustedResidentTaxYen,
      '年間住民税（算定額）',
      'キャッシュフロー表への反映額',
      formatResidentTaxBasisDescription(data),
    ),
    items,
    rows,
    notes,
  };
}

function buildPensionBreakdown(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): CalculationBreakdownConfig {
  const ins = data.employeeInsurance;
  const bonusAsRemuneration = ins.bonusTreatedAsRemuneration;
  const pensionTotalRate = FUKUOKA_PENSION_INSURANCE_RATE;

  const items: CalculationBreakdownConfig['items'] = bonusAsRemuneration
    ? [
        {
          id: 1,
          label: '標準報酬月額',
          value: formatYen(ins.standardMonthlyRemunerationYen),
        },
        {
          id: 2,
          label: '厚生年金保険料率',
          value: formatPercent(pensionTotalRate),
        },
        {
          id: 3,
          label: '年間賞与（月額報酬に按分）',
          value: formatYen(ins.annualBonusYen),
        },
        {
          id: 4,
          label: '厚生年金保険料',
          value: formatYen(ins.annualPensionYen),
        },
      ]
    : [
        { id: 1, label: '標準報酬月額', value: formatYen(ins.standardMonthlyRemunerationYen) },
        {
          id: 2,
          label: '厚生年金保険料率',
          value: formatPercent(pensionTotalRate),
        },
        { id: 3, label: '賞与（ボーナス）', value: formatYen(ins.annualBonusYen) },
        { id: 4, label: '厚生年金保険料', value: formatYen(ins.annualPensionYen) },
      ];

  const rows: BreakdownFormulaRow[] = bonusAsRemuneration
    ? [
        {
          layout: 'compound-sum',
          compoundParts: [
            {
              text: '（①標準報酬月額 × ②厚生年金保険料率 ÷ 2）× 12ヶ月',
              note: `※賞与は年${ins.bonusPaymentCount}回支給のため、年間賞与を12ヶ月分の報酬に按分して標準報酬月額に反映しています。`,
            },
          ],
          compoundNote: '保険料率を÷2しているのは、会社と折半のため。',
          segments: [],
          operators: ['='],
          resultId: 4,
          resultLabel: breakdownLabeledRef('4', '厚生年金保険料'),
          highlight: true,
        },
      ]
    : [
        {
          layout: 'compound-sum',
          compoundParts: [
            {
              text: '（①標準報酬月額 × ②厚生年金保険料率 ÷ 2）× 12ヶ月',
            },
            {
              text: '（③賞与（ボーナス） × ②厚生年金保険料率 ÷ 2）',
              note: '※ボーナス上限あり。下記の注意書き参照。',
            },
          ],
          compoundNote: '保険料率を÷2しているのは、会社と折半のため。',
          segments: [],
          operators: ['='],
          resultId: 4,
          resultLabel: breakdownLabeledRef('4', '厚生年金保険料'),
          highlight: true,
        },
      ];

  const notes = [
    '標準報酬月額は、全国健康保険協会福岡支部の令和8年度等級表（協会けんぽ）に基づき、Q7の月額給与から決定しています。',
    '厚生年金保険料率は18.3%（労使折半前の総率）を採用しています。',
    '年次試算では、試算対象月の報酬に対応する月例給与分の保険料として計上しています（実際の天引きは原則として翌月給与）。賞与分は支給月に天引きします。',
    bonusAsRemuneration
      ? `年間${ins.bonusPaymentCount}回の賞与支給は社会保険上「報酬」として扱われ、年間賞与総額を12で割った額を毎月の給与に上乗せして保険料を計算しています。`
      : '賞与（ボーナス）はQ7の入力額を反映しています。標準賞与額は1,000円未満を切り捨て、厚生年金は1回150万円の上限を適用します。',
    '計算結果は概算です。実際の保険料は事業所の処理・端数処理により異なる場合があります。',
  ];

  if (!ins.isEmployeeInsured) {
    notes.unshift('このメンバーは厚生年金（被用者保険）の対象外です。');
  }

  return {
    id: 'pension',
    title: '厚生年金',
    headerVariant: 'pension',
    items,
    rows,
    notes,
  };
}

function buildHealthInsuranceBreakdown(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): CalculationBreakdownConfig {
  const ins = data.employeeInsurance;
  const annualHealthTotal =
    ins.annualHealthMedicalSupportYen +
    ins.annualHealthChildcareYen +
    ins.annualHealthNursingYen;

  const items: CalculationBreakdownConfig['items'] = [
    {
      id: 1,
      label: '標準報酬月額',
      value: formatYen(ins.standardMonthlyRemunerationHealthYen),
    },
    {
      id: 2,
      label: '賞与（ボーナス）',
      value: formatYen(ins.standardHealthBonusYen),
    },
    {
      id: 3,
      label: '保険料率（医療・支援）',
      value: formatPercent(ins.healthMedicalSupportRate),
    },
    {
      id: 4,
      label: '保険料率（子ども子育て）',
      value: formatPercent(ins.healthChildcareRate),
    },
    {
      id: 5,
      label: '保険料率（介護）',
      value: formatPercent(ins.healthNursingRate),
    },
    {
      id: 6,
      label: '健康保険料（医療・支援）',
      value: formatYen(ins.annualHealthMedicalSupportYen),
    },
    {
      id: 7,
      label: '健康保険料（子ども子育て）',
      value: formatYen(ins.annualHealthChildcareYen),
    },
    {
      id: 8,
      label: '健康保険料（介護）',
      value: formatYen(ins.annualHealthNursingYen),
    },
    {
      id: 9,
      label: '健康保険料（合計）',
      value: `${formatYen(annualHealthTotal)} ※⑥～⑧の合計額`,
    },
  ];

  const salaryBonusCompoundParts = (
    rateRef: string,
  ): BreakdownFormulaRow['compoundParts'] => {
    const parts: NonNullable<BreakdownFormulaRow['compoundParts']> = [
      {
        text: `（①標準報酬月額 × ${rateRef} ÷ 2）× 12ヶ月`,
      },
      {
        text: `（②賞与（ボーナス） × ${rateRef} ÷ 2）`,
        note: ins.bonusTreatedAsRemuneration
          ? `※賞与は年${ins.bonusPaymentCount}回支給のため、年間賞与を12ヶ月分の報酬に按分して標準報酬月額に反映しています。`
          : undefined,
      },
    ];
    return parts;
  };

  const rows: BreakdownFormulaRow[] = [
    {
      layout: 'compound-sum',
      rowTitle: '医療・支援',
      compoundParts: salaryBonusCompoundParts(
        breakdownLabeledRef('3', '保険料率（医療・支援）'),
      ),
      compoundNote: '保険料率を÷2しているのは、会社と折半のため。',
      segments: [],
      operators: ['='],
      resultId: 6,
      resultLabel: breakdownLabeledRef('6', '健康保険料（医療・支援）'),
    },
    {
      layout: 'compound-sum',
      rowTitle: '子ども子育て',
      compoundParts: salaryBonusCompoundParts(
        breakdownLabeledRef('4', '保険料率（子ども子育て）'),
      ),
      segments: [],
      operators: ['='],
      resultId: 7,
      resultLabel: breakdownLabeledRef('7', '健康保険料（子ども子育て）'),
    },
    {
      layout: 'compound-sum',
      rowTitle: '介護',
      compoundParts: salaryBonusCompoundParts(
        breakdownLabeledRef('5', '保険料率（介護）'),
      ),
      compoundNote: '※40歳未満は0円',
      segments: [],
      operators: ['='],
      resultId: 8,
      resultLabel: breakdownLabeledRef('8', '健康保険料（介護）'),
    },
  ];

  const notes = [
    '計算結果は概算です。',
    '「標準報酬月額」「賞与（ボーナス）」は、Q7の給与入力と協会けんぽ福岡支部・令和8年度等級表に基づき決定しています。',
    '年次試算では、試算対象月の報酬に対応する月例給与分の保険料として計上しています（実際の天引きは原則として翌月給与）。賞与分は支給月に天引きします。',
    '健康保険の賞与に係る標準賞与額は、年間573万円が上限です。',
    '保険料率は全国健康保険協会（協会けんぽ）福岡支部・令和8年3月分（R8_40fukuoka）の料率（医療・支援10.11%、子ども・子育て支援金0.23%、介護1.62%）を使用しています。',
    '加入している健康保険組合によって料率が異なる場合があります。詳細はご加入の健康保険組合にご確認ください。',
  ];

  if (!ins.isEmployeeInsured) {
    notes.unshift('このメンバーは健康保険（被用者保険）の対象外です。');
  }

  return {
    id: 'health-insurance',
    title: '健康保険',
    headerVariant: 'health',
    items,
    rows,
    notes,
  };
}

function buildEmploymentInsuranceBreakdown(
  data: NonNullable<ReturnType<typeof buildMemberTaxBreakdownData>>,
): CalculationBreakdownConfig {
  const ins = data.employeeInsurance;
  const { proration } = data;

  const items: CalculationBreakdownConfig['items'] = [
    { id: 1, label: '年収（給与収入）', value: formatYen(ins.employmentAnnualIncomeYen) },
    {
      id: 2,
      label: '雇用保険料率（労働者負担）',
      value: formatPercent(ins.employmentRate),
    },
    { id: 3, label: '雇用保険', value: formatYen(ins.annualEmploymentYen) },
  ];

  const rows: BreakdownFormulaRow[] = [
    {
      segments: [{ type: 'text', text: '①年収 × ②雇用保険料率' }],
      operators: ['='],
      resultId: 3,
      resultLabel: breakdownLabeledRef('3', '雇用保険'),
      highlight: true,
    },
  ];

  const notes = [
    `年収（給与収入）はQ7の12か月年収（${formatManFromYen(proration.annualGrossSalaryYen)}万円）を算定基礎としています。`,
    '計算結果は概算です。',
    'キャッシュフロー表への計上は、試算対象月の給与・賞与ごとの天引き分の合計です（被用者社保は月次天引きのため、国保・住民税のような月数按分とは異なります）。',
    '雇用保険料率は一般の事業の労働者負担分（0.5%）を採用しています。事業の種類により料率が異なる場合があります。',
  ];

  if (!ins.isEmployeeInsured) {
    notes.unshift('このメンバーは雇用保険の対象外です。');
  }

  return {
    id: 'employment-insurance',
    title: '雇用保険',
    headerVariant: 'health',
    items,
    rows,
    notes,
  };
}

export function buildCalculationBreakdownConfigs(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear?: number;
  memberId: string;
  monthStart?: number;
  monthEnd?: number;
  levyPaymentFactor?: number;
  simulationMonthStart?: number;
  simulationMonthEnd?: number;
  simulationStartYear?: number;
  memberTaxBreakdownData?: MemberTaxBreakdownData | null;
}): CalculationBreakdownConfig[] {
  const calendarYear = input.calendarYear ?? input.referenceDate.getFullYear();

  const breakdownData =
    input.memberTaxBreakdownData ??
    (() => {
      const annualPensionManByMember = calcMemberAnnualPensionManByMember({
        familyMembers: input.familyMembers,
        incomeByMember: input.incomeByMember,
        pensionByMember: input.pensionByMember,
        referenceDate: input.referenceDate,
        calendarYear,
      });

      return buildMemberTaxBreakdownData({
        familyMembers: input.familyMembers,
        incomeByMember: input.incomeByMember,
        priorYearIncomeByMember: input.priorYearIncomeByMember,
        referenceDate: input.referenceDate,
        calendarYear,
        memberId: input.memberId,
        monthStart: input.monthStart,
        monthEnd: input.monthEnd,
        levyPaymentFactor: input.levyPaymentFactor,
        simulationMonthStart: input.simulationMonthStart,
        simulationMonthEnd: input.simulationMonthEnd,
        annualPensionManByMember,
        pensionByMember: input.pensionByMember,
        simulationStartYear: input.simulationStartYear,
      });
    })();

  if (!breakdownData) {
    return [];
  }

  return [
    attachFiscalYearLabel(buildIncomeTaxBreakdown(breakdownData, calendarYear), calendarYear),
    attachFiscalYearLabel(buildResidentTaxBreakdown(breakdownData, calendarYear), calendarYear),
    buildPensionBreakdown(breakdownData),
    buildHealthInsuranceBreakdown(breakdownData),
    buildEmploymentInsuranceBreakdown(breakdownData),
  ];
}
