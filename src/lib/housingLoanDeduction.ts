/**

 * 住宅借入金等特別控除（住宅ローン控除）の計算

 *

 * 制度概要（令和4年以降・消費税10%適用）

 * - 控除率  : 年末ローン残高 × 0.7%

 * - 控除期間: 新築13年 / 中古10年

 * - 上限額  : 住宅区分ごとの借入限度額 × 0.7%

 * - 適用   : 所得税から控除、控除しきれない分を住民税から控除（上限 97,500円/年）

 * - 諸費用 : 仲介・登記・銀行手数料のローン組込分は控除対象外

 *            （年末残高 × 物件価格 / 総借入額 で按分）

 *

 * 住民税控除の上限（地方税法附則第5条の4の2）

 * 所得税の課税総所得金額等の合計 × 5%（最大 97,500 円）

 * ← 本実装では保守的に 97,500 円の固定上限を使用

 */



import type {

  HousingLoanDeductionCategory,

  OwnedProperty,

  OwnedPropertyLoanSettings,

  HousingState,

} from '../types/housing';

import { HOUSEHOLD_HOUSING_KEY } from '../types/housing';

import type { FamilyMember } from '../types/family';

import type { LoanEntry, LoanState } from '../types/loan';

import {

  calcHousingLoanTotalAmountMan,

  calcHousingLoanDeductionEligibleYearEndBalanceYen,

  type HousingLoanAmountOptions,

} from './housingLoanAmount';

import { getOwnershipStartCalendar } from './housingLoanAmortization';

import { findLoanEntryBucket, getMemberLoanEntries, getAllLoanEntries } from './loanDefaults';

import { getLinkedHousingProperty } from './loanResolution';

import {
  isJointDebtEntry,
  resolveJointDebtPrimaryDeductionSharePct,
  resolveJointDebtSpouseDeductionSharePct,
  resolvePairSharePct,
} from './pairLoanShare';

import {

  resolveHousingLoanDeductionHouseholdType,

  type HousingLoanDeductionHouseholdType,

} from './housingLoanDeductionHousehold';
import { normalizeOwnedPropertyTargetSettings } from './housingLabels';

const MAN_TO_YEN = 10_000;



/** 2024年以降入居の一般新築は控除対象外 */

export const GENERAL_NEW_CONSTRUCTION_EXCLUSION_FROM_YEAR = 2024;



export const HOUSING_LOAN_DEDUCTION_RATE_PCT = 0.7;



export const NEW_CONSTRUCTION_DEDUCTION_LIMITS: Record<

  Exclude<HousingLoanDeductionCategory, 'none'>,

  { childRearingYoungMan: number; otherMan: number; years: number }

> = {

  certified_long_term: { childRearingYoungMan: 5000, otherMan: 4500, years: 13 },

  zeh: { childRearingYoungMan: 4500, otherMan: 3500, years: 13 },

  energy_standard: { childRearingYoungMan: 4000, otherMan: 3000, years: 13 },

  general: { childRearingYoungMan: 0, otherMan: 0, years: 13 },

};



export const USED_DEDUCTION_LIMITS: Record<

  'general' | 'certified_long_term',

  { limitMan: number; years: number }

> = {

  general: { limitMan: 2000, years: 10 },

  certified_long_term: { limitMan: 3000, years: 10 },

};



/** @deprecated 互換用。新築/中古・世帯区分は個別の定数を参照 */

export const HOUSING_LOAN_DEDUCTION_LIMITS: Record<

  Exclude<HousingLoanDeductionCategory, 'none'>,

  { newMan: number; usedMan: number; newYears: number; usedYears: number }

> = {

  certified_long_term: {

    newMan: 5000,

    usedMan: USED_DEDUCTION_LIMITS.certified_long_term.limitMan,

    newYears: 13,

    usedYears: USED_DEDUCTION_LIMITS.certified_long_term.years,

  },

  zeh: { newMan: 4500, usedMan: 3000, newYears: 13, usedYears: 10 },

  energy_standard: { newMan: 4000, usedMan: 3000, newYears: 13, usedYears: 10 },

  general: {

    newMan: 0,

    usedMan: USED_DEDUCTION_LIMITS.general.limitMan,

    newYears: 13,

    usedYears: USED_DEDUCTION_LIMITS.general.years,

  },

};



export interface NewConstructionHousingLoanDeductionTableRow {

  category: Exclude<HousingLoanDeductionCategory, 'none'>;

  childRearingYoungLimitMan: number;

  otherLimitMan: number;

  years: number;

}



export interface UsedHousingLoanDeductionTableRow {

  category: 'general' | 'certified_long_term';

  limitMan: number;

  years: number;

}



export function getNewConstructionHousingLoanDeductionTableRows(): NewConstructionHousingLoanDeductionTableRow[] {

  const categories: Exclude<HousingLoanDeductionCategory, 'none'>[] = [

    'certified_long_term',

    'zeh',

    'energy_standard',

    'general',

  ];



  return categories.map((category) => {

    const limits = NEW_CONSTRUCTION_DEDUCTION_LIMITS[category];

    return {

      category,

      childRearingYoungLimitMan: limits.childRearingYoungMan,

      otherLimitMan: limits.otherMan,

      years: limits.years,

    };

  });

}



export function getUsedHousingLoanDeductionTableRows(): UsedHousingLoanDeductionTableRow[] {

  return (['certified_long_term', 'general'] as const).map((category) => {

    const limits = USED_DEDUCTION_LIMITS[category];

    return {

      category,

      limitMan: limits.limitMan,

      years: limits.years,

    };

  });

}



export const HOUSING_LOAN_DEDUCTION_CATEGORY_LABELS: Record<HousingLoanDeductionCategory, string> = {

  certified_long_term: '認定長期優良住宅・低炭素住宅',

  zeh: 'ZEH水準省エネ住宅',

  energy_standard: '省エネ基準適合住宅',

  general: '一般住宅',

  none: '対象外（控除なし）',

};



function resolveNewConstructionBorrowingLimitMan(

  category: Exclude<HousingLoanDeductionCategory, 'none'>,

  householdType: HousingLoanDeductionHouseholdType,

  occupancyYear: number,

): number {

  if (

    category === 'general' &&

    occupancyYear >= GENERAL_NEW_CONSTRUCTION_EXCLUSION_FROM_YEAR

  ) {

    return 0;

  }



  const limits = NEW_CONSTRUCTION_DEDUCTION_LIMITS[category];

  return householdType === 'child_rearing_young_couple'

    ? limits.childRearingYoungMan

    : limits.otherMan;

}



function resolveUsedBorrowingLimitMan(
  category: HousingLoanDeductionCategory,
): number {
  if (
    category === 'certified_long_term' ||
    category === 'zeh' ||
    category === 'energy_standard'
  ) {
    return USED_DEDUCTION_LIMITS.certified_long_term.limitMan;
  }
  return USED_DEDUCTION_LIMITS.general.limitMan;
}

function resolveDeductionYears(
  isNewConstruction: boolean,
  category: HousingLoanDeductionCategory,
): number {
  if (category === 'none') return 0;
  if (isNewConstruction) {
    return NEW_CONSTRUCTION_DEDUCTION_LIMITS[category].years;
  }
  return category === 'certified_long_term' ||
    category === 'zeh' ||
    category === 'energy_standard'
    ? USED_DEDUCTION_LIMITS.certified_long_term.years
    : USED_DEDUCTION_LIMITS.general.years;
}



function resolveBorrowingLimitMan(

  _property: OwnedProperty,

  category: Exclude<HousingLoanDeductionCategory, 'none'>,

  occupancyYear: number,

  householdType: HousingLoanDeductionHouseholdType,

  isNewConstruction: boolean,

): number {

  if (isNewConstruction) {

    return resolveNewConstructionBorrowingLimitMan(

      category,

      householdType,

      occupancyYear,

    );

  }

  return resolveUsedBorrowingLimitMan(category);

}



/**

 * ローン設定に基づく住宅ローン控除額（円）。

 * 年末残高ベース（利息ではなく残高 × 0.7%）。

 */

function calcHousingLoanDeductionFromSettingsYen(

  property: OwnedProperty,

  loan: OwnedPropertyLoanSettings,

  memberAge: number,

  referenceYear: number,

  calendarYear: number,

  familyMembers: FamilyMember[] = [],

  referenceDate?: Date,

  amountOptions?: HousingLoanAmountOptions,

): number {

  if (property.paymentMethod !== 'loan') return 0;

  if (!loan || loan.deductionCategory === 'none') return 0;

  const loanAmountOptions =
    amountOptions?.pairSharePct != null
      ? { pairSharePct: amountOptions.pairSharePct }
      : undefined;

  const loanAmountMan = calcHousingLoanTotalAmountMan(
    property,
    loan,
    loanAmountOptions,
  );

  if (loanAmountMan <= 0) return 0;



  const { deductionCategory } = normalizeOwnedPropertyTargetSettings(

    loan.isNewConstruction,

    loan.deductionCategory,

  );



  const referenceMonth = referenceDate
    ? referenceDate.getMonth() + 1
    : (amountOptions?.referenceMonth ?? 1);
  const birthMonth = amountOptions?.birthMonth;
  const calendarOptions: HousingLoanAmountOptions = {
    ...amountOptions,
    birthMonth,
    referenceMonth,
  };

  const startCalendar = getOwnershipStartCalendar(
    property,
    memberAge,
    referenceYear,
    birthMonth,
    referenceMonth,
  );

  const occupancyYear = startCalendar.year;

  const householdType =
    referenceDate && familyMembers.length > 0
      ? resolveHousingLoanDeductionHouseholdType(
          familyMembers,
          referenceDate,
          occupancyYear,
        )
      : 'other';

  const borrowingLimitMan = resolveBorrowingLimitMan(
    property,
    deductionCategory,
    occupancyYear,
    householdType,
    loan.isNewConstruction,
  );
  if (borrowingLimitMan <= 0) return 0;

  const deductionYears = resolveDeductionYears(
    loan.isNewConstruction,
    deductionCategory,
  );
  const limitApplicableYear = occupancyYear + deductionYears;

  if (calendarYear < occupancyYear || calendarYear >= limitApplicableYear) {
    return 0;
  }

  const yearEndBalanceYen = calcHousingLoanDeductionEligibleYearEndBalanceYen(
    property,
    loan,
    memberAge,
    referenceYear,
    calendarYear,
    calendarOptions,
  );

  const borrowingLimitYen = borrowingLimitMan * MAN_TO_YEN;

  const applicableBalanceYen = Math.min(yearEndBalanceYen, borrowingLimitYen);



  return Math.floor(applicableBalanceYen * 0.007);

}



/**

 * 1物件・1暦年の住宅ローン控除額（円）を返す。

 * 控除の適用年数チェックを含む。

 */

export function calcPropertyHousingLoanDeductionYen(

  property: OwnedProperty,

  memberAge: number,

  referenceYear: number,

  calendarYear: number,

  familyMembers: FamilyMember[] = [],

  referenceDate?: Date,

  amountOptions?: HousingLoanAmountOptions,

): number {

  const { loan } = property;

  if (!loan) return 0;

  return calcHousingLoanDeductionFromSettingsYen(

    property,

    loan,

    memberAge,

    referenceYear,

    calendarYear,

    familyMembers,

    referenceDate,

    amountOptions,

  );

}



/**

 * Q9 ローンエントリ1本ぶんの住宅ローン控除額（円）。

 * ペアローンは借入分担後の残高で計算する。

 * 連帯債務は契約1本の残高を按分して双方の控除を計算する。

 */

export function calcLoanEntryHousingLoanDeductionYen(

  property: OwnedProperty,

  entry: LoanEntry,

  memberAge: number,

  referenceYear: number,

  calendarYear: number,

  familyMembers: FamilyMember[] = [],

  referenceDate?: Date,

  deductionShareOverride?: number,

): number {

  const pairSharePct = resolvePairSharePct(entry);

  const jointDebtPrimaryShare = resolveJointDebtPrimaryDeductionSharePct(entry);



  let amountOptions: HousingLoanAmountOptions | undefined;
  if (pairSharePct != null) {
    amountOptions = { pairSharePct };
  } else if (jointDebtPrimaryShare != null) {
    const sharePct = deductionShareOverride ?? jointDebtPrimaryShare;
    amountOptions = { deductionBalanceSharePct: sharePct };
  }
  // ペアローン・連帯債務では契約者本人の年齢ではなく、物件の入居年算定に使われた
  // 基準年齢（世帯の物件なら世帯主、個人の物件なら本人）を使う必要がある。
  const anchorAge = resolveHousingOwnershipAnchorAge(
    entry.housingLink?.targetId,
    familyMembers,
    memberAge,
  );
  const anchorBirthMonth = resolveHousingOwnershipAnchorBirthMonth(
    entry.housingLink?.targetId,
    familyMembers,
  );
  amountOptions = {
    ...amountOptions,
    birthMonth: anchorBirthMonth,
  };

  return calcHousingLoanDeductionFromSettingsYen(
    property,
    entry.settings,
    anchorAge,
    referenceYear,
    calendarYear,
    familyMembers,
    referenceDate,
    amountOptions,
  );
}



/**
 * 入居年の算定基準となる年齢を解決する。
 * property.startAge は「その物件のコンテキストメンバー」の年齢を基準に入力されているため
 * （世帯の物件は世帯主、個人の物件は本人）、ペアローン・連帯債務で控除計算の対象メンバーが
 * 契約者本人と異なる場合でも、常にこの基準年齢を使わないと入居年がズレてしまう。
 */
function resolveHousingOwnershipAnchorAge(
  targetId: string | undefined,
  familyMembers: FamilyMember[],
  fallbackAge: number,
): number {
  if (targetId == null) return fallbackAge;
  if (targetId === HOUSEHOLD_HOUSING_KEY) {
    const head = familyMembers.find((member) => member.role === 'head');
    return head?.age ?? fallbackAge;
  }
  const owner = familyMembers.find((member) => member.id === targetId);
  return owner?.age ?? fallbackAge;
}

function resolveHousingOwnershipAnchorBirthMonth(
  targetId: string | undefined,
  familyMembers: FamilyMember[],
  fallbackBirthMonth?: number | null,
): number | null | undefined {
  if (targetId == null) return fallbackBirthMonth;
  if (targetId === HOUSEHOLD_HOUSING_KEY) {
    const head = familyMembers.find((member) => member.role === 'head');
    return head?.birthMonth ?? fallbackBirthMonth;
  }
  const owner = familyMembers.find((member) => member.id === targetId);
  return owner?.birthMonth ?? fallbackBirthMonth;
}

function findSpouseMemberId(
  members: FamilyMember[],
  memberId: string,
): string | undefined {
  const member = members.find((item) => item.id === memberId);
  if (!member) return undefined;
  if (member.role === 'head') {
    return members.find((item) => item.role === 'spouse')?.id;
  }
  if (member.role === 'spouse') {
    return members.find((item) => item.role === 'head')?.id;
  }
  return undefined;
}

function calcJointDebtSpouseDeductionYen(
  housingState: HousingState,
  loanState: LoanState,
  memberId: string,
  memberAge: number,
  referenceYear: number,
  calendarYear: number,
  familyMembers: FamilyMember[],
  referenceDate?: Date,
): number {
  return getAllLoanEntries(loanState).reduce((sum, entry) => {
    if (!isJointDebtEntry(entry) || !entry.housingLink) return sum;

    const bucket = findLoanEntryBucket(loanState, entry.id);
    if (!bucket || bucket.memberId === memberId) return sum;

    const spouseMemberId = findSpouseMemberId(familyMembers, bucket.memberId);
    if (spouseMemberId !== memberId) return sum;

    const property = getLinkedHousingProperty(housingState, entry);
    if (!property) return sum;

    const spouseShare = resolveJointDebtSpouseDeductionSharePct(entry);
    if (spouseShare == null) return sum;

    return (
      sum +
      calcLoanEntryHousingLoanDeductionYen(
        property,
        entry,
        memberAge,
        referenceYear,
        calendarYear,
        familyMembers,
        referenceDate,
        spouseShare,
      )
    );
  }, 0);
}



function getMemberHousingLoanEntries(

  loanState: LoanState,

  memberId: string,

): LoanEntry[] {

  return getMemberLoanEntries(loanState, memberId).filter(

    (entry) => entry.category === 'housing' && entry.housingLink,

  );

}



function calcMemberDeductionFromOwnedProperties(

  properties: OwnedProperty[],

  memberAge: number,

  referenceYear: number,

  calendarYear: number,

  familyMembers: FamilyMember[],

  referenceDate?: Date,

  birthMonth?: number | null,

): number {

  return properties.reduce(

    (sum, property) =>

      sum +

      calcPropertyHousingLoanDeductionYen(

        property,

        memberAge,

        referenceYear,

        calendarYear,

        familyMembers,

        referenceDate,

        { birthMonth },

      ),

    0,

  );

}



/**

 * メンバー1人分の住宅ローン控除合計額（円）を返す。

 * Q9 のローンエントリを優先し、未登録時は所有物件の loan 設定にフォールバックする。

 */

export function calcMemberHousingLoanDeductionYen(

  housingState: HousingState,

  memberId: string,

  memberAge: number,

  referenceYear: number,

  calendarYear: number,

  familyMembers: FamilyMember[] = [],

  referenceDate?: Date,

  loanState?: LoanState,

): number {

  if (loanState) {

    const loanEntries = getMemberHousingLoanEntries(loanState, memberId);

    const ownDeduction = loanEntries.reduce((sum, entry) => {

      const property = getLinkedHousingProperty(housingState, entry);

      if (!property) return sum;

      return (

        sum +

        calcLoanEntryHousingLoanDeductionYen(

          property,

          entry,

          memberAge,

          referenceYear,

          calendarYear,

          familyMembers,

          referenceDate,

        )

      );

    }, 0);

    const jointDebtSpouseDeduction =
      familyMembers.length > 0
        ? calcJointDebtSpouseDeductionYen(
            housingState,
            loanState,
            memberId,
            memberAge,
            referenceYear,
            calendarYear,
            familyMembers,
            referenceDate,
          )
        : 0;

    if (loanEntries.length > 0 || jointDebtSpouseDeduction > 0) {
      return ownDeduction + jointDebtSpouseDeduction;
    }

  }



  const memberBirthMonth = familyMembers.find(
    (member) => member.id === memberId,
  )?.birthMonth;

  const memberTarget = housingState.byTarget[memberId];

  if (memberTarget?.owned.length) {

    return calcMemberDeductionFromOwnedProperties(

      memberTarget.owned,

      memberAge,

      referenceYear,

      calendarYear,

      familyMembers,

      referenceDate,

      memberBirthMonth,

    );

  }



  const headMember = familyMembers.find((member) => member.role === 'head');

  if (headMember?.id === memberId) {

    const householdTarget = housingState.byTarget[HOUSEHOLD_HOUSING_KEY];

    if (householdTarget?.owned.length) {

      return calcMemberDeductionFromOwnedProperties(

        householdTarget.owned,

        memberAge,

        referenceYear,

        calendarYear,

        familyMembers,

        referenceDate,

        memberBirthMonth,

      );

    }

  }



  return 0;

}



/** 住民税控除の年間上限（円） */

export const RESIDENT_TAX_HOUSING_LOAN_CREDIT_CAP_YEN = 97_500;

