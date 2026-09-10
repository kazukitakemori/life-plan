/** 個人タブの出し分け対象ドメイン */
export type MemberTabDomain =
  | 'living'
  | 'housing'
  | 'income'
  | 'pension'
  | 'vehicle'
  | 'loan'
  | 'insurance'
  | 'savings'
  | 'education'
  | 'lifeEvent'
  | 'taxSocialBreakdown';

/** 基本ルール外で個人タブを出すメンバーID（ドメイン別） */
export type MemberTabExtras = Partial<Record<MemberTabDomain, string[]>>;
