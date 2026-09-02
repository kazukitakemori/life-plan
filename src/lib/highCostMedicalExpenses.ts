/**
 * 高額療養費の自己負担限度額（協会けんぽ・70歳未満・令和8年8月～令和9年7月）。
 * @see https://www.kyoukaikenpo.or.jp/benefit/high_cost_medical_expenses/002/#heading-3
 */

/** 70歳未満の所得区分（ア〜オ） */
export type HighCostIncomeBracket = 'A' | 'B' | 'C' | 'D' | 'E';

export const HIGH_COST_INCOME_BRACKET_LABELS: Record<
  HighCostIncomeBracket,
  string
> = {
  A: '区分ア（標準報酬月額83万円以上）',
  B: '区分イ（53万〜79万円）',
  C: '区分ウ（28万〜50万円）',
  D: '区分エ（26万円以下）',
  E: '区分オ（低所得者）',
};

/** 標準報酬月額（万円）から区分を推定（70歳未満） */
export function inferHighCostIncomeBracket(
  standardRemunerationMan: number,
): HighCostIncomeBracket {
  const yen = standardRemunerationMan * 10_000;
  if (yen >= 830_000) return 'A';
  if (yen >= 530_000) return 'B';
  if (yen >= 280_000) return 'C';
  return 'D';
}

export const HIGH_COST_BRACKET_SHORT_LABELS: Record<
  HighCostIncomeBracket,
  string
> = {
  A: '区分ア',
  B: '区分イ',
  C: '区分ウ',
  D: '区分エ',
  E: '区分オ',
};

export const HIGH_COST_BRACKET_RANGE_LABELS: Record<
  HighCostIncomeBracket,
  string
> = {
  A: '標準報酬月額 83万円以上',
  B: '標準報酬月額 53万〜79万円',
  C: '標準報酬月額 28万〜50万円',
  D: '標準報酬月額 26万円以下',
  E: '低所得者（住民税非課税）',
};

export const HIGH_COST_BRACKET_CAP_FORMULAS: Record<
  HighCostIncomeBracket,
  string
> = {
  A: '270,300円＋(総医療費−901,000円)×1％',
  B: '179,100円＋(総医療費−597,000円)×1％',
  C: '85,800円＋(総医療費−286,000円)×1％',
  D: '61,500円',
  E: '36,900円',
};

export const HIGH_COST_BRACKET_ORDER: HighCostIncomeBracket[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
];

const MULTIPLE_TIMES_CAP_YEN: Record<HighCostIncomeBracket, number> = {
  A: 140_100,
  B: 93_000,
  C: 44_400,
  D: 44_400,
  E: 24_600,
};

/** 多数回該当でない月の自己負担限度額（円） */
export function calcHighCostNormalCapYen(
  bracket: HighCostIncomeBracket,
  totalMedicalYen: number,
): number {
  switch (bracket) {
    case 'A':
      return 270_300 + Math.max(0, totalMedicalYen - 901_000) * 0.01;
    case 'B':
      return 179_100 + Math.max(0, totalMedicalYen - 597_000) * 0.01;
    case 'C':
      return 85_800 + Math.max(0, totalMedicalYen - 286_000) * 0.01;
    case 'D':
      return 61_500;
    case 'E':
      return 36_900;
  }
}

/** 自己負担限度額（円）。多数回該当なら軽減後の上限 */
export function calcHighCostSelfPayCapYen(
  bracket: HighCostIncomeBracket,
  totalMedicalYen: number,
  multipleTimesApplicable: boolean,
): number {
  if (multipleTimesApplicable) {
    return MULTIPLE_TIMES_CAP_YEN[bracket];
  }
  return calcHighCostNormalCapYen(bracket, totalMedicalYen);
}

/** 1か月の医療費自己負担（円）。総医療費10割×負担割合と限度額の小さい方 */
export function calcHighCostMonthlySelfPayYen(input: {
  bracket: HighCostIncomeBracket;
  totalMedicalYen: number;
  copayRate?: number;
  multipleTimesApplicable?: boolean;
}): number {
  const copayRate = input.copayRate ?? 0.3;
  const actualCopayYen = input.totalMedicalYen * copayRate;
  const capYen = calcHighCostSelfPayCapYen(
    input.bracket,
    input.totalMedicalYen,
    input.multipleTimesApplicable ?? false,
  );
  return Math.min(actualCopayYen, capYen);
}

export interface HighCostMonthlyBreakdown {
  monthIndex: number;
  multipleTimesApplicable: boolean;
  selfPayCapYen: number;
  selfPayYen: number;
}

/** 高額療養費を使う月数ぶんの医療費自己負担。4か月目以降は多数回該当 */
export function calcHighCostAnnualMedicalSelfPayYen(input: {
  bracket: HighCostIncomeBracket;
  totalMedicalYenPerMonth: number;
  hospitalMonths: number;
  copayRate?: number;
}): {
  totalSelfPayYen: number;
  months: HighCostMonthlyBreakdown[];
} {
  const months: HighCostMonthlyBreakdown[] = [];
  let totalSelfPayYen = 0;
  const hospitalMonths = Math.max(0, Math.floor(input.hospitalMonths));

  for (let monthIndex = 1; monthIndex <= hospitalMonths; monthIndex += 1) {
    const multipleTimesApplicable = monthIndex >= 4;
    const selfPayCapYen = calcHighCostSelfPayCapYen(
      input.bracket,
      input.totalMedicalYenPerMonth,
      multipleTimesApplicable,
    );
    const selfPayYen = calcHighCostMonthlySelfPayYen({
      bracket: input.bracket,
      totalMedicalYen: input.totalMedicalYenPerMonth,
      copayRate: input.copayRate,
      multipleTimesApplicable,
    });
    months.push({ monthIndex, multipleTimesApplicable, selfPayCapYen, selfPayYen });
    totalSelfPayYen += selfPayYen;
  }

  return { totalSelfPayYen, months };
}

export function yenToMan(yen: number): number {
  return yen / 10_000;
}

export function manToYen(man: number): number {
  return man * 10_000;
}
