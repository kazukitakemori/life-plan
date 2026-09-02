import { calcBirthYear } from './birthDate';
import { resolveMemberBirthMonth } from './familyDefaults';
import {
  getDefaultNextInspection,
  vehicleRequiresInspection,
  withAutoNextInspection,
} from './vehicleInspection';
import {
  resolveVehicleCondition,
  vehicleTypeHasKind,
} from './vehicleLabels';
import type { FamilyMember } from '../types/family';
import type { VehicleEntry, VehicleReplacementCondition } from '../types/vehicle';

function createId(): string {
  return crypto.randomUUID();
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function addYearsToAgeMonth(
  age: number,
  month: number,
  years: number,
): { age: number; month: number } {
  return { age: age + years, month };
}

function subtractOneMonth(
  age: number,
  month: number,
): { age: number; month: number } {
  if (month > 1) {
    return { age, month: month - 1 };
  }
  return { age: age - 1, month: 12 };
}

function getEntryEnd(
  entry: VehicleEntry,
  member: FamilyMember,
): { endAge: number; endMonth: number } {
  if (entry.endMode === 'lifetime') {
    return { endAge: member.expectedLifespan, endMonth: 12 };
  }
  return { endAge: entry.endAge, endMonth: entry.endMonth };
}

function readLegacyReplacementCycle(entry: VehicleEntry): number {
  return (
    (entry as VehicleEntry & { replacementCycleYears?: number })
      .replacementCycleYears ?? 0
  );
}

function readLegacyReplacementCondition(
  entry: VehicleEntry,
): VehicleReplacementCondition | undefined {
  return (
    entry as VehicleEntry & {
      replacementCondition?: VehicleReplacementCondition;
    }
  ).replacementCondition;
}

export interface DuplicateVehicleOptions {
  /**
   * 複製先の新車/中古（自動車・バイクのみ）。
   * 自転車・その他は指定不要。
   */
  condition?: VehicleReplacementCondition;
}

function resolveDuplicateCondition(
  source: VehicleEntry,
  override?: VehicleReplacementCondition,
): VehicleReplacementCondition {
  if (override === 'used') return 'used';
  if (override === 'new') return 'new';
  return resolveVehicleCondition(source) === 'new' ? 'new' : 'used';
}

function applyDuplicateCondition(
  entry: VehicleEntry,
  condition: VehicleReplacementCondition | undefined,
): VehicleEntry {
  if (!condition || !vehicleTypeHasKind(entry.type)) return entry;
  if (entry.type === 'car') {
    const kind =
      condition === 'new' ? ('new' as const) : ('used' as const);
    return { ...entry, kind, condition: kind };
  }
  return { ...entry, condition };
}

function stripReplacementFields(entry: VehicleEntry): VehicleEntry {
  const next = { ...entry } as VehicleEntry & {
    replacementCycleYears?: number;
    replacementCondition?: VehicleReplacementCondition;
  };
  delete next.replacementCycleYears;
  delete next.replacementCondition;
  return next;
}

function prepareDuplicateBase(source: VehicleEntry): VehicleEntry {
  return stripReplacementFields({
    ...source,
    id: createId(),
    insurances: [],
    repaymentEndYear: 0,
    repaymentEndMonth: 0,
    paymentMode:
      source.paymentMode === 'alreadyOwned'
        ? 'purchaseAmount'
        : source.paymentMode,
  });
}

/**
 * 1 台を複製し、利用期間の終わりの翌月に次の台を追加する。
 * - 元の台の利用期間はそのまま
 * - 複製先は「(endAge,endMonth) の翌月」から開始し、元の台と同じ長さの利用期間を持つ
 */
export function duplicateVehicleEntry(
  source: VehicleEntry,
  member: FamilyMember,
  referenceDate: Date,
  options: DuplicateVehicleOptions,
): { source: VehicleEntry; duplicate: VehicleEntry } {
  if (source.endMode === 'lifetime') {
    throw new Error('lifetime period cannot be duplicated');
  }

  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const birthMonth = resolveMemberBirthMonth(member);

  const sourceStartIdx = ageMonthIndex(source.startAge, source.startMonth);
  const sourceEndIdx = ageMonthIndex(source.endAge, source.endMonth);
  const durationInclusive = sourceEndIdx - sourceStartIdx + 1;
  if (durationInclusive <= 0) {
    throw new Error('invalid source duration');
  }

  const duplicateStart =
    source.endMonth === 12
      ? { age: source.endAge + 1, month: 1 }
      : { age: source.endAge, month: source.endMonth + 1 };
  const duplicateStartIdx = ageMonthIndex(
    duplicateStart.age,
    duplicateStart.month,
  );

  const expectedEndIdx = ageMonthIndex(member.expectedLifespan, 12);
  if (duplicateStartIdx > expectedEndIdx) {
    throw new Error('duplicate start beyond expected lifespan');
  }

  let duplicateEndIdx =
    duplicateStartIdx + durationInclusive - 1;
  if (duplicateEndIdx > expectedEndIdx) duplicateEndIdx = expectedEndIdx;

  const idxToAgeMonth = (idx: number): { age: number; month: number } => {
    // ageMonthIndex は「age*12 + month(1-12)」なので、逆変換は idx-1 を使う
    const base = idx - 1;
    return { age: Math.floor(base / 12), month: (base % 12) + 1 };
  };

  const duplicateEnd = idxToAgeMonth(duplicateEndIdx);

  const updatedSource = stripReplacementFields({ ...source });

  let duplicate = prepareDuplicateBase(source);
  duplicate = {
    ...duplicate,
    startAge: duplicateStart.age,
    startMonth: duplicateStart.month,
    endMode: 'until',
    endAge: duplicateEnd.age,
    endMonth: duplicateEnd.month,
  };

  duplicate = applyDuplicateCondition(duplicate, options.condition);

  duplicate = withAutoNextInspection(duplicate, birthYear, birthMonth);
  if (
    vehicleRequiresInspection(duplicate) &&
    duplicate.nextInspectionYear == null
  ) {
    const defaults = getDefaultNextInspection(
      duplicate.startAge,
      duplicate.startMonth,
      birthYear,
      birthMonth,
      duplicate,
    );
    if (defaults) {
      duplicate = { ...duplicate, ...defaults };
    }
  }

  return {
    source: updatedSource,
    duplicate: stripReplacementFields(duplicate),
  };
}

/**
 * 旧データの買い替え周期を、期間分割された複数エントリへ展開する。
 * 先頭世代は元 id を維持（ローン・保険リンク用）。
 */
export function expandReplacementCycleEntry(
  entry: VehicleEntry,
  member: FamilyMember,
  referenceDate: Date,
): VehicleEntry[] {
  const cycleYears = readLegacyReplacementCycle(entry);
  if (cycleYears <= 0) {
    return [stripReplacementFields(entry)];
  }

  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const birthMonth = resolveMemberBirthMonth(member);
  const replacementCondition =
    readLegacyReplacementCondition(entry) ??
    resolveDuplicateCondition(entry);
  const end = getEntryEnd(entry, member);
  const endIdx = ageMonthIndex(end.endAge, end.endMonth);

  const segments: VehicleEntry[] = [];
  let generationStartAge = entry.startAge;
  let generationStartMonth = entry.startMonth;
  let isFirst = true;

  while (true) {
    const nextStart = addYearsToAgeMonth(
      generationStartAge,
      generationStartMonth,
      cycleYears,
    );
    const nextStartIdx = ageMonthIndex(nextStart.age, nextStart.month);

    let segment: VehicleEntry = stripReplacementFields({
      ...entry,
      startAge: generationStartAge,
      startMonth: generationStartMonth,
      insurances: isFirst ? (entry.insurances ?? []) : [],
      paymentMode:
        isFirst || entry.paymentMode !== 'alreadyOwned'
          ? entry.paymentMode
          : 'purchaseAmount',
    });

    if (!isFirst) {
      segment = {
        ...prepareDuplicateBase(entry),
        ...segment,
        id: createId(),
      };
      if (vehicleTypeHasKind(segment.type)) {
        segment = applyDuplicateCondition(segment, replacementCondition);
      }
      segment = withAutoNextInspection(segment, birthYear, birthMonth);
    }

    if (nextStartIdx > endIdx) {
      segment = {
        ...segment,
        endMode: entry.endMode,
        endAge: entry.endMode === 'lifetime' ? member.expectedLifespan : entry.endAge,
        endMonth: entry.endMode === 'lifetime' ? 12 : entry.endMonth,
      };
      segments.push(segment);
      break;
    }

    const segmentEnd = subtractOneMonth(nextStart.age, nextStart.month);
    segments.push({
      ...segment,
      endMode: 'until',
      endAge: segmentEnd.age,
      endMonth: segmentEnd.month,
    });

    generationStartAge = nextStart.age;
    generationStartMonth = nextStart.month;
    isFirst = false;
  }

  return segments;
}
