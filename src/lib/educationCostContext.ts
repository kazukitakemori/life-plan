import { calcBirthYear, calcMonthsFromBirth, calcYearAtAge } from './birthDate';
import type { FamilyMember } from '../types/family';
import type { EducationExpenseEntry } from '../types/education';

export interface HeadAgeAtEducationStart {
  age: number;
  month: number;
}

/** 在籍開始時点の世帯主年齢（居住地判定に使用） */
export function getHeadAgeAtEducationStart(
  headMember: FamilyMember,
  member: FamilyMember,
  entry: Pick<EducationExpenseEntry, 'startAge' | 'startMonth'>,
  referenceDate: Date,
): HeadAgeAtEducationStart {
  if (member.id === headMember.id) {
    return { age: entry.startAge, month: entry.startMonth };
  }

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1;
  const headBirthYear = calcBirthYear(
    headMember.age,
    headMember.birthMonth,
    referenceDate,
  );
  const memberBirthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const targetYear = calcYearAtAge(
    memberBirthYear,
    member.birthMonth,
    entry.startAge,
    entry.startMonth,
  );

  const memberMonthsAtRef = calcMonthsFromBirth(
    memberBirthYear,
    member.birthMonth,
    refYear,
    refMonth,
  );
  const memberMonthsAtStart = calcMonthsFromBirth(
    memberBirthYear,
    member.birthMonth,
    targetYear,
    entry.startMonth,
  );
  const headMonthsAtTarget =
    calcMonthsFromBirth(headBirthYear, headMember.birthMonth, refYear, refMonth) +
    (memberMonthsAtStart - memberMonthsAtRef);

  return {
    age: Math.floor(headMonthsAtTarget / 12),
    month: (headMonthsAtTarget % 12) + 1,
  };
}

/** 幼稚園入学前（3歳未満）の子どもがいるか。保育料参考値UIの表示条件に使用 */
export function hasPreKindergartenChild(members: FamilyMember[]): boolean {
  return members.some((member) => member.role === 'child' && member.age < 3);
}

/** 保育園の料金区分（3歳未満は乳幼児、3歳以上は就学前） */
export function isNurseryInfantAge(age: number): boolean {
  return age < 3;
}

/**
 * 認可保育園の多子軽減に使う子どもの生まれ順（1始まり）。
 *
 * 令和7年（2025年）4月から、3号認定（0〜2歳）保育料について
 * 所得制限なしで適用される多子軽減の対象人数の算定に使用する。
 *
 * 年齢の高い子ども = 1番目（第1子）として降順に並べ、
 * 同年齢の場合は誕生月の早い方（小さい値）を先に並べる。
 */
export function getChildBirthOrder(
  member: FamilyMember,
  familyMembers: FamilyMember[],
): number {
  const children = familyMembers
    .filter((m) => m.role === 'child')
    .sort((a, b) => {
      if (b.age !== a.age) return b.age - a.age;
      return a.birthMonth - b.birthMonth;
    });

  const index = children.findIndex((c) => c.id === member.id);
  return index === -1 ? 1 : index + 1;
}

/**
 * 多子軽減後の保育料係数を返す（令和7年4月〜・所得制限なし）。
 * - 第1子：1.0（変更なし）
 * - 第2子：0.5（半額）
 * - 第3子以降：0（無償）
 */
export function getMultiChildDiscount(birthOrder: number): number {
  if (birthOrder >= 3) return 0;
  if (birthOrder === 2) return 0.5;
  return 1.0;
}
