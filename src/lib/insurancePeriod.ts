import { resolveMemberBirthMonth } from './familyDefaults';
import {
  calcBirthYear,
  calcYearAtAge,
  getMemberAgeMonth,
} from './birthDate';
import type { FamilyMember } from '../types/family';
import type {
  HousingState,
  OwnedProperty,
  RentalProperty,
} from '../types/housing';
import type {
  InsuranceEndMode,
  InsuranceEntry,
  InsurancePeriodSource,
} from '../types/insurance';
import type { VehicleEntry, VehicleState } from '../types/vehicle';

/** 学資・個人年金・返戻金の受取計上月＝対象者の誕生日月 */
export function resolveInsuranceBenefitPaymentMonth(
  member: Pick<FamilyMember, 'birthMonth'>,
): number {
  return resolveMemberBirthMonth(member);
}

/**
 * 学資・個人年金の既定払込終了：受取開始（誕生日月）の前月まで（契約者の年齢・月）。
 * 受取基準者が子どもでも、払込期間は契約者年齢で表す。
 */
export function calcPremiumEndJustBeforeBenefit(input: {
  contractor: FamilyMember;
  receiveMember: FamilyMember;
  benefitReceiveAge: number;
  startAge: number;
  /** 未指定時は 1 月 */
  startMonth?: number;
  referenceDate: Date;
}): Pick<InsuranceEntry, 'endMode' | 'endAge' | 'endMonth'> {
  const startMonth = input.startMonth ?? 1;
  const receiveBirthMonth = resolveMemberBirthMonth(input.receiveMember);
  const receiveBirthYear = calcBirthYear(
    input.receiveMember.age,
    receiveBirthMonth,
    input.referenceDate,
  );
  const benefitYear = calcYearAtAge(
    receiveBirthYear,
    receiveBirthMonth,
    input.benefitReceiveAge,
    receiveBirthMonth,
  );

  let endCalendarMonth = receiveBirthMonth - 1;
  let endCalendarYear = benefitYear;
  if (endCalendarMonth < 1) {
    endCalendarMonth = 12;
    endCalendarYear -= 1;
  }

  const endAgeMonth = getMemberAgeMonth(
    input.contractor,
    input.referenceDate,
    endCalendarYear,
    endCalendarMonth,
  );

  const startIndex = input.startAge * 12 + startMonth;
  if (!endAgeMonth) {
    return {
      endMode: 'until',
      endAge: input.startAge,
      endMonth: startMonth,
    };
  }

  const endIndex = endAgeMonth.age * 12 + endAgeMonth.month;
  // 受取直前が払込開始より前になる場合は、開始月だけでも含められるよう揃える
  if (endIndex < startIndex) {
    return {
      endMode: 'until',
      endAge: input.startAge,
      endMonth: startMonth,
    };
  }

  return {
    endMode: 'until',
    endAge: endAgeMonth.age,
    endMonth: endAgeMonth.month,
  };
}

/** 保険料払込期間（年齢・月） */
export interface InsurancePremiumPeriod {
  startAge: number;
  startMonth: number;
  endMode: InsuranceEndMode;
  endAge: number;
  endMonth: number;
}

export type LinkedInsuranceAsset =
  | { kind: 'owned'; property: OwnedProperty }
  | { kind: 'rental'; property: RentalProperty }
  | { kind: 'vehicle'; vehicle: VehicleEntry };

function periodFromAsset(asset: LinkedInsuranceAsset): InsurancePremiumPeriod {
  if (asset.kind === 'vehicle') {
    const { vehicle } = asset;
    return {
      startAge: vehicle.startAge,
      startMonth: vehicle.startMonth,
      endMode: vehicle.endMode,
      endAge: vehicle.endAge,
      endMonth: vehicle.endMonth,
    };
  }
  const { property } = asset;
  return {
    startAge: property.startAge,
    startMonth: property.startMonth,
    endMode: property.endMode,
    endAge: property.endAge,
    endMonth: property.endMonth,
  };
}

export function getLinkedHousingAsset(
  housingState: HousingState,
  entry: InsuranceEntry,
): LinkedInsuranceAsset | undefined {
  if (!entry.housingLink) return undefined;
  const data = housingState.byTarget[entry.housingLink.targetId];
  if (!data) return undefined;
  if (entry.housingLink.propertyKind === 'rental') {
    const property = data.rentals.find(
      (item) => item.id === entry.housingLink?.propertyId,
    );
    return property ? { kind: 'rental', property } : undefined;
  }
  const property = data.owned.find(
    (item) => item.id === entry.housingLink?.propertyId,
  );
  return property ? { kind: 'owned', property } : undefined;
}

export function getLinkedVehicleAsset(
  vehicleState: VehicleState,
  entry: InsuranceEntry,
): LinkedInsuranceAsset | undefined {
  if (!entry.vehicleLink) return undefined;
  const vehicle = vehicleState.byMember[entry.vehicleLink.memberId]?.find(
    (item) => item.id === entry.vehicleLink?.vehicleId,
  );
  return vehicle ? { kind: 'vehicle', vehicle } : undefined;
}

export function getLinkedInsuranceAsset(
  entry: InsuranceEntry,
  housingState: HousingState,
  vehicleState: VehicleState,
): LinkedInsuranceAsset | undefined {
  if (entry.category === 'fire') {
    return getLinkedHousingAsset(housingState, entry);
  }
  if (entry.category === 'auto') {
    return getLinkedVehicleAsset(vehicleState, entry);
  }
  return undefined;
}

export function canLinkInsurancePeriod(entry: InsuranceEntry): boolean {
  return entry.category === 'fire' || entry.category === 'auto';
}

export function resolveInsurancePeriodSource(
  entry: InsuranceEntry,
  linkedAsset: LinkedInsuranceAsset | undefined,
): InsurancePeriodSource {
  if (!linkedAsset) return 'manual';
  return entry.periodSource === 'manual' ? 'manual' : 'linked';
}

export function resolveInsurancePremiumPeriod(
  entry: InsuranceEntry,
  member: FamilyMember,
  housingState: HousingState,
  vehicleState: VehicleState,
): InsurancePremiumPeriod {
  const linkedAsset = getLinkedInsuranceAsset(
    entry,
    housingState,
    vehicleState,
  );
  const source = resolveInsurancePeriodSource(entry, linkedAsset);
  if (source === 'linked' && linkedAsset) {
    const period = periodFromAsset(linkedAsset);
    if (period.endMode === 'lifetime') {
      return {
        ...period,
        endAge: member.expectedLifespan,
        endMonth: 12,
      };
    }
    return period;
  }

  if (entry.endMode === 'lifetime') {
    return {
      startAge: entry.startAge,
      startMonth: entry.startMonth,
      endMode: 'lifetime',
      endAge: member.expectedLifespan,
      endMonth: 12,
    };
  }

  return {
    startAge: entry.startAge,
    startMonth: entry.startMonth,
    endMode: entry.endMode,
    endAge: entry.endAge,
    endMonth: entry.endMonth,
  };
}

export function getInsurancePeriodLinkLabel(
  linkedAsset: LinkedInsuranceAsset,
): string {
  switch (linkedAsset.kind) {
    case 'owned':
      return '所有期間に合わせる';
    case 'rental':
      return '契約期間に合わせる';
    case 'vehicle':
      return '利用期間に合わせる';
  }
}

export function formatInsurancePeriodRangeLabel(
  period: InsurancePremiumPeriod,
  birthYear: number,
  birthMonth: number,
  formatStart: (
    age: number,
    month: number,
    birthYear: number,
    birthMonth: number,
  ) => string,
  formatEnd: (
    age: number,
    month: number,
    birthYear: number,
    birthMonth: number,
  ) => string,
): string {
  const startLabel = formatStart(
    period.startAge,
    period.startMonth,
    birthYear,
    birthMonth,
  );
  if (period.endMode === 'lifetime') {
    return `${startLabel}〜一生涯`;
  }
  const endLabel = formatEnd(
    period.endAge,
    period.endMonth,
    birthYear,
    birthMonth,
  );
  return `${startLabel}〜${endLabel}`;
}

/** リンク先の期間をエントリへコピー（manual 切替時・リンク作成時） */
export function applyPeriodToInsuranceEntry(
  entry: InsuranceEntry,
  period: InsurancePremiumPeriod,
  periodSource: InsurancePeriodSource,
): InsuranceEntry {
  return {
    ...entry,
    periodSource,
    startAge: period.startAge,
    startMonth: period.startMonth,
    endMode: period.endMode,
    endAge: period.endAge,
    endMonth: period.endMonth,
  };
}

export function periodPatchFromAsset(
  asset: LinkedInsuranceAsset,
): Pick<
  InsuranceEntry,
  'startAge' | 'startMonth' | 'endMode' | 'endAge' | 'endMonth' | 'periodSource'
> {
  const period = periodFromAsset(asset);
  return {
    ...period,
    periodSource: 'linked',
  };
}
