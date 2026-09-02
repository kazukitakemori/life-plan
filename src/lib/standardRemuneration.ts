import {
  BONUS_PAYMENT_COUNT_THRESHOLD,
  FUKUOKA_STANDARD_REMUNERATION_GRADES_R8,
  HEALTH_STANDARD_BONUS_ANNUAL_CAP_YEN,
  PENSION_STANDARD_BONUS_PER_PAYMENT_CAP_YEN,
  PENSION_STANDARD_REMUNERATION_CAP_YEN,
  PENSION_STANDARD_REMUNERATION_LOWER_YEN,
} from '../data/fukuokaStandardRemunerationR8';

export { BONUS_PAYMENT_COUNT_THRESHOLD };

export type StandardRemunerationPurpose = 'health' | 'pension';

/**
 * 報酬月額（円）から健康保険用の標準報酬月額を等級表で決定する。
 * 協会けんぽ福岡支部・令和8年度等級表（R8_40fukuoka）に準拠。
 */
export function resolveHealthStandardRemunerationYen(
  monthlyRemunerationYen: number,
): number {
  if (monthlyRemunerationYen <= 0) return 0;

  for (const grade of FUKUOKA_STANDARD_REMUNERATION_GRADES_R8) {
    if (
      grade.upperBoundYen == null ||
      monthlyRemunerationYen < grade.upperBoundYen
    ) {
      return grade.standardYen;
    }
  }

  return FUKUOKA_STANDARD_REMUNERATION_GRADES_R8.at(-1)?.standardYen ?? 0;
}

/**
 * 報酬月額（円）から厚生年金用の標準報酬月額を等級表で決定する。
 * 報酬月額635,000円以上は標準報酬月額650,000円（等級35）で上限。
 */
export function resolvePensionStandardRemunerationYen(
  monthlyRemunerationYen: number,
): number {
  if (monthlyRemunerationYen <= 0) return 0;
  if (monthlyRemunerationYen >= PENSION_STANDARD_REMUNERATION_LOWER_YEN) {
    return PENSION_STANDARD_REMUNERATION_CAP_YEN;
  }
  return resolveHealthStandardRemunerationYen(monthlyRemunerationYen);
}

export function resolveStandardRemunerationYen(
  monthlyRemunerationYen: number,
  purpose: StandardRemunerationPurpose,
): number {
  return purpose === 'pension'
    ? resolvePensionStandardRemunerationYen(monthlyRemunerationYen)
    : resolveHealthStandardRemunerationYen(monthlyRemunerationYen);
}

/** 賞与額から標準賞与額（1,000円未満切り捨て）を算出 */
export function truncateStandardBonusYen(bonusYen: number): number {
  if (bonusYen <= 0) return 0;
  return Math.floor(bonusYen / 1000) * 1000;
}

/** 厚生年金用標準賞与額（1回あたり150万円上限） */
export function resolvePensionStandardBonusYen(bonusYen: number): number {
  return Math.min(
    truncateStandardBonusYen(bonusYen),
    PENSION_STANDARD_BONUS_PER_PAYMENT_CAP_YEN,
  );
}

/** 健康保険用標準賞与額の年間合計（573万円上限） */
export function capHealthStandardBonusTotalYen(totalYen: number): number {
  return Math.min(totalYen, HEALTH_STANDARD_BONUS_ANNUAL_CAP_YEN);
}

/** 万円入力を等級表で標準報酬月額（円）に変換（年金推計などで使用） */
export function standardRemunerationYenFromMonthlyMan(
  monthlyAmountMan: number,
  purpose: StandardRemunerationPurpose = 'pension',
): number {
  return resolveStandardRemunerationYen(
    Math.max(0, monthlyAmountMan) * 10_000,
    purpose,
  );
}
