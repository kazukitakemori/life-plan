import {
  getOwnedPropertyTargetCategoryLabel,
  normalizeOwnedPropertyTargetSettings,
} from './housingLabels';
import type {
  HousingLoanDeductionCategory,
  OwnedProperty,
  OwnedPropertyLoanSettings,
  OwnedPropertyType,
  UsedBuildingConstructionEra,
} from '../types/housing';

export interface AcquisitionTargetContext {
  isNewConstruction: boolean;
  deductionCategory: Exclude<HousingLoanDeductionCategory, 'none'>;
}

/** 取得費用試算に使う物件エンティティ（商流・税法の判定単位） */
export interface PropertyAcquisitionEntity {
  propertyType: OwnedPropertyType;
  isNewConstruction: boolean;
  deductionCategory: Exclude<HousingLoanDeductionCategory, 'none'>;
  buildingMan: number;
  landMan: number;
  isManualArea: boolean;
  landAreaSqm: number;
  buildingAreaSqm: number;
  usedBuildingConstructionEra: UsedBuildingConstructionEra;
}

export interface ResolvedAcquisitionAreas {
  landAreaSqm: number;
  buildingAreaSqm: number;
  isDefault: boolean;
}

/** 画面表示用：土地面積（㎡） */
export function formatAcquisitionLandAreaDisplay(landAreaSqm: number): string {
  const formatted =
    Number.isInteger(landAreaSqm)
      ? landAreaSqm.toLocaleString()
      : landAreaSqm.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `${formatted}㎡`;
}

/** マンションの標準土地面積（建物延床面積 × 30%） */
export function estimateCondominiumDefaultLandAreaSqm(
  buildingAreaSqm: number = CONDOMINIUM_DEFAULT_BUILDING_SQM,
): number {
  return Math.round(buildingAreaSqm * CONDOMINIUM_LAND_AREA_RATIO * 10) / 10;
}

export interface AcquisitionFeeBreakdown {
  buildingMan: number;
  landMan: number;
  basePriceMan: number;
  brokerageFeeMan: number;
  registrationFeeMan: number;
  acquisitionTaxMan: number;
  acquisitionTaxYear: number;
  acquisitionTaxMonth: number;
  propertyType: OwnedPropertyType;
  target: AcquisitionTargetContext;
  areas: ResolvedAcquisitionAreas;
  brokerageDetail: {
    formula: string;
    note: string;
  };
  registrationDetail: {
    landAssessedMan: number;
    landAssessedRateLabel: string;
    landRateLabel: string;
    landRegistrationTaxMan: number;
    buildingAssessedMan: number;
    buildingAssessedRateLabel: string;
    buildingRateLabel: string;
    buildingRegistrationTaxMan: number;
    scrivenerFeeMan: number;
    pairLoanScrivenerSurchargeMan: number;
    formula: string;
    note: string;
  };
  acquisitionTaxDetail: {
    landTaxMan: number;
    landFormula: string;
    buildingTaxMan: number;
    buildingFormula: string;
    buildingDeductionMan: number;
    buildingConstructionEraLabel?: string;
    landQualifyingAreaSqm: number;
    note: string;
  };
}

const LAND_ASSESSED_RATE = 0.7;
const NEW_BUILDING_ASSESSED_RATE = 0.55;
const USED_BUILDING_ASSESSED_RATE = 0.45;
const ACQUISITION_TAX_RATE = 0.03;
const SCRIVENER_FEE_MAN = 8;
/** ペアローン時の司法書士報酬上乗せ（抵当権2本の手続き分） */
export const PAIR_LOAN_SCRIVENER_SURCHARGE_MAN = 3;

export function calcScrivenerFeeMan(hasPairLoan = false): number {
  return (
    SCRIVENER_FEE_MAN +
    (hasPairLoan ? PAIR_LOAN_SCRIVENER_SURCHARGE_MAN : 0)
  );
}
const LAND_B_MAX_SQM = 200;
const CONDOMINIUM_DEFAULT_BUILDING_SQM = 70;
const CONDOMINIUM_LAND_AREA_RATIO = 0.3;
const DETACHED_DEFAULT_LAND_SQM = 130;
const DETACHED_DEFAULT_BUILDING_SQM = 100;

const NEW_BUILDING_DEDUCTION_MAN: Record<
  Exclude<HousingLoanDeductionCategory, 'none'>,
  number
> = {
  general: 1200,
  certified_long_term: 1300,
  zeh: 1300,
  energy_standard: 1300,
};

export const DEFAULT_USED_BUILDING_CONSTRUCTION_ERA: UsedBuildingConstructionEra =
  'after_1997_apr';

export const USED_BUILDING_CONSTRUCTION_ERA_OPTIONS = [
  {
    value: 'after_1997_apr',
    label: '1997年4月以降（平成9年以降）',
    deductionMan: 1200,
  },
  {
    value: '1989_apr_to_1997_mar',
    label: '1989年4月〜1997年3月',
    deductionMan: 1000,
  },
  {
    value: '1985_jul_to_1989_mar',
    label: '1985年7月〜1989年3月',
    deductionMan: 450,
  },
  {
    value: '1981_jul_to_1985_jun',
    label: '1981年7月〜1985年6月',
    deductionMan: 420,
  },
  {
    value: 'before_1981_jul',
    label: '1981年7月より前',
    deductionMan: 350,
  },
] as const satisfies readonly {
  value: UsedBuildingConstructionEra;
  label: string;
  deductionMan: number;
}[];

const USED_BUILDING_DEDUCTION_BY_ERA: Record<
  UsedBuildingConstructionEra,
  number
> = Object.fromEntries(
  USED_BUILDING_CONSTRUCTION_ERA_OPTIONS.map((option) => [
    option.value,
    option.deductionMan,
  ]),
) as Record<UsedBuildingConstructionEra, number>;

export function getUsedBuildingConstructionEraLabel(
  era: UsedBuildingConstructionEra,
): string {
  return (
    USED_BUILDING_CONSTRUCTION_ERA_OPTIONS.find((option) => option.value === era)
      ?.label ?? era
  );
}

export function resolveUsedBuildingAcquisitionDeductionMan(
  era: UsedBuildingConstructionEra = DEFAULT_USED_BUILDING_CONSTRUCTION_ERA,
): number {
  return USED_BUILDING_DEDUCTION_BY_ERA[era];
}

export function resolveAcquisitionTarget(
  loan: OwnedPropertyLoanSettings,
): AcquisitionTargetContext {
  return normalizeOwnedPropertyTargetSettings(
    loan.isNewConstruction,
    loan.deductionCategory,
  );
}

export function formatAcquisitionTargetLabel(target: AcquisitionTargetContext): string {
  const condition = target.isNewConstruction ? '新築' : '中古';
  const category = getOwnedPropertyTargetCategoryLabel(
    target.deductionCategory,
    target.isNewConstruction,
  );
  return `${condition}・${category}`;
}

export function buildPropertyAcquisitionEntity(
  property: Pick<
    OwnedProperty,
    | 'type'
    | 'buildingMan'
    | 'landMan'
    | 'isManualArea'
    | 'landAreaSqm'
    | 'buildingAreaSqm'
    | 'usedBuildingConstructionEra'
    | 'loan'
  >,
): PropertyAcquisitionEntity {
  const target = resolveAcquisitionTarget(property.loan);
  return {
    propertyType: property.type,
    isNewConstruction: target.isNewConstruction,
    deductionCategory: target.deductionCategory,
    buildingMan: property.buildingMan,
    landMan: property.landMan,
    isManualArea: property.isManualArea,
    landAreaSqm: property.landAreaSqm,
    buildingAreaSqm: property.buildingAreaSqm,
    usedBuildingConstructionEra:
      property.usedBuildingConstructionEra ??
      DEFAULT_USED_BUILDING_CONSTRUCTION_ERA,
  };
}

/**
 * 価格帯から標準面積を推定（isManualArea=false 時のみ使用）。
 * 一戸建ては土地130㎡・建物100㎡を基準に、土地価格の偏りで調整する。
 */
export function resolveDefaultAcquisitionAreas(
  propertyType: OwnedPropertyType,
  buildingMan: number,
  landMan: number,
): ResolvedAcquisitionAreas {
  if (propertyType === 'condominium') {
    const buildingAreaSqm = CONDOMINIUM_DEFAULT_BUILDING_SQM;
    return {
      landAreaSqm: estimateCondominiumDefaultLandAreaSqm(buildingAreaSqm),
      buildingAreaSqm,
      isDefault: true,
    };
  }

  if (propertyType === 'land') {
    const totalMan = landMan;
    let landAreaSqm = DETACHED_DEFAULT_LAND_SQM;
    if (totalMan > 8000) landAreaSqm = 70;
    else if (totalMan > 5000) landAreaSqm = 80;
    else if (totalMan < 500) landAreaSqm = 150;
    return { landAreaSqm, buildingAreaSqm: 0, isDefault: true };
  }

  const totalMan = buildingMan + landMan;
  const landShare = totalMan > 0 ? landMan / totalMan : 0.5;
  let landAreaSqm = DETACHED_DEFAULT_LAND_SQM;
  const buildingAreaSqm = DETACHED_DEFAULT_BUILDING_SQM;

  if (landShare > 0.6 || landMan > 5000) {
    if (landMan > 8000) landAreaSqm = 70;
    else if (landMan > 5000) landAreaSqm = 80;
    else landAreaSqm = 90;
  } else if (landShare < 0.25 || landMan < 500) {
    landAreaSqm = 150;
  }

  return { landAreaSqm, buildingAreaSqm, isDefault: true };
}

export function resolveAcquisitionAreas(
  entity: PropertyAcquisitionEntity,
): ResolvedAcquisitionAreas {
  if (entity.isManualArea) {
    return {
      landAreaSqm: entity.landAreaSqm,
      buildingAreaSqm: entity.buildingAreaSqm,
      isDefault: false,
    };
  }
  return resolveDefaultAcquisitionAreas(
    entity.propertyType,
    entity.buildingMan,
    entity.landMan,
  );
}

/** 仲介手数料の法定上限（税込） */
export function calcBrokerageFeeStatutoryMaxMan(totalPriceMan: number): number {
  if (totalPriceMan <= 0) return 0;
  if (totalPriceMan <= 200) return Math.ceil(totalPriceMan * 0.05 * 1.1);
  if (totalPriceMan <= 400)
    return Math.ceil((totalPriceMan * 0.04 + 2) * 1.1);
  return Math.ceil((totalPriceMan * 0.03 + 6) * 1.1);
}

/** @deprecated calcBrokerageFeeStatutoryMaxMan を使用 */
export function calcBrokerageFeeMan(totalPriceMan: number): number {
  return calcBrokerageFeeStatutoryMaxMan(totalPriceMan);
}

function resolveBuildingAssessedRate(isNewConstruction: boolean): number {
  return isNewConstruction
    ? NEW_BUILDING_ASSESSED_RATE
    : USED_BUILDING_ASSESSED_RATE;
}

function formatAssessedRatePct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function estimateLandAssessedMan(landMan: number): number {
  if (landMan <= 0) return 0;
  return Math.ceil(landMan * LAND_ASSESSED_RATE);
}

function estimateBuildingAssessedMan(
  buildingMan: number,
  isNewConstruction: boolean,
): number {
  if (buildingMan <= 0) return 0;
  return Math.ceil(buildingMan * resolveBuildingAssessedRate(isNewConstruction));
}

function estimateBuildingAssessedManForAcquisitionTax(
  buildingMan: number,
  isNewConstruction: boolean,
): number {
  if (buildingMan <= 0) return 0;
  return Math.round(buildingMan * resolveBuildingAssessedRate(isNewConstruction));
}

function formatBrokerageStatutoryFormula(totalPriceMan: number): string {
  if (totalPriceMan <= 0) return '—';
  if (totalPriceMan > 400) {
    return `${totalPriceMan.toLocaleString()}万円 × 3% + 6万円（税抜）`;
  }
  if (totalPriceMan > 200) {
    return `${totalPriceMan.toLocaleString()}万円 × 4% + 2万円（税抜）`;
  }
  return `${totalPriceMan.toLocaleString()}万円 × 5%（税抜）`;
}

/** 商流に応じた仲介手数料（新築マンションは0円） */
export function calcBrokerageFeeForEntity(entity: PropertyAcquisitionEntity): {
  feeMan: number;
  formula: string;
  note: string;
} {
  const totalPriceMan = entity.buildingMan + entity.landMan;
  if (totalPriceMan <= 0) {
    return { feeMan: 0, formula: '—', note: '取得価格が未入力のため0円です。' };
  }

  if (entity.isNewConstruction && entity.propertyType === 'condominium') {
    return {
      feeMan: 0,
      formula: '0円（新築マンション・売主直接分譲）',
      note:
        '新築マンションは売主（ディベロッパー）直接分譲が基本のため、仲介手数料の初期反映額は0円としています。実際に仲介が介在する場合は手入力で修正してください。',
    };
  }

  const feeMan = calcBrokerageFeeStatutoryMaxMan(totalPriceMan);
  const formula = formatBrokerageStatutoryFormula(totalPriceMan);
  const note =
    entity.isNewConstruction && entity.propertyType === 'detached_house'
      ? '新築一戸建ては売主直・建売仲介の双方があり得るため、資金計画の安全性を考慮し法定上限（3%＋6万円＋税）で反映しています。売主直の場合は0円等に手入力で修正できます。'
      : '中古物件・土地のみの取得は仲介取引が原則のため、法定上限（3%＋6万円＋税込）で反映しています。';

  return { feeMan, formula, note };
}

function isNewConstructionPreferentialCategory(
  category: Exclude<HousingLoanDeductionCategory, 'none'>,
): boolean {
  return (
    category === 'certified_long_term' ||
    category === 'zeh' ||
    category === 'energy_standard'
  );
}

function resolvePreferentialNewBuildingRegistrationLabel(
  category: Exclude<HousingLoanDeductionCategory, 'none'>,
): string {
  switch (category) {
    case 'certified_long_term':
      return '0.1%（認定長期優良・低炭素住宅・所有権保存登記）';
    case 'zeh':
      return '0.1%（ZEH水準省エネ住宅・所有権保存登記）';
    case 'energy_standard':
      return '0.1%（省エネ基準適合住宅・所有権保存登記）';
    default:
      return '0.1%（省エネ・ZEH・認定長期優良など・所有権保存登記）';
  }
}

function resolveBuildingRegistrationRate(
  target: AcquisitionTargetContext,
): { rate: number; label: string } {
  if (target.isNewConstruction) {
    if (isNewConstructionPreferentialCategory(target.deductionCategory)) {
      return {
        rate: 0.001,
        label: resolvePreferentialNewBuildingRegistrationLabel(
          target.deductionCategory,
        ),
      };
    }
    return {
      rate: 0.0015,
      label: '0.15%（一般新築住宅・所有権保存登記）',
    };
  }

  if (target.deductionCategory === 'certified_long_term') {
    return {
      rate: 0.001,
      label: '0.1%（省エネ・認定住宅など・移転登記）',
    };
  }

  return {
    rate: 0.003,
    label: '0.3%（一般中古住宅・移転登記）',
  };
}

/** 土地の所有権移転登記にかかる登録免許税（建物と独立・一律1.5%） */
export function calcLandRegistrationTaxMan(landMan: number): number {
  if (landMan <= 0) return 0;
  const assessedMan = estimateLandAssessedMan(landMan);
  return Math.ceil(assessedMan * 0.015);
}

/** 建物の保存/移転登記にかかる登録免許税（土地と独立） */
export function calcBuildingRegistrationTaxMan(
  buildingMan: number,
  propertyType: OwnedPropertyType,
  target: AcquisitionTargetContext,
): number {
  if (buildingMan <= 0 || propertyType === 'land') return 0;
  const assessedMan = estimateBuildingAssessedMan(
    buildingMan,
    target.isNewConstruction,
  );
  const { rate } = resolveBuildingRegistrationRate(target);
  return Math.ceil(assessedMan * rate);
}

/** 登記手数料の概算（土地・建物の登録免許税を個別計算＋司法書士報酬） */
export function calcRegistrationFeeMan(
  buildingMan: number,
  landMan: number,
  propertyType: OwnedPropertyType,
  target: AcquisitionTargetContext,
  options?: { hasPairLoan?: boolean },
): number {
  const landTax = calcLandRegistrationTaxMan(landMan);
  const buildingTax = calcBuildingRegistrationTaxMan(
    buildingMan,
    propertyType,
    target,
  );
  if (landTax + buildingTax <= 0) return 0;
  return landTax + buildingTax + calcScrivenerFeeMan(options?.hasPairLoan);
}

function resolveBuildingAcquisitionDeductionMan(
  target: AcquisitionTargetContext,
  usedBuildingConstructionEra: UsedBuildingConstructionEra,
): number {
  if (target.isNewConstruction) {
    return NEW_BUILDING_DEDUCTION_MAN[target.deductionCategory];
  }
  return resolveUsedBuildingAcquisitionDeductionMan(usedBuildingConstructionEra);
}

export interface BuildingAcquisitionTaxResult {
  assessedMan: number;
  deductionMan: number;
  taxableBaseMan: number;
  taxMan: number;
  formula: string;
}

/** 建物の不動産取得税（土地とは完全独立。建物に1/2特例は適用しない） */
export function calcBuildingAcquisitionTaxMan(
  buildingMan: number,
  propertyType: OwnedPropertyType,
  target: AcquisitionTargetContext,
  usedBuildingConstructionEra: UsedBuildingConstructionEra = DEFAULT_USED_BUILDING_CONSTRUCTION_ERA,
): BuildingAcquisitionTaxResult {
  if (propertyType === 'land' || buildingMan <= 0) {
    return {
      assessedMan: 0,
      deductionMan: 0,
      taxableBaseMan: 0,
      taxMan: 0,
      formula: '—',
    };
  }

  const assessedMan = estimateBuildingAssessedManForAcquisitionTax(
    buildingMan,
    target.isNewConstruction,
  );
  const deductionMan = resolveBuildingAcquisitionDeductionMan(
    target,
    usedBuildingConstructionEra,
  );
  const taxableBaseMan = assessedMan - deductionMan;
  const taxMan =
    taxableBaseMan > 0 ? Math.ceil(taxableBaseMan * ACQUISITION_TAX_RATE) : 0;

  const formula =
    taxableBaseMan > 0
      ? `${assessedMan.toLocaleString()}万円 − ${deductionMan.toLocaleString()}万円 = ${Math.round(taxableBaseMan).toLocaleString()}万円 × 3% ≒ ${taxMan}万円`
      : `${assessedMan.toLocaleString()}万円 − ${deductionMan.toLocaleString()}万円 → 0万円（控除後ゼロ）`;

  return {
    assessedMan,
    deductionMan,
    taxableBaseMan,
    taxMan,
    formula,
  };
}

export interface LandAcquisitionTaxResult {
  assessedMan: number;
  taxableAfterAMan: number;
  qualifyingAreaSqm: number;
  landAreaSqm: number;
  reliefRatio: number;
  taxBeforeReliefMan: number;
  nonQualifyingAreaSqm: number;
  taxMan: number;
  formula: string;
}

/** 土地の不動産取得税（建物とは完全独立。1/2特例は土地のみ） */
export function calcLandAcquisitionTaxMan(
  landMan: number,
  landAreaSqm: number,
  buildingAreaSqm: number,
  propertyType: OwnedPropertyType,
  hasResidentialBuilding: boolean,
): LandAcquisitionTaxResult {
  if (landMan <= 0) {
    return {
      assessedMan: 0,
      taxableAfterAMan: 0,
      qualifyingAreaSqm: 0,
      landAreaSqm: 0,
      reliefRatio: 0,
      taxBeforeReliefMan: 0,
      nonQualifyingAreaSqm: 0,
      taxMan: 0,
      formula: '—',
    };
  }

  const assessedMan = Math.round(landMan * LAND_ASSESSED_RATE);
  const taxableAfterAMan = assessedMan * 0.5;
  const landRateLabel = formatAssessedRatePct(LAND_ASSESSED_RATE);

  if (!hasResidentialBuilding || propertyType === 'land') {
    const taxBeforeRelief = taxableAfterAMan * ACQUISITION_TAX_RATE;
    const taxMan = Math.ceil(taxBeforeRelief);
    return {
      assessedMan,
      taxableAfterAMan,
      qualifyingAreaSqm: 0,
      landAreaSqm,
      reliefRatio: 0,
      taxBeforeReliefMan: taxBeforeRelief,
      nonQualifyingAreaSqm: 0,
      taxMan,
      formula: `${landMan.toLocaleString()}万円 × ${landRateLabel} × 1/2 × 3% ≒ ${taxMan}万円（住宅用建物なし）`,
    };
  }

  const qualifyingAreaSqm =
    landAreaSqm > 0
      ? Math.min(landAreaSqm, buildingAreaSqm * 2, LAND_B_MAX_SQM)
      : 0;
  const reliefRatio =
    landAreaSqm > 0 ? Math.min(1, qualifyingAreaSqm / landAreaSqm) : 0;
  const taxBeforeRelief = taxableAfterAMan * ACQUISITION_TAX_RATE;
  const taxMan = Math.ceil(taxBeforeRelief * (1 - reliefRatio));
  const nonQualifyingAreaSqm = Math.max(0, landAreaSqm - qualifyingAreaSqm);

  let formula: string;
  if (reliefRatio >= 1) {
    formula = `${landMan.toLocaleString()}万円 × ${landRateLabel} × 1/2 × 3% → マイホーム特例（床面積連動減額）の適用により0万円`;
  } else if (reliefRatio <= 0) {
    formula = `${landMan.toLocaleString()}万円 × ${landRateLabel} × 1/2 × 3% ≒ ${taxMan}万円（床面積連動減額の対象面積なし）`;
  } else {
    const taxedSharePct = Math.round((1 - reliefRatio) * 100);
    formula = `${landMan.toLocaleString()}万円 × ${landRateLabel} × 1/2 × 3% × ${taxedSharePct}%（特例の対象外${(landAreaSqm - qualifyingAreaSqm).toFixed(1)}㎡分）≒ ${taxMan}万円`;
  }

  return {
    assessedMan,
    taxableAfterAMan,
    qualifyingAreaSqm,
    landAreaSqm,
    reliefRatio,
    taxBeforeReliefMan: taxBeforeRelief,
    nonQualifyingAreaSqm,
    taxMan,
    formula,
  };
}

/** 不動産取得税の概算（建物税＋土地税の合算。連動ゼロ化なし） */
export function calcAcquisitionTaxMan(
  buildingMan: number,
  landMan: number,
  propertyType: OwnedPropertyType,
  target: AcquisitionTargetContext,
  areas: ResolvedAcquisitionAreas,
  usedBuildingConstructionEra: UsedBuildingConstructionEra = DEFAULT_USED_BUILDING_CONSTRUCTION_ERA,
): number {
  const building = calcBuildingAcquisitionTaxMan(
    buildingMan,
    propertyType,
    target,
    usedBuildingConstructionEra,
  );
  const hasResidentialBuilding =
    propertyType !== 'land' && buildingMan > 0;
  const land = calcLandAcquisitionTaxMan(
    landMan,
    areas.landAreaSqm,
    areas.buildingAreaSqm,
    propertyType,
    hasResidentialBuilding,
  );
  return building.taxMan + land.taxMan;
}

export function buildAcquisitionFeeBreakdown(params: {
  entity: PropertyAcquisitionEntity;
  acquisitionTaxYear: number;
  acquisitionTaxMonth: number;
  hasPairLoan?: boolean;
}): AcquisitionFeeBreakdown {
  const { entity, acquisitionTaxYear, acquisitionTaxMonth, hasPairLoan = false } =
    params;
  const target: AcquisitionTargetContext = {
    isNewConstruction: entity.isNewConstruction,
    deductionCategory: entity.deductionCategory,
  };
  const { buildingMan, landMan, propertyType } = entity;
  const areas = resolveAcquisitionAreas(entity);
  const basePriceMan = buildingMan + landMan;

  const brokerage = calcBrokerageFeeForEntity(entity);
  const landRegistrationTaxMan = calcLandRegistrationTaxMan(landMan);
  const buildingRegistrationTaxMan = calcBuildingRegistrationTaxMan(
    buildingMan,
    propertyType,
    target,
  );
  const scrivenerFeeMan = calcScrivenerFeeMan(hasPairLoan);
  const pairLoanScrivenerSurchargeMan = hasPairLoan
    ? PAIR_LOAN_SCRIVENER_SURCHARGE_MAN
    : 0;
  const registrationFeeMan =
    landRegistrationTaxMan + buildingRegistrationTaxMan > 0
      ? landRegistrationTaxMan +
        buildingRegistrationTaxMan +
        scrivenerFeeMan
      : 0;

  const landAssessedMan = estimateLandAssessedMan(landMan);
  const buildingAssessedMan =
    buildingMan > 0 && propertyType !== 'land'
      ? estimateBuildingAssessedMan(buildingMan, target.isNewConstruction)
      : 0;
  const buildingRegistrationRate = resolveBuildingRegistrationRate(target);
  const landAssessedRateLabel = `市場価格 × ${formatAssessedRatePct(LAND_ASSESSED_RATE)}`;
  const buildingAssessedRateLabel = `市場価格 × ${formatAssessedRatePct(resolveBuildingAssessedRate(target.isNewConstruction))}`;

  const buildingTax = calcBuildingAcquisitionTaxMan(
    buildingMan,
    propertyType,
    target,
    entity.usedBuildingConstructionEra,
  );
  const hasResidentialBuilding =
    propertyType !== 'land' && buildingMan > 0;
  const landTax = calcLandAcquisitionTaxMan(
    landMan,
    areas.landAreaSqm,
    areas.buildingAreaSqm,
    propertyType,
    hasResidentialBuilding,
  );
  const acquisitionTaxMan = buildingTax.taxMan + landTax.taxMan;

  const registrationParts: string[] = [];
  if (landRegistrationTaxMan > 0) {
    registrationParts.push(
      `土地${landAssessedMan.toLocaleString()}万円 × 1.5% = ${landRegistrationTaxMan}万円`,
    );
  }
  if (buildingRegistrationTaxMan > 0) {
    registrationParts.push(
      `建物${buildingAssessedMan.toLocaleString()}万円 × ${buildingRegistrationRate.label.split('（')[0]} = ${buildingRegistrationTaxMan}万円`,
    );
  }

  return {
    buildingMan,
    landMan,
    basePriceMan,
    brokerageFeeMan: brokerage.feeMan,
    registrationFeeMan,
    acquisitionTaxMan,
    acquisitionTaxYear,
    acquisitionTaxMonth,
    propertyType,
    target,
    areas,
    brokerageDetail: {
      formula: brokerage.formula,
      note: brokerage.note,
    },
    registrationDetail: {
      landAssessedMan,
      landAssessedRateLabel,
      landRateLabel: '1.5%（土地の所有権移転登記）',
      landRegistrationTaxMan,
      buildingAssessedMan,
      buildingAssessedRateLabel,
      buildingRateLabel: buildingRegistrationRate.label,
      buildingRegistrationTaxMan,
      scrivenerFeeMan,
      pairLoanScrivenerSurchargeMan,
      formula:
        registrationParts.length > 0
          ? hasPairLoan
            ? `${registrationParts.join(' ＋ ')} ＋ 司法書士報酬${SCRIVENER_FEE_MAN}万円 ＋ ペアローン上乗せ${PAIR_LOAN_SCRIVENER_SURCHARGE_MAN}万円`
            : `${registrationParts.join(' ＋ ')} ＋ 司法書士報酬${SCRIVENER_FEE_MAN}万円`
          : '—',
      note: hasPairLoan
        ? 'ペアローン（抵当権2本）のため、司法書士報酬に上乗せを見込んでいます。登録免許税は持分按分のため大きくは変わりません。'
        : '',
    },
    acquisitionTaxDetail: {
      landTaxMan: landTax.taxMan,
      landFormula: landTax.formula,
      buildingTaxMan: buildingTax.taxMan,
      buildingFormula: buildingTax.formula,
      buildingDeductionMan: buildingTax.deductionMan,
      buildingConstructionEraLabel: target.isNewConstruction
        ? undefined
        : getUsedBuildingConstructionEraLabel(entity.usedBuildingConstructionEra),
      landQualifyingAreaSqm: landTax.qualifyingAreaSqm,
      note: areas.isDefault
        ? target.isNewConstruction
          ? '面積未入力のため標準面積で試算しています。「詳細計算」で実数値を確定できます。'
          : `面積未入力のため標準面積で試算しています。中古建物の控除は${getUsedBuildingConstructionEraLabel(entity.usedBuildingConstructionEra)}（${buildingTax.deductionMan.toLocaleString()}万円）を前提としています。「詳細計算」で面積・築年数を確定できます。`
        : target.isNewConstruction
          ? '入力された実面積で、土地のマイホーム特例（床面積連動減額・最大200㎡）を判定しています。'
          : `入力された実面積と築年数（${getUsedBuildingConstructionEraLabel(entity.usedBuildingConstructionEra)}・${buildingTax.deductionMan.toLocaleString()}万円控除）で試算しています。`,
    },
  };
}

export function buildAcquisitionFeeBreakdownFromProperty(
  property: OwnedProperty,
  acquisitionTaxYear: number,
  acquisitionTaxMonth: number,
  options?: { hasPairLoan?: boolean },
): AcquisitionFeeBreakdown {
  return buildAcquisitionFeeBreakdown({
    entity: buildPropertyAcquisitionEntity(property),
    acquisitionTaxYear,
    acquisitionTaxMonth,
    hasPairLoan: options?.hasPairLoan,
  });
}

/** 所有開始から約6ヶ月後の不動産取得税納付時期（Q5・Q9の費用試算で共通） */
export function resolveAcquisitionTaxPaymentCalendar(
  property: OwnedProperty,
  memberAge: number,
  referenceYear: number,
): { year: number; month: number } {
  const startYear = referenceYear + (property.startAge - memberAge);
  const rawMonth = property.startMonth + 6;
  if (rawMonth > 12) {
    return { year: startYear + 1, month: rawMonth - 12 };
  }
  return { year: startYear, month: rawMonth };
}

/** 仲介・登記手数料を物件情報から再試算（ペアローン時は登記の上乗せを反映） */
export function refetchPropertyTransactionFeesFromProperty(
  property: OwnedProperty,
  memberAge: number,
  referenceDate: Date,
  options?: { hasPairLoan?: boolean },
): Pick<AcquisitionFeeBreakdown, 'brokerageFeeMan' | 'registrationFeeMan'> {
  const { year, month } = resolveAcquisitionTaxPaymentCalendar(
    property,
    memberAge,
    referenceDate.getFullYear(),
  );
  const breakdown = buildAcquisitionFeeBreakdownFromProperty(
    property,
    year,
    month,
    options,
  );
  return {
    brokerageFeeMan: breakdown.brokerageFeeMan,
    registrationFeeMan: breakdown.registrationFeeMan,
  };
}
