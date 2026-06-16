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

function defaultAge(role: FamilyMemberRole): number {
  switch (role) {
    case 'head':
      return 40;
    case 'spouse':
      return 38;
    case 'child':
      return 0;
    case 'pet':
      return 0;
    default:
      return 30;
  }
}

function defaultGender(role: FamilyMemberRole) {
  if (role === 'spouse') return 'female' as const;
  if (role === 'pet') return 'male' as const;
  return 'male' as const;
}

export function createFamilyMember(role: FamilyMemberRole): FamilyMember {
  const base: FamilyMember = {
    id: createId(),
    role,
    nickname: '',
    age: defaultAge(role),
    birthMonth: 1,
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
