import type { FamilyMember } from '../types/family';
import type { OwnedProperty, RentalProperty } from '../types/housing';

export interface HousingAgeMonth {
  age: number;
  month: number;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

export function getRentalPeriodEnd(
  rental: RentalProperty,
  member: FamilyMember,
): HousingAgeMonth {
  if (rental.endMode === 'lifetime') {
    return { age: member.expectedLifespan, month: 12 };
  }
  return { age: rental.endAge, month: rental.endMonth };
}

export function getOwnedPeriodEnd(
  property: OwnedProperty,
  member: FamilyMember,
): HousingAgeMonth {
  if (property.endMode === 'lifetime') {
    return { age: member.expectedLifespan, month: 12 };
  }
  return { age: property.endAge, month: property.endMonth };
}

export function addMonthsToAgeMonth(
  age: number,
  month: number,
  months: number,
): HousingAgeMonth {
  const total = age * 12 + (month - 1) + months;
  return { age: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** 登録済みの賃貸・所有のうち最も遅い終了の翌月。未登録なら null */
export function resolveNextHousingStartPeriod(
  member: FamilyMember,
  rentals: RentalProperty[],
  owned: OwnedProperty[],
): HousingAgeMonth | null {
  const ends = [
    ...rentals.map((rental) => getRentalPeriodEnd(rental, member)),
    ...owned.map((property) => getOwnedPeriodEnd(property, member)),
  ];
  if (ends.length === 0) {
    return null;
  }

  let latestEnd = ends[0];
  let latestIndex = ageMonthIndex(latestEnd.age, latestEnd.month);
  for (const end of ends.slice(1)) {
    const index = ageMonthIndex(end.age, end.month);
    if (index > latestIndex) {
      latestEnd = end;
      latestIndex = index;
    }
  }

  return addMonthsToAgeMonth(latestEnd.age, latestEnd.month, 1);
}
