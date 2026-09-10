import type { FamilyMemberRole, Gender } from '../types/family';

/** ファイル名に対応する年齢帯（上限は inclusive。70 は 70 以上） */
const AGE_BANDS = [
  { min: 0, max: 2, key: '0_2' },
  { min: 3, max: 5, key: '3_5' },
  { min: 6, max: 12, key: '6_12' },
  { min: 13, max: 18, key: '13_18' },
  { min: 19, max: 29, key: '19_29' },
  { min: 30, max: 39, key: '30_39' },
  { min: 40, max: 49, key: '40_49' },
  { min: 50, max: 59, key: '50_59' },
  { min: 60, max: 69, key: '60_69' },
  { min: 70, max: Infinity, key: '70' },
] as const;

const ROLE_FALLBACK_AGE: Record<Exclude<FamilyMemberRole, 'pet'>, number> = {
  head: 40,
  spouse: 40,
  child: 5,
  other: 40,
};

const ROLE_EMOJI: Record<FamilyMemberRole, string> = {
  head: '👨',
  spouse: '👩',
  child: '👶',
  other: '👤',
  pet: '🐾',
};

function ageBandKey(age: number): string {
  const band = AGE_BANDS.find((b) => age >= b.min && age <= b.max);
  return band?.key ?? '40_49';
}

export function resolveMemberAvatarSrc(
  role: FamilyMemberRole,
  gender: Gender,
  age: number | null,
): string | null {
  if (role === 'pet') return null;
  const resolvedAge = age ?? ROLE_FALLBACK_AGE[role];
  const band = ageBandKey(resolvedAge);
  return `/icons/people/${gender}_${band}.png`;
}

export function memberAvatarEmoji(role: FamilyMemberRole): string {
  return ROLE_EMOJI[role];
}
