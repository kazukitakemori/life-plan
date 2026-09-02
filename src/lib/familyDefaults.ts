import type { FamilyMember, FamilyMemberRole } from '../types/family';

function createId(): string {
  return crypto.randomUUID();
}

function defaultHouseholdPeriod(role: FamilyMemberRole) {
  if (role === 'child') {
    return { mode: 'custom' as const, endAge: 22, endMonth: 3 };
  }
  return { mode: 'lifetime' as const, endAge: 90, endMonth: 12 };
}

function defaultGender(role: FamilyMemberRole) {
  if (role === 'spouse') return 'female' as const;
  if (role === 'pet') return 'male' as const;
  return 'male' as const;
}

/** 生年月日（年齢・月・日）がすべて入力済みか */
export function isMemberBirthComplete(
  member: Pick<FamilyMember, 'age' | 'birthMonth' | 'birthDay'>,
): member is Pick<FamilyMember, 'age' | 'birthMonth' | 'birthDay'> & {
  age: number;
  birthMonth: number;
  birthDay: number;
} {
  return (
    member.age != null && member.birthMonth != null && member.birthDay != null
  );
}

/** 計算用。未選択時は fallback（試算前のプレースホルダ） */
export function resolveMemberAge(
  member: Pick<FamilyMember, 'age'> | number | null | undefined,
  fallback = 0,
): number {
  if (typeof member === 'number') return member;
  return member?.age ?? fallback;
}

/** 計算用。未選択時は fallback */
export function resolveMemberBirthMonth(
  member: Pick<FamilyMember, 'birthMonth'> | number | null | undefined,
  fallback = 1,
): number {
  if (typeof member === 'number') return member;
  return member?.birthMonth ?? fallback;
}

/** 計算用。未選択時は fallback */
export function resolveMemberBirthDay(
  member: Pick<FamilyMember, 'birthDay'> | number | null | undefined,
  fallback = 1,
): number {
  if (typeof member === 'number') return member;
  return member?.birthDay ?? fallback;
}

/** 旧データ互換: birthDay 欠落を null で補完 */
export function migrateFamilyMember(member: FamilyMember): FamilyMember {
  return {
    ...member,
    birthDay: member.birthDay ?? null,
  };
}

export function migrateFamilyMembers(members: FamilyMember[]): FamilyMember[] {
  return members.map(migrateFamilyMember);
}

export function createFamilyMember(role: FamilyMemberRole): FamilyMember {
  const base: FamilyMember = {
    id: createId(),
    role,
    nickname: '',
    age: null,
    birthMonth: null,
    birthDay: null,
    gender: defaultGender(role),
    expectedLifespan: 90,
    disability: 'none',
    hobbies: [],
    householdPeriod: defaultHouseholdPeriod(role),
  };

  if (role === 'child') {
    return {
      ...base,
      taxDependentDefault: true,
      socialInsuranceDependentDefault: true,
    };
  }

  if (role === 'other') {
    return {
      ...base,
      otherRelationship: 'parent',
      isCohabiting: false,
      taxDependentDefault: true,
      socialInsuranceDependentDefault: true,
    };
  }

  return base;
}

export function createDefaultFamily(): FamilyMember[] {
  return [createFamilyMember('head')];
}
