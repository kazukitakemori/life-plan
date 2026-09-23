export type FamilyMemberRole = 'head' | 'spouse' | 'child' | 'other' | 'pet';

export type Gender = 'male' | 'female';

export type DisabilityStatus = 'none' | 'has';

export type PensionChildResidenceStatus =
  | 'unknown'
  | 'japan'
  | 'overseas_exception'
  | 'overseas';

export type DisabilityGrade =
  | 'none'
  | 'grade1'
  | 'grade2'
  | 'grade3'
  | 'other';

export type DisabilityPensionStatus =
  | 'none'
  | 'basic_grade1'
  | 'basic_grade2'
  | 'employees_grade1'
  | 'employees_grade2'
  | 'employees_grade3';

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
  /**
   * 2028年4月以降の年金「子の加算」の国内居住要件。
   * child と other/grandchild で使用する。旧データはunknown。
   */
  pensionChildResidence?: PensionChildResidenceStatus;
  /**
   * 現在の障害等級・状態。
   * 子の年金加算等では「1級・2級の障害状態」を判定するために使用する。
   * 未入力・旧データはnoneとして扱い、障害ありだけから等級を推測しない。
   */
  disabilityGrade?: DisabilityGrade;
  /**
   * 現在の障害年金受給状況。
   * 未入力・旧データはnoneとして扱い、障害があるだけで受給権を推測しない。
   */
  disabilityPension?: DisabilityPensionStatus;
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

export const DISABILITY_PENSION_LABELS: Record<DisabilityPensionStatus, string> = {
  none: '受給なし・不明',
  basic_grade1: '障害基礎年金 1級',
  basic_grade2: '障害基礎年金 2級',
  employees_grade1: '障害厚生年金 1級',
  employees_grade2: '障害厚生年金 2級',
  employees_grade3: '障害厚生年金 3級',
};

export const DISABILITY_GRADE_LABELS: Record<DisabilityGrade, string> = {
  none: '等級なし・不明',
  grade1: '1級',
  grade2: '2級',
  grade3: '3級',
  other: 'その他・等級外',
};

export const PENSION_CHILD_RESIDENCE_LABELS: Record<
  PensionChildResidenceStatus,
  string
> = {
  unknown: '未確認',
  japan: '日本国内',
  overseas_exception: '海外（留学等の例外）',
  overseas: '海外（その他）',
};
