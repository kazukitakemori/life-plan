import { NURSERY_MUNICIPAL_SUBSIDY_CAP_YEN } from '../data/nurseryCostReference';
import { KINDERGARTEN_SUBSIDY_CAP_YEN } from '../data/kindergartenCostReference';
import type {
  EducationReferenceDetail,
  EducationReferenceSection,
  FetchedEducationCosts,
  SchoolType,
  UniversityHousingType,
  GraduateProgramType,
} from '../types/education';
import {
  formatNurseryFeeTier,
  type NurseryFeeTier,
  type NurseryHouseholdIncomeContext,
} from './nurseryHouseholdIncome';
import { formatYen } from './simulate';
import {
  GRADUATE_PROGRAM_TYPE_LABELS,
  SCHOOL_CATEGORY_LABELS,
  SCHOOL_TYPE_LABELS,
  UNIVERSITY_HOUSING_TYPE_LABELS,
} from './educationLabels';
import type { NurseryFeeSchedule } from '../data/nurseryCostReference';
import type { KindergartenFeeSchedule } from '../data/kindergartenCostReference';
import type { ElementaryFeeSchedule } from '../data/elementaryCostReference';
import type { JuniorHighFeeSchedule } from '../data/juniorHighCostReference';
import type { HighSchoolFeeSchedule } from '../data/highSchoolCostReference';
import { isPublicHighSchoolType } from '../data/highSchoolCostReference';
import type { UniversityFeeSchedule } from '../data/universityCostReference';
import {
  isMedicalUniversityType,
  isNationalUniversityType,
} from '../data/universityCostReference';
import type { GraduateFeeSchedule } from '../data/graduateCostReference';
import {
  isGraduateMedicalType,
  isNationalGraduateType,
} from '../data/graduateCostReference';
function yen(value: number): string {
  return formatYen(value);
}

function monthlyYen(value: number): string {
  return `${yen(value)}/月`;
}

function annualYen(value: number): string {
  return `${yen(value)}/年`;
}

function buildExtracurricularSection(
  otherExpenses: { label: string; amount: number }[],
  sourceNote: string,
): EducationReferenceSection | null {
  const items = otherExpenses.filter(
    (item) => item.label.includes('習い事') || item.label.includes('塾'),
  );
  if (items.length === 0) return null;
  return {
    title: '学校外活動費（習い事・塾等）の参考値',
    description:
      '家庭や年齢により大きく異なります。全国平均を参考値として反映しています。実情に合わせて調整してください。',
    table: {
      columns: ['項目', '月額', '出典'],
      rows: items.map((item) => ({
        cells: [item.label, monthlyYen(item.amount), sourceNote],
      })),
    },
  };
}

function buildAppliedValuesSection(
  costs: FetchedEducationCosts,
  options?: { tuitionLabel?: string },
): EducationReferenceSection {
  const tuitionLabel = options?.tuitionLabel ?? '保育料（年額）';
  const rows = [
    { cells: ['入学金', yen(costs.entranceFee), '一括'] },
    {
      cells: [
        tuitionLabel,
        annualYen(costs.tuitionAnnual),
        costs.tuitionPaymentCycle === 'monthly' ? '月額×12' : '年額',
      ],
    },
    ...costs.otherExpenses.map((item) => ({
      cells: [
        item.label,
        item.paymentCycle === 'monthly'
          ? monthlyYen(item.amount)
          : annualYen(item.amount),
        item.paymentCycle === 'monthly' ? '月額' : '年額',
      ],
    })),
  ];

  return {
    title: '適用した参考値',
    description: '「参考」ボタンで入力欄に反映した金額です。',
    table: {
      columns: ['項目', '金額', '備考'],
      rows,
    },
  };
}

const NURSERY_TIER_TABLE: {
  tier: NurseryFeeTier;
  levyLabel: string;
  monthlyFee: (schedule: NurseryFeeSchedule) => number;
}[] = [
  { tier: 'D1', levyLabel: '生活保護世帯', monthlyFee: (s) => s.monthlyTuition3go.D1 },
  { tier: 'D2', levyLabel: '非課税世帯', monthlyFee: (s) => s.monthlyTuition3go.D2 },
  { tier: 'D3', levyLabel: '〜48,600円', monthlyFee: (s) => s.monthlyTuition3go.D3 },
  { tier: 'D4', levyLabel: '〜60,000円', monthlyFee: (s) => s.monthlyTuition3go.D4 },
  { tier: 'D5', levyLabel: '〜80,000円', monthlyFee: (s) => s.monthlyTuition3go.D5 },
  { tier: 'D6', levyLabel: '〜101,000円', monthlyFee: (s) => s.monthlyTuition3go.D6 },
  { tier: 'D7', levyLabel: '〜133,000円', monthlyFee: (s) => s.monthlyTuition3go.D7 },
  { tier: 'D8', levyLabel: '〜169,000円', monthlyFee: (s) => s.monthlyTuition3go.D8 },
  { tier: 'D9', levyLabel: '〜301,000円', monthlyFee: (s) => s.monthlyTuition3go.D9 },
  { tier: 'D10', levyLabel: '301,000円超', monthlyFee: (s) => s.monthlyTuition3go.D10 },
];

function formatIncomeResolution(context: NurseryHouseholdIncomeContext): string {
  if (!context.incomeConfigured) {
    return 'Q7の収入未入力のため、D6区分を目安として使用';
  }

  const parts: string[] = [];
  if (context.usedPriorYearOverride) parts.push('前年度収入の個別入力');
  if (context.usedReferenceYear) parts.push('Q7の期間設定から算出');
  if (context.usedCurrentYearProxy) {
    parts.push(`${context.currentYear}年の収入を代用`);
  }
  return parts.join('、') || 'Q7の収入設定を反映';
}

function buildLicensedNurseryTierSection(
  schedule: NurseryFeeSchedule,
  currentTier: NurseryFeeTier,
): EducationReferenceSection {
  return {
    title: '保育料階層表（3号認定・国基準上限）',
    description:
      '両親の市民税所得割額の合算により階層が決まります。各自治体はこの上限以下で独自の料金表を設定できます。',
    table: {
      columns: ['区分', '世帯の所得割（合算）', '月額保育料'],
      rows: NURSERY_TIER_TABLE.map(({ tier, levyLabel, monthlyFee }) => ({
        cells: [tier, levyLabel, monthlyYen(monthlyFee(schedule))],
        highlight: tier === currentTier,
      })),
    },
  };
}

export function buildLicensedNurseryReferenceDetail(input: {
  areaLabel: string;
  schedule: NurseryFeeSchedule;
  costs: FetchedEducationCosts;
  incomeContext: NurseryHouseholdIncomeContext;
  isInfant: boolean;
  birthOrder: number;
  baseMonthlyFee: number;
  discount: number;
  monthlyFee: number;
}): EducationReferenceDetail {
  const {
    areaLabel,
    schedule,
    costs,
    incomeContext,
    isInfant,
    birthOrder,
    baseMonthlyFee,
    discount,
    monthlyFee,
  } = input;

  const multiChildLabel =
    birthOrder >= 3
      ? '第3子以降（無償）'
      : birthOrder === 2
        ? '第2子（半額）'
        : '第1子（軽減なし）';

  const calculationSection: EducationReferenceSection = {
    title: '保育料の算定',
    keyValues: [
      { label: '対象地域', value: areaLabel },
      {
        label: '施設種別',
        value: SCHOOL_TYPE_LABELS.licensed_childcare,
      },
      {
        label: '年齢区分',
        value: isInfant ? '3号認定（0〜2歳）' : '2号認定（3歳以上・無償化）',
      },
      {
        label: '基準月額保育料',
        value: isInfant ? monthlyYen(baseMonthlyFee) : monthlyYen(schedule.monthlyTuition2go),
      },
      ...(isInfant
        ? [
            { label: '多子軽減', value: multiChildLabel },
            ...(discount < 1
              ? [
                  {
                    label: '軽減率',
                    value:
                      discount === 0
                        ? '100%軽減（無償）'
                        : `${Math.round((1 - discount) * 100)}%軽減`,
                  },
                ]
              : []),
            {
              label: '軽減後の月額保育料',
              value: monthlyYen(monthlyFee),
            },
          ]
        : []),
      {
        label: 'おかず・おやつ代',
        value: monthlyYen(schedule.snackMonthlyAmount),
      },
    ],
  };

  const incomeSection: EducationReferenceSection = {
    title: '所得区分の推計',
    description:
      '保育料の階層は、在籍開始の前年度（入園前年度）の両親の市民税所得割額合算で決まります。',
    keyValues: [
      {
        label: '参照年',
        value: incomeContext.incomeReferenceYear
          ? `${incomeContext.incomeReferenceYear}年`
          : '—',
      },
      {
        label: '世帯の所得割（概算）',
        value:
          incomeContext.estimatedMunicipalLevy != null
            ? yen(Math.round(incomeContext.estimatedMunicipalLevy))
            : '未算出',
      },
      {
        label: '適用区分',
        value: formatNurseryFeeTier(incomeContext.tier),
      },
      { label: '算出方法', value: formatIncomeResolution(incomeContext) },
    ],
  };

  const sections: EducationReferenceSection[] = [
    buildAppliedValuesSection(costs),
    calculationSection,
    incomeSection,
  ];

  if (isInfant) {
    sections.push(
      buildLicensedNurseryTierSection(schedule, incomeContext.tier),
    );
  }

  const extracurricularSection = buildExtracurricularSection(
    costs.otherExpenses,
    '文部科学省「子供の学習費調査（令和3年度）」幼稚園在園者を参考に推計',
  );
  if (extracurricularSection) {
    sections.push(extracurricularSection);
  }

  return {
    title: '保育園 参考値の詳細',
    summary: `${areaLabel}／${schedule.sourceLabel}`,
    sections,
    sources: [
      {
        label: '保育料の上限額',
        detail:
          '子ども・子育て支援法施行令 第13条「利用者負担額の上限額」（国基準）',
      },
      {
        label: '多子軽減',
        detail:
          '令和7年（2025年）4月から、3号認定（0〜2歳）の認可保育料に所得制限なしで適用',
      },
      {
        label: '地域・実費',
        detail: schedule.sourceLabel,
      },
      {
        label: '学校外活動費',
        detail:
          '習い事等は文部科学省「子供の学習費調査（令和3年度）」幼稚園在園者の学校外活動費を参考に推計',
      },
    ],
  };
}

export function buildUnlicensedNurseryReferenceDetail(input: {
  areaLabel: string;
  schedule: NurseryFeeSchedule;
  costs: FetchedEducationCosts;
  isInfant: boolean;
  monthlyFee: number;
}): EducationReferenceDetail {
  const { areaLabel, schedule, costs, isInfant, monthlyFee } = input;

  const unlicensedSections: EducationReferenceSection[] = [
    buildAppliedValuesSection(costs),
    {
      title: '費用の算定',
      description:
        '未認可保育施設は施設への支払い総額をそのまま参考値としています。無償化補助（月額上限37,000円）は市区町村の認定が条件のため、本試算では考慮していません。',
      keyValues: [
        { label: '対象地域', value: areaLabel },
        { label: '施設種別', value: SCHOOL_TYPE_LABELS.unlicensed_childcare },
        {
          label: '年齢区分',
          value: isInfant ? '0〜2歳' : '3歳以上',
        },
        {
          label: '月額支払い総額',
          value: monthlyYen(monthlyFee),
        },
        {
          label: 'おかず・おやつ代',
          value: monthlyYen(schedule.snackMonthlyAmount),
        },
        {
          label: '無償化補助の上限',
          value: monthlyYen(NURSERY_MUNICIPAL_SUBSIDY_CAP_YEN),
        },
      ],
    },
  ];

  const unlicensedExtracurricularSection = buildExtracurricularSection(
    costs.otherExpenses,
    '文部科学省「子供の学習費調査（令和3年度）」幼稚園在園者を参考に推計',
  );
  if (unlicensedExtracurricularSection) {
    unlicensedSections.push(unlicensedExtracurricularSection);
  }

  return {
    title: '保育園（未認可）参考値の詳細',
    summary: `${areaLabel}／${schedule.sourceLabel}`,
    sections: unlicensedSections,
    sources: [
      {
        label: '参考データ',
        detail: schedule.sourceLabel,
      },
      {
        label: '無償化補助',
        detail:
          '認可外保育施設等に係る利用者負担額の軽減（市区町村の認定が必要）',
      },
      {
        label: '学校外活動費',
        detail:
          '習い事等は文部科学省「子供の学習費調査（令和3年度）」幼稚園在園者の学校外活動費を参考に推計',
      },
    ],
  };
}

export function buildKindergartenReferenceDetail(input: {
  areaLabel: string;
  schedule: KindergartenFeeSchedule;
  costs: FetchedEducationCosts;
  schoolTypeLabel: string;
}): EducationReferenceDetail {
  const { areaLabel, schedule, costs, schoolTypeLabel } = input;

  const excessMonthly = schedule.subsidyIsGuaranteed
    ? Math.max(0, schedule.monthlyGrossTuition - schedule.subsidyCap)
    : schedule.monthlyGrossTuition;

  const calculationKeyValues = schedule.subsidyIsGuaranteed
    ? [
        { label: '対象地域', value: areaLabel },
        { label: '施設種別', value: schoolTypeLabel },
        {
          label: '月額支払い総額（補助前）',
          value: monthlyYen(schedule.monthlyGrossTuition),
        },
        {
          label: '無償化補助の上限',
          value: monthlyYen(schedule.subsidyCap),
        },
        {
          label: '自己負担の保育料（月額）',
          value: monthlyYen(excessMonthly),
        },
      ]
    : [
        { label: '対象地域', value: areaLabel },
        { label: '施設種別', value: schoolTypeLabel },
        {
          label: '月額支払い総額',
          value: monthlyYen(schedule.monthlyGrossTuition),
        },
        {
          label: '補助の扱い',
          value: '市区町村の認定が条件のため、補助なしで試算',
        },
      ];

  const regularOtherExpenseRows = schedule.otherExpenses
    .filter(
      (item) => !item.label.includes('習い事') && !item.label.includes('塾'),
    )
    .map((item) => ({
      cells: [item.label, monthlyYen(item.monthlyAmount), '実費'],
    }));

  const sections: EducationReferenceSection[] = [
    buildAppliedValuesSection(costs),
    {
      title: '保育料の算定',
      description: schedule.subsidyIsGuaranteed
        ? '幼児教育・保育の無償化により、月額25,700円までの補助が適用されます。超過分が自己負担の保育料となります。'
        : '認可外施設は施設への支払い総額を参考値としています。',
      keyValues: calculationKeyValues,
    },
  ];

  if (regularOtherExpenseRows.length > 0) {
    sections.push({
      title: 'その他の実費',
      table: {
        columns: ['項目', '金額', '備考'],
        rows: regularOtherExpenseRows,
      },
    });
  }

  const kgExtracurricularSection = buildExtracurricularSection(
    costs.otherExpenses,
    '文部科学省「子供の学習費調査（令和3年度）」',
  );
  if (kgExtracurricularSection) {
    sections.push(kgExtracurricularSection);
  }

  return {
    title: `${SCHOOL_CATEGORY_LABELS.kindergarten} 参考値の詳細`,
    summary: `${areaLabel}／${schedule.sourceLabel}`,
    sections,
    sources: [
      {
        label: '学習費調査',
        detail: '文部科学省「子供の学習費調査（令和3年度）」',
      },
      {
        label: '無償化補助',
        detail: `幼児教育・保育の無償化（補助上限 ${yen(KINDERGARTEN_SUBSIDY_CAP_YEN)}/月）`,
      },
      {
        label: '参考データ',
        detail: schedule.sourceLabel,
      },
      {
        label: '学校外活動費',
        detail: '習い事等は文部科学省「子供の学習費調査（令和3年度）」幼稚園在園者の学校外活動費（全国平均）',
      },
    ],
  };
}

export function buildElementaryReferenceDetail(input: {
  areaLabel: string;
  schedule: ElementaryFeeSchedule;
  costs: FetchedEducationCosts;
  schoolTypeLabel: string;
}): EducationReferenceDetail {
  const { areaLabel, schedule, costs, schoolTypeLabel } = input;

  const schoolEducationTotal = schedule.schoolEducationBreakdown.reduce(
    (sum, item) => sum + item.annualAmount,
    0,
  );
  const schoolAndLunchAnnual = schoolEducationTotal + schedule.lunchAnnual;

  const isPublic = schedule.tuitionAnnual === 0;

  const calculationKeyValues = isPublic
    ? [
        { label: '対象地域', value: areaLabel },
        { label: '学校種別', value: schoolTypeLabel },
        { label: '入学金', value: 'なし（公立）' },
        { label: '授業料', value: 'なし（義務教育無償）' },
        {
          label: '学校教育費（年間平均）',
          value: annualYen(schoolEducationTotal),
        },
        {
          label: '学校給食費（年間平均）',
          value: annualYen(schedule.lunchAnnual),
        },
        {
          label: '学校関連費用合計',
          value: annualYen(schoolAndLunchAnnual),
        },
      ]
    : [
        { label: '対象地域', value: areaLabel },
        { label: '学校種別', value: schoolTypeLabel },
        {
          label: '入学金',
          value: '学校により異なるため省略（個別に確認）',
        },
        {
          label: '授業料（年間平均）',
          value: annualYen(schedule.tuitionAnnual),
        },
        {
          label: '学校教育費合計（年間平均）',
          value: annualYen(schoolEducationTotal),
        },
        {
          label: '学校給食費（年間平均）',
          value: annualYen(schedule.lunchAnnual),
        },
        {
          label: '学校関連費用合計',
          value: annualYen(schoolAndLunchAnnual),
        },
      ];

  const breakdownRows = schedule.schoolEducationBreakdown.map((item) => ({
    cells: [item.label, annualYen(item.annualAmount), '学校教育費'],
  }));

  const descriptionText = isPublic
    ? '文部科学省「子供の学習費調査」の学校教育費・学校給食費・学校外活動費（塾・習い事等）をもとにしています。公立小学校は授業料・入学金ともに無償です。'
    : '文部科学省「子供の学習費調査」の学校教育費・学校給食費・学校外活動費（塾・習い事等）をもとにしています。入学金は学校によって大きく異なるため省略しています。';

  // 学校外活動費（習い事・塾）の参考値行
  const extracurricularSourceNote = isPublic
    ? '令和3年度全国平均'
    : '令和5年度推計';

  const extracurricularRows = schedule.otherExpenses
    .filter(
      (item) =>
        item.label.includes('塾') || item.label.includes('習い事'),
    )
    .map((item) => ({
      cells: [
        item.label,
        monthlyYen(item.amount),
        extracurricularSourceNote,
      ],
    }));

  return {
    title: `${SCHOOL_CATEGORY_LABELS.elementary} 参考値の詳細`,
    summary: `${areaLabel}／${schedule.sourceLabel}`,
    sections: [
      buildAppliedValuesSection(costs, { tuitionLabel: '授業料（年額）' }),
      {
        title: '費用の算定',
        description: descriptionText,
        keyValues: calculationKeyValues,
      },
      {
        title: '学校教育費の内訳（年間平均）',
        description: isPublic
          ? undefined
          : '授業料を含む学校教育費の内訳です。入学金等は入学時費用を6年で按分した値です。',
        table: {
          columns: ['項目', '金額', '区分'],
          rows: [
            ...breakdownRows,
            {
              cells: ['学校給食費', annualYen(schedule.lunchAnnual), '給食費'],
              highlight: false,
            },
            {
              cells: [
                '合計（学校外活動費除く）',
                annualYen(schoolAndLunchAnnual),
                '',
              ],
              highlight: true,
            },
          ],
        },
      },
      ...(extracurricularRows.length > 0
        ? [
            {
              title: '学校外活動費（塾・習い事等）の参考値',
              description:
                '家庭や学年により大きく異なります。入力欄には全国平均を参考値として反映しています。実情に合わせて調整してください。',
              table: {
                columns: ['項目', '月額', '出典'],
                rows: extracurricularRows,
              },
            } satisfies EducationReferenceSection,
          ]
        : []),
    ],
    sources: [
      {
        label: '学習費調査',
        detail: '文部科学省「子供の学習費調査（令和5年度）」',
      },
      {
        label: '学校外活動費',
        detail: isPublic
          ? '補助学習費・その他活動費は令和3年度全国平均値'
          : '補助学習費・その他活動費は令和5年度学校外活動費総額から按分推計',
      },
    ],
  };
}

export function buildJuniorHighReferenceDetail(input: {
  areaLabel: string;
  schedule: JuniorHighFeeSchedule;
  costs: FetchedEducationCosts;
  schoolTypeLabel: string;
}): EducationReferenceDetail {
  const { areaLabel, schedule, costs, schoolTypeLabel } = input;

  const schoolEducationTotal = schedule.schoolEducationBreakdown.reduce(
    (sum, item) => sum + item.annualAmount,
    0,
  );
  const schoolAndLunchAnnual = schoolEducationTotal + schedule.lunchAnnual;

  const isPublic = schedule.tuitionAnnual === 0;

  const calculationKeyValues = isPublic
    ? [
        { label: '対象地域', value: areaLabel },
        { label: '学校種別', value: schoolTypeLabel },
        { label: '入学金', value: 'なし（公立）' },
        { label: '授業料', value: 'なし（義務教育無償）' },
        {
          label: '学校教育費（年間）',
          value: annualYen(schoolEducationTotal),
        },
        {
          label: '学校給食費（年間）',
          value: annualYen(schedule.lunchAnnual),
        },
        {
          label: '学校関連費用合計',
          value: annualYen(schoolAndLunchAnnual),
        },
      ]
    : [
        { label: '対象地域', value: areaLabel },
        { label: '学校種別', value: schoolTypeLabel },
        {
          label: '入学金',
          value: '学校により異なるため省略（個別に確認）',
        },
        {
          label: '授業料（年間平均）',
          value: annualYen(schedule.tuitionAnnual),
        },
        {
          label: '学校教育費合計（年間平均）',
          value: annualYen(schoolEducationTotal),
        },
        {
          label: '学校給食費（年間平均）',
          value: annualYen(schedule.lunchAnnual),
        },
        {
          label: '学校関連費用合計',
          value: annualYen(schoolAndLunchAnnual),
        },
      ];

  const breakdownRows = schedule.schoolEducationBreakdown.map((item) => ({
    cells: [item.label, annualYen(item.annualAmount), '学校教育費'],
  }));

  const descriptionText = isPublic
    ? '文部科学省「子供の学習費調査」の学校教育費・学校給食費・学校外活動費（塾・習い事等）をもとにしています。公立中学校は授業料・入学金ともに無償です。学校教育費の内訳は令和3年度データを参照しています。'
    : '文部科学省「子供の学習費調査」の学校教育費・学校給食費・学校外活動費（塾・習い事等）をもとにしています。入学金は学校によって大きく異なるため省略しています。';

  const extracurricularSourceNote = '令和3年度全国平均';

  const extracurricularRows = schedule.otherExpenses
    .filter(
      (item) =>
        item.label.includes('塾') || item.label.includes('習い事'),
    )
    .map((item) => ({
      cells: [
        item.label,
        monthlyYen(item.amount),
        extracurricularSourceNote,
      ],
    }));

  return {
    title: `${SCHOOL_CATEGORY_LABELS.junior_high} 参考値の詳細`,
    summary: `${areaLabel}／${schedule.sourceLabel}`,
    sections: [
      buildAppliedValuesSection(costs, { tuitionLabel: '授業料（年額）' }),
      {
        title: '費用の算定',
        description: descriptionText,
        keyValues: calculationKeyValues,
      },
      {
        title: '学校教育費の内訳（年間平均）',
        description: isPublic
          ? '授業料・入学金なし。内訳の合計は令和3年度データ（139,870円）ですが、令和5年度の合計（150,761円）を費用計算に使用しています。'
          : '授業料を含む学校教育費の内訳です。入学金等は入学時費用を3年で按分した値（令和5年度推計）です。',
        table: {
          columns: ['項目', '金額', '区分'],
          rows: [
            ...breakdownRows,
            {
              cells: ['学校給食費', annualYen(schedule.lunchAnnual), '給食費'],
              highlight: false,
            },
            {
              cells: [
                '合計（学校外活動費除く）',
                annualYen(schoolAndLunchAnnual),
                '',
              ],
              highlight: true,
            },
          ],
        },
      },
      ...(extracurricularRows.length > 0
        ? [
            {
              title: '学校外活動費（塾・習い事等）の参考値',
              description:
                '家庭や学年により大きく異なります。入力欄には全国平均を参考値として反映しています。実情に合わせて調整してください。',
              table: {
                columns: ['項目', '月額', '出典'],
                rows: extracurricularRows,
              },
            } satisfies EducationReferenceSection,
          ]
        : []),
    ],
    sources: [
      {
        label: '学習費調査',
        detail: '文部科学省「子供の学習費調査（令和5年度）」',
      },
      {
        label: '学校教育費内訳',
        detail: isPublic
          ? '公立中の費用内訳は令和3年度データ。令和5年度の学校教育費合計（150,761円）を費用計算に使用'
          : '私立中の費用内訳は令和3年度から令和5年度総額にスケール推計',
      },
      {
        label: '学校外活動費',
        detail: '補助学習費・その他活動費は令和3年度全国平均値',
      },
    ],
  };
}

export function buildHighSchoolReferenceDetail(input: {
  areaLabel: string;
  schedule: HighSchoolFeeSchedule;
  costs: FetchedEducationCosts;
  schoolType: SchoolType;
  schoolTypeLabel: string;
}): EducationReferenceDetail {
  const { areaLabel, schedule, costs, schoolType, schoolTypeLabel } = input;

  const schoolEducationTotal = schedule.schoolEducationBreakdown.reduce(
    (sum, item) => sum + item.annualAmount,
    0,
  );

  const isPublic = isPublicHighSchoolType(schoolType);
  const isMextFullTime = schedule.referenceBasis === 'mext_full_time';
  const isStatutory = schedule.referenceBasis === 'statutory';

  const calculationKeyValues = buildHighSchoolCalculationKeyValues({
    areaLabel,
    schedule,
    schoolTypeLabel,
    schoolEducationTotal,
    isPublic,
    isMextFullTime,
    isStatutory,
  });

  const breakdownRows = schedule.schoolEducationBreakdown.map((item) => ({
    cells: [item.label, annualYen(item.annualAmount), '学校教育費'],
  }));

  const descriptionText = buildHighSchoolDescriptionText({
    isPublic,
    isMextFullTime,
    isStatutory,
    schoolTypeLabel,
  });

  const breakdownDescription = buildHighSchoolBreakdownDescription({
    isPublic,
    isMextFullTime,
    isStatutory,
    schoolTypeLabel,
  });

  const extracurricularSourceNote = isMextFullTime
    ? '令和5年度全国平均'
    : '参考値（推計）';

  const extracurricularRows = schedule.otherExpenses
    .filter(
      (item) =>
        item.label.includes('塾') || item.label.includes('習い事'),
    )
    .map((item) => ({
      cells: [
        item.label,
        monthlyYen(item.amount),
        extracurricularSourceNote,
      ],
    }));

  return {
    title: `${SCHOOL_CATEGORY_LABELS.high_school} 参考値の詳細`,
    summary: `${areaLabel}／${schedule.sourceLabel}`,
    sections: [
      buildAppliedValuesSection(costs, { tuitionLabel: '授業料（年額）' }),
      {
        title: '費用の算定',
        description: descriptionText,
        keyValues: calculationKeyValues,
      },
      {
        title: '学校教育費の内訳（年間平均）',
        description: breakdownDescription,
        table: {
          columns: ['項目', '金額', '区分'],
          rows: [
            ...breakdownRows,
            {
              cells: [
                '合計（学校外活動費除く）',
                annualYen(schoolEducationTotal),
                '',
              ],
              highlight: true,
            },
          ],
        },
      },
      ...(extracurricularRows.length > 0
        ? [
            {
              title: '学校外活動費（塾・習い事等）の参考値',
              description:
                '家庭や学年により大きく異なります。入力欄には参考値として反映しています。実情に合わせて調整してください。',
              table: {
                columns: ['項目', '月額', '出典'],
                rows: extracurricularRows,
              },
            } satisfies EducationReferenceSection,
          ]
        : []),
    ],
    sources: buildHighSchoolSources({
      isPublic,
      isMextFullTime,
      isStatutory,
      schoolTypeLabel,
    }),
  };
}

function buildHighSchoolCalculationKeyValues(input: {
  areaLabel: string;
  schedule: HighSchoolFeeSchedule;
  schoolTypeLabel: string;
  schoolEducationTotal: number;
  isPublic: boolean;
  isMextFullTime: boolean;
  isStatutory: boolean;
}): { label: string; value: string }[] {
  const {
    areaLabel,
    schedule,
    schoolTypeLabel,
    schoolEducationTotal,
    isPublic,
    isMextFullTime,
    isStatutory,
  } = input;

  if (isMextFullTime && isPublic) {
    return [
      { label: '対象地域', value: areaLabel },
      { label: '学校種別', value: schoolTypeLabel },
      { label: '入学金', value: 'なし（公立）' },
      {
        label: '授業料（実支払い平均）',
        value: annualYen(schedule.tuitionAnnual),
      },
      {
        label: '※就学支援金',
        value:
          '多くの世帯で授業料が実質無償化（年収目安910万円未満）',
      },
      {
        label: '学校教育費（授業料除く、年間平均）',
        value: annualYen(schoolEducationTotal - schedule.tuitionAnnual),
      },
      {
        label: '学校関連費用合計',
        value: annualYen(schoolEducationTotal),
      },
    ];
  }

  if (isMextFullTime) {
    return [
      { label: '対象地域', value: areaLabel },
      { label: '学校種別', value: schoolTypeLabel },
      {
        label: '入学金',
        value: '学校により異なるため省略（個別に確認）',
      },
      {
        label: '授業料（就学支援金後・全国平均）',
        value: annualYen(schedule.tuitionAnnual),
      },
      {
        label: '※就学支援金',
        value:
          '年収目安590万円未満の世帯は最大507,200円/年の支援あり',
      },
      {
        label: '学校教育費合計（年間平均）',
        value: annualYen(schoolEducationTotal),
      },
    ];
  }

  if (isStatutory) {
    return [
      { label: '対象地域', value: areaLabel },
      { label: '学校種別', value: schoolTypeLabel },
      {
        label: '入学料（省令標準額）',
        value: yen(schedule.entranceFee),
      },
      {
        label: '授業料（省令標準額）',
        value: annualYen(schedule.tuitionAnnual),
      },
      {
        label: '※就学支援金・修学支援',
        value: '本科1〜3年は高等学校等就学支援金の対象。4〜5年は修学支援新制度の対象',
      },
      {
        label: '学校教育費（授業料除く・推計）',
        value: annualYen(schoolEducationTotal - schedule.tuitionAnnual),
      },
      {
        label: '学校関連費用合計（推計）',
        value: annualYen(schoolEducationTotal),
      },
    ];
  }

  if (isPublic) {
    return [
      { label: '対象地域', value: areaLabel },
      { label: '学校種別', value: schoolTypeLabel },
      {
        label: '入学金',
        value:
          schedule.entranceFee > 0
            ? yen(schedule.entranceFee)
            : 'なし（公立）',
      },
      {
        label: '授業料（参考値）',
        value: annualYen(schedule.tuitionAnnual),
      },
      {
        label: '※就学支援金',
        value: '多くの世帯で授業料が実質無償化',
      },
      {
        label: '学校教育費（授業料除く・推計）',
        value: annualYen(schoolEducationTotal - schedule.tuitionAnnual),
      },
      {
        label: '学校関連費用合計（推計）',
        value: annualYen(schoolEducationTotal),
      },
    ];
  }

  return [
    { label: '対象地域', value: areaLabel },
    { label: '学校種別', value: schoolTypeLabel },
    {
      label: '入学金',
      value: '学校により異なるため省略（個別に確認）',
    },
    {
      label: '授業料（参考値）',
      value: annualYen(schedule.tuitionAnnual),
    },
    {
      label: '※就学支援金',
      value: '就学支援金の対象。支給上限は学校種別により異なります',
    },
    {
      label: '学校教育費合計（推計）',
      value: annualYen(schoolEducationTotal),
    },
  ];
}

function buildHighSchoolDescriptionText(input: {
  isPublic: boolean;
  isMextFullTime: boolean;
  isStatutory: boolean;
  schoolTypeLabel: string;
}): string {
  const { isPublic, isMextFullTime, isStatutory, schoolTypeLabel } = input;

  if (isMextFullTime) {
    return isPublic
      ? '文部科学省「子供の学習費調査」の学校教育費・学校外活動費（塾・習い事等）をもとにしています。授業料は就学支援金適用後の実支払い平均額です。'
      : '文部科学省「子供の学習費調査」の学校教育費・学校外活動費（塾・習い事等）をもとにしています。入学金は学校によって大きく異なるため省略しています。';
  }

  if (isStatutory) {
    return `${schoolTypeLabel}の授業料・入学料は文部科学省省令の標準額です。教材費・実習費・通学費等は一般的な水準を参考に推計しています。`;
  }

  return `${schoolTypeLabel}は学習費調査の対象外のため、標準額・公表データ・全日制の調査結果をベースに推計した参考値です。学校・コース・履修単位数により大きく異なります。`;
}

function buildHighSchoolBreakdownDescription(input: {
  isPublic: boolean;
  isMextFullTime: boolean;
  isStatutory: boolean;
  schoolTypeLabel: string;
}): string | undefined {
  const { isMextFullTime, isStatutory } = input;

  if (isMextFullTime) {
    return input.isPublic
      ? '授業料は就学支援金適用後の実支払い平均額です。入学金等は入学時費用を3年で按分した値です。'
      : '授業料を含む学校教育費の内訳です。入学金等は入学時費用を3年で按分した値です。';
  }

  if (isStatutory) {
    return '入学金等は5年課程で按分した値です。教材・実習費は一般的な水準を参考に推計しています。';
  }

  return '学習費調査の対象外のため推計値です。実際の費用は学校・履修単位数・コースにより大きく異なります。';
}

function buildHighSchoolSources(input: {
  isPublic: boolean;
  isMextFullTime: boolean;
  isStatutory: boolean;
  schoolTypeLabel: string;
}): EducationReferenceDetail['sources'] {
  const { isMextFullTime, isStatutory } = input;

  if (isMextFullTime) {
    return [
      {
        label: '学習費調査',
        detail: '文部科学省「子供の学習費調査（令和5年度）」',
      },
      {
        label: '就学支援金',
        detail: '高等学校等就学支援金制度（文部科学省）',
      },
      {
        label: '学校外活動費',
        detail: '補助学習費・学校外活動費は令和5年度全国平均値',
      },
    ];
  }

  if (isStatutory) {
    return [
      {
        label: '授業料・入学料',
        detail:
          '国立高等専門学校の授業料その他の費用に関する省令（平成16年文部科学省令第17号）',
      },
      {
        label: '就学支援金・修学支援',
        detail: '高等学校等就学支援金制度・修学支援新制度（文部科学省）',
      },
      {
        label: 'その他費用',
        detail: '教材・実習費・通学費等は一般的な水準を参考に推計',
      },
    ];
  }

  return [
    {
      label: '参考データ',
      detail:
        '定時制・通信制は標準額・公表データ、全日制の学習費調査をベースに推計',
    },
    {
      label: '就学支援金',
      detail: '高等学校等就学支援金制度（文部科学省）',
    },
    {
      label: '学校外活動費',
      detail: '全日制の学習費調査または一般的な水準を参考に推計',
    },
  ];
}

export function buildUniversityReferenceDetail(input: {
  areaLabel: string;
  schedule: UniversityFeeSchedule;
  costs: FetchedEducationCosts;
  schoolType: SchoolType;
  schoolTypeLabel: string;
  housingType: UniversityHousingType;
}): EducationReferenceDetail {
  const {
    areaLabel,
    schedule,
    costs,
    schoolType,
    schoolTypeLabel,
    housingType,
  } = input;

  const schoolEducationTotal = schedule.schoolEducationBreakdown.reduce(
    (sum, item) => sum + item.annualAmount,
    0,
  );

  const isNational = isNationalUniversityType(schoolType);
  const isMedical = isMedicalUniversityType(schoolType);
  const isMextSurvey = schedule.referenceBasis === 'mext_survey';
  const housingLabel = UNIVERSITY_HOUSING_TYPE_LABELS[housingType];

  const livingExpenses = schedule.otherExpenses.filter(
    (item) =>
      item.label.includes('生活費') || item.label.includes('引っ越し'),
  );
  const schoolOtherExpenses = schedule.otherExpenses.filter(
    (item) =>
      !item.label.includes('生活費') && !item.label.includes('引っ越し'),
  );

  const calculationKeyValues = [
    { label: '対象地域', value: areaLabel },
    { label: '学校種別', value: schoolTypeLabel },
    { label: '通学形態', value: housingLabel },
    {
      label: '入学金（参考値）',
      value:
        schedule.entranceFee > 0
          ? yen(schedule.entranceFee)
          : '学校により異なるため省略',
    },
    {
      label: '授業料（年額）',
      value: annualYen(schedule.tuitionAnnual),
    },
    {
      label: '学校教育費合計（生活費除く）',
      value: annualYen(schoolEducationTotal),
    },
    ...(housingType === 'dorm_apartment'
      ? [
          {
            label: '生活費（一人暮らし・月額平均）',
            value: monthlyYen(138_070),
          },
          {
            label: '引っ越し費用（初年度のみ）',
            value: yen(116_900),
          },
        ]
      : [
          {
            label: '生活費（自宅通学・月額平均）',
            value: monthlyYen(70_760),
          },
        ]),
  ];

  const breakdownRows = schedule.schoolEducationBreakdown.map((item) => ({
    cells: [item.label, annualYen(item.annualAmount), '学校教育費'],
  }));

  const schoolOtherRows = schoolOtherExpenses.map((item) => ({
    cells: [
      item.label,
      item.paymentCycle === 'monthly'
        ? monthlyYen(item.amount)
        : annualYen(item.amount),
      item.enrollmentYear === 1 ? '初年度のみ' : '年額',
    ],
  }));

  const livingRows = livingExpenses.map((item) => ({
    cells: [
      item.label,
      item.paymentCycle === 'monthly'
        ? monthlyYen(item.amount)
        : annualYen(item.amount),
      item.enrollmentYear === 1 ? '初年度のみ' : '月額',
    ],
  }));

  const descriptionText = isMextSurvey
    ? `文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」の平均額と、全国大学生活協同組合連合会「第61回学生生活実態調査」（2025年）の生活費をもとにしています。通学形態は「${housingLabel}」です。`
    : `国立大学等の授業料省令の標準額（または公立短大平均）と、大学生協調査の生活費をもとにしています。通学形態は「${housingLabel}」です。${isMedical ? '医学部は6年制です。' : ''}`;

  return {
    title: `${SCHOOL_CATEGORY_LABELS.university} 参考値の詳細`,
    summary: `${areaLabel}／${schedule.sourceLabel}`,
    sections: [
      buildAppliedValuesSection(costs, { tuitionLabel: '授業料（年額）' }),
      {
        title: '費用の算定',
        description: descriptionText,
        keyValues: calculationKeyValues,
      },
      {
        title: '学校教育費の内訳（年間）',
        description: isMextSurvey
          ? '私立大学・短大の調査平均値です。2年目以降も施設設備費等が毎年かかります。'
          : '国立大学は省令標準額です。教材・実習費は推計値を含みます。',
        table: {
          columns: ['項目', '金額', '区分'],
          rows: [
            ...breakdownRows,
            {
              cells: ['合計（生活費除く）', annualYen(schoolEducationTotal), ''],
              highlight: true,
            },
          ],
        },
      },
      ...(schoolOtherRows.length > 0
        ? [
            {
              title: 'その他の学校関連費用',
              table: {
                columns: ['項目', '金額', '備考'],
                rows: schoolOtherRows,
              },
            } satisfies EducationReferenceSection,
          ]
        : []),
      ...(livingRows.length > 0
        ? [
            {
              title: '生活費の参考値',
              description:
                '全国大学生活協同組合連合会「第61回学生生活実態調査」（2025年）の月額支出平均です。地域や生活スタイルにより大きく異なります。',
              table: {
                columns: ['項目', '金額', '備考'],
                rows: livingRows,
              },
            } satisfies EducationReferenceSection,
          ]
        : []),
    ],
    sources: [
      ...(isMextSurvey
        ? [
            {
              label: '学生納付金調査',
              detail:
                '文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」',
            },
          ]
        : [
            {
              label: '授業料・入学料',
              detail: isNational
                ? '国立大学等の授業料その他の費用に関する省令（標準額）または公立短期大学平均'
                : '文部科学省公表の標準額・平均額',
            },
          ]),
      {
        label: '生活費',
        detail:
          '全国大学生活協同組合連合会「第61回学生生活実態調査」（2025年）',
      },
      {
        label: '修学支援',
        detail: '高等教育の修学支援新制度・授業料減免（文部科学省）',
      },
    ],
  };
}

export function buildGraduateReferenceDetail(input: {
  areaLabel: string;
  schedule: GraduateFeeSchedule;
  costs: FetchedEducationCosts;
  schoolType: SchoolType;
  schoolTypeLabel: string;
  programType: GraduateProgramType;
  housingType: UniversityHousingType;
}): EducationReferenceDetail {
  const {
    areaLabel,
    schedule,
    costs,
    schoolType,
    schoolTypeLabel,
    programType,
    housingType,
  } = input;

  const schoolEducationTotal = schedule.schoolEducationBreakdown.reduce(
    (sum, item) => sum + item.annualAmount,
    0,
  );

  const isNational = isNationalGraduateType(schoolType);
  const isMedical = isGraduateMedicalType(schoolType);
  const isMextSurvey = schedule.referenceBasis === 'mext_survey';
  const programLabel = GRADUATE_PROGRAM_TYPE_LABELS[programType];
  const housingLabel = UNIVERSITY_HOUSING_TYPE_LABELS[housingType];

  const livingExpenses = schedule.otherExpenses.filter(
    (item) =>
      item.label.includes('生活費') || item.label.includes('引っ越し'),
  );
  const schoolOtherExpenses = schedule.otherExpenses.filter(
    (item) =>
      !item.label.includes('生活費') && !item.label.includes('引っ越し'),
  );

  const calculationKeyValues = [
    { label: '対象地域', value: areaLabel },
    { label: '学校種別', value: schoolTypeLabel },
    { label: '課程', value: programLabel },
    { label: '通学形態', value: housingLabel },
    {
      label: '入学金（参考値）',
      value:
        schedule.entranceFee > 0
          ? yen(schedule.entranceFee)
          : '学校により異なるため省略',
    },
    {
      label: '授業料（年額）',
      value: annualYen(schedule.tuitionAnnual),
    },
    {
      label: '学校教育費合計（生活費除く）',
      value: annualYen(schoolEducationTotal),
    },
    ...(housingType === 'dorm_apartment'
      ? [
          {
            label: '生活費（一人暮らし・月額平均）',
            value: monthlyYen(138_070),
          },
          {
            label: '引っ越し費用（初年度のみ）',
            value: yen(116_900),
          },
        ]
      : [
          {
            label: '生活費（自宅通学・月額平均）',
            value: monthlyYen(70_760),
          },
        ]),
  ];

  const breakdownRows = schedule.schoolEducationBreakdown.map((item) => ({
    cells: [item.label, annualYen(item.annualAmount), '学校教育費'],
  }));

  const schoolOtherRows = schoolOtherExpenses.map((item) => ({
    cells: [
      item.label,
      item.paymentCycle === 'monthly'
        ? monthlyYen(item.amount)
        : annualYen(item.amount),
      item.enrollmentYear === 1 ? '初年度のみ' : '年額',
    ],
  }));

  const livingRows = livingExpenses.map((item) => ({
    cells: [
      item.label,
      item.paymentCycle === 'monthly'
        ? monthlyYen(item.amount)
        : annualYen(item.amount),
      item.enrollmentYear === 1 ? '初年度のみ' : '月額',
    ],
  }));

  const descriptionText = isMextSurvey
    ? `文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」の大学院平均額と、大学生協調査の生活費をもとにしています。課程は「${programLabel}」、通学形態は「${housingLabel}」です。`
    : isNational
      ? `国立大学等の授業料省令標準額と、大学生協調査の生活費をもとにしています。課程は「${programLabel}」、通学形態は「${housingLabel}」です。${isMedical ? '医学系は教材・研究費が高めです。' : ''}`
      : `私立大学院の文科省調査平均をベースに、理系・医系は学部系統の倍率で推計しています。課程は「${programLabel}」、通学形態は「${housingLabel}」です。`;

  return {
    title: `${SCHOOL_CATEGORY_LABELS.graduate} 参考値の詳細`,
    summary: `${areaLabel}／${schedule.sourceLabel}`,
    sections: [
      buildAppliedValuesSection(costs, { tuitionLabel: '授業料（年額）' }),
      {
        title: '費用の算定',
        description: descriptionText,
        keyValues: calculationKeyValues,
      },
      {
        title: '学校教育費の内訳（年間）',
        description: isNational
          ? '国立大学院は省令標準額です。教材・研究費は推計値を含みます。'
          : '私立大学院の調査平均または推計値です。専攻・大学により大きく異なります。',
        table: {
          columns: ['項目', '金額', '区分'],
          rows: [
            ...breakdownRows,
            {
              cells: ['合計（生活費除く）', annualYen(schoolEducationTotal), ''],
              highlight: true,
            },
          ],
        },
      },
      ...(schoolOtherRows.length > 0
        ? [
            {
              title: 'その他の学校関連費用',
              table: {
                columns: ['項目', '金額', '備考'],
                rows: schoolOtherRows,
              },
            } satisfies EducationReferenceSection,
          ]
        : []),
      ...(livingRows.length > 0
        ? [
            {
              title: '生活費の参考値',
              description:
                '全国大学生活協同組合連合会「第61回学生生活実態調査」（2025年）の月額支出平均です。地域や生活スタイルにより大きく異なります。',
              table: {
                columns: ['項目', '金額', '備考'],
                rows: livingRows,
              },
            } satisfies EducationReferenceSection,
          ]
        : []),
    ],
    sources: [
      ...(isMextSurvey
        ? [
            {
              label: '学生納付金調査',
              detail:
                '文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」（大学院）',
            },
          ]
        : isNational
          ? [
              {
                label: '授業料・入学料',
                detail: '国立大学等の授業料その他の費用に関する省令（標準額）',
              },
            ]
          : [
              {
                label: '学生納付金調査',
                detail:
                  '文部科学省令和5年度調査の博士前期平均をベースに理系・医系を推計',
              },
            ]),
      {
        label: '生活費',
        detail:
          '全国大学生活協同組合連合会「第61回学生生活実態調査」（2025年）',
      },
      {
        label: '修学支援',
        detail: '高等教育の修学支援新制度・授業料減免（文部科学省）',
      },
    ],
  };
}
