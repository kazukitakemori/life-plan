import { calcBirthYear } from './birthDate';
import type { FamilyMember } from '../types/family';
import { ROLE_LABELS } from '../types/family';

export function formatBirthShort(
  member: FamilyMember,
  referenceDate: Date,
): string {
  if (
    member.age == null ||
    member.birthMonth == null ||
    member.birthDay == null
  ) {
    return '';
  }
  const year = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return `${year}年${member.birthMonth}月${member.birthDay}日`;
}

export function getMemberTabLabel(member: FamilyMember): string {
  if (member.nickname.trim()) {
    return `${member.nickname}さん`;
  }

  switch (member.role) {
    case 'head':
      return '世帯主さん';
    case 'spouse':
      return '配偶者さん';
    case 'child':
      return '子供さん';
    default:
      return `${ROLE_LABELS[member.role]}さん`;
  }
}

export function getIncomeEligibleMembers(members: FamilyMember[]): FamilyMember[] {
  return members.filter((m) => m.role !== 'pet');
}

/** 住宅ローンの契約者として選択できるメンバー */
export function getLoanContractorMembers(members: FamilyMember[]): FamilyMember[] {
  return members.filter((m) => m.role === 'head' || m.role === 'spouse');
}

/** Q2 教育費タブの初期表示メンバー（子どもがいれば最初の子どもを優先） */
export function getEducationDefaultActiveMemberId(
  members: FamilyMember[],
): string {
  const eligible = getIncomeEligibleMembers(members);
  const firstChild = eligible.find((m) => m.role === 'child');
  if (firstChild) return firstChild.id;

  const head = members.find((m) => m.role === 'head');
  return head?.id ?? eligible[0]?.id ?? '';
}
