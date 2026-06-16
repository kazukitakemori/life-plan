import {
  HEISEI15_REFORM_MONTH,
  HEISEI15_REFORM_YEAR,
  PROPORTIONAL_RATE_POST_HEISEI15,
  PROPORTIONAL_RATE_PRE_HEISEI15,
} from './pensionConstants';

/** 厚生年金加入期間の報酬累計（平成15年3月以前／4月以降で分割） */
export interface ProportionalPartAccumulation {
  preMonths: number;
  preRemunerationSumYen: number;
  postMonths: number;
  postRemunerationSumYen: number;
}

export function createEmptyProportionalAccumulation(): ProportionalPartAccumulation {
  return {
    preMonths: 0,
    preRemunerationSumYen: 0,
    postMonths: 0,
    postRemunerationSumYen: 0,
  };
}

export function getTotalEnrollmentMonths(
  acc: ProportionalPartAccumulation,
): number {
  return acc.preMonths + acc.postMonths;
}

/** 暦年月が平成15年4月以降の厚生年金加入期間か */
export function isPostHeisei15ReformMonth(
  calendarYear: number,
  calendarMonth: number,
): boolean {
  if (calendarYear > HEISEI15_REFORM_YEAR) return true;
  if (calendarYear < HEISEI15_REFORM_YEAR) return false;
  return calendarMonth >= HEISEI15_REFORM_MONTH;
}

/**
 * 報酬比例部分（年額・円）を算出する。
 *
 * A = 平成15年3月以前の Σ(標準報酬月額) × (7.125÷1000)
 * B = 平成15年4月以降の Σ(標準報酬月額) × (5.481÷1000)
 * 報酬比例部分 = A + B
 *
 * 加入月数は各月の標準報酬の合計（Σ）に反映される。
 * 定額部分（特別支給の老齢厚生年金）は含まない。
 * v1: 標準賞与・共済組合の別計算は未対応。
 */
export function calcProportionalPartAnnualYen(
  acc: ProportionalPartAccumulation,
): number {
  let annualYen = 0;

  if (acc.preMonths > 0) {
    annualYen +=
      acc.preRemunerationSumYen *
      (PROPORTIONAL_RATE_PRE_HEISEI15 / 1000);
  }

  if (acc.postMonths > 0) {
    annualYen +=
      acc.postRemunerationSumYen *
      (PROPORTIONAL_RATE_POST_HEISEI15 / 1000);
  }

  return annualYen;
}

/** 報酬比例部分の月額（円）= 年額 ÷ 12 */
export function calcProportionalPartMonthlyYen(
  acc: ProportionalPartAccumulation,
): number {
  return calcProportionalPartAnnualYen(acc) / 12;
}

export function addEmployeesEnrollmentMonth(
  acc: ProportionalPartAccumulation,
  calendarYear: number,
  calendarMonth: number,
  standardRemunerationYen: number,
): void {
  if (isPostHeisei15ReformMonth(calendarYear, calendarMonth)) {
    acc.postMonths += 1;
    acc.postRemunerationSumYen += standardRemunerationYen;
  } else {
    acc.preMonths += 1;
    acc.preRemunerationSumYen += standardRemunerationYen;
  }
}
