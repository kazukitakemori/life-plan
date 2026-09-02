export type FamilyMemberRole = 'head' | 'spouse' | 'child' | 'other' | 'pet';

export type Gender = 'male' | 'female';

export type DisabilityStatus = 'none' | 'has';

export type HouseholdPeriodMode = 'lifetime' | 'by_education' | 'custom';

/**
 * roleが'other'のメンバーの続柄。
 * 続柄によって扶養控除の種類・金額が変わる。
 * - parent/grandparent: 70歳以上で老人扶養控除 or 同居老親等控除
 * - sibling: 19-22歳の場合は特定扶養控除
 * - common_law_partner: 税法上の扶養控除は原則対象外（親族でないため）。社保の被扶養者は可。
 * - other_relative: 一般扶養控除
 */
export type OtherRelationship =
  | 'parent'
  | 'grandparent'
  | 'grandchild'
  | 'sibling'
  | 'common_law_partner'
  | 'other_relative';

export interface HouseholdPeriod {
  mode: HouseholdPeriodMode;
  endAge: number;
  endMonth: number;
}

export interface FamilyMember {
  id: string;
  role: FamilyMemberRole;
  nickname: string;
  /** 未選択時は null（新規入力の初期状態）。基準日時点の満年齢 */
  age: number | null;
  /** 未選択時は null（新規入力の初期状態） */
  birthMonth: number | null;
  /** 未選択時は null（新規入力の初期状態） */
  birthDay: number | null;
  gender: Gender;
  expectedLifespan: number;
  disability: DisabilityStatus;
  hobbies: string[];
  householdPeriod: HouseholdPeriod;
  /** roleが'other'のときのみ使用。続柄による控除区分の判定に使用 */
  otherRelationship?: OtherRelationship;
  /**
   * 同居か否か（70歳以上の親・祖父母のみ税計算に影響）。
   * true: 同居老親等控除（58万/45万）、false: 老人扶養控除（48万/38万）
   */
  isCohabiting?: boolean;
  /** child/otherのデフォルト扶養区分（税法上）。trueなら合計所得が上限以下の年は扶養控除を適用（令和7年分以降は58万円） */
  taxDependentDefault?: boolean;
  /** child/otherのデフォルト扶養区分（社会保険）。trueなら収入130万円未満の年は被扶養者として扱う */
  socialInsuranceDependentDefault?: boolean;
}

export const ROLE_LABELS: Record<FamilyMemberRole, string> = {
  head: '世帯主',
  spouse: '配偶者',
  child: '子供',
  other: 'その他',
  pet: 'ペット',
};

export const OTHER_RELATIONSHIP_LABELS: Record<OtherRelationship, string> = {
  parent: '親・義親',
  grandparent: '祖父母・義祖父母',
  grandchild: '孫',
  sibling: '兄弟姉妹',
  common_law_partner: '内縁の配偶者',
  other_relative: 'その他（その他親族など）',
};
