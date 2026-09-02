import {
  resolveBasicDeductionRule,
  type BasicDeductionTaxYearRule,
} from './basicDeduction';
import {
  calcSalaryIncomeDeductionYen,
  resolveSalaryIncomeDeductionRule,
  type SalaryIncomeDeductionTaxYearRule,
} from './incomeTaxDeductions';
import {
  describePublicPensionOtherIncomeTierLabel,
  resolvePublicPensionOtherIncomeTier,
} from './publicPensionDeduction';
import {
  formatSpouseDeductionLabel,
  getSpouseTotalIncomeLimitYen,
  resolveHeadIncomeTier,
  resolveSpouseDeductionRule,
  type SpouseDeductionInput,
  type SpouseDeductionKind,
} from './spouseDeduction';
import {
  calcNewSystemLifeInsuranceDeductionForCategoryYen,
  type LifeInsurancePremiumByKindMan,
} from './lifeInsuranceDeduction';
import type {
  TaxBreakdownReferenceDetail,
  TaxBreakdownReferenceTableRow,
} from '../types/taxBreakdownReference';

function formatYen(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`;
}

function formatManYen(yen: number): string {
  return `${(yen / 10_000).toLocaleString('ja-JP')}万円`;
}

function formatIncomeRangeLabel(
  lowerExclusiveYen: number | null,
  upperInclusiveYen: number | null,
): string {
  if (lowerExclusiveYen == null && upperInclusiveYen != null) {
    return `${formatManYen(upperInclusiveYen)}以下`;
  }
  if (lowerExclusiveYen != null && upperInclusiveYen != null) {
    return `${formatManYen(lowerExclusiveYen + 1)}～${formatManYen(upperInclusiveYen)}`;
  }
  if (lowerExclusiveYen != null && upperInclusiveYen == null) {
    return `${formatManYen(lowerExclusiveYen + 1)}以上`;
  }
  return '—';
}

interface SalaryBracket {
  lowerExclusiveYen: number | null;
  upperInclusiveYen: number | null;
  formulaLabel: string;
}

const SALARY_BRACKETS_LEGACY_R6: SalaryBracket[] = [
  { lowerExclusiveYen: null, upperInclusiveYen: 1_625_000, formulaLabel: '55万円' },
  {
    lowerExclusiveYen: 1_625_000,
    upperInclusiveYen: 1_800_000,
    formulaLabel: '収入金額×40％−10万円',
  },
  {
    lowerExclusiveYen: 1_800_000,
    upperInclusiveYen: 3_600_000,
    formulaLabel: '収入金額×30％＋8万円',
  },
  {
    lowerExclusiveYen: 3_600_000,
    upperInclusiveYen: 6_600_000,
    formulaLabel: '収入金額×20％＋44万円',
  },
  {
    lowerExclusiveYen: 6_600_000,
    upperInclusiveYen: 8_500_000,
    formulaLabel: '収入金額×10％＋110万円',
  },
  {
    lowerExclusiveYen: 8_500_000,
    upperInclusiveYen: null,
    formulaLabel: '195万円（上限）',
  },
];

const SALARY_BRACKETS_R7_ONWARD: SalaryBracket[] = [
  { lowerExclusiveYen: null, upperInclusiveYen: 1_900_000, formulaLabel: '65万円' },
  {
    lowerExclusiveYen: 1_900_000,
    upperInclusiveYen: 3_600_000,
    formulaLabel: '収入金額×30％＋8万円',
  },
  {
    lowerExclusiveYen: 3_600_000,
    upperInclusiveYen: 6_600_000,
    formulaLabel: '収入金額×20％＋44万円',
  },
  {
    lowerExclusiveYen: 6_600_000,
    upperInclusiveYen: 8_500_000,
    formulaLabel: '収入金額×10％＋110万円',
  },
  {
    lowerExclusiveYen: 8_500_000,
    upperInclusiveYen: null,
    formulaLabel: '195万円（上限）',
  },
];

function isRevenueInSalaryBracket(
  revenueYen: number,
  bracket: SalaryBracket,
): boolean {
  if (bracket.upperInclusiveYen == null) {
    return revenueYen > (bracket.lowerExclusiveYen ?? 0);
  }
  if (bracket.lowerExclusiveYen == null) {
    return revenueYen <= bracket.upperInclusiveYen;
  }
  return (
    revenueYen > bracket.lowerExclusiveYen &&
    revenueYen <= bracket.upperInclusiveYen
  );
}

function describeSalaryRuleLabel(rule: SalaryIncomeDeductionTaxYearRule): string {
  return rule === 'r7_onward'
    ? '令和7年分以降'
    : '令和6年分以前（令和2年分〜令和6年分）';
}

export function buildSalaryIncomeDeductionReferenceDetail(input: {
  calendarYear: number;
  revenueYen: number;
  deductionYen: number;
}): TaxBreakdownReferenceDetail {
  const rule = resolveSalaryIncomeDeductionRule(input.calendarYear);
  const brackets =
    rule === 'r7_onward'
      ? SALARY_BRACKETS_R7_ONWARD
      : SALARY_BRACKETS_LEGACY_R6;

  const rows = brackets.map((bracket) => {
    const sampleRevenueYen =
      bracket.upperInclusiveYen == null
        ? Math.max(input.revenueYen, (bracket.lowerExclusiveYen ?? 0) + 1)
        : bracket.lowerExclusiveYen == null
          ? Math.min(input.revenueYen, bracket.upperInclusiveYen)
          : Math.min(
              bracket.upperInclusiveYen,
              Math.max(input.revenueYen, bracket.lowerExclusiveYen + 1),
            );
    const sampleDeductionYen = calcSalaryIncomeDeductionYen(
      sampleRevenueYen,
      input.calendarYear,
    );

    return {
      cells: [
        formatIncomeRangeLabel(
          bracket.lowerExclusiveYen,
          bracket.upperInclusiveYen,
        ),
        bracket.formulaLabel,
        formatYen(sampleDeductionYen),
      ],
      highlight: isRevenueInSalaryBracket(input.revenueYen, bracket),
    };
  });

  return {
    title: '給与所得控除',
    summary: `${describeSalaryRuleLabel(rule)}の給与所得控除の早見表です。給与収入（年収）に応じた控除額を適用しています。`,
    sections: [
      {
        title: '今回の試算',
        keyValues: [
          { label: '給与収入（年収）', value: formatYen(input.revenueYen) },
          { label: '適用した給与所得控除額', value: formatYen(input.deductionYen) },
        ],
      },
      {
        title: '給与所得控除の区分表',
        description:
          '該当する行をハイライト表示しています。控除額の欄は区分内の計算例です。',
        table: {
          columns: ['給与収入の範囲', '給与所得控除額の計算', '控除額（例）'],
          rows,
        },
      },
    ],
    sources: [
      {
        label: '国税庁タックスアンサー',
        detail: 'No.1410 給与所得控除',
      },
    ],
  };
}

interface PensionBracket {
  lowerExclusiveYen: number | null;
  upperInclusiveYen: number | null;
  formulaLabel: string;
}

function buildPensionBracketRows(input: {
  age: number;
  pensionYen: number;
  otherIncomeYen: number;
}): TaxBreakdownReferenceTableRow[] {
  const tier = resolvePublicPensionOtherIncomeTier(input.otherIncomeYen);
  const age65Plus = input.age >= 65;

  const lowLimit = age65Plus ? 3_300_000 : 1_300_000;
  const lowFixed = age65Plus
    ? [1_100_000, 1_000_000, 900_000][tier]
    : [600_000, 500_000, 400_000][tier];
  const addend25 = [275_000, 175_000, 75_000][tier];
  const addend15 = [685_000, 585_000, 485_000][tier];
  const addend05 = [1_455_000, 1_355_000, 1_255_000][tier];
  const maxDeduction = [1_955_000, 1_855_000, 1_755_000][tier];

  const brackets: PensionBracket[] = [
    {
      lowerExclusiveYen: null,
      upperInclusiveYen: lowLimit,
      formulaLabel: formatYen(lowFixed),
    },
    {
      lowerExclusiveYen: lowLimit,
      upperInclusiveYen: 4_100_000,
      formulaLabel: `収入金額×25％＋${formatManYen(addend25)}`,
    },
    {
      lowerExclusiveYen: 4_100_000,
      upperInclusiveYen: 7_700_000,
      formulaLabel: `収入金額×15％＋${formatManYen(addend15)}`,
    },
    {
      lowerExclusiveYen: 7_700_000,
      upperInclusiveYen: 10_000_000,
      formulaLabel: `収入金額×5％＋${formatManYen(addend05)}`,
    },
    {
      lowerExclusiveYen: 10_000_000,
      upperInclusiveYen: null,
      formulaLabel: `${formatYen(maxDeduction)}（上限）`,
    },
  ];

  return brackets.map((bracket) => ({
    cells: [
      formatIncomeRangeLabel(
        bracket.lowerExclusiveYen,
        bracket.upperInclusiveYen,
      ),
      bracket.formulaLabel,
    ],
    highlight: isRevenueInSalaryBracket(input.pensionYen, bracket),
  }));
}

export function buildPublicPensionDeductionReferenceDetail(input: {
  age: number;
  pensionYen: number;
  otherIncomeYen: number;
  deductionYen: number;
}): TaxBreakdownReferenceDetail {
  const tierLabel = describePublicPensionOtherIncomeTierLabel(
    input.otherIncomeYen,
  );

  return {
    title: '公的年金等控除',
    summary:
      '公的年金等の収入金額から控除できる金額の早見表です。年齢（65歳以上／未満）と、公的年金以外の合計所得に応じた区分を適用しています。',
    sections: [
      {
        title: '今回の試算',
        keyValues: [
          { label: '年齢', value: `${input.age}歳` },
          { label: '公的年金の受給額', value: formatYen(input.pensionYen) },
          {
            label: '公的年金等以外の合計所得',
            value: formatYen(input.otherIncomeYen),
          },
          { label: '適用区分', value: tierLabel },
          { label: '適用した公的年金等控除額', value: formatYen(input.deductionYen) },
        ],
      },
      {
        title: '公的年金等控除の区分表',
        description:
          '該当する行をハイライト表示しています（令和2年分以降の措置）。',
        table: {
          columns: ['公的年金等の収入金額', '公的年金等控除額'],
          rows: buildPensionBracketRows(input),
        },
      },
    ],
    sources: [
      {
        label: '国税庁タックスアンサー',
        detail: 'No.1600 公的年金等の課税関係',
      },
    ],
  };
}

interface BasicDeductionBracket {
  upperInclusiveYen: number;
  deductionYen: number;
}

function describeBasicDeductionRuleLabel(rule: BasicDeductionTaxYearRule): string {
  if (rule === 'legacy_r6') return '令和6年分以前';
  if (rule === 'r7_r8') return '令和7年分・令和8年分';
  return '令和9年分以後';
}

function buildBasicDeductionBracketRows(
  brackets: readonly BasicDeductionBracket[],
  totalIncomeYen: number,
): TaxBreakdownReferenceTableRow[] {
  let lowerExclusiveYen = 0;

  return brackets.map((bracket) => {
    const row: TaxBreakdownReferenceTableRow = {
      cells: [
        formatIncomeRangeLabel(lowerExclusiveYen, bracket.upperInclusiveYen),
        formatYen(bracket.deductionYen),
      ],
      highlight:
        totalIncomeYen > lowerExclusiveYen &&
        totalIncomeYen <= bracket.upperInclusiveYen,
    };
    lowerExclusiveYen = bracket.upperInclusiveYen;
    return row;
  });
}

const INCOME_TAX_BASIC_DEDUCTION_LEGACY_BRACKETS: BasicDeductionBracket[] = [
  { upperInclusiveYen: 1_320_000, deductionYen: 480_000 },
  { upperInclusiveYen: 3_360_000, deductionYen: 880_000 },
  { upperInclusiveYen: 4_890_000, deductionYen: 680_000 },
  { upperInclusiveYen: 6_550_000, deductionYen: 630_000 },
  { upperInclusiveYen: 23_500_000, deductionYen: 580_000 },
  { upperInclusiveYen: 24_000_000, deductionYen: 480_000 },
  { upperInclusiveYen: 24_500_000, deductionYen: 320_000 },
  { upperInclusiveYen: 25_000_000, deductionYen: 160_000 },
];

const INCOME_TAX_BASIC_DEDUCTION_R7_R8_BRACKETS: BasicDeductionBracket[] = [
  { upperInclusiveYen: 1_320_000, deductionYen: 950_000 },
  { upperInclusiveYen: 23_500_000, deductionYen: 580_000 },
  { upperInclusiveYen: 24_000_000, deductionYen: 480_000 },
  { upperInclusiveYen: 24_500_000, deductionYen: 320_000 },
  { upperInclusiveYen: 25_000_000, deductionYen: 160_000 },
];

const INCOME_TAX_BASIC_DEDUCTION_R9_ONWARD_BRACKETS: BasicDeductionBracket[] = [
  { upperInclusiveYen: 1_320_000, deductionYen: 950_000 },
  { upperInclusiveYen: 24_000_000, deductionYen: 580_000 },
  { upperInclusiveYen: 24_500_000, deductionYen: 320_000 },
  { upperInclusiveYen: 25_000_000, deductionYen: 160_000 },
];

const RESIDENT_TAX_BASIC_DEDUCTION_BRACKETS: BasicDeductionBracket[] = [
  { upperInclusiveYen: 24_000_000, deductionYen: 430_000 },
  { upperInclusiveYen: 24_500_000, deductionYen: 290_000 },
  { upperInclusiveYen: 25_000_000, deductionYen: 150_000 },
];

export function buildBasicDeductionReferenceDetail(input: {
  calendarYear: number;
  totalIncomeYen: number;
  deductionYen: number;
  taxKind: 'income' | 'resident';
}): TaxBreakdownReferenceDetail {
  const isResident = input.taxKind === 'resident';
  const rule = resolveBasicDeductionRule(input.calendarYear);
  const brackets = isResident
    ? RESIDENT_TAX_BASIC_DEDUCTION_BRACKETS
    : rule === 'legacy_r6'
      ? INCOME_TAX_BASIC_DEDUCTION_LEGACY_BRACKETS
      : rule === 'r7_r8'
        ? INCOME_TAX_BASIC_DEDUCTION_R7_R8_BRACKETS
        : INCOME_TAX_BASIC_DEDUCTION_R9_ONWARD_BRACKETS;

  return {
    title: '基礎控除',
    summary: isResident
      ? '住民税の基礎控除額の早見表です。納税者本人の合計所得金額に応じて控除額が決まります。'
      : `${describeBasicDeductionRuleLabel(rule)}の所得税基礎控除の早見表です。納税者本人の合計所得金額に応じて控除額が決まります。`,
    sections: [
      {
        title: '今回の試算',
        keyValues: [
          { label: '合計所得金額', value: formatYen(input.totalIncomeYen) },
          { label: '適用した基礎控除額', value: formatYen(input.deductionYen) },
        ],
      },
      {
        title: '基礎控除の区分表',
        description: '該当する行をハイライト表示しています。',
        table: {
          columns: ['合計所得金額の範囲', '基礎控除額'],
          rows: buildBasicDeductionBracketRows(brackets, input.totalIncomeYen),
        },
      },
    ],
    sources: [
      {
        label: '国税庁タックスアンサー',
        detail: isResident
          ? 'No.1150 住民税の基礎控除'
          : 'No.1199 所得税の基礎控除',
      },
    ],
  };
}

function describeHeadIncomeTierLabel(headTotalIncomeYen: number): string {
  const tier = resolveHeadIncomeTier(headTotalIncomeYen);
  if (tier === null) {
    return '1,000万円超（配偶者控除の対象外）';
  }
  if (tier === 0) return '900万円以下';
  if (tier === 1) return '900万円超950万円以下';
  return '950万円超1,000万円以下';
}

type HeadIncomeTier = 0 | 1 | 2;

function buildSpouseDeductionTableRows(input: {
  headTotalIncomeYen: number;
  spouseTotalIncomeYen: number;
  spouseAgeAtYearEnd: number | null;
  kind: SpouseDeductionKind;
  taxKind: 'income' | 'resident';
}): TaxBreakdownReferenceTableRow[] {
  const tier = resolveHeadIncomeTier(input.headTotalIncomeYen);

  if (input.kind === 'special') {
    const specialRows: {
      maxIncome: number;
      incomeTax: [number, number, number];
      residentTax: [number, number, number];
    }[] = [
      { maxIncome: 950_000, incomeTax: [380_000, 260_000, 130_000], residentTax: [330_000, 220_000, 110_000] },
      { maxIncome: 1_000_000, incomeTax: [360_000, 240_000, 120_000], residentTax: [300_000, 200_000, 100_000] },
      { maxIncome: 1_050_000, incomeTax: [310_000, 210_000, 110_000], residentTax: [260_000, 170_000, 90_000] },
      { maxIncome: 1_100_000, incomeTax: [260_000, 180_000, 90_000], residentTax: [220_000, 140_000, 70_000] },
      { maxIncome: 1_150_000, incomeTax: [210_000, 140_000, 70_000], residentTax: [180_000, 120_000, 60_000] },
      { maxIncome: 1_200_000, incomeTax: [160_000, 110_000, 60_000], residentTax: [130_000, 90_000, 45_000] },
      { maxIncome: 1_250_000, incomeTax: [110_000, 80_000, 40_000], residentTax: [90_000, 65_000, 35_000] },
      { maxIncome: 1_300_000, incomeTax: [60_000, 40_000, 20_000], residentTax: [50_000, 35_000, 18_000] },
      { maxIncome: 1_330_000, incomeTax: [30_000, 20_000, 10_000], residentTax: [30_000, 20_000, 10_000] },
    ];

    return specialRows.map((row, index, rows) => {
      const lowerExclusiveYen = index === 0 ? 0 : rows[index - 1].maxIncome;
      const amounts =
        input.taxKind === 'income' ? row.incomeTax : row.residentTax;
      return {
        cells: [
          formatIncomeRangeLabel(lowerExclusiveYen, row.maxIncome),
          formatYen(amounts[0]),
          formatYen(amounts[1]),
          formatYen(amounts[2]),
        ],
        highlight:
          tier !== null &&
          input.spouseTotalIncomeYen > lowerExclusiveYen &&
          input.spouseTotalIncomeYen <= row.maxIncome,
      };
    });
  }

  const spouseRows: {
    headLabel: string;
    tier: HeadIncomeTier;
    incomeTax: [number, number];
    residentTax: [number, number];
  }[] = [
    {
      headLabel: '900万円以下',
      tier: 0,
      incomeTax: [380_000, 480_000],
      residentTax: [330_000, 380_000],
    },
    {
      headLabel: '900万円超950万円以下',
      tier: 1,
      incomeTax: [260_000, 320_000],
      residentTax: [220_000, 270_000],
    },
    {
      headLabel: '950万円超1,000万円以下',
      tier: 2,
      incomeTax: [130_000, 160_000],
      residentTax: [110_000, 130_000],
    },
  ];

  return spouseRows.map((row) => {
    const amounts =
      input.taxKind === 'income' ? row.incomeTax : row.residentTax;
    return {
      cells: [
        row.headLabel,
        formatYen(amounts[0]),
        formatYen(amounts[1]),
      ],
      highlight: tier === row.tier,
    };
  });
}

export function buildSpouseDeductionReferenceDetail(input: {
  calendarYear: number;
  headTotalIncomeYen: number;
  spouseTotalIncomeYen: number;
  spouseAgeAtYearEnd: number | null;
  kind: SpouseDeductionKind;
  deductionYen: number;
  taxKind: 'income' | 'resident';
}): TaxBreakdownReferenceDetail {
  const rule = resolveSpouseDeductionRule(input.calendarYear);
  const spouseIncomeLimit = getSpouseTotalIncomeLimitYen(input.calendarYear);
  const kindLabel = formatSpouseDeductionLabel(input.kind);
  const isSpecial = input.kind === 'special';

  return {
    title: kindLabel,
    summary:
      rule === 'r7_onward'
        ? `${kindLabel}の早見表です（令和7年分以降）。配偶者の合計所得が${formatManYen(spouseIncomeLimit)}以下であることが要件です。`
        : `${kindLabel}の早見表です（令和6年分以前）。配偶者の合計所得が48万円以下であることが要件です。`,
    sections: [
      {
        title: '今回の試算',
        keyValues: [
          { label: '本人の合計所得', value: formatYen(input.headTotalIncomeYen) },
          {
            label: '本人の所得区分',
            value: describeHeadIncomeTierLabel(input.headTotalIncomeYen),
          },
          { label: '配偶者の合計所得', value: formatYen(input.spouseTotalIncomeYen) },
          {
            label: '配偶者の年齢（12月31日時点）',
            value:
              input.spouseAgeAtYearEnd == null
                ? '—'
                : `${input.spouseAgeAtYearEnd}歳`,
          },
          { label: '適用区分', value: kindLabel },
          {
            label: `適用した${kindLabel}額`,
            value: formatYen(input.deductionYen),
          },
        ],
      },
      {
        title: isSpecial ? '配偶者特別控除の区分表' : '配偶者控除の区分表',
        description: isSpecial
          ? '配偶者の合計所得に応じた行をハイライト表示しています。列は本人の合計所得の区分です。'
          : '本人の合計所得の区分に応じた行をハイライト表示しています。配偶者が70歳以上の場合は右列を適用します。',
        table: {
          columns: isSpecial
            ? [
                '配偶者の合計所得',
                '本人900万円以下',
                '本人900万円超950万円以下',
                '本人950万円超1,000万円以下',
              ]
            : [
                '本人の合計所得',
                '配偶者（69歳以下）',
                '配偶者（70歳以上）',
              ],
          rows: buildSpouseDeductionTableRows(input),
        },
      },
    ],
    sources: [
      {
        label: '国税庁タックスアンサー',
        detail: isSpecial ? 'No.1195 配偶者特別控除' : 'No.1191 配偶者控除',
      },
    ],
  };
}

const LIFE_INSURANCE_CATEGORY_LABELS: Record<
  keyof LifeInsurancePremiumByKindMan,
  string
> = {
  general: '一般生命保険料',
  nursing: '介護医療保険料',
  pension: '個人年金保険料',
};

function buildLifeInsuranceBracketRows(
  taxKind: 'income' | 'resident',
): TaxBreakdownReferenceTableRow[] {
  const brackets = [
    { upper: 20_000, formula: '支払保険料の全額' },
    { upper: 40_000, formula: '支払保険料÷2＋控除額' },
    { upper: 80_000, formula: '支払保険料÷4＋控除額' },
    { upper: null, formula: '区分ごとの上限額' },
  ] as const;

  let lowerExclusive = 0;
  return brackets.map((bracket) => {
    const samplePremiumYen =
      bracket.upper == null ? 100_000 : Math.min(bracket.upper, 30_000);
    const sampleDeductionYen = calcNewSystemLifeInsuranceDeductionForCategoryYen(
      samplePremiumYen,
      taxKind,
    );
    const row: TaxBreakdownReferenceTableRow = {
      cells: [
        bracket.upper == null
          ? `${formatManYen(lowerExclusive + 1)}以上`
          : formatIncomeRangeLabel(lowerExclusive, bracket.upper),
        bracket.formula,
        formatYen(sampleDeductionYen),
      ],
      highlight: false,
    };
    if (bracket.upper != null) {
      lowerExclusive = bracket.upper;
    }
    return row;
  });
}

export function buildLifeInsuranceDeductionReferenceDetail(input: {
  premiumsByKindYen: LifeInsurancePremiumByKindMan;
  deductionYen: number;
  taxKind: 'income' | 'resident';
}): TaxBreakdownReferenceDetail {
  const taxLabel = input.taxKind === 'income' ? '所得税' : '住民税';
  const categoryCap = input.taxKind === 'income' ? 40_000 : 28_000;
  const totalCap = input.taxKind === 'income' ? 120_000 : 84_000;

  const categoryRows = (['general', 'nursing', 'pension'] as const).map(
    (kind) => {
      const premiumYen = input.premiumsByKindYen[kind];
      const categoryDeductionYen =
        calcNewSystemLifeInsuranceDeductionForCategoryYen(
          premiumYen,
          input.taxKind,
        );
      return {
        cells: [
          LIFE_INSURANCE_CATEGORY_LABELS[kind],
          formatYen(premiumYen),
          formatYen(categoryDeductionYen),
        ],
        highlight: premiumYen > 0,
      };
    },
  );

  return {
    title: '生命保険料控除',
    summary: `新制度（平成24年1月1日以降契約）の生命保険料控除です。区分ごとに算出し、合計は${taxLabel}で最高${formatManYen(totalCap)}まで控除できます。`,
    sections: [
      {
        title: '今回の試算',
        keyValues: [
          {
            label: '一般生命保険料（年間支払）',
            value: formatYen(input.premiumsByKindYen.general),
          },
          {
            label: '介護医療保険料（年間支払）',
            value: formatYen(input.premiumsByKindYen.nursing),
          },
          {
            label: '個人年金保険料（年間支払）',
            value: formatYen(input.premiumsByKindYen.pension),
          },
          {
            label: '適用した生命保険料控除額',
            value: formatYen(input.deductionYen),
          },
        ],
      },
      {
        title: '区分ごとの控除額',
        description:
          'Q8の生命保険の年間支払保険料から、区分ごとの控除額を算出しています。',
        table: {
          columns: ['区分', '年間支払保険料', '控除額'],
          rows: categoryRows,
        },
      },
      {
        title: '区分ごとの計算式（新制度）',
        description: `1区分あたりの控除上限は${formatYen(categoryCap)}です。`,
        table: {
          columns: ['年間支払保険料', '計算式', '控除額（例）'],
          rows: buildLifeInsuranceBracketRows(input.taxKind),
        },
      },
    ],
    sources: [
      {
        label: '国税庁タックスアンサー',
        detail: 'No.1141 生命保険料控除',
      },
    ],
  };
}

export function buildDependentDeductionReferenceDetail(input: {
  deductionYen: number;
  taxKind: 'income' | 'resident';
}): TaxBreakdownReferenceDetail {
  const amounts = (income: number, resident: number) =>
    formatYen(input.taxKind === 'income' ? income : resident);

  return {
    title: '扶養控除',
    summary:
      '扶養親族の年齢・続柄に応じた控除額の早見表です。扶養親族の合計所得が控除の所得上限以下であることが要件です。',
    sections: [
      {
        title: '今回の試算',
        keyValues: [
          {
            label: '適用した扶養控除額（合計）',
            value: formatYen(input.deductionYen),
          },
        ],
      },
      {
        title: '扶養控除の区分表',
        description:
          '子ども・その他親族それぞれの区分です。該当する扶養親族が複数いる場合は合算します。',
        table: {
          columns: ['対象', '年齢・条件', '控除額'],
          rows: [
            {
              cells: ['子ども', '16〜18歳', amounts(380_000, 330_000)],
            },
            {
              cells: ['子ども', '19〜22歳（特定扶養）', amounts(630_000, 450_000)],
            },
            {
              cells: ['その他親族', '16歳以上（一般）', amounts(380_000, 330_000)],
            },
            {
              cells: ['その他親族', '19〜22歳（特定扶養）', amounts(630_000, 450_000)],
            },
            {
              cells: ['その他親族', '70歳以上（老人扶養）', amounts(480_000, 380_000)],
            },
            {
              cells: [
                'その他親族',
                '70歳以上・親/祖父母と同居（同居老親等）',
                amounts(580_000, 450_000),
              ],
            },
          ],
        },
      },
    ],
    sources: [
      {
        label: '国税庁タックスアンサー',
        detail: 'No.1180 扶養控除',
      },
    ],
  };
}

export function buildSmallScaleMutualAidReferenceDetail(input: {
  contributionYen: number;
  deductionYen: number;
  taxKind: 'income' | 'resident';
}): TaxBreakdownReferenceDetail {
  return {
    title: '小規模企業共済等掛金控除',
    summary:
      'iDeCoの掛金および企業型DCの加入者掛金（選択型）は、支払った金額の全額が所得控除の対象です（事業主掛金は含みません）。',
    sections: [
      {
        title: '今回の試算',
        keyValues: [
          {
            label: '対象掛金の合計（年間）',
            value: formatYen(input.contributionYen),
          },
          {
            label: '適用した小規模企業共済等掛金控除額',
            value: formatYen(input.deductionYen),
          },
        ],
      },
      {
        title: '控除の考え方',
        description:
          '掛金の全額をそのまま所得控除として差し引きます。区分ごとの上限計算はありません。',
      },
    ],
    sources: [
      {
        label: '国税庁タックスアンサー',
        detail: 'No.1240 小規模企業共済等掛金控除',
      },
    ],
  };
}

export type SpouseDeductionReferenceContext = SpouseDeductionInput & {
  kind: SpouseDeductionKind;
};

export function premiumsManToYen(
  premiums: LifeInsurancePremiumByKindMan,
): LifeInsurancePremiumByKindMan {
  return {
    general: Math.round(premiums.general * 10_000),
    nursing: Math.round(premiums.nursing * 10_000),
    pension: Math.round(premiums.pension * 10_000),
  };
}
