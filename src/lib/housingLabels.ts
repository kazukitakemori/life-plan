import type {

  HousingLoanDeductionCategory,

  OwnedPropertyCurrentExpenseMode,

  OwnedPropertyLoanPaymentType,

  OwnedPropertyType,

  OwnedPropertyUsage,

  RentalOccupancy,

} from '../types/housing';



const NEW_CONSTRUCTION_TARGET_CATEGORY_LABELS: Record<

  Exclude<HousingLoanDeductionCategory, 'none'>,

  string

> = {

  certified_long_term: '認定長期優良・低炭素住宅',

  zeh: 'ZEH水準省エネ住宅',

  energy_standard: '省エネ基準適合住宅',

  general: 'その他の住宅（一般新築）',

};



const USED_TARGET_CATEGORY_LABELS: Record<

  'general' | 'certified_long_term',

  string

> = {

  general: '一般中古住宅',

  certified_long_term:

    '省エネ・認定住宅など（ZEH水準や省エネ基準適合を含む）',

};



/** 対象物件（住宅ローン控除区分）の表示ラベル */

export const OWNED_PROPERTY_TARGET_CATEGORY_LABELS: Record<

  Exclude<HousingLoanDeductionCategory, 'none'>,

  string

> = {

  ...NEW_CONSTRUCTION_TARGET_CATEGORY_LABELS,

};



export function getOwnedPropertyTargetCategoryLabel(

  category: Exclude<HousingLoanDeductionCategory, 'none'>,

  isNewConstruction: boolean,

): string {

  if (isNewConstruction) {

    return NEW_CONSTRUCTION_TARGET_CATEGORY_LABELS[category];

  }

  if (category === 'certified_long_term') {

    return USED_TARGET_CATEGORY_LABELS.certified_long_term;

  }

  return USED_TARGET_CATEGORY_LABELS.general;

}



export const NEW_CONSTRUCTION_TARGET_CATEGORIES = [

  'certified_long_term',

  'zeh',

  'energy_standard',

  'general',

] as const satisfies readonly Exclude<HousingLoanDeductionCategory, 'none'>[];



export const USED_TARGET_CATEGORIES = [

  'certified_long_term',

  'general',

] as const satisfies readonly Exclude<HousingLoanDeductionCategory, 'none'>[];



export function getOwnedPropertyTargetCategories(

  isNewConstruction: boolean,

): readonly Exclude<HousingLoanDeductionCategory, 'none'>[] {

  return isNewConstruction

    ? NEW_CONSTRUCTION_TARGET_CATEGORIES

    : USED_TARGET_CATEGORIES;

}



function mapDeductionCategoryForConstructionType(

  isNewConstruction: boolean,

  deductionCategory: HousingLoanDeductionCategory,

): Exclude<HousingLoanDeductionCategory, 'none'> {

  if (deductionCategory === 'none') return 'general';



  if (isNewConstruction) {

    return NEW_CONSTRUCTION_TARGET_CATEGORIES.includes(

      deductionCategory as (typeof NEW_CONSTRUCTION_TARGET_CATEGORIES)[number],

    )

      ? deductionCategory

      : 'general';

  }



  if (

    deductionCategory === 'zeh' ||

    deductionCategory === 'energy_standard' ||

    deductionCategory === 'certified_long_term'

  ) {

    return 'certified_long_term';

  }



  return 'general';

}



export function normalizeOwnedPropertyTargetSettings(

  isNewConstruction: boolean,

  deductionCategory: HousingLoanDeductionCategory,

): {

  isNewConstruction: boolean;

  deductionCategory: Exclude<HousingLoanDeductionCategory, 'none'>;

} {

  return {

    isNewConstruction,

    deductionCategory: mapDeductionCategoryForConstructionType(

      isNewConstruction,

      deductionCategory,

    ),

  };

}



export const RENTAL_OCCUPANCY_SELECT_LABELS: Record<RentalOccupancy, string> = {

  current: '居住中',

  upcoming: '入居予定',

};



export const RENTAL_OCCUPANCY_LABELS: Record<RentalOccupancy, string> = {

  current: '居住中の物件',

  upcoming: 'これから入居',

};



export const RENTAL_OCCUPANCY_HINTS: Record<RentalOccupancy, string> = {

  current: '敷金・礼金・仲介手数料は支払済みとして試算に含めません。',

  upcoming: '入居予定月に敷金・礼金・仲介手数料を購入費・初として計上します。',

};



export const RENTAL_PERIOD_LABELS: Record<RentalOccupancy, string> = {

  current: '住居期間（試算）',

  upcoming: '入居予定',

};



export const OWNED_PROPERTY_USAGE_LABELS: Record<OwnedPropertyUsage, string> = {

  current: '居住中',

  upcoming: '入居予定',

};

export const OWNED_PROPERTY_CURRENT_EXPENSE_MODE_LABELS: Record<
  OwnedPropertyCurrentExpenseMode,
  string
> = {
  analysis: 'ローン分析をする',
  simple: 'ローン分析をしない（簡単入力）',
};


export const OWNED_PROPERTY_LOAN_PAYMENT_LABELS: Record<

  OwnedPropertyLoanPaymentType,

  string

> = {

  loan: 'ローン',

  cash: '現金一括',

};



export const OWNED_PROPERTY_TYPE_LABELS: Record<OwnedPropertyType, string> = {

  condominium: 'マンション',

  detached_house: '一戸建て',

  land: '土地',

};



export const OWNED_PROPERTY_TYPE_DESCRIPTIONS: Record<

  OwnedPropertyType,

  string

> = {

  condominium: '区分所有の集合住宅',

  detached_house: '戸建住宅・注文住宅など',

  land: '更地・駐車場用地など',

};



export const OWNED_PROPERTY_TYPE_ICONS: Record<OwnedPropertyType, string> = {

  condominium: '🏢',

  detached_house: '🏠',

  land: '📍',

};



export const RENTAL_RENEWAL_INTERVAL_OPTIONS = [

  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,

] as const;



export function formatRentalRenewalIntervalLabel(years: number): string {

  if (years === 0) return 'なし';

  return `${years}年おき`;

}



export function getOwnedPropertyDefaultName(type: OwnedPropertyType): string {

  return OWNED_PROPERTY_TYPE_LABELS[type];

}



export const OWNED_REPAIR_INTERVAL_OPTIONS = [

  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,

] as const;



export function formatOwnedRepairIntervalLabel(years: number): string {

  if (years === 0) return 'なし';

  return `${years}年ごと`;

}



export function formatOwnedPeriodOffsetLabel(offsetYears: number): string {

  if (offsetYears === 0) return '当初';

  if (offsetYears < 0) return '永年';

  return `${offsetYears}年後`;

}

