/** 貯蓄 / 投資の大分類（追加カードのグループ分け用） */
export type SavingsSector = 'deposit' | 'invest';

/**
 * 貯蓄・運用カテゴリ。
 * - deposit / time_deposit / savings_other … 貯蓄
 * - nisa_tsumitate / nisa_growth / taxable / ideco / dc / db / invest_other … 運用
 */
export type SavingsCategory =
  | 'deposit'
  | 'time_deposit'
  | 'savings_other'
  | 'nisa_tsumitate'
  | 'nisa_growth'
  | 'taxable'
  | 'ideco'
  | 'dc'
  | 'db'
  | 'invest_other';

export type SavingsEndMode = 'lifetime' | 'until';

/** 積立の払込方法 */
export type SavingsContributionMode = 'monthly' | 'annual' | 'none';

/** NISA の活用状況 */
export type NisaUtilization = 'active' | 'new';

/** NISA の評価額の入力方法 */
export type NisaValuationMode = 'gains' | 'rate';

/**
 * NISA / 特定口座の取崩し（売却）方法。
 * - drawdown … 運用資産を年数で割って月額取崩し
 * - once … 指定年齢・月に一括売却
 * - none … 取崩しなし
 *
 * 旧値 monthly / annual は drawdown に正規化する。
 */
export type SavingsWithdrawalMode =
  | 'drawdown'
  | 'once'
  | 'none'
  | 'monthly' // legacy
  | 'annual'; // legacy

/** 特定口座の活用状況（NISA と同趣旨） */
export type TaxableUtilization = 'active' | 'new';

/** iDeCo 年金受取の期間指定方法 */
export type IdecoAnnuityPeriodMode = 'years' | 'until_age';

/** DB 加入期間の入力方法（会社退職金の勤続年数と同型） */
export type DbEnrollmentMode = 'years' | 'period';

/**
 * DB: 加入終了が原則60歳より前のときの扱い。
 * - defer … 据置（規程により支給開始まで繰延）
 * - lump_at_exit … 脱退一時金（加入終了時に現金受取・退職所得）
 * - transfer_ideco … iDeCo へ移換（ポータビリティ）
 */
export type DbEarlyExitMode = 'defer' | 'lump_at_exit' | 'transfer_ideco';

/** iDeCo 加入区分（国民年金の被保険者区分に対応） */
export type IdecoOccupancy =
  | 'self_employed'
  | 'employee'
  | 'civil_servant'
  | 'spouse_no_income';

/**
 * 企業型DCの過去積み立て1区間（職歴／掛金水準ごと）。
 * iDeCo は単一の past* スカラーを使う。
 */
export interface SavingsPastContributionSegment {
  id: string;
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
  expectedReturnRatePct: number;
  contributionMode: SavingsContributionMode;
  /** 積立額（万円）。DCは事業主＋加入者の合計月額想定 */
  contributionMan: number;
}

/**
 * 企業型DC・DBの加入区分（第2号被保険者＝厚生年金加入の職歴に対応）。
 * 自営業等の第1号は対象外。積立／加入期間は選んだ区分の収入期間に連動する。
 */
export type DcOccupancy = 'employee' | 'part_time';

/** 貯蓄・運用口座1件（所有者メンバー配下） */
export interface SavingsEntry {
  id: string;
  category: SavingsCategory;
  name: string;
  /**
   * 現在残高（万円）。貯蓄カテゴリ等で試算開始時点の残高として金融資産に反映する。
   * NISA・特定口座では principalMan / gainsMan 等から算出し、直接入力しない。
   * iDeCo / 企業型DCでは原則 0（過去分は past* または積立期間の遡及推計）。
   */
  balanceMan: number;
  /**
   * 積立額（万円）。
   * contributionMode に応じて月額 / 年額として解釈する。
   * contributionMode === 'none' のときは未使用。
   * 企業型DCでは事業主掛金の互換エイリアス（ensureDcContributionFields で同期）。
   */
  contributionMan: number;
  /** 積立方法（未設定時は積立なし） */
  contributionMode: SavingsContributionMode;
  /**
   * 企業型DCのみ: 事業主掛金の払込方法。
   * 未設定時は contributionMode から移行。
   */
  employerContributionMode?: SavingsContributionMode;
  /** 企業型DCのみ: 事業主掛金額（万円） */
  employerContributionMan?: number;
  /**
   * 企業型DCのみ: 加入者掛金（選択型）の払込方法。
   * 未設定時は none。
   */
  employeeContributionMode?: SavingsContributionMode;
  /** 企業型DCのみ: 加入者掛金（選択型・万円） */
  employeeContributionMan?: number;
  /**
   * 企業型DCのみ: 加入区分（手動選択）。第2号（会社員・パート等）のみ。
   * 未設定時は積立開始時点の Q7 職歴から自動判定。
   */
  dcOccupancy?: DcOccupancy;
  /**
   * 企業型DCのみ: 拠出終了月に残高を同一メンバーの iDeCo へ移管するか。
   * 拠出終了が受取開始可能年齢（原則60歳）より前のときだけ意味を持つ。
   * true のとき CF で DC 残高を iDeCo へ付け替え、DC 側の受取は行わない。
   */
  transferBalanceToIdecoOnEnd?: boolean;
  /**
   * DB のみ: 加入区分（手動選択）。第2号（会社員・パート等）のみ。
   * 期間モード時は Q7 職歴に連動。未設定時は積立開始／加入開始時点から自動判定。
   */
  dbOccupancy?: DcOccupancy;
  /**
   * DB のみ: 加入終了が原則60歳より前のときの扱い。
   * 期間モードかつ終了年齢が60歳未満のときだけ意味を持つ。
   */
  dbEarlyExitMode?: DbEarlyExitMode;
  /**
   * 想定利回り（年率 %）。
   * 例: 3 → 年 3%。
   */
  expectedReturnRatePct: number;
  /** 積立期間の開始年齢 */
  startAge: number;
  startMonth: number;
  endMode: SavingsEndMode;
  endAge: number;
  endMonth: number;
  /** NISA のみ: 既に活用中かこれからか */
  nisaUtilization?: NisaUtilization;
  /**
   * NISA / 特定口座: 投資元本（万円）— 買付済みの累計（簿価）。
   * 特定口座の売却益税の原価、NISA 生涯枠の使用済みに使用する。
   */
  principalMan?: number;
  /**
   * NISA / 特定口座: 評価方法（運用益を直接入力 or 現在の利回りを入力）
   */
  nisaValuationMode?: NisaValuationMode;
  /** NISA / 特定口座: 運用益（万円）。nisaValuationMode === 'gains' のとき */
  gainsMan?: number;
  /**
   * NISA / 特定口座: 現在の利回り（累積 %）。
   * nisaValuationMode === 'rate' のとき、元本に対する評価額算出に使用。
   */
  nisaCurrentReturnRatePct?: number;
  /** 特定口座のみ: 既に活用中かこれからか */
  taxableUtilization?: TaxableUtilization;
  /**
   * NISA / 特定口座: 取崩し（売却）方法。
   * 未設定時は取崩しなし。
   */
  withdrawalMode?: SavingsWithdrawalMode;
  /**
   * NISA / 特定口座: 取崩し額（万円）。
   * once … 一括額 / drawdown … 月額（資産÷年数÷12）
   */
  withdrawalMan?: number;
  /**
   * drawdown のみ: 取崩年数。
   * 運用資産見込みをこの年数で割って月額・年額を算出する。
   */
  withdrawalYears?: number;
  /** NISA / 特定口座: 取崩し開始年齢 */
  withdrawalStartAge?: number;
  withdrawalStartMonth?: number;
  /** NISA / 特定口座: 取崩し終了（一生涯 or 年齢指定） */
  withdrawalEndMode?: SavingsEndMode;
  withdrawalEndAge?: number;
  withdrawalEndMonth?: number;
  /**
   * 定期預金のみ: 預入期間（年）。1〜10。
   * 満期 = 預入開始（startAge/startMonth）＋ termYears。
   * 未設定時は 1 年として扱う。
   */
  termYears?: number;
  /**
   * iDeCo のみ: 加入区分（手動選択）。
   * 未設定時は積立開始時点の Q7 職歴から自動判定。
   */
  idecoOccupancy?: IdecoOccupancy;
  /**
   * iDeCo のみ: 企業型DC加入のキャッシュ。
   * 真実源は同一メンバーの `category === 'dc'` 口座の有無。同期で更新する。
   */
  hasCorporateDc?: boolean;
  /**
   * iDeCo のみ: DB（確定給付）加入のキャッシュ。
   * 真実源は同一メンバーの `category === 'db'` 口座の有無。同期で更新する。
   * 公務員は共済相当として既定であり（口座作成で表現）。
   */
  hasDb?: boolean;
  /**
   * DB のみ: 他制度掛金相当額（万円・月額）。UIでは「DBの月額掛金」と併記。
   * 企業型DCの拠出枠・iDeCo残余上限の控除に使用。未設定時は代表値 2.75 万円。
   */
  otherSystemContributionMan?: number;
  /**
   * DB のみ: 加入期間の入力方法（会社退職金の勤続年数と同型）。
   * 退職所得控除の加入年数に使用。未設定時は years。
   */
  dbEnrollmentMode?: DbEnrollmentMode;
  /** DB のみ: dbEnrollmentMode === 'years' の加入年数 */
  dbEnrollmentYears?: number;
  /** DB のみ: dbEnrollmentMode === 'period' の加入開始 */
  dbEnrollmentStartAge?: number;
  dbEnrollmentStartMonth?: number;
  /** DB のみ: dbEnrollmentMode === 'period' の加入終了 */
  dbEnrollmentEndAge?: number;
  dbEnrollmentEndMonth?: number;
  /**
   * iDeCo 年金受取のみ: 期間の指定方法。
   * - years … withdrawalYears（5〜20年）
   * - until_age … withdrawalEndAge/Month（受給完了年齢）
   * 未設定時は years。
   */
  idecoAnnuityPeriodMode?: IdecoAnnuityPeriodMode;
  /**
   * iDeCo / 企業型DC: 過去の積み立てを別途入力するか。
   * true のとき past* フィールドを使う。未設定は false（移行処理あり）。
   */
  pastContributionEnabled?: boolean;
  /** 過去積み立て: 積立額から推計 / 現在残高を直接 */
  pastContributionInputMode?: 'amount' | 'balance';
  /**
   * 企業型DC のみ: 過去積み立て区間（職歴／掛金水準ごと）。
   * amount モードの残高推計・加入年数の真実源。iDeCo は使わない。
   */
  pastContributionSegments?: SavingsPastContributionSegment[];
  /** iDeCo 用（DC は移行元）。過去積立開始 */
  pastStartAge?: number;
  pastStartMonth?: number;
  /** 同期時に現在（今月）以下へクランプ（編集可・上限のみ） */
  pastEndAge?: number;
  pastEndMonth?: number;
  pastExpectedReturnRatePct?: number;
  pastContributionMode?: SavingsContributionMode;
  /** 過去の積立額（万円）。iDeCo amount モード。DCは移行元 */
  pastContributionMan?: number;
  /** 試算開始時点の残高（万円）。balance モード（移換など） */
  pastBalanceMan?: number;
}

export type SavingsByMember = Record<string, SavingsEntry[]>;

export interface SavingsState {
  byMember: SavingsByMember;
}
